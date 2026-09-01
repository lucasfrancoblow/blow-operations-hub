import { createServerFn } from "@tanstack/react-start";

import { loadCallMetrics, type CallMetricsData } from "@/lib/call-metrics";
import { defaultDateRange, type DateRange } from "@/lib/leads-recentes";

// Cache curto: os dados no Supabase só mudam 1x/dia (job externo, ver
// scripts/sync-3cplus-calls.ts), mas mantemos um TTL pra não bater no banco a cada
// re-render/foco de aba.
const cache = new Map<string, { data: CallMetricsData | null; expiresAt: number }>();
const CACHE_TTL_MS = 120_000;

export const getCallMetricsData = createServerFn({ method: "GET" })
  .validator((input?: DateRange) => input ?? defaultDateRange())
  .handler(async ({ data: range }): Promise<CallMetricsData | null> => {
    const key = `${range.from}_${range.to}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const data = await loadCallMetrics(range);
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  });
