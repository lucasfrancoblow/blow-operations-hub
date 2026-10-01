import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser } from "@/lib/session";
import { loadAdMetrics, type AdMetricRow } from "@/lib/ad-metrics";
import { defaultDateRange, type DateRange } from "@/lib/leads-recentes";

import { createSwrCache } from "@/lib/swr-cache";

const cache = createSwrCache<AdMetricRow[] | null>(60_000, 30 * 60_000);

/** Custo/desempenho real de anúncios (Meta + Google) no range informado. */
export const getAdMetricsData = createServerFn({ method: "GET" })
  .validator((input?: DateRange) => input ?? defaultDateRange())
  .handler(async ({ data: range }): Promise<AdMetricRow[] | null> => {
    await requireSessionUser();
    return cache.get(`${range.from}_${range.to}`, () => loadAdMetrics(range));
  });
