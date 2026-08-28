import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser } from "@/lib/session";
import { loadAdMetrics, type AdMetricRow } from "@/lib/ad-metrics";
import { defaultDateRange, type DateRange } from "@/lib/leads-recentes";

const cache = new Map<string, { data: AdMetricRow[] | null; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

/** Custo/desempenho real de anúncios (Meta + Google) no range informado. */
export const getAdMetricsData = createServerFn({ method: "GET" })
  .validator((input?: DateRange) => input ?? defaultDateRange())
  .handler(async ({ data: range }): Promise<AdMetricRow[] | null> => {
    await requireSessionUser();
    const key = `${range.from}_${range.to}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const data = await loadAdMetrics(range);
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  });
