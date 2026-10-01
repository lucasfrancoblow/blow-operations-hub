import { createServerFn } from "@tanstack/react-start";

import { loadCallMetrics, type CallMetricsData } from "@/lib/call-metrics";
import { defaultDateRange, type DateRange } from "@/lib/leads-recentes";

import { createSwrCache } from "@/lib/swr-cache";

// Os dados só mudam 1x/dia (job externo, ver scripts/sync-3cplus-calls.ts).
const cache = createSwrCache<CallMetricsData | null>(120_000, 60 * 60_000);

export const getCallMetricsData = createServerFn({ method: "GET" })
  .validator((input?: DateRange) => input ?? defaultDateRange())
  .handler(async ({ data: range }): Promise<CallMetricsData | null> => {
    return cache.get(`${range.from}_${range.to}`, () => loadCallMetrics(range));
  });
