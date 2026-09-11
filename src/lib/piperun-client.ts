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
  status: number; // 0 = aberto, 1 = ganho, 2 = perdido
  origin_id: number | null;
  value: number;
  created_at: string;
  updated_at: string;
  last_contact_at: string | null;
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

  const response = await fetch(url, { headers: { token, Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`PipeRun API respondeu ${response.status} em ${path}`);
  }

  return (await response.json()) as PipeRunPage<T>;
}

/** Todos os negócios abertos (status=0), paginando até o fim. */
export async function fetchOpenDeals(): Promise<PipeRunDeal[]> {
  const deals: PipeRunDeal[] = [];
  const first = await piperunFetch<PipeRunDeal>("/deals", {
    show: String(PAGE_SIZE),
    status: "0",
    page: "1",
  });
  deals.push(...first.data);

  const totalPages = first.meta.total_pages;
  for (let page = 2; page <= totalPages; page++) {
    const next = await piperunFetch<PipeRunDeal>("/deals", {
      show: String(PAGE_SIZE),
      status: "0",
      page: String(page),
    });
    deals.push(...next.data);
  }

  return deals;
}

/** Negócios criados dentro de um range de datas (YYYY-MM-DD, inclusivo), qualquer
 * status — pra ver tudo que chegou, incluindo o que já fechou/perdeu rápido. */
export async function fetchDealsInRange(since: string, until: string): Promise<PipeRunDeal[]> {
  const deals: PipeRunDeal[] = [];
  const first = await piperunFetch<PipeRunDeal>("/deals", {
    show: String(PAGE_SIZE),
    created_at_start: since,
    created_at_end: until,
    with: "customFields,person.contactPhones",
    order_by: "created_at",
    order: "desc",
    page: "1",
  });
  deals.push(...first.data);

  const totalPages = first.meta.total_pages;
  for (let page = 2; page <= totalPages; page++) {
    const next = await piperunFetch<PipeRunDeal>("/deals", {
      show: String(PAGE_SIZE),
      created_at_start: since,
      created_at_end: until,
      with: "customFields,person.contactPhones",
      order_by: "created_at",
      order: "desc",
      page: String(page),
    });
    deals.push(...next.data);
  }

  return deals;
}

/** Negócios buscados por lote de ids (id=1,2,3 — a API aceita lista separada por
 * vírgula em `id`, embora não conste na doc de parâmetros). Usado pra descobrir
 * pipeline/origem/utm de negócios que aparecem no histórico de etapa mas cujo
 * created_at pode estar fora do range de datas selecionado (ciclo de venda longo:
 * ver fetchStageEntradasInRange). */
export async function fetchDealsByIds(ids: number[]): Promise<PipeRunDeal[]> {
  if (ids.length === 0) return [];
  const deals: PipeRunDeal[] = [];
  const CHUNK_SIZE = 100;
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const result = await piperunFetch<PipeRunDeal>("/deals", {
      show: String(chunk.length),
      id: chunk.join(","),
      with: "customFields",
    });
    deals.push(...result.data);
  }
  return deals;
}

export interface PipeRunStageHistory {
  id: number;
  deal_id: number;
  in_stage_id: number;
  out_stage_id: number | null;
  in_date: string; // "YYYY-MM-DD HH:MM:SS", Brasília local (mesmo formato de deal.created_at)
  out_date: string | null;
}

interface PipeRunCursorPage<T> {
  success: boolean;
  data: T[];
  meta: { cursor: { next: string | null } };
}

async function piperunCursorFetch<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const token = getToken();
  if (!token) {
    throw new Error("PIPERUN_API_KEY não configurada no servidor.");
  }

  const items: T[] = [];
  let cursor = "";

  while (true) {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url, { headers: { token, Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`PipeRun API respondeu ${response.status} em ${path}`);
    }
    const page = (await response.json()) as PipeRunCursorPage<T>;
    items.push(...page.data);

    const next = page.meta?.cursor?.next;
    if (!next) break;
    cursor = next;
  }

  return items;
}

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
  return piperunCursorFetch<PipeRunStageHistory>("/stageHistories", {
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
  return piperunCursorFetch<PipeRunStageHistory>("/stageHistories", {
    show: String(PAGE_SIZE),
    out_date_start: `${since} 00:00:00`,
    out_date_end: `${until} 23:59:59`,
  });
}

export async function fetchPipelines(): Promise<PipeRunPipeline[]> {
  const result = await piperunFetch<PipeRunPipeline>("/pipelines", { show: "100" });
  return result.data;
}

export async function fetchStages(pipelineId: number): Promise<PipeRunStage[]> {
  const result = await piperunFetch<PipeRunStage>("/stages", {
    pipeline_id: String(pipelineId),
    show: "100",
  });
  return result.data;
}
