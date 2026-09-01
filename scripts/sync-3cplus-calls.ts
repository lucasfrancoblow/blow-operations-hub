// Job de sincronização das métricas de ligação da 3C Plus (discador) -> Supabase.
//
// Roda fora do app web (GitHub Actions, ver .github/workflows/sync-3cplus-calls.yml)
// porque o endpoint /calls da 3C Plus não tem relatório agregado pronto: pra montar
// qualquer métrica é preciso paginar TODAS as chamadas do dia (2-3 mil chamadas/dia
// nesta conta, a maioria ruído do próprio discador tentando conectar antes de um
// agente entrar) e somar aqui. Rodar isso a cada carregamento de tela do hub seria
// lento demais — este script roda 1x/dia, agrega e grava só os totais.
//
// Uso: bun run scripts/sync-3cplus-calls.ts [YYYY-MM-DD]
// Sem argumento, sincroniza o dia de ontem (America/Sao_Paulo) — dia já fechado,
// sem chamada ainda em andamento.

const THREECPLUS_BASE_URL = "https://app.3c.plus/api/v1";
const PER_PAGE = 500;

interface ThreeCPlusCall {
  agent_id: number;
  agent: string;
  campaign_id: number;
  campaign: string;
  status_id: number;
  readable_status_text: string;
  calling_time: string; // "HH:MM:SS"
  speaking_with_agent_time: string; // "HH:MM:SS"
  recorded: boolean;
}

interface CallMetricRow {
  call_date: string;
  agent_id: number;
  agent_name: string;
  campaign_id: number;
  campaign_name: string;
  status_id: number;
  status_text: string;
  total_calls: number;
  total_calling_seconds: number;
  total_speaking_seconds: number;
  recorded_count: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada no ambiente.`);
  return value;
}

function hmsToSeconds(hms: string): number {
  const [h, m, s] = hms.split(":").map(Number);
  return (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0);
}

/** Dia de ontem em America/Sao_Paulo, formato YYYY-MM-DD. */
function yesterdaySaoPaulo(): string {
  const now = new Date();
  const saoPauloNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  saoPauloNow.setDate(saoPauloNow.getDate() - 1);
  return saoPauloNow.toLocaleDateString("en-CA");
}

async function fetchAllCalls(apiKey: string, date: string): Promise<ThreeCPlusCall[]> {
  const calls: ThreeCPlusCall[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = new URLSearchParams({
      per_page: String(PER_PAGE),
      page: String(page),
      start_date: `${date} 00:00:00`,
      end_date: `${date} 23:59:59`,
    });
    const response = await fetch(`${THREECPLUS_BASE_URL}/calls?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`3C Plus API respondeu ${response.status} em /calls (página ${page})`);
    }
    const body = (await response.json()) as {
      data: ThreeCPlusCall[];
      meta: { pagination: { total_pages: number } };
    };
    calls.push(...body.data);
    totalPages = body.meta.pagination.total_pages;
    page += 1;
  } while (page <= totalPages);

  return calls;
}

function aggregate(date: string, calls: ThreeCPlusCall[]): CallMetricRow[] {
  const byKey = new Map<string, CallMetricRow>();

  for (const call of calls) {
    const key = `${call.agent_id}|${call.campaign_id}|${call.status_id}`;
    const row = byKey.get(key) ?? {
      call_date: date,
      agent_id: call.agent_id,
      agent_name: call.agent || "-",
      campaign_id: call.campaign_id,
      campaign_name: call.campaign || "-",
      status_id: call.status_id,
      status_text: call.readable_status_text || "-",
      total_calls: 0,
      total_calling_seconds: 0,
      total_speaking_seconds: 0,
      recorded_count: 0,
    };
    row.total_calls += 1;
    row.total_calling_seconds += hmsToSeconds(call.calling_time);
    row.total_speaking_seconds += hmsToSeconds(call.speaking_with_agent_time);
    if (call.recorded) row.recorded_count += 1;
    byKey.set(key, row);
  }

  return Array.from(byKey.values());
}

async function upsertRows(
  supabaseUrl: string,
  serviceRoleKey: string,
  rows: CallMetricRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/call_metrics_daily`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Supabase REST respondeu ${response.status} ao gravar call_metrics_daily: ${body}`);
  }
}

async function main() {
  const apiKey = requireEnv("THREECPLUS_API_KEY");
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const date = process.argv[2] ?? yesterdaySaoPaulo();

  console.log(`Sincronizando chamadas da 3C Plus para ${date}...`);
  const calls = await fetchAllCalls(apiKey, date);
  console.log(`${calls.length} chamadas encontradas.`);

  const rows = aggregate(date, calls);
  console.log(`${rows.length} linhas agregadas (agente x campanha x status).`);

  await upsertRows(supabaseUrl, serviceRoleKey, rows);
  console.log("Gravado no Supabase (call_metrics_daily).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
