// Monta o texto (mrkdwn do Slack) do relatório comercial. Tabelas em bloco de código para
// alinhar as colunas no celular e no desktop.

import type { CallMetricRow } from "@/lib/call-metrics";
import {
  formatarDiaMes,
  nomeDoDia,
  tituloPeriodo,
  type Periodo,
} from "@/lib/relatorio-funil-b2b/periodo";
import {
  ETAPA,
  FUNIS,
  diasSemLigacao,
  duracao,
  entradasPorEtapa,
  porDono,
  principaisMotivos,
  resumirFechados,
  resumirLigacoes,
  type Contagem,
  type FunilChave,
  type Janela,
} from "./calculo";
import type { DadosPipeRun } from "./coleta";

const INDISPONIVEL = "_indisponível hoje (falha ao buscar os dados)._";

function tabela(cabecalho: string[], linhas: string[][]): string {
  const todas = [cabecalho, ...linhas];
  const larg = cabecalho.map((_, i) => Math.max(...todas.map((l) => (l[i] ?? "").length)));
  const fmt = (l: string[]) =>
    l.map((c, i) => (i === 0 ? c.padEnd(larg[i]!) : c.padStart(larg[i]!))).join("  ");
  return "```\n" + todas.map(fmt).join("\n") + "\n```";
}

/** Soma linha a linha (para a linha Total). */
function somar<K extends string>(linhas: Array<Record<K, Contagem>>): Record<K, Contagem> {
  const out = {} as Record<K, Contagem>;
  for (const l of linhas) {
    for (const k of Object.keys(l) as K[]) {
      out[k] = {
        periodo: (out[k]?.periodo ?? 0) + l[k].periodo,
        mes: (out[k]?.mes ?? 0) + l[k].mes,
      };
    }
  }
  return out;
}

const pm = (c: Contagem) => `${c.periodo} (${c.mes})`;
const curto = (nome: string, max = 16) => (nome.length > max ? `${nome.slice(0, max - 1)}…` : nome);

export function rotuloPeriodo(p: Periodo): string {
  return p.fimDeSemana ? "Fim de semana" : "Ontem";
}

function secaoLigacoes(linhas: CallMetricRow[], p: Periodo, mes: Janela): string {
  const per = resumirLigacoes(linhas, p);
  const doMes = new Map(resumirLigacoes(linhas, mes).map((a) => [a.agente, a] as const));
  const faltando = diasSemLigacao(linhas, p.dias);
  const partes = ["*📞 Ligações (3C Plus)*"];
  if (faltando.length === p.dias.length && per.length === 0) {
    partes.push("_Nenhuma ligação registrada na 3C no período._");
  } else {
    if (faltando.length) {
      partes.push(
        `_Nenhuma ligação registrada na 3C em ${faltando.map(formatarDiaMes).join(", ")}._`,
      );
    }
    const agentes = [...new Set([...per.map((a) => a.agente), ...doMes.keys()])];
    partes.push(
      tabela(
        ["Agente", "Ligações", "Atendidas", "Falado", "Média", "Mês lig.", "Mês média"],
        agentes.map((nome) => {
          const a = per.find((x) => x.agente === nome);
          const m = doMes.get(nome);
          return [
            curto(nome),
            String(a?.ligacoes ?? 0),
            String(a?.conversas ?? 0),
            duracao(a?.segundosFalados ?? 0),
            duracao(a?.mediaSegundos ?? null),
            String(m?.ligacoes ?? 0),
            duracao(m?.mediaSegundos ?? null),
          ];
        }),
      ),
    );
    partes.push(
      "_Atendidas = ligação em que a agente falou com o lead. Média = tempo médio por ligação atendida._",
    );
  }
  return partes.join("\n");
}

function secaoPessoas(d: DadosPipeRun, p: Periodo, mes: Janela): string {
  const sdr = porDono(
    d.entradas.filter((e) => d.negocios.get(e.dealId)?.funil !== "closer"),
    d.negocios,
    {
      sql: [ETAPA.sqlInbound, ETAPA.sqlOutbound],
      agendada: [ETAPA.agendadaInbound, ETAPA.agendadaOutbound],
      noShow: [ETAPA.noShowInbound],
    },
    p,
    mes,
  );
  const closer = porDono(
    d.entradas.filter((e) => d.negocios.get(e.dealId)?.funil === "closer"),
    d.negocios,
    {
      prevista: [ETAPA.reuniaoPrevista],
      realizada: [ETAPA.reuniaoRealizada],
      noShow: [ETAPA.noShowCloser],
      roga: [ETAPA.rogaRealizado],
      doc: [ETAPA.documentacao],
      contrato: [ETAPA.contrato],
      venda: [ETAPA.venda],
    },
    p,
    mes,
  );
  const ordenar = <T>(m: Map<string, T>) => [...m].sort((a, b) => a[0].localeCompare(b[0]));
  return [
    `*👩‍💼 SDRs (PipeRun)* — ${rotuloPeriodo(p).toLowerCase()} (mês)`,
    sdr.size
      ? tabela(
          ["Pessoa", "SQL", "Agendadas", "No-show"],
          ordenar(sdr).map(([n, c]) => [curto(n), pm(c.sql), pm(c.agendada), pm(c.noShow)]),
        )
      : "_Nenhuma movimentação._",
    `*🤝 Closer (PipeRun)* — ${rotuloPeriodo(p).toLowerCase()} (mês)`,
    closer.size
      ? tabela(
          ["Pessoa", "Previstas", "Realizadas", "No-show", "RoGa", "Doc.", "Contrato", "Venda"],
          [...ordenar(closer), ["Total", somar([...closer.values()])] as const].map(([n, c]) => [
            curto(n),
            pm(c.prevista),
            pm(c.realizada),
            pm(c.noShow),
            pm(c.roga),
            pm(c.doc),
            pm(c.contrato),
            pm(c.venda),
          ]),
        )
      : "_Nenhuma movimentação._",
    "_Reuniões realizadas = cards que entraram em “Reunião Realizada”. A pessoa é o dono atual do card: card que ainda está no nome da SDR aparece com o nome dela._",
  ].join("\n");
}

