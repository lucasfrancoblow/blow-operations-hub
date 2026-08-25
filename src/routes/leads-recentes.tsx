import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Inbox, Radar } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getLeadsRecentesData } from "@/services/leads-recentes-service";
import {
  defaultRadarDateRange,
  parsePipeRunDate,
  todayDateString,
  type DateRange,
  type LeadRecente,
} from "@/lib/leads-recentes";
import { DateRangePicker } from "@/components/hub/DateRangePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  TablePagination,
  TableSkeleton,
} from "@/components/hub/primitives";
import { Stagger, StaggerItem } from "@/components/hub/motion";
import { LeadDetailDialog } from "@/components/hub/LeadDetailDialog";

export const Route = createFileRoute("/leads-recentes")({
  head: () => ({
    meta: [
      { title: "Radar de Leads — hubLOw BLOW" },
      {
        name: "description",
        content:
          "Leads que chegaram no PipeRun no período selecionado, com o progresso real do CRM.",
      },
      { property: "og:title", content: "Radar de Leads — hubLOw BLOW" },
      {
        property: "og:description",
        content:
          "Feed em tempo real dos leads que entram no CRM, com progresso automático por etapa.",
      },
    ],
  }),
  component: LeadsRecentesPage,
});

const PAGE_SIZE = 25;
const PROGRESSO_FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "novo", label: "Novos" },
  { value: "andamento", label: "Em andamento" },
];

