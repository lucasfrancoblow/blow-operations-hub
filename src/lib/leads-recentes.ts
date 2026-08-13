// Feed de leads recém-chegados no PipeRun, pro time validar direto no hub — combina
// negócios reais do CRM (últimos N dias, qualquer status) com o registro de validação
// manual guardado no Supabase (tabela leads_validacao).

import {
  fetchPipelines,
  fetchRecentDeals,
  fetchStages,
  isPipeRunConfigured,
  type PipeRunDeal,
} from "@/lib/piperun-client";
import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabase-client";

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

export interface LeadValidacaoRow {
  deal_id: number;
  validado: boolean;
  validado_por: string | null;
  observacao: string | null;
  created_at: string;
}

export interface LeadRecente {
  id: number;
  title: string;
  pipelineName: string;
  stageName: string;
  ownerName: string;
  origin: string;
  status: string;
  value: number;
  createdAt: string;
  validado: boolean;
  validadoPor: string | null;
  observacao: string | null;
}

export interface LeadsRecentesData {
  leads: LeadRecente[];
  pipelineNames: string[];
  origins: string[];
  summary: {
    total: number;
    pendentes: number;
    validados: number;
    ultimasVintQuatroHoras: number;
  };
}

function toLeadRecente(
  deal: PipeRunDeal,
  pipelineNames: Map<number, string>,
  stageNames: Map<number, string>,
  validacoes: Map<number, LeadValidacaoRow>,
): LeadRecente {
  const validacao = validacoes.get(deal.id);
  return {
    id: deal.id,
    title: deal.title || `Negócio #${deal.id}`,
    pipelineName: pipelineNames.get(deal.pipeline_id) ?? "Funil não identificado",
    stageName: stageNames.get(deal.stage_id) ?? "Etapa não identificada",
    ownerName: deal.owner?.name ?? "Sem responsável",
    origin: (deal.origin_id && ORIGIN_LABELS[deal.origin_id]) || "Outra origem",
    status: DEAL_STATUS_LABELS[deal.status] ?? "Desconhecido",
    value: deal.value,
    createdAt: deal.created_at,
    validado: validacao?.validado ?? false,
    validadoPor: validacao?.validado_por ?? null,
    observacao: validacao?.observacao ?? null,
  };
}

const RECENT_WINDOW_DAYS = 14;

export async function loadLeadsRecentesData(): Promise<LeadsRecentesData | null> {
  if (!isPipeRunConfigured()) return null;

  const [deals, pipelines] = await Promise.all([
    fetchRecentDeals(RECENT_WINDOW_DAYS),
    fetchPipelines(),
  ]);
  const pipelineNames = new Map(pipelines.map((p) => [p.id, p.name] as const));

  const pipelineIdsInUse = Array.from(new Set(deals.map((d) => d.pipeline_id)));
  const stagesByPipeline = await Promise.all(pipelineIdsInUse.map((id) => fetchStages(id)));
  const stageNames = new Map(stagesByPipeline.flat().map((s) => [s.id, s.name] as const));

  const validacoes = isSupabaseConfigured()
    ? new Map(
        (await supabaseSelect<LeadValidacaoRow>("leads_validacao", { select: "*" })).map(
          (r) => [r.deal_id, r] as const,
        ),
      )
    : new Map<number, LeadValidacaoRow>();

  const leads = deals
    .map((d) => toLeadRecente(d, pipelineNames, stageNames, validacoes))
    .sort(
      (a, b) =>
        new Date(b.createdAt.replace(" ", "T")).getTime() -
        new Date(a.createdAt.replace(" ", "T")).getTime(),
    );

  const now = Date.now();
  const summary = {
    total: leads.length,
    pendentes: leads.filter((l) => !l.validado).length,
    validados: leads.filter((l) => l.validado).length,
    ultimasVintQuatroHoras: leads.filter(
      (l) => now - new Date(l.createdAt.replace(" ", "T") + "Z").getTime() < 24 * 60 * 60 * 1000,
    ).length,
  };

  return {
    leads,
    pipelineNames: Array.from(new Set(leads.map((l) => l.pipelineName))).sort(),
    origins: Array.from(new Set(leads.map((l) => l.origin))).sort(),
    summary,
  };
}
