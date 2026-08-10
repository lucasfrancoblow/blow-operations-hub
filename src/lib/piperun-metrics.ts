// Monta a lista de "leads em risco" a partir da API real do PipeRun.
// Server-only (usa piperun-client, que depende de process.env). Sem persistência:
// recalculado a cada carga a partir dos negócios abertos no CRM.

import {
  fetchOpenDeals,
  fetchPipelines,
  fetchStages,
  isPipeRunConfigured,
  type PipeRunDeal,
} from "@/lib/piperun-client";

export interface ColdLead {
  id: number;
  title: string;
  pipelineName: string;
  stageName: string;
  ownerName: string;
  value: number;
  createdAt: string;
  lastContactAt: string | null;
  daysSinceContact: number;
  everContacted: boolean;
}

export interface PipeRunLeadsData {
  leads: ColdLead[];
  pipelineNames: string[];
  summary: {
    totalOpen: number;
    over7Days: number;
    over14Days: number;
    over30Days: number;
    neverContacted: number;
  };
}

function daysSince(dateStr: string, now: Date): number {
  const then = new Date(dateStr.replace(" ", "T") + "Z");
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function toColdLead(
  deal: PipeRunDeal,
  pipelineNames: Map<number, string>,
  stageNames: Map<number, string>,
  now: Date,
): ColdLead {
  const anchor = deal.last_contact_at ?? deal.created_at;
  return {
    id: deal.id,
    title: deal.title || `Negócio #${deal.id}`,
    pipelineName: pipelineNames.get(deal.pipeline_id) ?? "Funil não identificado",
    stageName: stageNames.get(deal.stage_id) ?? "Etapa não identificada",
    ownerName: deal.owner?.name ?? "Sem responsável",
    value: deal.value,
    createdAt: deal.created_at,
    lastContactAt: deal.last_contact_at,
    daysSinceContact: daysSince(anchor, now),
    everContacted: Boolean(deal.last_contact_at),
  };
}

export async function loadPipeRunLeadsData(): Promise<PipeRunLeadsData | null> {
  if (!isPipeRunConfigured()) return null;

  const [deals, pipelines] = await Promise.all([fetchOpenDeals(), fetchPipelines()]);
  const pipelineNames = new Map(pipelines.map((p) => [p.id, p.name] as const));

  const pipelineIdsInUse = Array.from(new Set(deals.map((d) => d.pipeline_id)));
  const stagesByPipeline = await Promise.all(pipelineIdsInUse.map((id) => fetchStages(id)));
  const stageNames = new Map(stagesByPipeline.flat().map((s) => [s.id, s.name] as const));

  const now = new Date();
  const leads = deals
    .map((d) => toColdLead(d, pipelineNames, stageNames, now))
    .sort((a, b) => b.daysSinceContact - a.daysSinceContact);

  const summary = {
    totalOpen: leads.length,
    over7Days: leads.filter((l) => l.daysSinceContact >= 7).length,
    over14Days: leads.filter((l) => l.daysSinceContact >= 14).length,
    over30Days: leads.filter((l) => l.daysSinceContact >= 30).length,
    neverContacted: leads.filter((l) => !l.everContacted).length,
  };

  return {
    leads,
    pipelineNames: Array.from(new Set(leads.map((l) => l.pipelineName))).sort(),
    summary,
  };
}
