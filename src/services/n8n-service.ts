import { createServerFn } from "@tanstack/react-start";

import { isN8nConfigured } from "@/lib/n8n-client";
import { loadN8nOperationalData, type N8nOperationalData } from "@/lib/n8n-metrics";

export type N8nStatus =
  | { configured: false }
  | { configured: true; ok: true; totalWorkflows: number; activeWorkflows: number; checkedAt: string }
  | { configured: true; ok: false; error: string; checkedAt: string };

// Cache em memória do processo do servidor: evita recalcular tudo (workflows +
// ~1500 execuções + detalhe de erros) a cada query independente que a UI dispara
// na mesma janela de alguns segundos (Visão geral, Automações e Incidentes usam
// esse mesmo payload).
let cache: { data: N8nOperationalData | null; expiresAt: number } | null = null;
const CACHE_TTL_MS = 45_000;

async function getCachedOperationalData(): Promise<N8nOperationalData | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;
  const data = await loadN8nOperationalData();
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

/** Payload completo (automações + incidentes + overview) derivado do n8n real, ou null se não configurado. */
export const getN8nOperationalData = createServerFn({ method: "GET" }).handler(
  async (): Promise<N8nOperationalData | null> => getCachedOperationalData(),
);

/** Status resumido usado no card de "Sistemas e integrações". */
export const getN8nStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<N8nStatus> => {
    if (!isN8nConfigured()) return { configured: false };

    const checkedAt = new Date().toISOString();
    try {
      const data = await getCachedOperationalData();
      if (!data) return { configured: false };
      return {
        configured: true,
        ok: true,
        totalWorkflows: data.automations.length,
        activeWorkflows: data.automations.filter((a) => a.status === "Ativa").length,
        checkedAt,
      };
    } catch (error) {
      return {
        configured: true,
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido ao consultar n8n",
        checkedAt,
      };
    }
  },
);
