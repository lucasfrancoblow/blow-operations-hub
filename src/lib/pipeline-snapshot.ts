// Retrato do PipeRun hoje: todos os funis, fase a fase, só com negócios ABERTOS
// (status=0). Alimenta a Visão geral. Perdidos não entram: o Kanban nativo conta
// negócios perdidos "parados" na fase e inflaria os números (ver piperun-client.ts).

import {
  fetchOpenDeals,
  fetchPipelines,
  fetchStages,
  isPipeRunConfigured,
} from "@/lib/piperun-client";
import { parsePipeRunDate } from "@/lib/leads-recentes";

/** Fase sem movimentação há mais que isso conta como "parada". */
const STALLED_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface StageSnapshot {
  id: number;
  name: string;
  order: number;
  color: string | null;
  count: number;
  value: number;
  stalled: number;
  neverContacted: number;
}

export interface PipelineSnapshot {
  id: number;
  name: string;
  /** Funis de Implantação e Sucesso do Franqueado são pós-venda; o resto é venda. */
  kind: "venda" | "pos-venda";
  open: number;
  value: number;
  stalled: number;
  neverContacted: number;
  stages: StageSnapshot[];
}

export interface OwnerSnapshot {
  name: string;
  open: number;
  value: number;
  stalled: number;
}

export interface HubSnapshot {
  pipelines: PipelineSnapshot[];
  owners: OwnerSnapshot[];
  totals: { open: number; value: number; stalled: number; neverContacted: number };
  updatedAt: string;
}

const POS_VENDA = new Set(["IMPLANTAÇÃO", "SUCESSO DO FRANQUEADO"]);

export async function loadHubSnapshot(): Promise<HubSnapshot | null> {
  if (!isPipeRunConfigured()) return null;

  const [pipelines, deals] = await Promise.all([fetchPipelines(), fetchOpenDeals()]);
  const stagesByPipeline = await Promise.all(pipelines.map((p) => fetchStages(p.id)));
  const now = Date.now();

  const byStage = new Map<
    number,
    { count: number; value: number; stalled: number; neverContacted: number }
  >();
  const byOwner = new Map<string, OwnerSnapshot>();
  let stalledTotal = 0;
  let neverContacted = 0;
  let valueTotal = 0;

  for (const d of deals) {
    const since = d.last_stage_updated_at ?? d.updated_at ?? d.created_at;
    const stalled = now - parsePipeRunDate(since).getTime() > STALLED_DAYS * DAY_MS;
    const cur = byStage.get(d.stage_id) ?? { count: 0, value: 0, stalled: 0, neverContacted: 0 };
    cur.count += 1;
    cur.value += d.value ?? 0;
    if (stalled) cur.stalled += 1;
    if (!d.last_contact_at) cur.neverContacted += 1;
    byStage.set(d.stage_id, cur);

    const ownerName = d.owner?.name ?? "Sem responsável";
    const o = byOwner.get(ownerName) ?? { name: ownerName, open: 0, value: 0, stalled: 0 };
    o.open += 1;
    o.value += d.value ?? 0;
    if (stalled) o.stalled += 1;
    byOwner.set(ownerName, o);

    if (stalled) stalledTotal += 1;
    if (!d.last_contact_at) neverContacted += 1;
    valueTotal += d.value ?? 0;
  }

  const snapshots: PipelineSnapshot[] = pipelines.map((p, i) => {
    const stages: StageSnapshot[] = (stagesByPipeline[i] ?? [])
      .map((s) => {
        const c = byStage.get(s.id) ?? { count: 0, value: 0, stalled: 0, neverContacted: 0 };
        return {
          id: s.id,
          name: s.name,
          order: s.order ?? 0,
          color: s.color ?? null,
          count: c.count,
          value: c.value,
          stalled: c.stalled,
          neverContacted: c.neverContacted,
        };
      })
      .sort((a, b) => a.order - b.order);
    return {
      id: p.id,
      name: p.name,
      kind: POS_VENDA.has(p.name.trim().toUpperCase()) ? "pos-venda" : "venda",
      open: stages.reduce((s, x) => s + x.count, 0),
      value: stages.reduce((s, x) => s + x.value, 0),
      stalled: stages.reduce((s, x) => s + x.stalled, 0),
      neverContacted: stages.reduce((s, x) => s + x.neverContacted, 0),
      stages,
    };
  });

  return {
    pipelines: snapshots.sort((a, b) => b.open - a.open),
    owners: [...byOwner.values()].sort((a, b) => b.open - a.open),
    totals: { open: deals.length, value: valueTotal, stalled: stalledTotal, neverContacted },
    updatedAt: new Date().toISOString(),
  };
}
