import { createServerFn } from "@tanstack/react-start";

import { fetchN8nExecutions, fetchN8nWorkflows, isN8nConfigured } from "@/lib/n8n-client";

export type N8nStatus =
  | { configured: false }
  | { configured: true; ok: true; totalWorkflows: number; activeWorkflows: number; checkedAt: string }
  | { configured: true; ok: false; error: string; checkedAt: string };

/**
 * Status resumido da instância n8n real, usado no card de "Sistemas e integrações".
 * Roda no servidor: a API key nunca chega ao bundle do cliente.
 */
export const getN8nStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<N8nStatus> => {
    if (!isN8nConfigured()) return { configured: false };

    const checkedAt = new Date().toISOString();
    try {
      const workflows = await fetchN8nWorkflows();
      return {
        configured: true,
        ok: true,
        totalWorkflows: workflows.length,
        activeWorkflows: workflows.filter((w) => w.active).length,
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

export const listN8nWorkflows = createServerFn({ method: "GET" }).handler(async () => {
  if (!isN8nConfigured()) return [];
  return fetchN8nWorkflows();
});

export const listN8nExecutions = createServerFn({ method: "GET" })
  .validator((workflowId: string | undefined) => workflowId)
  .handler(async ({ data: workflowId }) => {
    if (!isN8nConfigured()) return [];
    return fetchN8nExecutions(workflowId);
  });