function relativeTime(createdAt: string, now: number): string {
  const diffMs = now - parsePipeRunDate(createdAt).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

/** Feed ao vivo dos leads mais recentes — o "radar" de verdade da página: pulso animado
 * + tempo relativo que sobe sozinho, pra bater o olho e ver o que chegou agora. */
function LiveLeadTicker({ leads }: { leads: LeadRecente[] }) {
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const recent = leads.slice(0, 8);
  if (recent.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/8 via-transparent to-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {!reduce && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          )}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
        </span>
        <Radar className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Leads chegando agora
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {recent.map((lead, i) => (
          <motion.div
            key={lead.id}
            initial={reduce ? undefined : { opacity: 0, x: -12 }}
            animate={reduce ? undefined : { opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-w-[200px] shrink-0 flex-col gap-1 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{lead.title}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {relativeTime(lead.createdAt, now)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{lead.origin}</span>
              <span>·</span>
              <span className="truncate">{lead.destino}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function LeadsRecentesPage() {
  const [range, setRange] = useState<DateRange>(() => defaultRadarDateRange());

  const { data, isLoading } = useQuery({
    queryKey: ["piperun", "leads-recentes", range.from, range.to],
    queryFn: () => getLeadsRecentesData({ data: range }),
    refetchInterval: 60_000,
  });

  const [search, setSearch] = useState("");
  const [pipeline, setPipeline] = useState("todos");
  const [origem, setOrigem] = useState("todas");
  const [destino, setDestino] = useState("todos");
  const [progresso, setProgresso] = useState("todos");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LeadRecente | null>(null);

  const filtered = useMemo(() => {
    return (data?.leads ?? []).filter((l) => {
      if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (pipeline !== "todos" && l.pipelineName !== pipeline) return false;
      if (origem !== "todas" && l.origin !== origem) return false;
      if (destino !== "todos" && l.destino !== destino) return false;
      if (progresso === "novo" && l.emAndamento) return false;
      if (progresso === "andamento" && !l.emAndamento) return false;
      return true;
    });
  }, [data, search, pipeline, origem, destino, progresso]);

  // KPIs e gráficos respondem aos mesmos filtros da tabela — recalculados em cima da
  // lista já filtrada, não do agregado bruto do servidor. Sem isso, filtrar por
  // "Google" continuava mostrando o total geral nos números e gráficos acima.
  const filteredSummary = useMemo(() => {
    const today = todayDateString();
    return {
      total: filtered.length,
      novos: filtered.filter((l) => !l.emAndamento).length,
      emAndamento: filtered.filter((l) => l.emAndamento).length,
      hoje: filtered.filter((l) => l.createdAt.slice(0, 10) === today).length,
    };
  }, [filtered]);

  const filteredByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of filtered) {
      const day = l.createdAt.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return (data?.byDay ?? []).map((d) => ({ date: d.date, total: counts.get(d.date) ?? 0 }));
  }, [filtered, data]);

  function groupBy<K extends string>(items: LeadRecente[], key: (l: LeadRecente) => K) {
    const counts = new Map<string, number>();
    for (const l of items) {
      const k = key(l);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts, ([k, total]) => ({ key: k, total })).sort(
      (a, b) => b.total - a.total,
    );
  }

  const filteredByOrigin = useMemo(
    () => groupBy(filtered, (l) => l.origin).map((r) => ({ origin: r.key, total: r.total })),
    [filtered],
  );
  const filteredByDestino = useMemo(
    () => groupBy(filtered, (l) => l.destino).map((r) => ({ destino: r.key, total: r.total })),
    [filtered],
  );
  const filteredByPipeline = useMemo(
    () =>
      groupBy(filtered, (l) => l.pipelineName).map((r) => ({ pipeline: r.key, total: r.total })),
    [filtered],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Radar de Leads"
        subtitle="Dados reais do PipeRun — progresso automático por etapa"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      {!isLoading && !data ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="PipeRun não configurado"
          description="Defina PIPERUN_API_KEY no ambiente do servidor para ver os leads reais aqui."
        />
      ) : (
        <>
          {!isLoading && data && <LiveLeadTicker leads={data.leads} />}

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-border/60 bg-card">
                  <CardContent className="py-5">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
                    <div className="mt-2 h-7 w-12 animate-pulse rounded bg-muted/60" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StaggerItem>
                <StatCard label="Total no período" value={filteredSummary.total} accent="primary" />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Hoje"
                  value={filteredSummary.hoje}
                  accent="primary"
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Novos"
                  value={filteredSummary.novos}
                  accent="warning"
                  tone="warning"
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Em andamento"
                  value={filteredSummary.emAndamento}
                  accent="success"
                  tone="success"
                />
              </StaggerItem>
            </Stagger>
          )}

          {!isLoading && (
            <div className="grid gap-4">
              <SectionCard title="Leads por dia">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredByDay} margin={{ left: -20, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
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
                        fill="url(#gLeads)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <div className="grid gap-4 lg:grid-cols-3">
                <SectionCard title="Leads por origem (UTM)">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={filteredByOrigin.slice(0, 6)}
                        layout="vertical"
                        margin={{ left: 8, right: 12 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="origin"
                          width={100}
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <RTooltip
                          cursor={{ fill: "var(--color-muted)" }}
                          contentStyle={{
                            background: "var(--color-popover)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="total" name="Leads" fill="var(--color-primary)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>

                <SectionCard title="Leads por destino (LP / Forms)">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={filteredByDestino.slice(0, 6)}
                        layout="vertical"
                        margin={{ left: 8, right: 12 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="destino"
                          width={100}
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <RTooltip
                          cursor={{ fill: "var(--color-muted)" }}
                          contentStyle={{
                            background: "var(--color-popover)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="total" name="Leads" fill="var(--color-warning)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>

                <SectionCard title="Leads por funil">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={filteredByPipeline.slice(0, 6)}
                        layout="vertical"
                        margin={{ left: 8, right: 12 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="pipeline"
                          width={100}
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <RTooltip
                          cursor={{ fill: "var(--color-muted)" }}
                          contentStyle={{
                            background: "var(--color-popover)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="total" name="Leads" fill="var(--color-info)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          <div className="grid gap-3 rounded-xl border border-border/60 bg-card/60 p-3 sm:grid-cols-2 xl:grid-cols-5">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome"
            />
            <Select
              value={pipeline}
              onValueChange={(v) => {
                setPipeline(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os funis</SelectItem>
                {(data?.pipelineNames ?? []).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={origem}
              onValueChange={(v) => {
                setOrigem(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as origens</SelectItem>
                {(data?.origins ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={destino}
              onValueChange={(v) => {
                setDestino(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os destinos</SelectItem>
                {(data?.destinos ?? []).map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={progresso}
              onValueChange={(v) => {
                setProgresso(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROGRESSO_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Nenhum lead encontrado"
              description="Ajuste os filtros ou a busca."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/60">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Nome</TableHead>
                      <TableHead>Funil</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => setSelected(lead)}
                      >
                        <TableCell className="font-medium">{lead.title}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.pipelineName}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.stageName}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.origin}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.destino}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.ownerName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {parsePipeRunDate(lead.createdAt).toLocaleDateString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                current={current}
                totalPages={pages}
                totalItems={filtered.length}
                itemLabel="leads"
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      <LeadDetailDialog
        lead={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
