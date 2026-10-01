// Agregações do painel de TV. Só PipeRun (leads), 3C+ (ligações) e Meta/Google (anúncios).

import { adChannelFor, type AdMetricRow } from "@/lib/ad-metrics";
import type { CallMetricsData } from "@/lib/call-metrics";
import type { LeadsRecentesData } from "@/lib/leads-recentes";

export interface TvData {
  leads: LeadsRecentesData | null;
  ads: AdMetricRow[] | null;
  calls: CallMetricsData | null;
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const int = (n: number) => n.toLocaleString("pt-BR");

export function funnelCounts(leads: LeadsRecentesData | null) {
  const list = leads?.leads ?? [];
  return {
    leads: list.length,
    sql: list.filter((l) => l.isSql).length,
    reuniaoAgendada: list.filter((l) => l.isReuniaoAgendada).length,
    reuniaoRealizada: list.filter((l) => l.isReuniaoRealizada).length,
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

export function monthRange(today: string) {
  return { from: `${today.slice(0, 8)}01`, to: today };
}
