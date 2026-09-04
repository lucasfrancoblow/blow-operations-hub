// Feed de leads recém-chegados no PipeRun, pro time acompanhar direto no hub — o
// próprio avanço de etapa no CRM já diz se o lead foi trabalhado, então não duplicamos
// isso com um registro manual: "em andamento" é derivado automaticamente da etapa real.

import {
  fetchDealsInRange,
  fetchPipelines,
  fetchStages,
  isPipeRunConfigured,
  type PipeRunDeal,
} from "@/lib/piperun-client";

// O PipeRun devolve created_at no horário de Brasília (sem timezone no texto), não em
// UTC — tratar como UTC direto (só colando "Z") atrasava o relógio em 3h e fazia leads
// recém-chegados aparecerem como "há 4h" no radar ao vivo. Brasil não tem mais horário
// de verão desde 2019, então o offset -03:00 é fixo o ano todo.
export function parsePipeRunDate(createdAt: string): Date {
  return new Date(`${createdAt.replace(" ", "T")}-03:00`);
}

// Dia de hoje em Brasília, no mesmo formato YYYY-MM-DD do prefixo de created_at — dá
// pra comparar direto como texto, sem reconstruir Date. "en-CA" é só o jeito mais curto
// de pedir pro Intl formatar em ISO (YYYY-MM-DD) sem montar a string na mão.
export function todayDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// "Destino" (nome do Form/LP) não existe como campo pronto no PipeRun — é extraído do
// utm_campaign. Em vez de tentar adivinhar por um padrão de texto (o que gerava
// entradas soltas tipo "Form 08 04 26" pra campanha de teste antiga), mapeia direto
// contra a lista real de campanhas em uso hoje (confirmada com o time em 2026-08-20).
// Campanha fora dessa lista — teste, antiga, pausada — cai em "Outro".
const CAMPAIGN_DESTINO_MAP: Record<string, string> = {
  "BLOW-MO-LEA-ABO-META-LP-RAPHA-MATTOS-ESTATICOS": "LP Rapha Mattos",
  "BLOW-MO-LEA-ABO-META-LP-RAPHA-MATTOS-VIDEOS": "LP Rapha Mattos",
  "BLOW-MO-LEA-ABO-META-FORM-LAL-ESTATICOS": "Form Lal",
  "BLOW-MO-LEA-ABO-META-FORM-LAL-VIDEOS": "Form Lal",
  "BLOW-MO-LEA-ABO-META-FORM-INTERESSES-VIDEOS": "Form Interesses",
  "BLOW-MO-LEA-ABO-META-FORM-INTERESSES-ESTATICOS": "Form Interesses",
  "BLOW-MO-LEA-ABO-META-LP-RMKT-VIDEOS": "LP Rmkt",
  "BLOW-MO-LEA-ABO-META-LP-RMKT-ESTATICOS": "LP Rmkt",
  "BLOW-MO-LEA-ABO-META-LP-REPASSE": "LP Repasse",
  "BLOW-MO-LEA-GOO-LP-SEARCH-INSTITUCIONAL": "LP Search Institucional",
  "BLOW-MO-LEA-GOO-LP-GERACAO-DEMANDA-KEYWORD": "LP Geração Demanda",
  "BLOW-MO-LEA-GOO-LP-GERACAO-DEMANDA-MIX": "LP Geração Demanda",
  "BLOW-MO-LEA-GOO-LP-FUNDO-DE-FUNIL-FRANQUIA-DE-ESCOVARIA": "LP Franquia Escovaria",
  "BLOW-MO-LEA-GOO-LP-YOUTUBE-RAPHA-MATTOS": "LP Youtube Rapha Mattos",
  "BLOW-MO-LEA-GOO-LP-FUNDO-DE-FUNIL-FRANQUIA-DE-SALAO-DE-BELEZA": "LP Franquia Salão de Beleza",
  "BLOW-MO-LEA-GOO-LP-FUNDO-DE-FUNIL-FRANQUIA-DE-ESCOVA-EXPRESS": "LP Franquia Escova Express",
};

// Pipelines com destino próprio independente do utm_campaign — o card já nasce nessa
// pipeline (id fixo no workflow de criação), então não precisa esperar descobrir o
// nome exato da campanha que a LP vai mandar pra reconhecer de onde veio.
const PIPELINE_DESTINOS = new Set(["BLOW ACADEMY"]);

function classifyDestino(utmCampaign: string | null, pipelineName: string): string {
  const pipelineUpper = pipelineName.trim().toUpperCase();
  if (PIPELINE_DESTINOS.has(pipelineUpper)) return pipelineName.trim();
  if (!utmCampaign) return "Sem campanha";
  return CAMPAIGN_DESTINO_MAP[utmCampaign.trim().toUpperCase()] ?? "Outro";
}

