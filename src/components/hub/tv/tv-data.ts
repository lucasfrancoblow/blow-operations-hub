// Agregações do painel de TV. Só PipeRun (leads), 3C+ (ligações) e Meta/Google (anúncios).

import { adChannelFor, type AdMetricRow } from "@/lib/ad-metrics";
import type { CallMetricsData } from "@/lib/call-metrics";
import {
  isOutbound,
  pipelineKey,
  todayDateString,
  type DateRange,
  type LeadRecente,
  type LeadsRecentesData,
} from "@/lib/leads-recentes";
import type { FunnelStageEvent } from "@/lib/funnel-conversao";
import type { HubSnapshot } from "@/lib/pipeline-snapshot";

export interface TvData {
  leads: LeadsRecentesData | null;
  ads: AdMetricRow[] | null;
  calls: CallMetricsData | null;
  snapshot: HubSnapshot | null;
  /** Entradas em SQL/RA/RR/Contrato pelo histórico de etapas do PipeRun (mesma base do Funil de MKT). */
  events: FunnelStageEvent[] | null;
  /** Fontes ainda carregando: o widget mostra esqueleto só até a SUA fonte chegar. */
  pending: Record<TvSource, boolean>;
}

export type TvSource = "leads" | "ads" | "calls" | "snapshot" | "events";

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const int = (n: number) => n.toLocaleString("pt-BR");

/** Funil do mês pelo histórico real de etapas (entradas), com os leads criados como topo.
 * Cai para as marcas de etapa atual do lead enquanto o histórico não chegou. */
export function funnelOf(d: Pick<TvData, "leads" | "events">) {
  if (!d.events) return funnelCounts(d.leads);
  const entradas = d.events.filter((e) => e.direction === "entrada");
  const n = (metric: FunnelStageEvent["metric"]) =>
    entradas.filter((e) => e.metric === metric).length;
  return {
    leads: d.leads?.leads.length ?? 0,
    sql: n("sql"),
    reuniaoAgendada: n("reuniaoAgendada"),
    reuniaoRealizada: n("reuniaoRealizada"),
    rogaMarcado: n("rogaMarcado"),
    rogaRealizado: n("rogaRealizado"),
    contratoEnviado: n("contratoEnviado"),
    contratoAssinado: n("contratoAssinado"),
  };
}

export function funnelCounts(leads: LeadsRecentesData | null) {
  const list = leads?.leads ?? [];
  return {
    leads: list.length,
    sql: list.filter((l) => l.isSql).length,
    reuniaoAgendada: list.filter((l) => l.isReuniaoAgendada).length,
    reuniaoRealizada: list.filter((l) => l.isReuniaoRealizada).length,
    rogaMarcado: list.filter((l) => l.isRogaMarcado).length,
    rogaRealizado: list.filter((l) => l.isRogaRealizado).length,
    contratoEnviado: list.filter((l) => l.isContratoEnviado).length,
    contratoAssinado: list.filter((l) => l.isContratoAssinado).length,
  };
}

