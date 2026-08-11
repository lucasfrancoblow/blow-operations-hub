// Cliente server-only para o Supabase (nunca importar de código de cliente: depende
// de SUPABASE_SERVICE_ROLE_KEY, que só existe em process.env no servidor — essa chave
// ignora RLS, então não pode nunca chegar no navegador do usuário final).
//
// Sem SDK: chama a Data API (PostgREST) direto via fetch, no mesmo padrão usado
// pra n8n e PipeRun neste projeto.

interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

function getConfig(): SupabaseConfig | null {
  const url = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/+$/, ""), serviceRoleKey };
}

export function isSupabaseConfigured(): boolean {
  return getConfig() !== null;
}

async function restFetch<T>(
  path: string,
  init: RequestInit & { preferHeader?: string } = {},
): Promise<T> {
  const config = getConfig();
  if (!config) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.");
  }

  const { preferHeader, ...fetchInit } = init;
  const response = await fetch(`${config.url}/rest/v1${path}`, {
    ...fetchInit,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(preferHeader ? { Prefer: preferHeader } : {}),
      ...(fetchInit.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Supabase REST respondeu ${response.status} em ${path}: ${body}`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Busca todas as linhas de uma tabela, com paginação simples via Range header. */
export async function supabaseSelect<T>(table: string, query = ""): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const result = await restFetch<T[]>(`/${table}?${query}`, {
      method: "GET",
      headers: { Range: `${offset}-${offset + pageSize - 1}` },
    });
    if (!result || result.length === 0) break;
    rows.push(...result);
    if (result.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

/** Insere ou atualiza linhas por conflito de chave primária (upsert). */
export async function supabaseUpsert<T>(table: string, rows: T[]): Promise<void> {
  if (rows.length === 0) return;
  await restFetch(`/${table}`, {
    method: "POST",
    body: JSON.stringify(rows),
    preferHeader: "resolution=merge-duplicates,return=minimal",
  });
}
