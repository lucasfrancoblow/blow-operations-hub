import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Phone } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getCallMetricsData } from "@/services/call-metrics-service";
import { getCallsForDay } from "@/services/call-browse-service";
import { canAccessPage } from "@/lib/page-access";
import { defaultDateRange, todayDateString, type DateRange } from "@/lib/leads-recentes";
import { DateRangePicker } from "@/components/hub/DateRangePicker";
import {
  CardsSkeleton,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  useSortState,
} from "@/components/hub/primitives";
import { FadeIn } from "@/components/hub/motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/ligacoes")({
  beforeLoad: ({ context }) => {
    if (!canAccessPage(context.user, "ligacoes")) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Ligações — hubLOw BLOW" },
      {
        name: "description",
        content:
          "Métricas de ligação da 3C Plus: por agente, por campanha e taxa de conexão do discador.",
      },
    ],
  }),
  component: LigacoesPage,
});

function fmtDM(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function fmtDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function pct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

/** Cabeçalho ordenável no mesmo estilo simples (`<th>` cru) já usado nas
 * tabelas desta página — a versão de primitives.tsx usa o TableHead do
 * shadcn, que não bate com o padding dessas tabelas HTML puras. */
function SortTh<T extends string>({
  label,
  sortKey,
  active,
  onSort,
}: {
  label: string;
  sortKey: T;
  active: { key: T; direction: "asc" | "desc" } | null;
  onSort: (key: T) => void;
}) {
  const isActive = active?.key === sortKey;
  return (
    <th className="py-2 pr-4 text-right font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {isActive ? (
          active.direction === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function LigacoesPage() {
  const [range, setRange] = useState<DateRange>(() => defaultDateRange());
  const [browseDate, setBrowseDate] = useState<string>(() => todayDateString());

  const { data, isLoading } = useQuery({
    queryKey: ["call-metrics", range.from, range.to],
    queryFn: () => getCallMetricsData({ data: range }),
    refetchInterval: 120_000,
  });

  const { data: dayCalls, isLoading: dayLoading } = useQuery({
    queryKey: ["call-browse", browseDate],
    queryFn: () => getCallsForDay({ data: browseDate }),
  });

  const { sort: agentSort, toggleSort: toggleAgentSort } = useSortState<
    "totalCalls" | "connectedCalls" | "connectionRate" | "avgSpeakingSeconds"
  >();
  const { sort: campaignSort, toggleSort: toggleCampaignSort } = useSortState<
    "totalCalls" | "connectedCalls" | "connectionRate"
  >();

  const byAgent = [...(data?.byAgent ?? [])].sort((a, b) => {
    if (!agentSort) return 0;
    const dir = agentSort.direction === "asc" ? 1 : -1;
    if (agentSort.key === "connectionRate") {
      const ra = a.totalCalls > 0 ? a.connectedCalls / a.totalCalls : 0;
      const rb = b.totalCalls > 0 ? b.connectedCalls / b.totalCalls : 0;
      return (ra - rb) * dir;
    }
    return (a[agentSort.key] - b[agentSort.key]) * dir;
  });

  const byCampaign = [...(data?.byCampaign ?? [])].sort((a, b) => {
    if (!campaignSort) return 0;
    const dir = campaignSort.direction === "asc" ? 1 : -1;
    if (campaignSort.key === "connectionRate") {
      const ra = a.totalCalls > 0 ? a.connectedCalls / a.totalCalls : 0;
      const rb = b.totalCalls > 0 ? b.connectedCalls / b.totalCalls : 0;
      return (ra - rb) * dir;
    }
    return (a[campaignSort.key] - b[campaignSort.key]) * dir;
  });

  const lastSyncedDay = data?.byDay.length
    ? data.byDay.reduce((max, d) => (d.date > max ? d.date : max), data.byDay[0]!.date)
    : null;

  function exportAgentsCsv() {
    downloadCsv(
      `ligacoes-por-agente-${range.from}_${range.to}.csv`,
      byAgent.map((a) => ({
        agente: a.agentName,
        chamadas: a.totalCalls,
        conectadas: a.connectedCalls,
        taxa_conexao: pct(a.connectedCalls, a.totalCalls),
        tempo_medio_falando: fmtDuration(a.avgSpeakingSeconds),
      })),
    );
  }

  function exportCampaignsCsv() {
    downloadCsv(
      `ligacoes-por-campanha-${range.from}_${range.to}.csv`,
      byCampaign.map((c) => ({
        campanha: c.campaignName,
        chamadas: c.totalCalls,
        conectadas: c.connectedCalls,
        taxa_conexao: pct(c.connectedCalls, c.totalCalls),
      })),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ligações"
        subtitle="Métricas de ligação da 3C Plus — por agente, por campanha e taxa de conexão do discador"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      {lastSyncedDay && (
        <p className="text-xs text-muted-foreground">
          KPIs e tabelas abaixo atualizados até {fmtDM(lastSyncedDay)} (sincronização roda 1x por
          dia) — só "Chamadas do dia" abaixo é ao vivo.
        </p>
      )}

      {isLoading ? (
        <CardsSkeleton />
      ) : !data ? (
        <EmptyState
          icon={<Phone className="h-5 w-5" />}
          title="3C Plus não configurada"
          description="Rode a migração supabase/migrations/0022_create_call_metrics_daily.sql e configure o job scripts/sync-3cplus-calls.ts (ver .github/workflows/sync-3cplus-calls.yml)."
        />
      ) : (
        <FadeIn className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total de chamadas" value={data.totals.totalCalls} accent="primary" />
            <StatCard
              label="Chamadas conectadas (agente)"
              value={data.totals.connectedCalls}
              accent="success"
              tone="success"
            />
            <StatCard
              label="Taxa de conexão"
              value={
                data.totals.totalCalls > 0
                  ? Math.round((data.totals.connectedCalls / data.totals.totalCalls) * 100)
                  : 0
              }
              accent="warning"
              tone="warning"
              formatter={(n) => `${n}%`}
            />
            <StatCard
              label="Tempo total falando"
              value={data.totals.totalSpeakingSeconds}
              accent="primary"
              formatter={fmtDuration}
            />
          </div>

          <SectionCard title="Chamadas por dia (total vs conectadas)">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byDay} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDM}
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <RTooltip
                    labelFormatter={(v: string) => fmtDM(v)}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="totalCalls" name="Total" fill="var(--color-chart-1)" radius={4} />
                  <Bar
                    dataKey="connectedCalls"
                    name="Conectadas"
                    fill="var(--color-chart-3)"
                    radius={4}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard
            title="Por agente"
            action={
              <Button variant="outline" size="sm" onClick={exportAgentsCsv}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Agente</th>
                    <SortTh
                      label="Chamadas"
                      sortKey="totalCalls"
                      active={agentSort}
                      onSort={toggleAgentSort}
                    />
                    <SortTh
                      label="Conectadas"
                      sortKey="connectedCalls"
                      active={agentSort}
                      onSort={toggleAgentSort}
                    />
                    <SortTh
                      label="Taxa de conexão"
                      sortKey="connectionRate"
                      active={agentSort}
                      onSort={toggleAgentSort}
                    />
                    <SortTh
                      label="Tempo médio falando"
                      sortKey="avgSpeakingSeconds"
                      active={agentSort}
                      onSort={toggleAgentSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {byAgent.map((a) => (
                    <tr key={a.agentId} className="border-b border-border/40">
                      <td className="py-2 pr-4 font-medium">{a.agentName}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{a.totalCalls}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{a.connectedCalls}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {pct(a.connectedCalls, a.totalCalls)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {fmtDuration(a.avgSpeakingSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Por campanha"
            collapsible
            defaultCollapsed
            action={
              <Button variant="outline" size="sm" onClick={exportCampaignsCsv}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Campanha</th>
                    <SortTh
                      label="Chamadas"
                      sortKey="totalCalls"
                      active={campaignSort}
                      onSort={toggleCampaignSort}
                    />
                    <SortTh
                      label="Conectadas"
                      sortKey="connectedCalls"
                      active={campaignSort}
                      onSort={toggleCampaignSort}
                    />
                    <SortTh
                      label="Taxa de conexão"
                      sortKey="connectionRate"
                      active={campaignSort}
                      onSort={toggleCampaignSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {byCampaign.map((c) => (
                    <tr key={c.campaignId} className="border-b border-border/40">
                      <td className="py-2 pr-4">{c.campaignName}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{c.totalCalls}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{c.connectedCalls}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {pct(c.connectedCalls, c.totalCalls)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Chamadas do dia (com agente)"
            collapsible
            defaultCollapsed
            action={
              <Input
                type="date"
                value={browseDate}
                onChange={(e) => setBrowseDate(e.target.value)}
                className="w-auto"
              />
            }
          >
            {dayLoading ? (
              <CardsSkeleton count={1} />
            ) : !dayCalls ? (
              <EmptyState
                icon={<Phone className="h-5 w-5" />}
                title="3C Plus não configurada"
                description="Defina THREECPLUS_API_KEY no ambiente do servidor pra ver as chamadas individuais aqui."
              />
            ) : dayCalls.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma chamada com agente nesse dia.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Horário</th>
                      <th className="py-2 pr-4 font-medium">Agente</th>
                      <th className="py-2 pr-4 font-medium">Número</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Qualificação</th>
                      <th className="py-2 pr-4 text-right font-medium">Tempo falando</th>
                      <th className="py-2 pr-4 text-center font-medium">Gravada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayCalls.map((c) => (
                      <tr key={c.id} className="border-b border-border/40">
                        <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                          {c.callDate.slice(11, 16)}
                        </td>
                        <td className="py-2 pr-4">{c.agentName}</td>
                        <td className="py-2 pr-4 tabular-nums text-muted-foreground">{c.number}</td>
                        <td className="py-2 pr-4">{c.statusText}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {c.qualification ?? "—"}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{c.speakingTime}</td>
                        <td className="py-2 pr-4 text-center">{c.recorded ? "Sim" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </FadeIn>
      )}
    </div>
  );
}
