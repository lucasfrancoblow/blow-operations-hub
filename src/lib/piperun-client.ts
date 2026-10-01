// Cliente server-only para a API pública do PipeRun (nunca importar de código de
// cliente: depende de PIPERUN_API_KEY, que só existe em process.env no servidor).
//
// Autenticação: header "token", base https://api.pipe.run/v1.
// Docs: https://developers.pipe.run/

const BASE_URL = "https://api.pipe.run/v1";
const PAGE_SIZE = 200;

export interface PipeRunOwner {
  id: number;
  name: string;
}

export interface PipeRunCustomField {
  name: string;
  value: string | null;
}

export interface PipeRunContactPhone {
  phone: string;
  is_main: number;
}

export interface PipeRunPerson {
  id: number;
  name: string;
  contactPhones?: PipeRunContactPhone[];
}

export interface PipeRunDeal {
  id: number;
  title: string;
  pipeline_id: number;
  stage_id: number;
  owner_id: number | null;
  owner?: PipeRunOwner;
  person_id: number | null;
  person?: PipeRunPerson;
  // 0 = aberto, 1 = ganho — "perdido" NÃO é 2 nesta conta: confirmado ao vivo em
  // 2026-09-14 que negócios perdidos vêm com status=3 (com lost_reason_id preenchido).
  // O Kanban nativo do PipeRun conta TODO negócio cujo stage_id atual é aquela etapa,
  // aberto ou não — por isso o badge de uma etapa pode mostrar milhares mesmo com poucas
  // dezenas realmente em aberto (negócio perdido fica "parado" visualmente na etapa).
  status: number;
  origin_id: number | null;
  value: number;
  created_at: string;
  updated_at: string;
  last_contact_at: string | null;
  /** Última mudança de etapa ("YYYY-MM-DD HH:mm:ss", Brasília) — base do "parado na fase". */
  last_stage_updated_at?: string | null;
  closed_at?: string | null;
  lost_reason_id?: number | null;
  temperature?: number | null;
  customFields?: PipeRunCustomField[];
}

export interface PipeRunPipeline {
  id: number;
  name: string;
}

export interface PipeRunStage {
  id: number;
  pipeline_id: number;
  name: string;
  /** Posição da etapa no funil (0 = entrada). */
  order?: number;
  /** Cor da etapa no Kanban do PipeRun (hex). */
  color?: string | null;
}

interface PipeRunPage<T> {
  success: boolean;
  data: T[];
  meta: { total: number; per_page: number; current_page: number; total_pages: number };
}

function getToken(): string | null {
  return process.env["PIPERUN_API_KEY"] || null;
}

export function isPipeRunConfigured(): boolean {
  return getToken() !== null;
}