// Etapas que ainda não tiveram nenhum trabalho real do time — qualquer etapa fora
// dessa lista conta como "em andamento", automaticamente, sem precisar de flag manual.
const ETAPAS_INICIAIS = new Set(["Novo Lead", "NOVO LEAD", "Contato Inicial"]);

// Funil real, lido direto da ordem das etapas no PipeRun (ver stages?pipeline_id=...):
// PRÉ VENDAS (0 Novo Lead → ... → 8 SQL → 10 Reunião Agendada, etapa final que passa o
// bastão) → EXPANSÃO CLOSER (0 Reunião Realizada → ... → 4 Contrato → 5 Venda). Cada
// flag abaixo é cumulativa: um lead que já está no Closer necessariamente passou por
// SQL e RA na Pré Vendas, mesmo que o card de lá não mostre mais isso.
const PIPELINE_CLOSER = "EXPANSÃO CLOSER";
const STAGE_SQL = "SQL";
const STAGE_REUNIAO_AGENDADA = "Reunião Agendada";
const STAGE_CONTRATO = "Contrato";
const STAGE_VENDA = "Venda";

function funnelFlags(pipelineName: string, stageName: string) {
  const inCloser = pipelineName.toUpperCase() === PIPELINE_CLOSER;
  const isSql = inCloser || stageName === STAGE_SQL || stageName === STAGE_REUNIAO_AGENDADA;
  const isReuniaoAgendada = inCloser || stageName === STAGE_REUNIAO_AGENDADA;
  const isReuniaoRealizada = inCloser;
  const isContratoEnviado = inCloser && (stageName === STAGE_CONTRATO || stageName === STAGE_VENDA);
  const isContratoAssinado = inCloser && stageName === STAGE_VENDA;
  return { isSql, isReuniaoAgendada, isReuniaoRealizada, isContratoEnviado, isContratoAssinado };
}

// Códigos de origem usados pelos workflows de criação de card no n8n (ver Deal-* nodes).
// Não é uma lista exaustiva de todo código que já existiu no CRM — só os que os fluxos
// atuais realmente geram; qualquer outro cai no fallback "Outra origem".
const ORIGIN_LABELS: Record<number, string> = {
  739346: "Sem UTM",
  739347: "Meta (pago)",
  739344: "Meta (orgânico)",
  739352: "Google",
};

const DEAL_STATUS_LABELS: Record<number, string> = {
  0: "Aberto",
  1: "Ganho",
  2: "Perdido",
  3: "Congelado",
};

export interface LeadRecente {
  id: number;
  title: string;
  pipelineName: string;
  stageName: string;
  ownerName: string;
  origin: string;
  destino: string;
  utmCampaign: string | null;
  status: string;
  value: number;
  createdAt: string;
  emAndamento: boolean;
  isSql: boolean;
  isReuniaoAgendada: boolean;
  isReuniaoRealizada: boolean;
  isContratoEnviado: boolean;
  isContratoAssinado: boolean;
  /** Só dígitos, com DDI (ex.: "5582993089537") — como o PipeRun devolve. Usar
   * formatPhoneBR/whatsappLink pra exibir/linkar. */
  phone: string | null;
}

export interface LeadsRecentesData {
  leads: LeadRecente[];
  pipelineNames: string[];
  origins: string[];
  destinos: string[];
  summary: {
    total: number;
    novos: number;
    emAndamento: number;
    hoje: number;
  };
  byDay: Array<{ date: string; total: number }>;
  byOrigin: Array<{ origin: string; total: number }>;
  byPipeline: Array<{ pipeline: string; total: number }>;
  byDestino: Array<{ destino: string; total: number }>;
}

/** O PipeRun pode ter mais de um telefone por pessoa — prioriza o marcado como
 * principal (`is_main`); sem isso, usa o primeiro que existir. */
function extractPhone(deal: PipeRunDeal): string | null {
  const phones = deal.person?.contactPhones ?? [];
  if (phones.length === 0) return null;
  const main = phones.find((p) => p.is_main === 1) ?? phones[0]!;
  const digits = main.phone.replace(/\D/g, "");
  return digits || null;
}

/** Formata um telefone brasileiro com DDI ("5582993089537" → "(82) 99308-9537").
 * Números fora do formato esperado (alguns leads de formulário chegam com dígito
 * duplicado) caem no fallback: devolve os dígitos como vieram, sem tentar adivinhar. */
export function formatPhoneBR(digits: string | null): string | null {
  if (!digits) return null;
  const withoutCountry = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = withoutCountry.slice(0, 2);
  const rest = withoutCountry.slice(2);
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return digits;
}

