import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser } from "@/lib/session";
import {
  defaultDateRange,
  loadLeadsRecentesData,
  type DateRange,
  type LeadsRecentesData,
} from "@/lib/leads-recentes";

import { createSwrCache } from "@/lib/swr-cache";

// Dado de até 45 s sai na hora; até 15 min sai na hora e atualiza por baixo.
const cache = createSwrCache<LeadsRecentesData | null>(45_000, 15 * 60_000);

/** Leads criados no range de datas informado no PipeRun (default: últimos 14 dias),
 * com etapa real do CRM. */
export const getLeadsRecentesData = createServerFn({ method: "GET" })
  .validator((input?: DateRange) => input ?? defaultDateRange())
  .handler(async ({ data: range }): Promise<LeadsRecentesData | null> => {
    await requireSessionUser();
    return cache.get(`${range.from}_${range.to}`, () => loadLeadsRecentesData(range));
  });
