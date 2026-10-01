import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, Filter, Inbox, Radar as RadarIcon, Search, X } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DateRangePicker } from "@/components/hub/DateRangePicker";
import { LeadDetailDialog } from "@/components/hub/LeadDetailDialog";
import { MultiSelectFilter } from "@/components/hub/MultiSelectFilter";
import { CHANNEL_COLORS, LeadRadar } from "@/components/hub/charts/LeadRadar";
import { HourHeatmap } from "@/components/hub/charts/HourHeatmap";
import { OriginFlow } from "@/components/hub/charts/OriginFlow";
import { PhaseChips } from "@/components/hub/charts/PhaseChips";
import { RankBars } from "@/components/hub/charts/RankBars";
import { Stagger, StaggerItem } from "@/components/hub/motion";
import {
  CardsSkeleton,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  TablePagination,
  TableSkeleton,
} from "@/components/hub/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv-export";
import {
  defaultRadarDateRange,
  formatPhoneBR,
  isOutbound,
  parsePipeRunDate,
  todayDateString,
  type DateRange,
  type LeadRecente,
} from "@/lib/leads-recentes";
import { canAccessPage } from "@/lib/page-access";
import { cn } from "@/lib/utils";
import { getLeadsRecentesData } from "@/services/leads-recentes-service";