/** Link "clique pra conversar" no WhatsApp Web — wa.me espera só dígitos, com DDI. */
export function whatsappLink(digits: string | null): string | null {
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function toLeadRecente(
  deal: PipeRunDeal,
  pipelineNames: Map<number, string>,
  stageNames: Map<number, string>,
): LeadRecente {
  const stageName = stageNames.get(deal.stage_id) ?? "Etapa não identificada";
  const pipelineName = pipelineNames.get(deal.pipeline_id) ?? "Funil não identificado";
  const utmCampaign =
    deal.customFields?.find((c) => c.name === "utm_campaign")?.value?.trim() || null;
  return {
    id: deal.id,
    title: deal.title || `Negócio #${deal.id}`,
    pipelineName,
    stageName,
    ownerName: deal.owner?.name ?? "Sem responsável",
    origin: (deal.origin_id && ORIGIN_LABELS[deal.origin_id]) || "Outra origem",
    destino: classifyDestino(utmCampaign, pipelineName),
    utmCampaign,
    status: DEAL_STATUS_LABELS[deal.status] ?? "Desconhecido",
    value: deal.value,
    createdAt: deal.created_at,
    emAndamento: !ETAPAS_INICIAIS.has(stageName),
    phone: extractPhone(deal),
    ...funnelFlags(pipelineName, stageName),
  };
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

/** Range default quando a tela abre sem filtro explícito: últimos 14 dias. */
export function defaultDateRange(): DateRange {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 13);
  return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

/** Range default do Radar de Leads: só hoje (Brasília) — o time quer abrir a tela já
 * vendo o dia corrente, e filtrar outros períodos manualmente quando precisar. */
export function defaultRadarDateRange(): DateRange {
  const today = todayDateString();
  return { from: today, to: today };
}

export async function loadLeadsRecentesData(
  range: DateRange = defaultDateRange(),
): Promise<LeadsRecentesData | null> {
  if (!isPipeRunConfigured()) return null;

  const [deals, pipelines] = await Promise.all([
    fetchDealsInRange(range.from, range.to),
    fetchPipelines(),
  ]);
  const pipelineNames = new Map(pipelines.map((p) => [p.id, p.name] as const));

  const pipelineIdsInUse = Array.from(new Set(deals.map((d) => d.pipeline_id)));
  const stagesByPipeline = await Promise.all(pipelineIdsInUse.map((id) => fetchStages(id)));
  const stageNames = new Map(stagesByPipeline.flat().map((s) => [s.id, s.name] as const));

  const leads = deals
    .map((d) => toLeadRecente(d, pipelineNames, stageNames))
    .sort(
      (a, b) => parsePipeRunDate(b.createdAt).getTime() - parsePipeRunDate(a.createdAt).getTime(),
    );

  const today = todayDateString();
  const summary = {
    total: leads.length,
    novos: leads.filter((l) => !l.emAndamento).length,
    emAndamento: leads.filter((l) => l.emAndamento).length,
    hoje: leads.filter((l) => l.createdAt.slice(0, 10) === today).length,
  };

  const rangeStart = new Date(`${range.from}T00:00:00Z`);
  const rangeEnd = new Date(`${range.to}T00:00:00Z`);
  const dayCount =
    Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const byDay = Array.from({ length: Math.max(1, dayCount) }, (_, i) => {
    const d = new Date(rangeStart.getTime() + i * 24 * 60 * 60 * 1000);
    const date = d.toISOString().slice(0, 10);
    const total = leads.filter((l) => l.createdAt.slice(0, 10) === date).length;
    return { date, total };
  });

  const originCounts = new Map<string, number>();
  for (const l of leads) originCounts.set(l.origin, (originCounts.get(l.origin) ?? 0) + 1);
  const byOrigin = Array.from(originCounts, ([origin, total]) => ({ origin, total })).sort(
    (a, b) => b.total - a.total,
  );

  const pipelineCounts = new Map<string, number>();
  for (const l of leads)
    pipelineCounts.set(l.pipelineName, (pipelineCounts.get(l.pipelineName) ?? 0) + 1);
  const byPipeline = Array.from(pipelineCounts, ([pipeline, total]) => ({ pipeline, total })).sort(
    (a, b) => b.total - a.total,
  );

  const destinoCounts = new Map<string, number>();
  for (const l of leads) destinoCounts.set(l.destino, (destinoCounts.get(l.destino) ?? 0) + 1);
  const byDestino = Array.from(destinoCounts, ([destino, total]) => ({ destino, total })).sort(
    (a, b) => b.total - a.total,
  );

  return {
    leads,
    pipelineNames: Array.from(new Set(leads.map((l) => l.pipelineName))).sort(),
    origins: Array.from(new Set(leads.map((l) => l.origin))).sort(),
    destinos: Array.from(new Set(leads.map((l) => l.destino))).sort(),
    summary,
    byDay,
    byOrigin,
    byPipeline,
    byDestino,
  };
}
