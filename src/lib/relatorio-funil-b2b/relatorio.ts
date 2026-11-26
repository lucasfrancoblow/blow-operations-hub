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
import { calcCusto, calcTaxa, tomTaxa, type Taxa, type TomTaxa } from "./variacao";
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
  seteDias: number | null;
  mes: number | null;
}

export interface LinhaCusto {
  rotulo: string;
  casas: 0 | 2;
  ontem: number | null;
  seteDias: number | null;
  mes: number | null;
}

export interface LinhaTaxa {
  rotulo: string;
  benchmark: number;
  ontem: Taxa;
  seteDias: Taxa;
  mes: Taxa;
  tomOntem: TomTaxa;
  tomSete: TomTaxa;
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
  seteDias: number | null;
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

export function montarRelatorio(entrada: EntradaRelatorio): Relatorio {
  const { periodo, eventos } = entrada;
  const diasPeriodo = new Set(periodo.dias);
  const diasSete = diasEntre(periodo.seteDiasFrom, periodo.seteDiasTo);
  const diasMes = diasEntre(periodo.mesFrom, periodo.to);
  const setSete = new Set(diasSete);
  const setMes = new Set(diasMes);

  // Totais (não médias): ontem, últimos 7 dias até ontem e mês até ontem.
  const geral = {
    ontem: contarGeral(eventos, diasPeriodo),
    sete: contarGeral(eventos, setSete),
    mes: contarGeral(eventos, setMes),
  };

  // Gasto.
  const gastoIndisponivel = entrada.gasto === null;
  const porDia = entrada.gasto ?? new Map<string, GastoDia>();
  const gOntem = somarGasto(porDia, periodo.dias, true);
  const gSete = somarGasto(porDia, diasSete, false);
  const gMes = somarGasto(porDia, diasMes, false);
  const invGeral = {
    ontem: gastoIndisponivel ? null : investimentoGeral(gOntem),
    sete: gastoIndisponivel ? null : investimentoGeral(gSete),
    mes: gastoIndisponivel ? null : investimentoGeral(gMes),
  };

  // Funil do dia (10 linhas).
  const linhaInvest: LinhaFunil = {
    rotulo: "Investimento",
    tipoValor: "moeda",
    ontem: invGeral.ontem,
    seteDias: invGeral.sete,
    mes: invGeral.mes,
  };
  const funil: LinhaFunil[] = [
    linhaInvest,
    ...METRICAS.map((m): LinhaFunil => ({
      rotulo: ROTULOS[m],
      tipoValor: "inteiro",
      ontem: geral.ontem[m],
      seteDias: geral.sete[m],
      mes: geral.mes[m],
    })),
  ];

  // Custos.
  const custo = (inv: number | null, m: Metrica, c: Record<Metrica, number>) =>
    calcCusto(inv, c[m]);
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
    // 7 dias e mês = investimento total da janela / volume total da janela.
    seteDias: custo(invGeral.sete, m, geral.sete),
    mes: custo(invGeral.mes, m, geral.mes),
  }));

  // Taxas.
  const taxas: LinhaTaxa[] = TAXAS.map((t) => {
    const ontem = calcTaxa(geral.ontem[t.num], geral.ontem[t.den]);
    const seteDias = calcTaxa(geral.sete[t.num], geral.sete[t.den]);
    const mes = calcTaxa(geral.mes[t.num], geral.mes[t.den]);
    return {
      rotulo: t.rotulo,
      benchmark: t.benchmark,
      ontem,
      seteDias,
      mes,
      tomOntem: tomTaxa(ontem, t.benchmark),
      tomSete: tomTaxa(seteDias, t.benchmark),
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
    seteDias: linha.seteDias,
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

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1).replace(".", ",")}%`;
}

function gerarDestaques(r: Relatorio, g: GastoJanela, gastoIndisponivel: boolean): string[] {
  const out: string[] = [];
  const linha = (rot: string) => r.funil.find((l) => l.rotulo === rot)!;
  const leads = linha("Leads");
  const sql = linha("SQL");
  if (
    leads.ontem !== null &&
    leads.seteDias !== null &&
    sql.ontem !== null &&
    sql.seteDias !== null
  ) {
    const quando = r.periodo.fimDeSemana ? "No sábado e domingo" : "Ontem";
    out.push(
      `${quando}: ${fmtNum(leads.ontem)} leads e ${fmtNum(sql.ontem)} SQL; nos últimos 7 dias: ${fmtNum(leads.seteDias)} leads e ${fmtNum(sql.seteDias)} SQL.`,
    );
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
    avisos.push("Segunda-feira: o período soma sábado e domingo; os 7 dias vão até domingo.");
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
