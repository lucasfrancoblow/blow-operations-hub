// Cálculo do relatório: a partir dos eventos já classificados por canal e do gasto por dia,
// monta o modelo que o template renderiza. Função pura (sem rede, sem relógio).

import {
  CANAIS_GERAL,
  CANAL_OUTBOUND,
  METRICAS,
  contagensVazias,
  type Canal,
  type Contagens,
  type EventoFunil,
  type Metrica,
} from "./tipos";
import { diasEntre, formatarDiaMes, type Periodo } from "./periodo";
import {
  calcCusto,
  calcTaxa,
  tomTaxa,
  tomVariacao,
  variacaoPct,
  type Taxa,
  type Tom,
  type TomTaxa,
} from "./variacao";
import { investimentoGeral, somarGasto, type GastoDia, type GastoJanela } from "./gasto";
import { moeda } from "./formato";

export interface EntradaRelatorio {
  periodo: Periodo;
  eventos: EventoFunil[];
  excluidos: Array<{ day: string; motivo: "teste" | "bounce" }>;
  /** null = fonte de gasto indisponível (falha ao consultar). */
  gasto: Map<string, GastoDia> | null;
  /** false quando a planilha Backup Leads não pôde ser lida. */
  backupDisponivel: boolean;
}

export interface LinhaFunil {
  rotulo: string;
  tipoValor: "moeda" | "inteiro";
  ontem: number | null;
  media7: number | null;
  mes: number | null;
  variacao: number | null;
  tom: Tom;
}

export interface LinhaCusto {
  rotulo: string;
  casas: 0 | 2;
  ontem: number | null;
  media7: number | null;
  mes: number | null;
}

export interface LinhaTaxa {
  rotulo: string;
  benchmark: number;
  ontem: Taxa;
  mes: Taxa;
  tomOntem: TomTaxa;
  tomMes: TomTaxa;
}

export interface LinhaCanal {
  canal: Canal | "Geral";
  investimento: number | null;
  contagens: Contagens;
  cpl: number | null;
  custoSql: number | null;
  /** Outbound: fora do Geral. */
  foraDoGeral: boolean;
}

export interface Cartao {
  rotulo: string;
  tipoValor: "moeda" | "inteiro";
  valor: number | null;
  media7: number | null;
  variacao: number | null;
  tom: Tom;
}

export interface Relatorio {
  periodo: Periodo;
  cartoes: Cartao[];
  funil: LinhaFunil[];
  custos: LinhaCusto[];
  taxas: LinhaTaxa[];
  canais: LinhaCanal[];
  destaques: string[];
  avisos: string[];
}

const ROTULOS: Record<Metrica, string> = {
  leads: "Leads",
  sql: "SQL",
  agendada: "Reunião agendada",
  realizada: "Reunião realizada",
  rogaMarcado: "RoGa marcado",
  rogaRealizado: "RoGa realizado",
  documentacao: "Documentação",
  contrato: "Contrato",
  venda: "Venda",
};

const TAXAS: Array<{ rotulo: string; num: Metrica; den: Metrica; benchmark: number }> = [
  { rotulo: "Lead → SQL", num: "sql", den: "leads", benchmark: 0.25 },
  { rotulo: "SQL → Agendada", num: "agendada", den: "sql", benchmark: 0.9 },
  { rotulo: "Agendada → Realizada", num: "realizada", den: "agendada", benchmark: 0.6 },
  { rotulo: "Realizada → RoGa marcado", num: "rogaMarcado", den: "realizada", benchmark: 0.5 },
  { rotulo: "RoGa marc. → RoGa real.", num: "rogaRealizado", den: "rogaMarcado", benchmark: 0.75 },
  {
    rotulo: "RoGa real. → Documentação",
    num: "documentacao",
    den: "rogaRealizado",
    benchmark: 0.4,
  },
  { rotulo: "Documentação → Contrato", num: "contrato", den: "documentacao", benchmark: 0.5 },
  { rotulo: "Contrato → Venda", num: "venda", den: "contrato", benchmark: 0.75 },
  { rotulo: "Lead → Venda", num: "venda", den: "leads", benchmark: 0.01 },
];

export function somarContagens(a: Contagens, b: Contagens): Contagens {
  const out = contagensVazias();
  for (const m of METRICAS) out[m] = a[m] + b[m];
  return out;
}

