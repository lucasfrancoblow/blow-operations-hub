import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Lightbulb, Megaphone, TrendingDown } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DateRangePicker } from "@/components/hub/DateRangePicker";
import { Stagger, StaggerItem } from "@/components/hub/motion";
import {
  CardsSkeleton,
  EmptyState,
  PageHeader,
  SectionCard,
  SortableHeader,
  StatCard,
  useSortState,
} from "@/components/hub/primitives";
import { adsByChannel, adTotals, brl, int, lastDaysRange } from "@/components/hub/tv/tv-data";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adChannelFor } from "@/lib/ad-metrics";
import { canAccessPage } from "@/lib/page-access";
import { todayDateString, type DateRange } from "@/lib/leads-recentes";
import { getAdMetricsData } from "@/services/ad-metrics-service";

export const Route = createFileRoute("/campanhas")({
  beforeLoad: ({ context }) => {
    if (!canAccessPage(context.user, "campanhas")) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Campanhas — hubLOw" },
      {
        name: "description",
        content: "Investimento, leads e custo por lead das campanhas de Meta e Google Ads.",
      },
    ],
  }),
  component: CampanhasPage,
});

type SortKey = "name" | "spend" | "results" | "cpl" | "ctr";

interface CampaignRow {
  key: string;
  name: string;
  channel: string;
  spend: number;
  results: number;
  cpl: number;
  ctr: number;
}

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
};