function secaoFunis(d: DadosPipeRun, p: Periodo, mes: Janela): string {
  const partes = [`*📊 Entradas por etapa* — ${rotuloPeriodo(p).toLowerCase()} / mês`];
  for (const k of Object.keys(FUNIS) as FunilChave[]) {
    const linhas = entradasPorEtapa(d.entradas, d.etapas[k], p, mes);
    partes.push(`_${FUNIS[k].nome}_`);
    partes.push(
      tabela(
        ["Etapa", rotuloPeriodo(p), "Mês"],
        linhas.map((l) => [curto(l.etapa, 28), String(l.periodo), String(l.mes)]),
      ),
    );
  }
  return partes.join("\n");
}

function secaoFechados(d: DadosPipeRun, p: Periodo): string {
  const r = resumirFechados(d.fechados, p);
  const motivos = principaisMotivos(d.fechados, p);
  return [
    `*✅❌ Ganhos e perdidos* — ${rotuloPeriodo(p).toLowerCase()} (mês)`,
    tabela(
      ["Funil", "Ganhos", "Perdidos"],
      r.map((x) => [FUNIS[x.funil].nome, pm(x.ganhos), pm(x.perdidos)]),
    ),
    "_No Inbound/Outbound, “ganho” = lead passado para o closer. Venda de verdade é o ganho do Closer._",
    motivos.length
      ? `*Principais motivos de perda (${rotuloPeriodo(p).toLowerCase()}):*\n` +
        motivos.map((m) => `• ${m.motivo}: ${m.total}`).join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function destaques(
  d: DadosPipeRun | null,
  ligacoes: CallMetricRow[] | null,
  p: Periodo,
  mes: Janela,
): string {
  const itens: string[] = [];
  if (d) {
    const conta = (ids: number[], j: Janela) =>
      new Set(
        d.entradas
          .filter((e) => ids.includes(e.stageId) && e.dia >= j.from && e.dia <= j.to)
          .map((e) => e.dealId),
      ).size;
    const c = (ids: number[]) => `*${conta(ids, p)}* (mês ${conta(ids, mes)})`;
    itens.push(`• Leads novos: ${c([ETAPA.novoLeadInbound, ETAPA.levantouMaoOutbound])}`);
    itens.push(`• SQL: ${c([ETAPA.sqlInbound, ETAPA.sqlOutbound])}`);
    itens.push(`• Reuniões agendadas: ${c([ETAPA.agendadaInbound, ETAPA.agendadaOutbound])}`);
    itens.push(`• Reuniões realizadas: ${c([ETAPA.reuniaoRealizada])}`);
    itens.push(`• Vendas: ${c([ETAPA.venda])}`);
    const perdidos = d.fechados.filter((f) => !f.ganho);
    const noP = perdidos.filter((f) => f.dia >= p.from && f.dia <= p.to).length;
    itens.push(`• Negócios perdidos: *${noP}* (mês ${perdidos.length})`);
  }
  if (ligacoes) {
    const tot = resumirLigacoes(ligacoes, p).reduce(
      (s, a) => ({ l: s.l + a.ligacoes, c: s.c + a.conversas, seg: s.seg + a.segundosFalados }),
      { l: 0, c: 0, seg: 0 },
    );
    itens.push(
      `• Ligações: *${tot.l}*, atendidas ${tot.c}, tempo médio ${duracao(tot.c ? tot.seg / tot.c : null)}`,
    );
  }
  return itens.length ? `*Resumo*\n${itens.join("\n")}` : "";
}

export function montarMensagem(
  p: Periodo,
  pipe: DadosPipeRun | null,
  ligacoes: CallMetricRow[] | null,
): string {
  const mes: Janela = { from: p.mesFrom, to: p.to };
  const titulo = p.fimDeSemana
    ? `*Comercial Expansão — ${tituloPeriodo(p)}*`
    : `*Comercial Expansão — ${tituloPeriodo(p)} (${nomeDoDia(p.to)})*`;
  return [
    titulo,
    `_Números ${p.fimDeSemana ? "do fim de semana" : "de ontem"}; entre parênteses, o acumulado do mês (${formatarDiaMes(mes.from)} a ${formatarDiaMes(mes.to)})._`,
    destaques(pipe, ligacoes, p, mes),
    ligacoes ? secaoLigacoes(ligacoes, p, mes) : `*📞 Ligações (3C Plus)*\n${INDISPONIVEL}`,
    pipe ? secaoPessoas(pipe, p, mes) : `*PipeRun*\n${INDISPONIVEL}`,
    pipe ? secaoFechados(pipe, p) : "",
    pipe ? secaoFunis(pipe, p, mes) : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
