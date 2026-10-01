import { createServerFn } from "@tanstack/react-start";

import { loadHubSnapshot, type HubSnapshot } from "@/lib/pipeline-snapshot";
import { requireSessionUser } from "@/lib/session";

// Paginar ~2 mil negócios abertos custa várias chamadas: cache de 2 min no processo.
let cache: { data: HubSnapshot | null; expiresAt: number } | null = null;
const CACHE_TTL_MS = 120_000;

/** Retrato de todos os funis do PipeRun, fase a fase (só negócios abertos). */
export const getHubSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<HubSnapshot | null> => {
    await requireSessionUser();
    if (cache && cache.expiresAt > Date.now()) return cache.data;
    const data = await loadHubSnapshot();
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  },
);
