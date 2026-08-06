// Cliente server-only para a API pública do n8n (nunca importar de código de cliente:
// depende de N8N_API_KEY, que só existe em process.env no servidor).
//
// Autenticação: header X-N8N-API-KEY, base path /api/v1.
// Docs: https://docs.n8n.io/api/

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: Array<{ id: string; name: string; type: string }>;
  tags?: Array<{ id: string; name: string }>;
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  status: "success" | "error" | "running" | "waiting" | "canceled" | string;
  startedAt: string;
  stoppedAt: string | null;
  finished: boolean;
  mode: string;
}

interface N8nConfig {
  baseUrl: string;
  apiKey: string;
}

function getConfig(): N8nConfig | null {
  const baseUrl = process.env["N8N_BASE_URL"];
  const apiKey = process.env["N8N_API_KEY"];
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

export function isN8nConfigured(): boolean {
  return getConfig() !== null;
}

async function n8nFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const config = getConfig();
  if (!config) {
    throw new Error("N8N_BASE_URL / N8N_API_KEY não configurados no servidor.");
  }

  const url = new URL(`${config.baseUrl}/api/v1${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      "X-N8N-API-KEY": config.apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`n8n API respondeu ${response.status} em ${path}`);
  }

  return (await response.json()) as T;
}

export async function fetchN8nWorkflows(): Promise<N8nWorkflow[]> {
  const page = await n8nFetch<{ data: N8nWorkflow[] }>("/workflows", { limit: "250" });
  return page.data;
}

export async function fetchN8nExecutions(workflowId?: string): Promise<N8nExecution[]> {
  const params: Record<string, string> = { limit: "50" };
  if (workflowId) params["workflowId"] = workflowId;
  const page = await n8nFetch<{ data: N8nExecution[] }>("/executions", params);
  return page.data;
}
