// Métricas diárias de ligação da 3C Plus, já agregadas por um job externo (ver
// scripts/sync-3cplus-calls.ts e .github/workflows/sync-3cplus-calls.yml) na tabela
// call_metrics_daily do Supabase — não lemos a API da 3C Plus ao vivo aqui porque o
// endpoint /calls não tem relatório pronto e paginar tudo a cada carregamento de tela
// seria lento demais (ver call-browse.ts pra navegação pontual de um único dia).

import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabase-client";
import type { DateRange } from "@/lib/leads-recentes";

export interface CallMetricRow {
  call_date: string;
  agent_id: number;
  agent_name: string;
  campaign_id: number;
  campaign_name: string;
  status_id: number;
  status_text: string;
  total_calls: number;
  total_calling_seconds: number;
  total_speaking_seconds: number;
  recorded_count: number;
}

// status_id=7 "Finalizada" com um agente conectado é o proxy de "contato efetivo" —
// os outros status (Falha, Caixa postal, Não Atendida, Abandonada) nunca chegam a
// colocar um humano do nosso lado na linha, então não contam como conversa real.
const CONNECTED_STATUS_ID = 7;

export function isCallMetricsConfigured(): boolean {
  return isSupabaseConfigured();
}

export interface AgentSummary {
  agentId: number;
  agentName: string;
  totalCalls: number;
  connectedCalls: number;
  totalSpeakingSeconds: number;
  avgSpeakingSeconds: number;
}

export interface CampaignSummary {
  campaignId: number;
  campaignName: string;
  totalCalls: number;
  connectedCalls: number;
}

export interface CallMetricsData {
  rows: CallMetricRow[];
  byDay: Array<{ date: string; totalCalls: number; connectedCalls: number }>;
  byAgent: AgentSummary[];
  byCampaign: CampaignSummary[];
  totals: {
    totalCalls: number;
    connectedCalls: number;
    totalSpeakingSeconds: number;
  };
}

export async function loadCallMetrics(range: DateRange): Promise<CallMetricsData | null> {
  if (!isSupabaseConfigured()) return null;

  const rows = await supabaseSelect<CallMetricRow>("call_metrics_daily", {
    select:
      "call_date,agent_id,agent_name,campaign_id,campaign_name,status_id,status_text,total_calls,total_calling_seconds,total_speaking_seconds,recorded_count",
    call_date: `gte.${range.from}`,
    order: "call_date.asc",
  });
  const inRange = rows.filter((r) => r.call_date <= range.to);

  const byDayMap = new Map<string, { totalCalls: number; connectedCalls: number }>();
  const byAgentMap = new Map<number, AgentSummary>();
  const byCampaignMap = new Map<number, CampaignSummary>();
  const totals = { totalCalls: 0, connectedCalls: 0, totalSpeakingSeconds: 0 };

  for (const row of inRange) {
    const isConnected = row.status_id === CONNECTED_STATUS_ID && row.agent_id !== 0;

    const day = byDayMap.get(row.call_date) ?? { totalCalls: 0, connectedCalls: 0 };
    day.totalCalls += row.total_calls;
    if (isConnected) day.connectedCalls += row.total_calls;
    byDayMap.set(row.call_date, day);

    totals.totalCalls += row.total_calls;
    totals.totalSpeakingSeconds += row.total_speaking_seconds;
    if (isConnected) totals.connectedCalls += row.total_calls;

    if (row.agent_id !== 0) {
      const agent = byAgentMap.get(row.agent_id) ?? {
        agentId: row.agent_id,
        agentName: row.agent_name,
        totalCalls: 0,
        connectedCalls: 0,
        totalSpeakingSeconds: 0,
        avgSpeakingSeconds: 0,
      };
      agent.totalCalls += row.total_calls;
      agent.totalSpeakingSeconds += row.total_speaking_seconds;
      if (isConnected) agent.connectedCalls += row.total_calls;
      byAgentMap.set(row.agent_id, agent);
    }

    const campaign = byCampaignMap.get(row.campaign_id) ?? {
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      totalCalls: 0,
      connectedCalls: 0,
    };
    campaign.totalCalls += row.total_calls;
    if (isConnected) campaign.connectedCalls += row.total_calls;
    byCampaignMap.set(row.campaign_id, campaign);
  }

  const byAgent = Array.from(byAgentMap.values())
    .map((a) => ({
      ...a,
      avgSpeakingSeconds:
        a.connectedCalls > 0 ? Math.round(a.totalSpeakingSeconds / a.connectedCalls) : 0,
    }))
    .sort((a, b) => b.totalCalls - a.totalCalls);

  const byCampaign = Array.from(byCampaignMap.values()).sort((a, b) => b.totalCalls - a.totalCalls);

  const byDay = Array.from(byDayMap, ([date, v]) => ({ date, ...v })).sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );

  return { rows: inRange, byDay, byAgent, byCampaign, totals };
}
