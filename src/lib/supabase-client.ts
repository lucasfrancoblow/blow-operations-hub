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

// Nome de tabela sempre vem de uma constante no próprio código (nunca de input
// externo), mas validamos o formato mesmo assim: fecha a porta pra qualquer uso
// futuro que acabe interpolando algo não confiável na URL.
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertSafeIdentifier(value: string, label: string): void {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`${label} inválido: "${value}". Só letras, números e underscore.`);
  }
}

async function restFetch<T>(
  path: string,
  searchParams: URLSearchParams,
  init: RequestInit & { preferHeader?: string } = {},
): Promise<T> {
  const config = getConfig();
  if (!config) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.");
  }

  const { preferHeader, ...fetchInit } = init;
  const qs = searchParams.toString();
  const response = await fetch(`${config.url}/rest/v1${path}${qs ? `?${qs}` : ""}`, {
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

/**
 * Busca todas as linhas de uma tabela, com paginação simples via Range header.
 * `filters` vira query string do PostgREST via URLSearchParams (nunca concatenação
 * de string crua), então valores especiais são sempre escapados corretamente.
 */
export async function supabaseSelect<T>(
  table: string,
  filters: Record<string, string> = { select: "*" },
): Promise<T[]> {
  assertSafeIdentifier(table, "Nome de tabela");

  const rows: T[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const params = new URLSearchParams(filters);
    const result = await restFetch<T[]>(`/${table}`, params, {
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
  assertSafeIdentifier(table, "Nome de tabela");
  if (rows.length === 0) return;
  await restFetch(`/${table}`, new URLSearchParams(), {
    method: "POST",
    body: JSON.stringify(rows),
    preferHeader: "resolution=merge-duplicates,return=minimal",
  });
}

/** Atualiza parcialmente uma linha por id (PATCH). */
export async function supabaseUpdate<T extends object>(
  table: string,
  id: string,
  patch: Partial<T>,
): Promise<void> {
  assertSafeIdentifier(table, "Nome de tabela");
  await restFetch(`/${table}`, new URLSearchParams({ id: `eq.${id}` }), {
    method: "PATCH",
    body: JSON.stringify(patch),
    preferHeader: "return=minimal",
  });
}

/** Remove uma linha por id. */
export async function supabaseDelete(table: string, id: string): Promise<void> {
  assertSafeIdentifier(table, "Nome de tabela");
  await restFetch(`/${table}`, new URLSearchParams({ id: `eq.${id}` }), {
    method: "DELETE",
    preferHeader: "return=minimal",
  });
}
