import { createServerFn } from "@tanstack/react-start";

import { loadPipeRunLeadsData, type PipeRunLeadsData } from "@/lib/piperun-metrics";

// Cache em memória do processo do servidor: evita repaginar ~1000 negócios + funis +
// etapas a cada query independente disparada pela tela na mesma janela de segundos.
let cache: { data: PipeRunLeadsData | null; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

/** Lista de negócios abertos no PipeRun com dias sem contato, ou null se PIPERUN_API_KEY não configurada. */
export const getPipeRunLeadsData = createServerFn({ method: "GET" }).handler(
  async (): Promise<PipeRunLeadsData | null> => {
    if (cache && cache.expiresAt > Date.now()) return cache.data;
    const data = await loadPipeRunLeadsData();
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  },
);