export const Route = createFileRoute("/leads-recentes")({
  beforeLoad: ({ context }) => {
    if (!canAccessPage(context.user, "leads-recentes")) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Radar de Leads — hubLOw" },
      {
        name: "description",
        content:
          "Leads do PipeRun por fase, origem e local de inscrição, com radar ao vivo e filtros.",
      },
    ],
  }),
  component: LeadsRecentesPage,
});

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["Todos", "Aberto", "Ganho", "Perdido"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function relativeTime(createdAt: string, now: number): string {
  const min = Math.round((now - parsePipeRunDate(createdAt).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

function presetRange(days: number): DateRange {
  const to = todayDateString();
  const d = new Date(`${to}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return { from: d.toISOString().slice(0, 10), to };
}

const PRESETS: Array<{ label: string; range: () => DateRange }> = [
  { label: "Hoje", range: () => defaultRadarDateRange() },
  { label: "7 dias", range: () => presetRange(7) },
  { label: "30 dias", range: () => presetRange(30) },
  {
    label: "Mês",
    range: () => {
      const to = todayDateString();
      return { from: `${to.slice(0, 8)}01`, to };
    },
  },
];

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
};

function count<K extends string>(items: LeadRecente[], key: (l: LeadRecente) => K | null) {
  const m = new Map<string, number>();
  for (const l of items) {
    const k = key(l);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function LeadsRecentesPage() {
  const [range, setRange] = useState<DateRange>(() => defaultRadarDateRange());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["piperun", "leads-recentes", range.from, range.to],
    queryFn: () => getLeadsRecentesData({ data: range }),
    refetchInterval: 60_000,
  });

  const [search, setSearch] = useState("");
  const [funis, setFunis] = useState<string[]>([]);
  const [fases, setFases] = useState<string[]>([]);
  const [origens, setOrigens] = useState<string[]>([]);
  const [inscricoes, setInscricoes] = useState<string[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("Todos");
  // Outbound = listas de prospecção importadas de uma vez (ex.: 1.030 negócios em 30/09); não são leads de marketing.
  const [incluirOutbound, setIncluirOutbound] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LeadRecente | null>(null);

  const all = data?.leads ?? [];

  const hiddenOutbound = useMemo(() => all.filter((l) => isOutbound(l.pipelineName)).length, [all]);

  const options = useMemo(
    () => ({
      inscricoes: [...new Set(all.map((l) => l.inscricao))].sort(),
      owners: [...new Set(all.map((l) => l.ownerName))].sort(),
    }),
    [all],
  );

  // Todos os filtros menos "fase": os chips de fase mostram quanto cada fase tem DENTRO
  // dos outros filtros, sem encolher quando o usuário seleciona uma delas.
  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((l) => {
      if (!incluirOutbound && isOutbound(l.pipelineName)) return false;
      if (q && !`${l.title} ${l.cidade ?? ""} ${l.ownerName}`.toLowerCase().includes(q))
        return false;
      if (funis.length && !funis.includes(l.pipelineName)) return false;
      if (origens.length && !origens.includes(l.origin)) return false;
      if (inscricoes.length && !inscricoes.includes(l.inscricao)) return false;
      if (ufs.length && !(l.uf && ufs.includes(l.uf))) return false;
      if (owners.length && !owners.includes(l.ownerName)) return false;
      if (status !== "Todos" && l.status !== status) return false;
      return true;
    });
  }, [all, search, funis, origens, inscricoes, ufs, owners, status, incluirOutbound]);

  const filtered = useMemo(
    () => (fases.length ? base.filter((l) => fases.includes(l.stageName)) : base),
    [base, fases],
  );

  const phaseChips = useMemo(() => {
    const m = new Map<string, { count: number; order: number; color: string | null; n: number }>();
    for (const l of base) {
      const cur = m.get(l.stageName) ?? { count: 0, order: 0, color: l.stageColor, n: 0 };
      cur.count += 1;
      cur.order += l.stageOrder;
      cur.n += 1;
      m.set(l.stageName, cur);
    }
    return [...m.entries()]
      .map(([key, v]) => ({
        key,
        label: key,
        count: v.count,
        color: v.color,
        order: v.order / v.n,
      }))
      .sort((a, b) => a.order - b.order);
  }, [base]);

  useEffect(() => setPage(1), [filtered.length]);

  const kpis = useMemo(() => {
    const today = todayDateString();
    const advanced = filtered.filter((l) => l.isSql).length;
    const open = filtered.filter((l) => l.status === "Aberto");
    return {
      total: filtered.length,
      hoje: filtered.filter((l) => l.createdAt.slice(0, 10) === today).length,
      semContato: open.filter((l) => !l.lastContactAt).length,
      sql: advanced,
      taxaSql: filtered.length ? Math.round((advanced / filtered.length) * 100) : 0,
    };
  }, [filtered]);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of filtered)
      m.set(l.createdAt.slice(0, 10), (m.get(l.createdAt.slice(0, 10)) ?? 0) + 1);
    return (data?.byDay ?? []).map((d) => ({
      label: `${d.date.slice(8)}/${d.date.slice(5, 7)}`,
      total: m.get(d.date) ?? 0,
    }));
  }, [filtered, data]);

  const heat = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    for (const l of filtered) {
      const hour = Number(l.createdAt.slice(11, 13));
      const dow = new Date(`${l.createdAt.slice(0, 10)}T12:00:00Z`).getUTCDay();
      if (!Number.isNaN(hour)) grid[dow]![hour]! += 1;
    }
    return grid;
  }, [filtered]);

  const flow = useMemo(() => {
    const m = new Map<string, number>();
    const order = new Map<string, { sum: number; n: number }>();
    for (const l of filtered) {
      const k = `${l.origin}\u0000${l.stageName}`;
      m.set(k, (m.get(k) ?? 0) + 1);
      const o = order.get(l.stageName) ?? { sum: 0, n: 0 };
      o.sum += l.stageOrder;
      o.n += 1;
      order.set(l.stageName, o);
    }
    const links = [...m.entries()].map(([k, value]) => {
      const [from, to] = k.split("\u0000") as [string, string];
      return { from, to, value };
    });
    const rightOrder = [...order.entries()]
      .sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)
      .map(([name]) => name);
    return { links, rightOrder };
  }, [filtered]);

  const byInscricao = useMemo(() => count(filtered, (l) => l.inscricao).slice(0, 8), [filtered]);
  const byUf = useMemo(() => count(filtered, (l) => l.uf).slice(0, 8), [filtered]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const activeFilters =
    funis.length +
    fases.length +
    origens.length +
    inscricoes.length +
    ufs.length +
    owners.length +
    (status !== "Todos" ? 1 : 0) +
    (search ? 1 : 0);

  function clearFilters() {
    setSearch("");
    setFunis([]);
    setFases([]);
    setOrigens([]);
    setInscricoes([]);
    setUfs([]);
    setOwners([]);
    setStatus("Todos");
  }

  function toggleFase(key: string) {
    setFases((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  function exportCsv() {
    downloadCsv(
      `radar-de-leads-${todayDateString()}.csv`,
      filtered.map((l) => ({
        titulo: l.title,
        telefone: formatPhoneBR(l.phone) ?? "",
        funil: l.pipelineName,
        fase: l.stageName,
        responsavel: l.ownerName,
        origem: l.origin,
        onde_se_inscreveu: l.inscricao,
        utm_source: l.utmSource ?? "",
        utm_medium: l.utmMedium ?? "",
        campanha_utm: l.utmCampaign ?? "",
        cidade: l.cidade ?? "",
        uf: l.uf ?? "",
        investimento: l.investimento ?? "",
        status: l.status,
        valor: l.value,
        criado_em: l.createdAt,
      })),
    );
  }

  const isPreset = (p: (typeof PRESETS)[number]) => {
    const r = p.range();
    return r.from === range.from && r.to === range.to;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Radar de Leads"
        subtitle="Todos os leads do PipeRun: em que fase estão e onde se inscreveram."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full bg-muted/60 p-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setRange(p.range())}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    isPreset(p)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <DateRangePicker value={range} onChange={setRange} />
            <Button
              variant="outline"
              size="sm"
              disabled={filtered.length === 0}
              onClick={exportCsv}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        }
      />

      {!isLoading && !data ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="PipeRun não configurado"
          description="Defina PIPERUN_API_KEY no ambiente do servidor para ver os leads reais aqui."
        />
      ) : (
        <>
          {/* Filtros */}
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:min-w-52 sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, cidade ou responsável"
                  className="pl-9"
                />
              </div>
              <MultiSelectFilter
                label="Funil"
                options={data?.pipelineNames ?? []}
                selected={funis}
                onChange={setFunis}
              />
              <MultiSelectFilter
                label="Origem"
                options={data?.origins ?? []}
                selected={origens}
                onChange={setOrigens}
              />
              <MultiSelectFilter
                label="Onde se inscreveu"
                options={options.inscricoes}
                selected={inscricoes}
                onChange={setInscricoes}
              />
              <MultiSelectFilter
                label="UF"
                options={data?.ufs ?? []}
                selected={ufs}
                onChange={setUfs}
              />
              <MultiSelectFilter
                label="Responsável"
                options={options.owners}
                selected={owners}
                onChange={setOwners}
              />
              <div className="flex rounded-full bg-muted/60 p-1">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      status === s
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={incluirOutbound} onCheckedChange={setIncluirOutbound} />
                <span>
                  Incluir Outbound
                  {!incluirOutbound && hiddenOutbound > 0 && (
                    <span className="ml-1 text-warning">
                      ({hiddenOutbound.toLocaleString("pt-BR")} fora)
                    </span>
                  )}
                </span>
              </label>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4" /> Limpar ({activeFilters})
                </Button>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Filter className="size-3" /> Fase em que está
                {fases.length > 0 && (
                  <button
                    type="button"
                    className="ml-2 normal-case text-primary hover:underline"
                    onClick={() => setFases([])}
                  >
                    limpar fases
                  </button>
                )}
              </p>
              {isLoading ? (
                <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
              ) : (
                <PhaseChips items={phaseChips} selected={fases} onToggle={toggleFase} />
              )}
            </div>
          </div>

          {isLoading ? (
            <CardsSkeleton count={4} />
          ) : (
            <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StaggerItem>
                <StatCard label="Leads no filtro" value={kpis.total} accent="primary" />
              </StaggerItem>
              <StaggerItem>
                <StatCard label="Entraram hoje" value={kpis.hoje} accent="primary" />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Abertos sem contato"
                  value={kpis.semContato}
                  accent="warning"
                  tone="warning"
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label={`Chegaram a SQL (${kpis.taxaSql}%)`}
                  value={kpis.sql}
                  accent="success"
                  tone="success"
                />
              </StaggerItem>
            </Stagger>
          )}

          {!isLoading && (
            <>
              <SectionCard
                title="Radar ao vivo"
                action={
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RadarIcon className="size-3.5 text-primary" /> clique num ponto para abrir o
                    lead
                  </span>
                }
              >
                <LeadRadar leads={filtered} onSelect={setSelected} />
              </SectionCard>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <SectionCard title="Leads por dia" className="lg:col-span-2">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={byDay} margin={{ left: -20, right: 8, top: 8 }}>
                        <defs>
                          <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          vertical={false}
                        />
                        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <RTooltip contentStyle={tooltipStyle} />
                        <Area
                          type="monotone"
                          dataKey="total"
                          name="Leads"
                          stroke="var(--color-primary)"
                          fill="url(#gLeads)"
                          strokeWidth={2.5}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>
                <SectionCard title="Onde se inscreveram">
                  <RankBars rows={byInscricao.map((r) => ({ label: r.label, value: r.value }))} />
                </SectionCard>
              </div>

              <SectionCard title="Da origem até a fase atual">
                <OriginFlow
                  links={flow.links}
                  rightOrder={flow.rightOrder}
                  colorOf={(o) => CHANNEL_COLORS[o] ?? "#375542"}
                />
              </SectionCard>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <SectionCard title="Melhores horários de entrada" className="lg:col-span-2">
                  <HourHeatmap grid={heat} />
                </SectionCard>
                <SectionCard title="Leads por estado">
                  <RankBars
                    rows={byUf.map((r) => ({ label: r.label, value: r.value }))}
                    empty="Nenhum lead informou UF."
                  />
                </SectionCard>
              </div>
            </>
          )}

          {/* Tabela */}
          <SectionCard title={`Leads (${filtered.length})`}>
            {isLoading ? (
              <TableSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title="Nenhum lead com esses filtros"
                description="Ajuste o período ou limpe os filtros."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead>Onde se inscreveu</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead className="text-right">Entrou</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((l) => (
                      <TableRow
                        key={l.id}
                        className="cursor-pointer"
                        onClick={() => setSelected(l)}
                      >
                        <TableCell className="max-w-64">
                          <p className="truncate font-medium">{l.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[l.cidade, l.uf].filter(Boolean).join(" / ") || "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ background: l.stageColor ?? "var(--color-primary)" }}
                            />
                            <span>
                              <span className="block text-sm">{l.stageName}</span>
                              <span className="block text-xs text-muted-foreground">
                                {l.pipelineName}
                              </span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="max-w-48 truncate">{l.inscricao}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2 text-sm">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: CHANNEL_COLORS[l.origin] ?? "#375542" }}
                            />
                            {l.origin}
                          </span>
                        </TableCell>
                        <TableCell>{l.ownerName}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                          {relativeTime(l.createdAt, now)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  current={current}
                  totalPages={pages}
                  totalItems={filtered.length}
                  itemLabel="leads"
                  onPageChange={setPage}
                />
              </>
            )}
          </SectionCard>
        </>
      )}

      <LeadDetailDialog
        lead={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
