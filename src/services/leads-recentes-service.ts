import { createServerFn } from "@tanstack/react-start";

import { loadLeadsRecentesData, type LeadsRecentesData } from "@/lib/leads-recentes";

// Cache em memória do processo do servidor: evita repaginar negócios + funis + etapas
// a cada query independente disparada pela tela na mesma janela de segundos.
let cache: { data: LeadsRecentesData | null; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

/** Leads criados nos últimos 14 dias no PipeRun, com etapa real do CRM. */
export const getLeadsRecentesData = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeadsRecentesData | null> => {
    if (cache && cache.expiresAt > Date.now()) return cache.data;
    const data = await loadLeadsRecentesData();
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  },
);
