// Cálculo de SQL/RA/RR/Contrato Enviado/Contrato Assinado usando o histórico REAL de
// entrada em etapa do PipeRun (endpoint /stageHistories) — não created_at do negócio +
// etapa atual (ver leads-recentes.ts::funnelFlags, que é a forma antiga/errada usada
// até aqui pelo Funil de Marketing).
//
// Por que isso existe: um negócio criado há meses mas que só virou SQL esta semana não
// aparecia em nenhum relatório por período, porque o filtro era por created_at (antigo).
// Confirmado com dado real: 60% dos negócios abertos em EXPANSÃO CLOSER têm created_at
// há mais de 30 dias — qualquer range de 30 dias ou menos invisibilizava a maioria do
// Closer ativo. Aqui, cada linha do histórico tem sua PRÓPRIA data de entrada na etapa,
// então um negócio antigo que avançou esta semana é contado esta semana, não na semana
// (distante) em que foi criado.
//
// Validado contra o relatório nativo "Taxa de Conversão" do PipeRun: mesmo filtro de
// funil + período, mesma contagem de entrada em NOVO LEAD (106 aqui vs. 105 na tela —
// diferença de 1, consistente com borda de fuso horário, não erro de lógica).

import {
  fetchDealsByIds,
  fetchPipelines,
  fetchStageEntradasInRange,
  fetchStages,
  isPipeRunConfigured,
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
  /** YYYY-MM-DD (Brasília) — dia em que o negócio ATINGIU esse critério pela 1ª vez
   * dentro do range consultado (não é created_at do negócio). */
  achievedAt: string;
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

/** Carrega os eventos de funil (SQL/RA/RR/Contrato) de verdade pro range e funis
 * informados. `pipelineNames` vazio = todos os funis existentes (mesma semântica do
 * resto da tela); caso contrário, só entradas em etapa desses funis contam. */
export async function loadFunnelStageEvents(
  range: DateRange,
  pipelineNames: string[],
): Promise<FunnelStageEvent[]> {
  if (!isPipeRunConfigured()) return [];

  const [entradas, pipelines] = await Promise.all([
    fetchStageEntradasInRange(range.from, range.to),
    fetchPipelines(),
  ]);

  const wantedUpper = new Set(pipelineNames.map((p) => p.toUpperCase()));
  const pipelineIdsToLoad =
    wantedUpper.size > 0
      ? pipelines.filter((p) => wantedUpper.has(p.name.toUpperCase())).map((p) => p.id)
      : pipelines.map((p) => p.id);

  const pipelineNameById = new Map(pipelines.map((p) => [p.id, p.name] as const));
  const stagesByPipeline = await Promise.all(pipelineIdsToLoad.map((id) => fetchStages(id)));
  const stageMeta = new Map<number, { pipelineName: string; stageName: string }>();
  for (const stages of stagesByPipeline) {
    for (const s of stages) {
      stageMeta.set(s.id, {
        pipelineName: pipelineNameById.get(s.pipeline_id) ?? "",
        stageName: s.name,
      });
    }
  }

  // dealId+metric -> menor achievedAt visto (1ª vez que o negócio bateu esse critério
  // dentro do range) — evita contar de novo se ele reentrar na mesma etapa depois.
  const best = new Map<
    string,
    { dealId: number; metric: FunnelMetric; achievedAt: string; pipelineName: string }
  >();

  for (const e of entradas) {
    const meta = stageMeta.get(e.in_stage_id);
    if (!meta) continue; // etapa de um funil fora do filtro pedido
    const day = e.in_date.slice(0, 10);
    for (const metric of classifyMetrics(meta.pipelineName, meta.stageName)) {
      const key = `${e.deal_id}|${metric}`;
      const current = best.get(key);
      if (!current || day < current.achievedAt) {
        best.set(key, {
          dealId: e.deal_id,
          metric,
          achievedAt: day,
          pipelineName: meta.pipelineName,
        });
      }
    }
  }

  if (best.size === 0) return [];

  // Origem/UTM pro canal — buscado por lote de id porque o negócio pode ter sido
  // CRIADO fora do range selecionado (é literalmente o motivo de essa função existir).
  const dealIds = Array.from(new Set(Array.from(best.values(), (v) => v.dealId)));
  const deals = await fetchDealsByIds(dealIds);
  const originByDealId = new Map(
    deals.map(
      (d) => [d.id, (d.origin_id && ORIGIN_LABELS[d.origin_id]) || "Outra origem"] as const,
    ),
  );

  return Array.from(best.values(), (v) => ({
    dealId: v.dealId,
    metric: v.metric,
    achievedAt: v.achievedAt,
    pipelineName: v.pipelineName,
    origin: originByDealId.get(v.dealId) ?? "Outra origem",
  }));
}
