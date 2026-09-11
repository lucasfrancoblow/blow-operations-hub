// Exporta as tabelas principais do Supabase do hub pra Parquet (1 arquivo por
// tabela), pra alimentar o banco geral da empresa (blow_dw). Não sobe nada
// sozinho: só gera os .parquet em exports/parquet/ — a promoção pro Dremio
// (setup_dw.py) roda num repo separado, fora deste projeto.
//
// Tabelas escolhidas: as de dado de negócio (tasks, projetos, comentários,
// incidentes, validação de leads, métricas de ligação, usuários). Fora:
// audit_log (log de login, sensível), hub_settings/task_board_settings/
// task_saved_views (preferência de UI, não é dado), task_assignees/
// task_project_access (tabelas de junção só de controle de acesso),
// task_attachments (metadado de arquivo). `app_users.password_hash` nunca sai
// daqui, mesmo a tabela sendo exportada — é hash de senha, não dado de negócio.
//
// Uso: bun run scripts/export-parquet.ts

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import duckdb from "duckdb";

const OUTPUT_DIR = join(import.meta.dirname, "..", "exports", "parquet");

interface TableSpec {
  table: string;
  /** Query string pro PostgREST (select=... pra escolher/excluir colunas). */
  select: string;
  /** Colunas jsonb que viram varchar (JSON.stringify) antes do Parquet — mesmo
   * motivo do resto do DW: schema de list/struct varia entre linhas vazias e
   * preenchidas, o que quebra a unificação de tipo do Dremio/Parquet. */
  jsonColumns?: string[];
}

const TABLES: TableSpec[] = [
  { table: "tasks", select: "*", jsonColumns: ["tags", "reference"] },
  { table: "task_projects", select: "*" },
  { table: "task_comments", select: "*" },
  { table: "incidents", select: "*", jsonColumns: ["facts", "timeline"] },
  { table: "leads_validacao", select: "*" },
  { table: "call_metrics_daily", select: "*" },
  // Sem password_hash: essa tabela vira dado de empresa, hash de senha não pode ir junto.
  { table: "app_users", select: "id,username,role,active,created_by,created_at,updated_at" },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada no ambiente.`);
  return value;
}

const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertSafeIdentifier(value: string, label: string): void {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`${label} inválido: "${value}". Só letras, números e underscore.`);
  }
}

/** Busca todas as linhas de uma tabela via PostgREST, paginando pelo header Range. */
async function fetchAllRows(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: string,
  select: string,
): Promise<Record<string, unknown>[]> {
  assertSafeIdentifier(table, "Nome de tabela");

  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({ select });
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Range: `${offset}-${offset + pageSize - 1}`,
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Supabase REST respondeu ${response.status} em ${table}: ${body}`);
    }
    const page = (await response.json()) as Record<string, unknown>[];
    if (page.length === 0) break;
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

/** Serializa colunas jsonb como string JSON, pra Parquet não ter que unificar
 * struct/list entre linhas vazias e preenchidas (ver comentário no topo). */
function stringifyJsonColumns(
  rows: Record<string, unknown>[],
  columns: string[],
): Record<string, unknown>[] {
  if (columns.length === 0) return rows;
  return rows.map((row) => {
    const copy = { ...row };
    for (const col of columns) {
      if (col in copy) copy[col] = JSON.stringify(copy[col] ?? null);
    }
    return copy;
  });
}

function runSql(con: duckdb.Connection, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    con.run(sql, (err: Error | null) => (err ? reject(err) : resolve()));
  });
}

async function exportTableToParquet(
  con: duckdb.Connection,
  tmpDir: string,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const parquetPath = join(OUTPUT_DIR, `${table}.parquet`);

  if (rows.length === 0) {
    console.log(`  ${table}: 0 linhas, gerando Parquet vazio (schema não inferível sem dado).`);
    return;
  }

  const jsonPath = join(tmpDir, `${table}.json`);
  writeFileSync(jsonPath, JSON.stringify(rows));

  await runSql(con, `CREATE OR REPLACE TABLE "${table}" AS SELECT * FROM read_json_auto('${jsonPath}')`);
  await runSql(con, `COPY "${table}" TO '${parquetPath}' (FORMAT PARQUET)`);
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const tmpDir = mkdtempSync(join(tmpdir(), "hub-parquet-export-"));

  const db = new duckdb.Database(":memory:");
  const con = db.connect();

  try {
    for (const spec of TABLES) {
      console.log(`Exportando ${spec.table}...`);
      const rows = await fetchAllRows(supabaseUrl, serviceRoleKey, spec.table, spec.select);
      const prepared = stringifyJsonColumns(rows, spec.jsonColumns ?? []);
      await exportTableToParquet(con, tmpDir, spec.table, prepared);
      console.log(`  ${spec.table}: ${rows.length} linhas -> exports/parquet/${spec.table}.parquet`);
    }
  } finally {
    con.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`\nPronto. Arquivos em ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
