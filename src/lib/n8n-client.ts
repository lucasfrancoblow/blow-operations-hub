// Cliente server-only para a API pública do n8n (nunca importar de código de cliente:
// depende de N8N_API_KEY, que só existe em process.env no servidor).
//
// Autenticação: header X-N8N-API-KEY, base path /api/v1.
// Docs: https://docs.n8n.io/api/

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    credentials?: Record<string, { id: string; name: string }>;
  }>;
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

export interface N8nExecutionError {
  message: string;
  description: string | null;
  name: string | null;
  node: string | null;
  nodeType: string | null;
  httpCode: number | null;
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

/** URL pública da instância, para montar links diretos ao editor/execuções. Só chamar quando isN8nConfigured() for true. */
export function getN8nBaseUrl(): string {
  const config = getConfig();
  if (!config) throw new Error("N8N_BASE_URL / N8N_API_KEY não configurados no servidor.");
  return config.baseUrl;
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
  const workflows: N8nWorkflow[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { limit: "250" };
    if (cursor) params["cursor"] = cursor;
    const page = await n8nFetch<{ data: N8nWorkflow[]; nextCursor?: string | null }>(
      "/workflows",
      params,
    );
    workflows.push(...page.data);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return workflows;
}

export async function fetchN8nWorkflow(id: string): Promise<N8nWorkflow> {
  return n8nFetch<N8nWorkflow>(`/workflows/${id}`);
}

export async function fetchN8nExecutions(workflowId?: string): Promise<N8nExecution[]> {
  const params: Record<string, string> = { limit: "50" };
  if (workflowId) params["workflowId"] = workflowId;
  const page = await n8nFetch<{ data: N8nExecution[] }>("/executions", params);
  return page.data;
}

/**
 * Janela de execuções recentes, todas as automações misturadas, mais novas primeiro.
 * Usada pra derivar status/saúde das automações sem precisar de 1 chamada por workflow.
 * Cobertura limitada pelo numero de paginas: workflows de baixa frequencia podem nao aparecer.
 */
export async function fetchN8nRecentExecutions(maxPages = 6): Promise<N8nExecution[]> {
  return fetchN8nExecutionsByStatus(undefined, maxPages);
}

/**
 * Histórico de execuções filtrado por status (ex: só "error"), paginando bem mais
 * fundo que a janela recente — usado pra montar incidentes que não desaparecem da
 * tela conforme execuções normais mais recentes empurram o erro antigo pra fora da
 * janela misturada (ver fetchN8nRecentExecutions).
 */
async function fetchN8nExecutionsByStatus(
  status: string | undefined,
  maxPages: number,
): Promise<N8nExecution[]> {
  const executions: N8nExecution[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = { limit: "250" };
    if (status) params["status"] = status;
    if (cursor) params["cursor"] = cursor;
    const result = await n8nFetch<{ data: N8nExecution[]; nextCursor?: string | null }>(
      "/executions",
      params,
    );
    executions.push(...result.data);
    cursor = result.nextCursor ?? undefined;
    if (!cursor) break;
  }
  return executions;
}

/** Histórico profundo só de execuções com erro — ver fetchN8nExecutionsByStatus. */
export async function fetchN8nErrorExecutions(maxPages = 20): Promise<N8nExecution[]> {
  return fetchN8nExecutionsByStatus("error", maxPages);
}

/** Detalhe de erro de uma execução específica, com o nó/HTTP code/mensagem reais. */
export async function fetchN8nExecutionError(
  executionId: string,
): Promise<N8nExecutionError | null> {
  const detail = await n8nFetch<{
    data?: { resultData?: { error?: Record<string, unknown> } };
  }>(`/executions/${executionId}`, { includeData: "true" });

  const error = detail.data?.resultData?.error;
  if (!error) return null;

  const node = error["node"] as { name?: string; type?: string } | undefined;
  return {
    message: typeof error["message"] === "string" ? error["message"] : "Erro sem mensagem.",
    description: typeof error["description"] === "string" ? error["description"] : null,
    name: typeof error["name"] === "string" ? error["name"] : null,
    node: typeof node?.name === "string" ? node.name : null,
    nodeType: typeof node?.type === "string" ? node.type : null,
    httpCode: typeof error["httpCode"] === "number" ? error["httpCode"] : null,
  };
}
