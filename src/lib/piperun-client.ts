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
