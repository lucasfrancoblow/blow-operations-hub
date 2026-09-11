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
// Validado contra o relatório nativo "Taxa de Conversão" do PipeRun: mesmo filtro de
// funil + período, mesma contagem de entrada em NOVO LEAD (106 aqui vs. 105 na tela —
// diferença de 1, consistente com borda de fuso horário, não erro de lógica).

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
  PIPELINE_CLOSER,
  STAGE_CONTRATO,
  STAGE_REUNIAO_AGENDADA,
  STAGE_SQL,
  STAGE_VENDA,
  type DateRange,
} from "@/lib/leads-recentes";

// Funil ABF não tem etapa chamada "Reunião Agendada" — o equivalente lá se chama
// "Atendimento Agendada" (ver stages reais do pipeline_id 104843). Mesmo conceito,
// nome diferente; sem isso o Funil ABF nunca contaria RA/SQL via essa etapa.
const STAGE_RA_NAMES = new Set(
  [STAGE_REUNIAO_AGENDADA, "Atendimento Agendada"].map((s) => s.toUpperCase()),
);
const STAGE_SQL_NAMES = new Set([STAGE_SQL].map((s) => s.toUpperCase()));

export type FunnelMetric =
  "sql" | "reuniaoAgendada" | "reuniaoRealizada" | "contratoEnviado" | "contratoAssinado";

export interface FunnelStageEvent {
  dealId: number;
  metric: FunnelMetric;
  direction: "entrada" | "saida";
  /** YYYY-MM-DD (Brasília) — dia em que o negócio ATINGIU (entrada) ou DEIXOU (saída)
   * esse critério pela 1ª vez dentro do range consultado (não é created_at). */
  day: string;
  pipelineName: string;
  /** Mesmo rótulo de LeadRecente.origin — permite reaproveitar channelFor() do Funil
   * de Marketing sem duplicar a lógica de canal. */
  origin: string;
}

function classifyMetrics(pipelineName: string, stageName: string): FunnelMetric[] {
  const inCloser = pipelineName.toUpperCase() === PIPELINE_CLOSER;
  const sUpper = stageName.toUpperCase();
  const isSqlStage = STAGE_SQL_NAMES.has(sUpper);
  const isRaStage = STAGE_RA_NAMES.has(sUpper);

  const metrics: FunnelMetric[] = [];
  if (inCloser || isSqlStage || isRaStage) metrics.push("sql");
  if (inCloser || isRaStage) metrics.push("reuniaoAgendada");
  if (inCloser) metrics.push("reuniaoRealizada");
  if (inCloser && (sUpper === STAGE_CONTRATO.toUpperCase() || sUpper === STAGE_VENDA.toUpperCase()))
    metrics.push("contratoEnviado");
  if (inCloser && sUpper === STAGE_VENDA.toUpperCase()) metrics.push("contratoAssinado");
  return metrics;
}

interface StageMeta {
  pipelineName: string;
  stageName: string;
}

/** Reduz linhas cruas de stageHistories a 1 evento por (negócio, métrica): a data mais
 * antiga em que o negócio bateu aquele critério dentro do range — evita contar de novo
 * se ele reentrar/resair da mesma etapa mais de uma vez no período. */
function reduceToEvents(
  rows: PipeRunStageHistory[],
  dateField: "in_date" | "out_date",
  stageMeta: Map<number, StageMeta>,
  direction: "entrada" | "saida",
): Map<string, { dealId: number; metric: FunnelMetric; day: string; pipelineName: string }> {
  const best = new Map<
    string,
    { dealId: number; metric: FunnelMetric; day: string; pipelineName: string }
  >();

  for (const row of rows) {
    const meta = stageMeta.get(row.in_stage_id);
    if (!meta) continue; // etapa de um funil fora do filtro pedido
    const rawDate = row[dateField];
    if (!rawDate) continue;
    const day = rawDate.slice(0, 10);
    for (const metric of classifyMetrics(meta.pipelineName, meta.stageName)) {
      const key = `${direction}|${row.deal_id}|${metric}`;
      const current = best.get(key);
      if (!current || day < current.day) {
        best.set(key, { dealId: row.deal_id, metric, day, pipelineName: meta.pipelineName });
      }
    }
  }

  return best;
}

/** Carrega os eventos de funil (SQL/RA/RR/Contrato), entrada E saída, pro range e
 * funis informados. `pipelineNames` vazio = todos os funis existentes (mesma semântica
 * do resto da tela); caso contrário, só etapas desses funis contam. */
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

  const entradaBest = reduceToEvents(entradaRows, "in_date", stageMeta, "entrada");
  const saidaBest = reduceToEvents(saidaRows, "out_date", stageMeta, "saida");

  if (entradaBest.size === 0 && saidaBest.size === 0) return [];

  // Origem/UTM pro canal — buscado por lote de id porque o negócio pode ter sido
  // CRIADO fora do range selecionado (é literalmente o motivo de essa função existir).
  const dealIds = Array.from(
    new Set([
      ...Array.from(entradaBest.values(), (v) => v.dealId),
      ...Array.from(saidaBest.values(), (v) => v.dealId),
    ]),
  );
  const deals = await fetchDealsByIds(dealIds);
  const originByDealId = new Map(
    deals.map(
      (d) => [d.id, (d.origin_id && ORIGIN_LABELS[d.origin_id]) || "Outra origem"] as const,
    ),
  );

  function toEvents(
    best: Map<string, { dealId: number; metric: FunnelMetric; day: string; pipelineName: string }>,
    direction: "entrada" | "saida",
  ): FunnelStageEvent[] {
    return Array.from(best.values(), (v) => ({
      dealId: v.dealId,
      metric: v.metric,
      direction,
      day: v.day,
      pipelineName: v.pipelineName,
      origin: originByDealId.get(v.dealId) ?? "Outra origem",
    }));
  }

  return [...toEvents(entradaBest, "entrada"), ...toEvents(saidaBest, "saida")];
}
