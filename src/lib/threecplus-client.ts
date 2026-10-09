// Cliente server-only pra API ao vivo da 3C Plus (discador) — nunca importar de código
// de cliente: depende de THREECPLUS_API_KEY. Usado só pra navegação pontual de um dia
// específico (qualificação/duração das ligações reais); o painel agregado principal lê
// call_metrics_daily no Supabase (ver @/lib/call-metrics.ts) porque paginar milhares de
// chamadas a cada carregamento de tela seria lento demais.
//
// Doc: SDK oficial em github.com/3C-Plus/3cplusv2-sdk — base https://app.3c.plus/api/v1,
// header "Authorization: Bearer <token>". O endpoint /calls não filtra por campanha ou
// agente via query string (só por data), então filtramos aqui depois de baixar a página.

const BASE_URL = "https://app.3c.plus/api/v1";
const PER_PAGE = 500;
// Limite de segurança: um dia comum tem 2-4 mil chamadas, quase tudo ruído do discador
// (sem agente). Isso evita paginar o dia inteiro se, por algum motivo, vier tudo sem
// agente — nesse caso a lista fica vazia em vez de travar em dezenas de páginas.
const MAX_PAGES = 20;

interface ThreeCPlusCallRaw {
  id: string;
  agent_id: number;
  agent: string;
  campaign_id: number;
  campaign: string;
  number: string;
  status_id: number;
  readable_status_text: string;
  qualification: string;
  call_date: string;
  calling_time: string;
  speaking_with_agent_time: string;
  recorded: boolean;
}

export interface ThreeCPlusCall {
  id: string;
  agentName: string;
  campaignName: string;
  number: string;
  statusText: string;
  qualification: string | null;
  callDate: string;
  callingTime: string;
  speakingTime: string;
  recorded: boolean;
}

function getApiKey(): string | null {
  return process.env["THREECPLUS_API_KEY"] || null;
}

export function isThreeCPlusConfigured(): boolean {
  return getApiKey() !== null;
}

function toCall(raw: ThreeCPlusCallRaw): ThreeCPlusCall {
  return {
    id: raw.id,
    agentName: raw.agent,
    campaignName: raw.campaign,
    number: raw.number,
    statusText: raw.readable_status_text,
    qualification: raw.qualification && raw.qualification !== "-" ? raw.qualification : null,
    callDate: raw.call_date,
    callingTime: raw.calling_time,
    speakingTime: raw.speaking_with_agent_time,
    recorded: raw.recorded,
  };
}

/** Chamadas de um dia (America/Sao_Paulo) que tiveram um agente real conectado —
 * ignora o ruído do discador (voicemail/falha/não atendida sem agente), que é a
 * maioria esmagadora do volume bruto e não interessa pra auditoria de conversa. */
export async function fetchCallsForDay(date: string): Promise<ThreeCPlusCall[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("THREECPLUS_API_KEY não configurada no servidor.");

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
    const response = await fetch(`${BASE_URL}/calls?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`3C Plus API respondeu ${response.status} em /calls`);
    }
    const body = (await response.json()) as {
      data: ThreeCPlusCallRaw[];
      meta: { pagination: { total_pages: number } };
    };
    for (const raw of body.data) {
      if (raw.agent_id !== 0) calls.push(toCall(raw));
    }
    totalPages = Math.min(body.meta.pagination.total_pages, MAX_PAGES);
    page += 1;
  } while (page <= totalPages);

  return calls.sort((a, b) => (a.callDate < b.callDate ? 1 : -1));
}

// --- Leitura geral (usada pelo conector MCP; nada aqui escreve na 3C Plus) -----------

/** Campos que nunca saem do servidor: senhas, tokens, códigos de confirmação, documentos. */
const SENSITIVE_KEY =
  /password|senha|token|secret|confirmation_code|document|cpf|cnpj|sip_user|api_key/i;

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? "[oculto]" : redactSensitive(v),
      ]),
    );
  }
  return value;
}

/** GET livre na API da 3C Plus. Caminho validado (só /recurso/...), sem outro host. */
export async function threeCPlusGet(
  path: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("THREECPLUS_API_KEY não configurada no servidor.");
  if (!/^\/[A-Za-z0-9_/-]+$/.test(path) || path.includes("..")) {
    throw new Error("Caminho inválido. Use algo como /campaigns ou /calls/ID.");
  }
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(
      `3C Plus API respondeu ${response.status} em ${path}${detail ? `: ${detail}` : ""}`,
    );
  }
  return redactSensitive(await response.json());
}

export type ThreeCPlusCallFull = Record<string, unknown> & {
  id: string;
  agent_id: number;
  agent: string;
  campaign: string;
  number: string;
  readable_status_text: string;
  qualification: string;
  call_date: string;
  speaking_with_agent_time: string;
};

/** Todas as chamadas de um intervalo de dias (inclui o ruído do discador, sem agente).
 * `truncado` = bateu no limite de páginas e o resultado está incompleto. */
export async function fetchCallsRange(
  since: string,
  until: string,
): Promise<{ calls: ThreeCPlusCallFull[]; truncado: boolean }> {
  const calls: ThreeCPlusCallFull[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const body = (await threeCPlusGet("/calls", {
      per_page: String(PER_PAGE),
      page: String(page),
      start_date: `${since} 00:00:00`,
      end_date: `${until} 23:59:59`,
    })) as { data: ThreeCPlusCallFull[]; meta: { pagination: { total_pages: number } } };
    calls.push(...body.data);
    totalPages = body.meta.pagination.total_pages;
    page += 1;
  } while (page <= Math.min(totalPages, MAX_PAGES));
  return { calls, truncado: totalPages > MAX_PAGES };
}
