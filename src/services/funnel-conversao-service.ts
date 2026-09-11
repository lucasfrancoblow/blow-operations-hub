import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser } from "@/lib/session";
import { loadFunnelStageEvents, type FunnelStageEvent } from "@/lib/funnel-conversao";
import { defaultDateRange, type DateRange } from "@/lib/leads-recentes";

interface FunnelConversaoInput {
  range: DateRange;
  pipelineNames: string[];
}

const cache = new Map<string, { data: FunnelStageEvent[]; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

/** SQL/RA/RR/Contrato Enviado/Contrato Assinado de verdade, pela data de ENTRADA na
 * etapa (PipeRun /stageHistories) — ver src/lib/funnel-conversao.ts pro porquê. */
export const getFunnelConversaoData = createServerFn({ method: "GET" })
  .validator((input?: Partial<FunnelConversaoInput>): FunnelConversaoInput => ({
    range: input?.range ?? defaultDateRange(),
    pipelineNames: input?.pipelineNames ?? [],
  }))
  .handler(async ({ data: { range, pipelineNames } }): Promise<FunnelStageEvent[]> => {
    await requireSessionUser();
    const key = `${range.from}_${range.to}_${[...pipelineNames].sort().join(",")}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const data = await loadFunnelStageEvents(range, pipelineNames);
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  });