async function piperunFetch<T>(
  path: string,
  params: Record<string, string>,
): Promise<PipeRunPage<T>> {
  const token = getToken();
  if (!token) {
    throw new Error("PIPERUN_API_KEY não configurada no servidor.");
  }

  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  // Páginas buscadas em paralelo podem esbarrar no limite de requisições: tenta de novo
  // algumas vezes com espera crescente antes de desistir.
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { headers: { token, Accept: "application/json" } });
    if (response.ok) return (await response.json()) as PipeRunPage<T>;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= 3) {
      throw new Error(`PipeRun API respondeu ${response.status} em ${path}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1) ** 2));
  }
}

/** Roda `fn` em todos os itens com no máximo `limit` chamadas simultâneas, mantendo a ordem. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

const PAGE_CONCURRENCY = 6;

/** Pagina um endpoint: busca a 1ª página (que informa o total) e o resto em paralelo. */
async function fetchAllPages<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const first = await piperunFetch<T>(path, { ...params, page: "1" });
  const totalPages = first.meta.total_pages;
  if (totalPages <= 1) return first.data;
  const rest = await mapPool(
    Array.from({ length: totalPages - 1 }, (_, i) => i + 2),
    PAGE_CONCURRENCY,
    (page) => piperunFetch<T>(path, { ...params, page: String(page) }),
  );
  return [first.data, ...rest.map((r) => r.data)].flat();
}

/** Todos os negócios abertos (status=0), paginando até o fim. */
export async function fetchOpenDeals(): Promise<PipeRunDeal[]> {
  return fetchAllPages<PipeRunDeal>("/deals", { show: String(PAGE_SIZE), status: "0" });
}

/** Negócios criados dentro de um range de datas (YYYY-MM-DD, inclusivo), qualquer
 * status — pra ver tudo que chegou, incluindo o que já fechou/perdeu rápido. */
export async function fetchDealsInRange(since: string, until: string): Promise<PipeRunDeal[]> {
  return fetchAllPages<PipeRunDeal>("/deals", {
    show: String(PAGE_SIZE),
    created_at_start: since,
    created_at_end: until,
    with: "customFields,person.contactPhones",
    order_by: "created_at",
    order: "desc",
  });
}

/** Negócios buscados por lote de ids (id=1,2,3 — a API aceita lista separada por
 * vírgula em `id`, embora não conste na doc de parâmetros). Usado pra descobrir
 * pipeline/origem/utm de negócios que aparecem no histórico de etapa mas cujo
 * created_at pode estar fora do range de datas selecionado (ciclo de venda longo:
 * ver fetchStageEntradasInRange). */
export async function fetchDealsByIds(ids: number[]): Promise<PipeRunDeal[]> {
  if (ids.length === 0) return [];
  const CHUNK_SIZE = 100;
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));
  const results = await mapPool(chunks, PAGE_CONCURRENCY, (chunk) =>
    piperunFetch<PipeRunDeal>("/deals", {
      show: String(chunk.length),
      id: chunk.join(","),
      with: "customFields",
    }),
  );
  return results.flatMap((r) => r.data);
}

export interface PipeRunStageHistory {
  id: number;
  deal_id: number;
  in_stage_id: number;
  out_stage_id: number | null;
  in_date: string; // "YYYY-MM-DD HH:MM:SS", Brasília local (mesmo formato de deal.created_at)
  out_date: string | null;
}

// A doc de /stageHistories descreve paginação por `cursor`, mas a resposta real desta
// conta usa o MESMO formato page-based dos outros endpoints (`total_pages`/
// `current_page`, sem `meta.cursor` nenhum) — confirmado direto na API (340 registros
// totais, `total_pages: 2`, sem nunca aparecer `cursor.next`). Paginação por cursor
// silenciosamente parava na 1ª página (200 de 340 linhas) sem erro nenhum, porque
// "sem next" e "cursor não existe no formato" são indistinguíveis do jeito que a
// função antiga checava. Reaproveita piperunFetch (mesma paginação de fetchDealsInRange).
/** Histórico real de ENTRADA em etapa dentro do range de datas (endpoint /stageHistories
 * — o mesmo que alimenta o relatório nativo "Taxa de Conversão" do PipeRun). Cada linha é
 * "o negócio X entrou na etapa Y nesta data/hora", com data própria por movimentação —
 * diferente de fetchDealsInRange, que só sabe created_at do negócio + etapa ATUAL.
 *
 * Por quê isso importa: um negócio criado há meses mas que só virou SQL esta semana não
 * aparece em fetchDealsInRange("esta semana", ...) porque created_at é antigo — mas
 * aparece aqui, porque a entrada na etapa SQL aconteceu de fato esta semana. Confirmado
 * contra o relatório nativo do PipeRun (mesmo filtro de funil/período): 106 entradas em
 * "NOVO LEAD" por esta consulta vs. 105 mostrados na tela do PipeRun (diferença de 1,
 * consistente com borda de fuso horário, não erro de lógica). */
export async function fetchStageEntradasInRange(
  since: string,
  until: string,
): Promise<PipeRunStageHistory[]> {
  return fetchAllPages<PipeRunStageHistory>("/stageHistories", {
    show: String(PAGE_SIZE),
    in_date_start: `${since} 00:00:00`,
    in_date_end: `${until} 23:59:59`,
  });
}

/** Mesma ideia de fetchStageEntradasInRange, mas filtrando por SAÍDA de etapa
 * (out_date) — quantos negócios deixaram aquela etapa (avançaram pra próxima) dentro
 * do período. Junto com entrada, replica as duas colunas do relatório nativo "Taxa de
 * Conversão" do PipeRun (ENTRADA/SAÍDA por etapa). */
export async function fetchStageSaidasInRange(
  since: string,
  until: string,
): Promise<PipeRunStageHistory[]> {
  return fetchAllPages<PipeRunStageHistory>("/stageHistories", {
    show: String(PAGE_SIZE),
    out_date_start: `${since} 00:00:00`,
    out_date_end: `${until} 23:59:59`,
  });
}

// Funis e etapas quase nunca mudam: guarda 10 min no processo para não refazer as ~9 chamadas
// a cada tela. (Contagens de negócios NÃO passam por aqui.)
const META_TTL_MS = 10 * 60_000;
const metaCache = new Map<string, { value: Promise<unknown>; expiresAt: number }>();

function cachedMeta<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = metaCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as Promise<T>;
  const value = load().catch((error) => {
    metaCache.delete(key);
    throw error;
  });
  metaCache.set(key, { value, expiresAt: Date.now() + META_TTL_MS });
  return value;
}

export function fetchPipelines(): Promise<PipeRunPipeline[]> {
  return cachedMeta("pipelines", async () => {
    const result = await piperunFetch<PipeRunPipeline>("/pipelines", { show: "100" });
    return result.data;
  });
}

export function fetchStages(pipelineId: number): Promise<PipeRunStage[]> {
  return cachedMeta(`stages:${pipelineId}`, async () => {
    const result = await piperunFetch<PipeRunStage>("/stages", {
      pipeline_id: String(pipelineId),
      show: "100",
    });
    return result.data;
  });
}
