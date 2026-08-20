import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Inbox, TrendingUp } from "lucide-react";

import { getLeadsRecentesData } from "@/services/leads-recentes-service";
import { defaultDateRange, type DateRange } from "@/lib/leads-recentes";
import { Button } from "@/components/ui/button";
import {
  CardsSkeleton,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/hub/primitives";
import { Stagger, StaggerItem } from "@/components/hub/motion";
import { DateRangePicker } from "@/components/hub/DateRangePicker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "hubLOw — Funil comercial BLOW" },
      {
        name: "description",
        content:
          "Dashboard de marketing, vendas e growth: leads, origem e funil, com dados reais do PipeRun.",
      },
      { property: "og:title", content: "hubLOw — Funil comercial BLOW" },
      {
        property: "og:description",
        content: "Acompanhe leads, origem e progresso do funil comercial da BLOW em um só painel.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const [range, setRange] = useState<DateRange>(() => defaultDateRange());

  const leads = useQuery({
    queryKey: ["piperun", "leads-recentes", range.from, range.to],
    queryFn: () => getLeadsRecentesData({ data: range }),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="hubLOw"
        subtitle="Funil comercial — dados reais do PipeRun, para MKT, Vendas e GT"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      {leads.isLoading ? (
        <CardsSkeleton />
      ) : !leads.data ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="PipeRun não configurado"
          description="Defina PIPERUN_API_KEY no ambiente do servidor para ver os dados reais aqui."
        />
      ) : (
        <>
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StaggerItem>
              <StatCard
                label="Leads no período"
                value={leads.data.summary.total}
                accent="primary"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Últimas 24h"
                value={leads.data.summary.ultimasVintQuatroHoras}
                accent="primary"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Novos"
                value={leads.data.summary.novos}
                accent="warning"
                tone="warning"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Em andamento"
                value={leads.data.summary.emAndamento}
                accent="success"
                tone="success"
              />
            </StaggerItem>
          </Stagger>

          <SectionCard
            title="Leads por dia"
            action={
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/funil-marketing">
                    <TrendingUp className="h-4 w-4" /> Funil de marketing
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/leads-recentes">Ver origem e destino</Link>
                </Button>
              </div>
            }
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={leads.data.byDay} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gLeadsOverview" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(8) + "/" + v.slice(5, 7)}
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
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Leads"
                    stroke="var(--color-primary)"
                    fill="url(#gLeadsOverview)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
