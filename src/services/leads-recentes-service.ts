import { createServerFn } from "@tanstack/react-start";

import {
  defaultDateRange,
  loadLeadsRecentesData,
  type DateRange,
  type LeadsRecentesData,
} from "@/lib/leads-recentes";

// Cache em memória do processo do servidor, por range de datas: evita repaginar
// negócios + funis + etapas a cada query independente disparada pela tela na
// mesma janela de segundos, sem misturar resultado de um range com outro.
const cache = new Map<string, { data: LeadsRecentesData | null; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

/** Leads criados no range de datas informado no PipeRun (default: últimos 14 dias),
 * com etapa real do CRM. */
export const getLeadsRecentesData = createServerFn({ method: "GET" })
  .validator((input?: DateRange) => input ?? defaultDateRange())
  .handler(async ({ data: range }): Promise<LeadsRecentesData | null> => {
    const key = `${range.from}_${range.to}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const data = await loadLeadsRecentesData(range);
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  });
