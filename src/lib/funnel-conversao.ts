// Cálculo de SQL/RA/RR/Contrato Enviado/Contrato Assinado usando o histórico REAL de
// entrada e saída de etapa do PipeRun (endpoint /stageHistories) — não created_at do
// negócio + etapa atual (ver leads-recentes.ts::funnelFlags, a forma antiga/errada
// usada até aqui pelo Funil de Marketing).
//
// Por que isso existe: um negócio criado há meses mas que só virou SQL esta semana não
// aparecia em nenhum relatório por período, porque o filtro era por created_at (antigo).
// Confirmado com dado real: 60% dos negócios abertos em EXPANSÃO CLOSER têm created_at
// há mais de 30 dias — qualquer range de 30 dias ou menos invisibilizava a maioria do
// Closer ativo. Aqui, cada linha do histórico tem sua PRÓPRIA data de entrada/saída na
// etapa, então um negócio antigo que avançou esta semana é contado esta semana, não na
// semana (distante) em que foi criado.
//
// Contagem BRUTA por etapa nomeada, sem dedupe por negócio — mesma lógica do relatório
// nativo "Taxa de Conversão" do PipeRun (cada linha de stageHistories conta 1, mesmo
// que o negócio reentre na etapa mais de uma vez no período). Uma 1ª versão desta
// função tentava ser "esperta" (etapa cumulativa entre funis, 1 contagem por negócio) —
// isso divergia do PipeRun (deu 22 aqui vs. 20/16 na tela). Contagem bruta por etapa
// validada exata contra o relatório nativo: SQL do Pré Vendas em 03/09–09/09 = entrada
// 20, saída 16 — bateu igual, dígito a dígito.
import {
  fetchDealsByIds,
  fetchPipelines,
  fetchStageEntradasInRange,
  fetchStageSaidasInRange,
  fetchStages,
  isPipeRunConfigured,
  type PipeRunStageHistory,
} from "@/lib/piperun-client";
import {
  ORIGIN_LABELS,
  STAGE_CONTRATO,
  STAGE_REUNIAO_AGENDADA,
  STAGE_SQL,
  STAGE_VENDA,
  type DateRange,
} from "@/lib/leads-recentes";

// Nome literal da etapa -> métrica. Cada etapa mapeia pra NO MÁXIMO uma métrica (são
// conceitos distintos no funil, não cumulativos) — diferente da 1ª versão, que também
// somava "qualquer etapa do Closer" em SQL/RA/RR ao mesmo tempo.
//
// Funil ABF não tem etapa chamada "Reunião Agendada" — o equivalente lá se chama
// "Atendimento Agendada" (ver stages reais do pipeline_id 104843), mesmo conceito.
// "Reunião Realizada" é a etapa literal de ENTRADA no funil Expansão Closer.
const STAGE_NAME_TO_METRIC: Record<string, FunnelMetric> = {
  [STAGE_SQL.toUpperCase()]: "sql",
  [STAGE_REUNIAO_AGENDADA.toUpperCase()]: "reuniaoAgendada",
  ["ATENDIMENTO AGENDADA"]: "reuniaoAgendada",
  ["REUNIÃO REALIZADA"]: "reuniaoRealizada",
  [STAGE_CONTRATO.toUpperCase()]: "contratoEnviado",
  [STAGE_VENDA.toUpperCase()]: "contratoAssinado",
};

export type FunnelMetric =
  "sql" | "reuniaoAgendada" | "reuniaoRealizada" | "contratoEnviado" | "contratoAssinado";

export interface FunnelStageEvent {
  dealId: number;
  metric: FunnelMetric;
  direction: "entrada" | "saida";
  /** YYYY-MM-DD (Brasília) — dia da entrada ou saída real na etapa (não created_at). */
  day: string;
  pipelineName: string;
  /** Mesmo rótulo de LeadRecente.origin — permite reaproveitar channelFor() do Funil
   * de Marketing sem duplicar a lógica de canal. */
  origin: string;
}

interface StageMeta {
  pipelineName: string;
  stageName: string;
}

function toEvents(
  rows: PipeRunStageHistory[],
  dateField: "in_date" | "out_date",
  stageMeta: Map<number, StageMeta>,
  direction: "entrada" | "saida",
  originByDealId: Map<number, string>,
): FunnelStageEvent[] {
  const events: FunnelStageEvent[] = [];
  for (const row of rows) {
    const meta = stageMeta.get(row.in_stage_id);
    if (!meta) continue; // etapa de um funil fora do filtro pedido
    const metric = STAGE_NAME_TO_METRIC[meta.stageName.toUpperCase()];
    if (!metric) continue; // etapa sem métrica correspondente (ex.: "Tentativa de contato 3")
    const rawDate = row[dateField];
    if (!rawDate) continue;
    events.push({
      dealId: row.deal_id,
      metric,
      direction,
      day: rawDate.slice(0, 10),
      pipelineName: meta.pipelineName,
      origin: originByDealId.get(row.deal_id) ?? "Outra origem",
    });
  }
  return events;
}

/** Carrega os eventos de funil (SQL/RA/RR/Contrato), entrada E saída, pro range e
 * funis informados — 1 linha por movimentação real, sem dedupe (mesma contagem bruta
 * do relatório nativo "Taxa de Conversão" do PipeRun). `pipelineNames` vazio = todos os
 * funis existentes (mesma semântica do resto da tela). */
export async function loadFunnelStageEvents(
  range: DateRange,
  pipelineNames: string[],
): Promise<FunnelStageEvent[]> {
  if (!isPipeRunConfigured()) return [];

  const [entradaRows, saidaRows, pipelines] = await Promise.all([
    fetchStageEntradasInRange(range.from, range.to),
    fetchStageSaidasInRange(range.from, range.to),
    fetchPipelines(),
  ]);

  const wantedUpper = new Set(pipelineNames.map((p) => p.toUpperCase()));
  const pipelineIdsToLoad =
    wantedUpper.size > 0
      ? pipelines.filter((p) => wantedUpper.has(p.name.toUpperCase())).map((p) => p.id)
      : pipelines.map((p) => p.id);

  const pipelineNameById = new Map(pipelines.map((p) => [p.id, p.name] as const));
  const stagesByPipeline = await Promise.all(pipelineIdsToLoad.map((id) => fetchStages(id)));
  const stageMeta = new Map<number, StageMeta>();
  for (const stages of stagesByPipeline) {
    for (const s of stages) {
      stageMeta.set(s.id, {
        pipelineName: pipelineNameById.get(s.pipeline_id) ?? "",
        stageName: s.name,
      });
    }
  }

  // Origem/UTM pro canal — buscado por lote de id porque o negócio pode ter sido
  // CRIADO fora do range selecionado (é literalmente o motivo de essa função existir).
  const dealIds = Array.from(new Set([...entradaRows, ...saidaRows].map((r) => r.deal_id)));
  const deals = await fetchDealsByIds(dealIds);
  const originByDealId = new Map(
    deals.map(
      (d) => [d.id, (d.origin_id && ORIGIN_LABELS[d.origin_id]) || "Outra origem"] as const,
    ),
  );

  return [
    ...toEvents(entradaRows, "in_date", stageMeta, "entrada", originByDealId),
    ...toEvents(saidaRows, "out_date", stageMeta, "saida", originByDealId),
  ];
}