export function adTotals(ads: AdMetricRow[] | null) {
  const rows = ads ?? [];
  const spend = rows.reduce((s, r) => s + r.valor_usado, 0);
  const results = rows.reduce((s, r) => s + (r.resultados ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + (r.cliques_link ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + (r.impressoes ?? 0), 0);
  return {
    spend,
    results,
    cpl: results > 0 ? spend / results : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
  };
}

export function adsByChannel(ads: AdMetricRow[] | null) {
  const map = new Map<string, { channel: string; spend: number; results: number }>();
  for (const r of ads ?? []) {
    const key = adChannelFor(r);
    const cur = map.get(key) ?? { channel: key, spend: 0, results: 0 };
    cur.spend += r.valor_usado;
    cur.results += r.resultados ?? 0;
    map.set(key, cur);
  }
  return [...map.values()].map((c) => ({ ...c, cpl: c.results > 0 ? c.spend / c.results : 0 }));
}

export function topCampaigns(ads: AdMetricRow[] | null, limit = 6) {
  const map = new Map<string, { name: string; channel: string; spend: number; results: number }>();
  for (const r of ads ?? []) {
    const key = `${r.canal}:${r.campanha_id}`;
    const cur = map.get(key) ?? {
      name: r.campanha ?? r.campanha_id,
      channel: adChannelFor(r),
      spend: 0,
      results: 0,
    };
    cur.spend += r.valor_usado;
    cur.results += r.resultados ?? 0;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((c) => ({ ...c, cpl: c.results > 0 ? c.spend / c.results : 0 }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

/** Últimos `days` dias, terminando em `today` (YYYY-MM-DD). */
export function lastDaysRange(today: string, days = 30) {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return { from: d.toISOString().slice(0, 10), to: today };
}

/** Início do mês corrente. */
export function monthRange(today: string) {
  return { from: `${today.slice(0, 8)}01`, to: today };
}

/** Heatmap dia da semana (0 = Dom) × hora, em Brasília, dos leads criados. */
export function hourGrid(leads: LeadsRecentesData | null): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const l of leads?.leads ?? []) {
    const hour = Number(l.createdAt.slice(11, 13));
    const dow = new Date(`${l.createdAt.slice(0, 10)}T12:00:00Z`).getUTCDay();
    if (!Number.isNaN(hour)) grid[dow]![hour]! += 1;
  }
  return grid;
}

/** Qualidade por origem, cada eixo normalizado (0–100) contra a melhor origem do conjunto. */
export function originQuality(leads: LeadsRecentesData | null, top = 3) {
  const list = leads?.leads ?? [];
  const groups = new Map<string, typeof list>();
  for (const l of list) groups.set(l.origin, [...(groups.get(l.origin) ?? []), l]);
  const ranked = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, top);
  const axes: Array<{ metric: string; of: (ls: typeof list) => number }> = [
    { metric: "Volume", of: (ls) => ls.length },
    { metric: "Contato feito", of: (ls) => ls.filter((l) => l.lastContactAt).length / ls.length },
    { metric: "SQL", of: (ls) => ls.filter((l) => l.isSql).length / ls.length },
    {
      metric: "Reunião agendada",
      of: (ls) => ls.filter((l) => l.isReuniaoAgendada).length / ls.length,
    },
    {
      metric: "Reunião realizada",
      of: (ls) => ls.filter((l) => l.isReuniaoRealizada).length / ls.length,
    },
    { metric: "Contrato", of: (ls) => ls.filter((l) => l.isContratoEnviado).length / ls.length },
  ];
  const data = axes.map((axis) => {
    const raw = ranked.map(([, ls]) => axis.of(ls));
    const best = Math.max(...raw, 1e-9);
    const row: Record<string, string | number> = { metric: axis.metric };
    ranked.forEach(([name], i) => {
      row[`s${i}`] = Math.round((raw[i]! / best) * 100);
      void name;
    });
    return row;
  });
  return { data, names: ranked.map(([name]) => name) };
}

// ---------- Filtros da Visão geral ----------

export interface TvFilters {
  range: DateRange;
  /** Vazio = todos os funis (respeitando "incluir Outbound"). */
  funis: string[];
  /** Outbound é prospecção em lista (ex.: 1.030 negócios importados de uma vez), não lead de marketing. */
  incluirOutbound: boolean;
}

export function pipelineAllowed(name: string, f: Pick<TvFilters, "funis" | "incluirOutbound">) {
  if (!f.incluirOutbound && isOutbound(name)) return false;
  if (f.funis.length === 0) return true;
  return f.funis.some((x) => pipelineKey(x) === pipelineKey(name));
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** Recalcula os agregados de LeadsRecentesData em cima de uma lista já filtrada. */
export function filterLeadsData(
  data: LeadsRecentesData | null,
  f: Pick<TvFilters, "funis" | "incluirOutbound">,
  range: DateRange,
): LeadsRecentesData | null {
  if (!data) return null;
  const leads = data.leads.filter((l: LeadRecente) => pipelineAllowed(l.pipelineName, f));
  const today = todayDateString();
  const start = new Date(`${range.from}T12:00:00Z`);
  const end = new Date(`${range.to}T12:00:00Z`);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const perDay = new Map<string, number>();
  for (const l of leads)
    perDay.set(l.createdAt.slice(0, 10), (perDay.get(l.createdAt.slice(0, 10)) ?? 0) + 1);
  const byDay = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { date: d, total: perDay.get(d) ?? 0 };
  });
  return {
    leads,
    pipelineNames: data.pipelineNames,
    origins: [...new Set(leads.map((l) => l.origin))].sort(),
    destinos: [...new Set(leads.map((l) => l.destino))].sort(),
    summary: {
      total: leads.length,
      novos: leads.filter((l) => !l.emAndamento).length,
      emAndamento: leads.filter((l) => l.emAndamento).length,
      hoje: leads.filter((l) => l.createdAt.slice(0, 10) === today).length,
    },
    byDay,
    byOrigin: countBy(leads, (l) => l.origin).map(([origin, total]) => ({ origin, total })),
    byPipeline: countBy(leads, (l) => l.pipelineName).map(([pipeline, total]) => ({
      pipeline,
      total,
    })),
    byDestino: countBy(leads, (l) => l.destino).map(([destino, total]) => ({ destino, total })),
    ufs: [...new Set(leads.map((l) => l.uf).filter((u): u is string => !!u))].sort(),
    stageNames: [...new Set(leads.map((l) => l.stageName))].sort(),
  };
}

/** Mesma regra de funis aplicada ao retrato dos negócios abertos (totais recalculados). */
export function filterSnapshot(
  snapshot: HubSnapshot | null,
  f: Pick<TvFilters, "funis" | "incluirOutbound">,
): HubSnapshot | null {
  if (!snapshot) return null;
  const pipelines = snapshot.pipelines.filter((p) => pipelineAllowed(p.name, f));
  return {
    ...snapshot,
    pipelines,
    totals: {
      ...snapshot.totals,
      open: pipelines.reduce((s, p) => s + p.open, 0),
      value: pipelines.reduce((s, p) => s + p.value, 0),
      stalled: pipelines.reduce((s, p) => s + p.stalled, 0),
      abandoned: pipelines.reduce((s, p) => s + p.abandoned, 0),
      neverContacted: pipelines.reduce((s, p) => s + p.neverContacted, 0),
    },
  };
}