/** Entradas de um canal nos dias informados. */
export function contar(eventos: EventoFunil[], canal: Canal, dias: Set<string>): Contagens {
  const c = contagensVazias();
  for (const e of eventos) {
    if (e.canal === canal && dias.has(e.day)) c[e.metrica] += 1;
  }
  return c;
}

/** Geral = soma dos quatro canais (Outbound fora). */
export function contarGeral(eventos: EventoFunil[], dias: Set<string>): Contagens {
  return CANAIS_GERAL.reduce(
    (acc, canal) => somarContagens(acc, contar(eventos, canal, dias)),
    contagensVazias(),
  );
}

function escalar(c: Contagens, fator: number): Record<Metrica, number> {
  const out = contagensVazias();
  for (const m of METRICAS) out[m] = c[m] * fator;
  return out;
}

export function montarRelatorio(entrada: EntradaRelatorio): Relatorio {
  const { periodo, eventos } = entrada;
  const nDias = periodo.dias.length;
  const diasPeriodo = new Set(periodo.dias);
  const diasMedia = diasEntre(periodo.media7From, periodo.media7To);
  const diasMes = diasEntre(periodo.mesFrom, periodo.to);
  const setMedia = new Set(diasMedia);
  const setMes = new Set(diasMes);
  // Média de 7 dias por dia, escalada para o tamanho do período (2 dias na segunda).
  const fatorMedia = nDias / diasMedia.length;

  const geral = {
    ontem: contarGeral(eventos, diasPeriodo),
    media: escalar(contarGeral(eventos, setMedia), fatorMedia),
    mes: contarGeral(eventos, setMes),
  };

  // Gasto.
  const gastoIndisponivel = entrada.gasto === null;
  const porDia = entrada.gasto ?? new Map<string, GastoDia>();
  const gOntem = somarGasto(porDia, periodo.dias, true);
  const gMedia = somarGasto(porDia, diasMedia, false);
  const gMes = somarGasto(porDia, diasMes, false);
  const invGeral = {
    ontem: gastoIndisponivel ? null : investimentoGeral(gOntem),
    media: gastoIndisponivel ? null : mediaEscalada(investimentoGeral(gMedia), fatorMedia),
    mes: gastoIndisponivel ? null : investimentoGeral(gMes),
  };

  // Funil do dia (10 linhas).
  const linhaInvest: LinhaFunil = {
    rotulo: "Investimento",
    tipoValor: "moeda",
    ontem: invGeral.ontem,
    media7: invGeral.media,
    mes: invGeral.mes,
    variacao: variacaoPct(invGeral.ontem, invGeral.media),
    tom: "neutro",
  };
  const funil: LinhaFunil[] = [
    linhaInvest,
    ...METRICAS.map((m): LinhaFunil => {
      const v = variacaoPct(geral.ontem[m], geral.media[m]);
      return {
        rotulo: ROTULOS[m],
        tipoValor: "inteiro",
        ontem: geral.ontem[m],
        media7: geral.media[m],
        mes: geral.mes[m],
        variacao: v,
        tom: tomVariacao(v, "volume"),
      };
    }),
  ];

  // Custos.
  const custo = (inv: number | null, m: Metrica, c: Record<Metrica, number>) =>
    calcCusto(inv, c[m]);
  const mediaInvSoma = gastoIndisponivel ? null : investimentoGeral(gMedia);
  const custos: LinhaCusto[] = (
    [
      ["CPL", "leads", 2],
      ["Custo por SQL", "sql", 0],
      ["Custo por reunião agendada", "agendada", 0],
      ["Custo por reunião realizada", "realizada", 0],
      ["CAC", "venda", 0],
    ] as const
  ).map(([rotulo, m, casas]) => ({
    rotulo,
    casas,
    ontem: custo(invGeral.ontem, m, geral.ontem),
    // Média e mês = razão de somas (investimento total / volume total da janela).
    media7: custo(mediaInvSoma, m, escalar(contarGeral(eventos, setMedia), 1)),
    mes: custo(invGeral.mes, m, geral.mes),
  }));

  // Taxas.
  const taxas: LinhaTaxa[] = TAXAS.map((t) => {
    const ontem = calcTaxa(geral.ontem[t.num], geral.ontem[t.den]);
    const mes = calcTaxa(geral.mes[t.num], geral.mes[t.den]);
    return {
      rotulo: t.rotulo,
      benchmark: t.benchmark,
      ontem,
      mes,
      tomOntem: tomTaxa(ontem, t.benchmark),
      tomMes: tomTaxa(mes, t.benchmark),
    };
  });

  // Canais.
  const investCanal = (canal: Canal): number | null => {
    if (gastoIndisponivel) return canal === "Orgânico" || canal === CANAL_OUTBOUND ? 0 : null;
    switch (canal) {
      case "Facebook Ads":
        return gOntem.facebook;
      case "Google":
        return gOntem.google;
      case "Rapha Mattos":
        return gOntem.rapha;
      default:
        return 0;
    }
  };
  const linhaCanal = (canal: Canal): LinhaCanal => {
    const contagens = contar(eventos, canal, diasPeriodo);
    const investimento = investCanal(canal);
    return {
      canal,
      investimento,
      contagens,
      cpl: calcCusto(investimento, contagens.leads),
      custoSql: calcCusto(investimento, contagens.sql),
      foraDoGeral: canal === CANAL_OUTBOUND,
    };
  };
  const linhasGeral: LinhaCanal = {
    canal: "Geral",
    investimento: invGeral.ontem,
    contagens: geral.ontem,
    cpl: calcCusto(invGeral.ontem, geral.ontem.leads),
    custoSql: calcCusto(invGeral.ontem, geral.ontem.sql),
    foraDoGeral: false,
  };
  const canais: LinhaCanal[] = [
    ...CANAIS_GERAL.map(linhaCanal),
    linhasGeral,
    linhaCanal(CANAL_OUTBOUND),
  ];

  // Cartões.
  const cartao = (rotulo: string, linha: LinhaFunil): Cartao => ({
    rotulo,
    tipoValor: linha.tipoValor,
    valor: linha.ontem,
    media7: linha.media7,
    variacao: linha.variacao,
    tom: linha.tom,
  });
  const linhaPorRotulo = (r: string) => funil.find((l) => l.rotulo === r)!;
  const cartoes: Cartao[] = [
    cartao("Investimento", linhaInvest),
    cartao("Leads", linhaPorRotulo("Leads")),
    cartao("SQL", linhaPorRotulo("SQL")),
    cartao("Reuniões realizadas", linhaPorRotulo("Reunião realizada")),
    cartao("Vendas", linhaPorRotulo("Venda")),
  ];

  const relatorio: Relatorio = {
    periodo,
    cartoes,
    funil,
    custos,
    taxas,
    canais,
    destaques: [],
    avisos: [],
  };
  relatorio.destaques = gerarDestaques(relatorio, gOntem, gastoIndisponivel);
  relatorio.avisos = gerarAvisos(entrada, gOntem, gastoIndisponivel);
  return relatorio;
}