function CampanhasPage() {
  const [range, setRange] = useState<DateRange>(() => lastDaysRange(todayDateString(), 30));
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<string>("Todos");
  const { sort, toggleSort } = useSortState<SortKey>();

  const { data, isLoading } = useQuery({
    queryKey: ["campanhas", range],
    queryFn: () => getAdMetricsData({ data: range }),
    refetchInterval: 5 * 60_000,
  });

  const totals = adTotals(data ?? null);
  const channels = adsByChannel(data ?? null);

  const daily = useMemo(() => {
    const map = new Map<string, { spend: number; results: number }>();
    for (const r of data ?? []) {
      const cur = map.get(r.data_referencia) ?? { spend: 0, results: 0 };
      cur.spend += r.valor_usado;
      cur.results += r.resultados ?? 0;
      map.set(r.data_referencia, cur);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
        spend: Math.round(v.spend),
        results: v.results,
      }));
  }, [data]);

  const campaigns = useMemo<CampaignRow[]>(() => {
    const map = new Map<string, CampaignRow & { clicks: number; impressions: number }>();
    for (const r of data ?? []) {
      const key = `${r.canal}:${r.campanha_id}`;
      const cur = map.get(key) ?? {
        key,
        name: r.campanha ?? r.campanha_id,
        channel: adChannelFor(r),
        spend: 0,
        results: 0,
        cpl: 0,
        ctr: 0,
        clicks: 0,
        impressions: 0,
      };
      cur.spend += r.valor_usado;
      cur.results += r.resultados ?? 0;
      cur.clicks += r.cliques_link ?? 0;
      cur.impressions += r.impressoes ?? 0;
      map.set(key, cur);
    }
    return [...map.values()].map((c) => ({
      ...c,
      cpl: c.results > 0 ? c.spend / c.results : 0,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
    }));
  }, [data]);

  // Sugestões automáticas: onde está indo dinheiro sem retorno e o que foge da média.
  const insights = useMemo(() => {
    const out: Array<{ tone: "critical" | "warning" | "info"; text: string }> = [];
    const wasted = campaigns.filter((c) => c.results === 0 && c.spend >= 100);
    if (wasted.length) {
      const sum = wasted.reduce((s, c) => s + c.spend, 0);
      out.push({
        tone: "critical",
        text: `${wasted.length} campanha(s) gastaram ${brl(sum)} sem nenhum resultado: ${wasted
          .slice(0, 2)
          .map((c) => c.name)
          .join(", ")}${wasted.length > 2 ? "…" : ""}. Vale pausar ou revisar.`,
      });
    }
    if (totals.cpl > 0) {
      const expensive = campaigns.filter((c) => c.results >= 3 && c.cpl > totals.cpl * 1.5);
      if (expensive.length) {
        out.push({
          tone: "warning",
          text: `${expensive.length} campanha(s) com CPL 50% acima da média (${brl(totals.cpl)}), como "${expensive[0]!.name}" a ${brl(expensive[0]!.cpl)}.`,
        });
      }
      const best = campaigns.filter((c) => c.results >= 3).sort((a, b) => a.cpl - b.cpl)[0];
      if (best) {
        out.push({
          tone: "info",
          text: `Melhor custo por lead: "${best.name}" (${best.channel}) a ${brl(best.cpl)}. Candidata a ganhar mais verba.`,
        });
      }
    }
    return out;
  }, [campaigns, totals.cpl]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = campaigns.filter(
      (c) =>
        (channel === "Todos" || c.channel === channel) && (!q || c.name.toLowerCase().includes(q)),
    );
    const key = sort?.key ?? "spend";
    const dir = sort ? (sort.direction === "asc" ? 1 : -1) : -1;
    return filtered.sort((a, b) =>
      key === "name" ? dir * a.name.localeCompare(b.name) : dir * (a[key] - b[key]),
    );
  }, [campaigns, search, channel, sort]);

  const channelNames = ["Todos", ...channels.map((c) => c.channel)];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas"
        subtitle="Meta e Google Ads: onde o investimento vira lead."
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      {isLoading ? (
        <CardsSkeleton />
      ) : !data ? (
        <EmptyState
          icon={<Megaphone className="size-5" />}
          title="Métricas de anúncios não configuradas"
          description="Configure o Supabase com a tabela ad_metrics_daily para ver as campanhas."
        />
      ) : (
        <>
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StaggerItem>
              <StatCard
                label="Investimento"
                value={Math.round(totals.spend)}
                formatter={brl}
                accent="primary"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Resultados"
                value={totals.results}
                formatter={int}
                accent="success"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Custo por lead"
                value={Math.round(totals.cpl)}
                formatter={brl}
                accent="warning"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="CTR de link"
                value={Math.round(totals.ctr * 100)}
                formatter={(n) => `${(n / 100).toFixed(2).replace(".", ",")}%`}
                accent="success"
              />
            </StaggerItem>
          </Stagger>

          {insights.length > 0 && (
            <SectionCard title="Sugestões do hub">
              <ul className="space-y-2">
                {insights.map((i) => (
                  <li
                    key={i.text}
                    className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 text-sm"
                  >
                    {i.tone === "critical" ? (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-critical" />
                    ) : i.tone === "warning" ? (
                      <TrendingDown className="mt-0.5 size-4 shrink-0 text-warning" />
                    ) : (
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-info" />
                    )}
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SectionCard title="Investimento e resultados por dia" className="lg:col-span-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={daily} margin={{ left: -10, right: 8, top: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis yAxisId="l" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis
                      yAxisId="r"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <RTooltip contentStyle={tooltipStyle} />
                    <Bar
                      yAxisId="l"
                      dataKey="spend"
                      name="Investido (R$)"
                      fill="var(--color-chart-1)"
                      radius={[6, 6, 0, 0]}
                    />
                    <Line
                      yAxisId="r"
                      dataKey="results"
                      name="Resultados"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Por canal">
              <ul className="space-y-4">
                {channels.map((c) => (
                  <li key={c.channel} className="rounded-xl border border-border/70 p-3">
                    <p className="text-sm font-medium">{c.channel}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{brl(c.spend)}</p>
                    <p className="text-xs text-muted-foreground">
                      {int(c.results)} resultados · CPL {c.results ? brl(c.cpl) : "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard
            title="Todas as campanhas"
            action={
              <div className="flex items-center gap-2">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  aria-label="Canal"
                >
                  {channelNames.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar campanha"
                  className="h-9 w-48"
                />
              </div>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    label="Campanha"
                    sortKey="name"
                    active={sort}
                    onSort={toggleSort}
                  />
                  <TableHead>Canal</TableHead>
                  <SortableHeader
                    label="Investido"
                    sortKey="spend"
                    active={sort}
                    onSort={toggleSort}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Resultados"
                    sortKey="results"
                    active={sort}
                    onSort={toggleSort}
                    className="text-right"
                  />
                  <SortableHeader
                    label="CPL"
                    sortKey="cpl"
                    active={sort}
                    onSort={toggleSort}
                    className="text-right"
                  />
                  <SortableHeader
                    label="CTR"
                    sortKey="ctr"
                    active={sort}
                    onSort={toggleSort}
                    className="text-right"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.key}>
                    <TableCell className="max-w-72 truncate font-medium">{c.name}</TableCell>
                    <TableCell>{c.channel}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(c.spend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{int(c.results)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.results ? brl(c.cpl) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.ctr.toFixed(2).replace(".", ",")}%
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhuma campanha encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </SectionCard>
        </>
      )}
    </div>
  );
}
