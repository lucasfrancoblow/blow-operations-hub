import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser } from "@/lib/session";
import { loadFunnelStageEvents, type FunnelStageEvent } from "@/lib/funnel-conversao";
import { defaultDateRange, type DateRange } from "@/lib/leads-recentes";

interface FunnelConversaoInput {
  range: DateRange;
  pipelineNames: string[];
  /** Só entradas, sem saídas nem canal: bem mais rápido (Visão geral). */
  light: boolean;
}

import { createSwrCache } from "@/lib/swr-cache";

const cache = createSwrCache<FunnelStageEvent[]>(45_000, 15 * 60_000);

/** SQL/RA/RR/Contrato Enviado/Contrato Assinado de verdade, pela data de ENTRADA na
 * etapa (PipeRun /stageHistories) — ver src/lib/funnel-conversao.ts pro porquê. */
export const getFunnelConversaoData = createServerFn({ method: "GET" })
  .validator((input?: Partial<FunnelConversaoInput>): FunnelConversaoInput => ({
    range: input?.range ?? defaultDateRange(),
    pipelineNames: input?.pipelineNames ?? [],
    light: input?.light ?? false,
  }))
  .handler(async ({ data: { range, pipelineNames, light } }): Promise<FunnelStageEvent[]> => {
    await requireSessionUser();
    const key = `${range.from}_${range.to}_${[...pipelineNames].sort().join(",")}_${light}`;
    return cache.get(key, () => loadFunnelStageEvents(range, pipelineNames, light));
  });