function mediaEscalada(soma: number | null, fator: number): number | null {
  // `soma` é o total dos 7 dias; média por dia × tamanho do período = soma/7*nDias = soma/diasMedia*nDias.
  return soma === null ? null : soma * fator;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1).replace(".", ",")}%`;
}

function comparar(rotulo: string, dia: number, media: number): string | null {
  if (media === 0 && dia === 0) return null;
  if (dia > media)
    return `${rotulo} acima da média de 7 dias (${fmtNum(dia)} contra ${fmtNum(media)})`;
  if (dia < media)
    return `${rotulo} abaixo da média de 7 dias (${fmtNum(dia)} contra ${fmtNum(media)})`;
  return `${rotulo} em linha com a média de 7 dias (${fmtNum(dia)})`;
}

function gerarDestaques(r: Relatorio, g: GastoJanela, gastoIndisponivel: boolean): string[] {
  const out: string[] = [];
  const linha = (rot: string) => r.funil.find((l) => l.rotulo === rot)!;
  const leads = linha("Leads");
  const sql = linha("SQL");
  if (leads.ontem !== null && leads.media7 !== null && sql.ontem !== null && sql.media7 !== null) {
    const acima = leads.ontem >= leads.media7 && sql.ontem >= sql.media7;
    const abaixo = leads.ontem <= leads.media7 && sql.ontem <= sql.media7;
    if ((acima || abaixo) && leads.ontem !== leads.media7) {
      out.push(
        `Leads e SQL ${acima ? "acima" : "abaixo"} da média de 7 dias (${fmtNum(leads.ontem)} contra ${fmtNum(leads.media7)} e ${fmtNum(sql.ontem)} contra ${fmtNum(sql.media7)}).`,
      );
    } else {
      const partes = [
        comparar("Leads", leads.ontem, leads.media7),
        comparar("SQL", sql.ontem, sql.media7),
      ].filter(Boolean);
      if (partes.length) out.push(`${partes.join("; ")}.`);
    }
  }
  const fundo = ["RoGa realizado", "Contrato", "Venda"].map(linha);
  const zerados = fundo.filter((l) => l.ontem === 0).map((l) => l.rotulo.toLowerCase());
  if (zerados.length === fundo.length) {
    out.push("Nenhum RoGa realizado, contrato ou venda no período.");
  } else {
    const feitos = fundo.filter((l) => (l.ontem ?? 0) > 0);
    if (feitos.length) {
      out.push(
        `No fundo do funil: ${feitos.map((l) => `${l.ontem} ${l.rotulo.toLowerCase()}`).join(", ")}.`,
      );
    }
  }
  const leadSql = r.taxas[0]!;
  if (leadSql.mes.valor !== null && leadSql.mes.denominador >= 5) {
    const rel = leadSql.mes.valor >= leadSql.benchmark ? "acima" : "abaixo";
    out.push(
      `No mês, Lead → SQL está em ${pct(leadSql.mes.valor)}, ${rel} do benchmark de ${Math.round(leadSql.benchmark * 100)}%.`,
    );
  }
  if (!gastoIndisponivel && g.diasSemMeta.length === 0) {
    const total = g.metaForm + g.metaLp + g.metaOutro;
    if (total > 0) {
      out.push(
        `Meta Ads: ${moeda(g.metaForm)} em lead nativo (FORM) e ${moeda(g.metaLp)} em landing page (LP)${g.metaOutro > 0 ? `, ${moeda(g.metaOutro)} em outras campanhas` : ""}.`,
      );
    }
  }
  return out;
}

function gerarAvisos(
  entrada: EntradaRelatorio,
  g: GastoJanela,
  gastoIndisponivel: boolean,
): string[] {
  const avisos: string[] = [];
  const { periodo } = entrada;
  if (periodo.fimDeSemana) {
    avisos.push(
      "Segunda-feira: o período soma sábado e domingo; a média de 7 dias é multiplicada por 2 para comparar.",
    );
  }
  if (gastoIndisponivel) {
    avisos.push(
      "Investimento indisponível (falha ao consultar a base de anúncios): custos, CPL e CAC ficam sem dado.",
    );
  } else {
    if (g.diasSemMeta.length) {
      avisos.push(
        `Sem dados de investimento do Meta em ${g.diasSemMeta.map(formatarDiaMes).join(", ")}: investimento e custos sem dado.`,
      );
    }
    if (g.diasSemGoogle.length) {
      avisos.push(
        `Sem dados de investimento do Google em ${g.diasSemGoogle.map(formatarDiaMes).join(", ")}: investimento e custos sem dado.`,
      );
    }
    if (g.excluido !== null && g.excluido > 0) {
      avisos.push(`Gasto de live/webinar fora dos canais: ${moeda(g.excluido)}.`);
    }
  }
  const dias = new Set(periodo.dias);
  const semOrigem = new Set(
    entrada.eventos.filter((e) => e.semOrigem && dias.has(e.day)).map((e) => e.dealId),
  ).size;
  if (semOrigem > 0) {
    avisos.push(
      `${semOrigem} ${semOrigem === 1 ? "card sem origem identificada, classificado" : "cards sem origem identificada, classificados"} como Orgânico.`,
    );
  }
  if (!entrada.backupDisponivel) {
    avisos.push(
      "Planilha Backup Leads indisponível: canal definido pelo UTM/origem do card no PipeRun.",
    );
  }
  const testes = entrada.excluidos.filter((e) => dias.has(e.day) && e.motivo === "teste").length;
  const bounces = entrada.excluidos.filter((e) => dias.has(e.day) && e.motivo === "bounce").length;
  if (testes + bounces > 0) {
    const partes: string[] = [];
    if (testes) partes.push(`${testes} ${testes === 1 ? "card de teste" : "cards de teste"}`);
    if (bounces)
      partes.push(
        `${bounces} ${bounces === 1 ? "movimentação errada" : "movimentações erradas"} (volta em menos de 2 min)`,
      );
    avisos.push(`Excluídos do período: ${partes.join(" e ")}.`);
  }
  avisos.push("Mês do relatório é de calendário e pode diferir da aba B2B | Mensal.");
  return avisos;
}
