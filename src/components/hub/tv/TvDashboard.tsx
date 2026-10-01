import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Activity,
  GitBranch,
  GripVertical,
  LayoutGrid,
  Maximize2,
  Megaphone,
  Minimize2,
  Move,
  Pause,
  Phone,
  Play,
  Radar as RadarIcon,
  RotateCcw,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

import { CHANNEL_COLORS, LeadRadar } from "@/components/hub/charts/LeadRadar";
import { GlowRadar } from "@/components/hub/charts/GlowRadar";
import { HourHeatmap } from "@/components/hub/charts/HourHeatmap";
import { OriginFlow } from "@/components/hub/charts/OriginFlow";
import { RadialGauge } from "@/components/hub/charts/RadialGauge";
import { RankBars } from "@/components/hub/charts/RankBars";
import { AnimatedNumber } from "@/components/hub/motion";
import {
  adsByChannel,
  adTotals,
  brl,
  funnelCounts,
  funnelOf,
  hourGrid,
  int,
  filterLeadsData,
  filterSnapshot,
  originQuality,
  topCampaigns,
  type TvData,
  type TvFilters,
  type TvSource,
} from "@/components/hub/tv/tv-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { rangeFor, TvFilterBar, type RangePreset } from "@/components/hub/tv/TvFilterBar";
import { FunnelChart } from "@/components/ui/funnel-chart";
import {
  isOutbound,
  parsePipeRunDate,
  todayDateString,
  type DateRange,
} from "@/lib/leads-recentes";
import type { PipelineSnapshot } from "@/lib/pipeline-snapshot";
import { cn } from "@/lib/utils";
import { getAdMetricsData } from "@/services/ad-metrics-service";
import { getCallMetricsData } from "@/services/call-metrics-service";
import { getFunnelConversaoData } from "@/services/funnel-conversao-service";
import { getLeadsRecentesData } from "@/services/leads-recentes-service";
import { getHubSnapshot } from "@/services/pipeline-snapshot-service";

const ROTATE_MS = 30_000;
const STORAGE_KEY = "hublow-tv-layout-v2";
const FILTERS_KEY = "hublow-tv-filters-v1";
const EASE = [0.16, 1, 0.3, 1] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

type Size = "kpi" | "sm" | "md" | "lg" | "full";
const SIZE_CLASS: Record<Size, string> = {
  kpi: "col-span-6 lg:col-span-3",
  sm: "col-span-12 lg:col-span-4",
  md: "col-span-12 lg:col-span-6",
  lg: "col-span-12 lg:col-span-8",
  full: "col-span-12",
};

const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - parsePipeRunDate(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
};

// ---------- Peças ----------

function Kpi({
  label,
  value,
  format,
  hint,
  tone = "primary",
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  hint?: string;
  tone?: "primary" | "success" | "info" | "warning" | "critical";
}) {
  const bar = {
    primary: "bg-primary",
    success: "bg-success",
    info: "bg-info",
    warning: "bg-warning",
    critical: "bg-critical",
  }[tone];
  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div>
        <AnimatedNumber
          value={Math.round(value)}
          {...(format ? { formatter: format } : {})}
          className="font-display text-4xl font-semibold tabular-nums tracking-tight group-data-[tv=true]/tv:text-6xl"
        />
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className={cn("h-1 w-10 rounded-full", bar)} />
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ChartBox({ children }: { children: ReactNode }) {
  return <div className="h-72 w-full group-data-[tv=true]/tv:h-96">{children}</div>;
}

/** Rampa de laranja da marca: etapa inicial clara → etapa final intensa (em vez das cores do Kanban). */
function stageRamp(index: number, total: number): string {
  const pct = total <= 1 ? 100 : 28 + (72 * index) / (total - 1);
  return `color-mix(in oklab, var(--color-primary) ${pct}%, var(--color-muted))`;
}

// ---------- Widgets de dados ----------

function LeadsPorDia({ d }: { d: TvData }) {
  const data = (d.leads?.byDay ?? []).map((x) => ({ ...x, label: dayLabel(x.date) }));
  if (!data.length) return <Empty>Sem leads no período.</Empty>;
  return (
    <ChartBox>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="tvLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
          <RTooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Leads"]} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            fill="url(#tvLeads)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

function FunilLeads({ d }: { d: TvData }) {
  const mobile = useIsMobile();
  const c = funnelOf(d);
  if (!c.leads) return <Empty>Sem leads no período.</Empty>;
  return (
    <FunnelChart
      orientation={mobile ? "vertical" : "horizontal"}
      style={{ aspectRatio: mobile ? "1 / 1.5" : "4.4 / 1" }}
      data={[
        { label: "Leads", value: c.leads },
        { label: "SQL", value: c.sql },
        { label: "Reunião agendada", value: c.reuniaoAgendada },
        { label: "Reunião realizada", value: c.reuniaoRealizada },
        { label: "RoGa marcado", value: c.rogaMarcado },
        { label: "RoGa realizada", value: c.rogaRealizado },
        { label: "Contrato enviado", value: c.contratoEnviado },
        { label: "Assinado", value: c.contratoAssinado },
      ].map((st) => ({ ...st, shape: Math.pow(st.value, 0.4) }))}
      color="var(--chart-2)"
      edges="curved"
    />
  );
}

function FeedLeads({ d }: { d: TvData }) {
  const items = (d.leads?.leads ?? []).slice(0, 7);
  if (!items.length) return <Empty>Nenhum lead novo ainda.</Empty>;
  return (
    <ul className="space-y-1">
      <AnimatePresence initial={false}>
        {items.map((l) => (
          <motion.li
            key={l.id}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60"
          >
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{l.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {l.inscricao} · {l.stageName}
                {l.uf ? ` · ${l.uf}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(l.createdAt)}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function Rank({ rows }: { rows: Array<{ label: string; value: number }> }) {
  return <RankBars rows={rows} />;
}

function PorOrigem({ d }: { d: TvData }) {
  return (
    <RankBars
      rows={(d.leads?.byOrigin ?? []).slice(0, 6).map((o) => ({
        label: o.origin,
        value: o.total,
        color: CHANNEL_COLORS[o.origin] ?? "#375542",
      }))}
    />
  );
}

function PorInscricao({ d }: { d: TvData }) {
  const m = new Map<string, number>();
  for (const l of d.leads?.leads ?? []) m.set(l.inscricao, (m.get(l.inscricao) ?? 0) + 1);
  const rows = [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);
  return <Rank rows={rows} />;
}

function PorUf({ d }: { d: TvData }) {
  const m = new Map<string, number>();
  for (const l of d.leads?.leads ?? []) if (l.uf) m.set(l.uf, (m.get(l.uf) ?? 0) + 1);
  const rows = [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  return <RankBars rows={rows} empty="Nenhum lead informou UF." />;
}

function RadarLeads({ d }: { d: TvData }) {
  const recent = (d.leads?.leads ?? []).filter(
    (l) => Date.now() - parsePipeRunDate(l.createdAt).getTime() < 7 * DAY_MS,
  );
  return <LeadRadar leads={recent} />;
}

function Fluxo({ d }: { d: TvData }) {
  const links = new Map<string, number>();
  const order = new Map<string, { sum: number; n: number }>();
  for (const l of d.leads?.leads ?? []) {
    const k = `${l.origin}\u0000${l.stageName}`;
    links.set(k, (links.get(k) ?? 0) + 1);
    const o = order.get(l.stageName) ?? { sum: 0, n: 0 };
    o.sum += l.stageOrder;
    o.n += 1;
    order.set(l.stageName, o);
  }
  return (
    <OriginFlow
      links={[...links.entries()].map(([k, value]) => {
        const [from, to] = k.split("\u0000") as [string, string];
        return { from, to, value };
      })}
      rightOrder={[...order.entries()]
        .sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)
        .map(([n]) => n)}
      colorOf={(o) => CHANNEL_COLORS[o] ?? "#375542"}
    />
  );
}

function Qualidade({ d }: { d: TvData }) {
  const { data, names } = originQuality(d.leads);
  if (!names.length) return <Empty>Sem leads no período.</Empty>;
  return (
    <div>
      <GlowRadar
        data={data}
        series={names.map((n, i) => ({
          key: `s${i}`,
          label: n,
          color: CHANNEL_COLORS[n] ?? "#375542",
        }))}
      />
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {names.map((n, i) => (
          <li key={n} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ background: CHANNEL_COLORS[n] ?? "#375542" }}
            />
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Medidores({ d }: { d: TvData }) {
  const c = funnelOf(d);
  const list = d.leads?.leads ?? [];
  const contacted = list.length
    ? (list.filter((l) => l.lastContactAt).length / list.length) * 100
    : 0;
  const sql = c.leads ? (c.sql / c.leads) * 100 : 0;
  const ra = c.sql ? (c.reuniaoAgendada / c.sql) * 100 : 0;
  const rr = c.reuniaoAgendada ? (c.reuniaoRealizada / c.reuniaoAgendada) * 100 : 0;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <RadialGauge
        value={contacted}
        label="Com contato"
        hint="leads já abordados"
        color="#2A78D6"
      />
      <RadialGauge value={sql} label="Lead → SQL" hint="qualificação" color="#D74015" />
      <RadialGauge value={ra} label="SQL → Reunião" hint="agendamento" color="#EDA100" />
      <RadialGauge value={rr} label="Reunião → Realizada" hint="comparecimento" color="#375542" />
    </div>
  );
}

function Mapa({ d }: { d: TvData }) {
  return <HourHeatmap grid={hourGrid(d.leads)} />;
}

function StagesBar({ pipeline }: { pipeline: PipelineSnapshot }) {
  const max = Math.max(1, ...pipeline.stages.map((s) => s.count));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          <b className="text-foreground">{int(pipeline.open)}</b> abertos
        </span>
        <span className="text-muted-foreground">
          <b className="text-foreground">{brl(pipeline.value)}</b> em valor
        </span>
        <span className={pipeline.stalled ? "text-warning" : "text-muted-foreground"}>
          <b>{int(pipeline.stalled)}</b> parados +7 dias
        </span>
      </div>
      <ul className="space-y-2.5">
        {pipeline.stages.map((s, i) => (
          <li
            key={s.id}
            className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm"
          >
            <span className="truncate text-muted-foreground">{s.name}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ background: stageRamp(i, pipeline.stages.length) }}
                initial={{ width: 0 }}
                animate={{ width: `${(s.count / max) * 100}%` }}
                transition={{ duration: 0.8, ease: EASE, delay: i * 0.04 }}
              />
            </div>
            <span className="min-w-8 text-right font-semibold tabular-nums">
              {s.count}
              {s.stalled > 0 && (
                <span className="ml-1 text-xs font-normal text-warning">·{s.stalled}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TodosFunis({ d }: { d: TvData }) {
  const pipelines = d.snapshot?.pipelines ?? [];
  if (!d.snapshot) return <Empty>PipeRun não configurado.</Empty>;
  return (
    <ul className="space-y-5">
      {pipelines.map((p) => {
        const total = Math.max(1, p.open);
        return (
          <li key={p.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">
                {p.name}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {p.kind === "pos-venda" ? "pós-venda" : "vendas"}
                </span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                <b className="text-foreground">{int(p.open)}</b> abertos · {brl(p.value)}
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {p.stages
                .map((s, i) => ({ s, i }))
                .filter(({ s }) => s.count > 0)
                .map(({ s, i }) => (
                  <motion.div
                    key={s.id}
                    title={`${s.name}: ${s.count}`}
                    className="h-full border-r border-card/60 last:border-r-0"
                    style={{ background: stageRamp(i, p.stages.length) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.count / total) * 100}%` }}
                    transition={{ duration: 0.8, ease: EASE, delay: i * 0.04 }}
                  />
                ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Time({ d }: { d: TvData }) {
  const owners = (d.snapshot?.owners ?? []).slice(0, 8);
  if (!d.snapshot) return <Empty>PipeRun não configurado.</Empty>;
  return (
    <RankBars
      rows={owners.map((o) => ({
        label: o.name,
        value: o.open,
        sub: o.stalled ? `${o.stalled} parados` : "",
        display: `${int(o.open)} · ${brl(o.value)}`,
      }))}
    />
  );
}

function InvestimentoCanal({ d }: { d: TvData }) {
  if (!d.ads) return <Empty>Métricas de anúncios não configuradas.</Empty>;
  return (
    <RankBars
      rows={adsByChannel(d.ads).map((c) => ({
        label: c.channel,
        value: c.spend,
        display: brl(c.spend),
      }))}
    />
  );
}

function InvestimentoDia({ d }: { d: TvData }) {
  const byDay = new Map<string, number>();
  for (const r of d.ads ?? [])
    byDay.set(r.data_referencia, (byDay.get(r.data_referencia) ?? 0) + r.valor_usado);
  const data = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, spend]) => ({ label: dayLabel(date), spend: Math.round(spend) }));
  if (!data.length) return <Empty>Sem investimento no período.</Empty>;
  return (
    <ChartBox>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} />
          <RTooltip contentStyle={tooltipStyle} formatter={(v) => [brl(Number(v)), "Investido"]} />
          <Bar dataKey="spend" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

function TopCampanhas({ d }: { d: TvData }) {
  const rows = topCampaigns(d.ads, 7);
  if (!rows.length) return <Empty>Sem campanhas no período.</Empty>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
          <th className="pb-2 font-medium">Campanha</th>
          <th className="pb-2 text-right font-medium">Investido</th>
          <th className="pb-2 text-right font-medium">Leads</th>
          <th className="pb-2 text-right font-medium">CPL</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.channel}-${r.name}`} className="border-t border-border/60">
            <td className="max-w-0 py-2 pr-3">
              <p className="truncate font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.channel}</p>
            </td>
            <td className="py-2 text-right tabular-nums">{brl(r.spend)}</td>
            <td className="py-2 text-right tabular-nums">{int(r.results)}</td>
            <td className="py-2 text-right tabular-nums">{r.results ? brl(r.cpl) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LigacoesDia({ d }: { d: TvData }) {
  const data = (d.calls?.byDay ?? []).map((x) => ({ ...x, label: dayLabel(x.date) }));
  if (!d.calls) return <Empty>Métricas de ligações não configuradas.</Empty>;
  if (!data.length) return <Empty>Sem ligações no período.</Empty>;
  return (
    <ChartBox>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
          <RTooltip contentStyle={tooltipStyle} />
          <Bar
            dataKey="totalCalls"
            name="Ligações"
            fill="var(--color-chart-1)"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="connectedCalls"
            name="Atendidas"
            fill="var(--color-chart-3)"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

function RankingAgentes({ d }: { d: TvData }) {
  if (!d.calls) return <Empty>Métricas de ligações não configuradas.</Empty>;
  return (
    <RankBars
      rows={d.calls.byAgent
        .slice()
        .sort((a, b) => b.connectedCalls - a.connectedCalls)
        .slice(0, 7)
        .map((a) => ({ label: a.agentName, value: a.connectedCalls }))}
    />
  );
}

// ---------- Registro de widgets e cenas ----------

interface WidgetDef {
  title: string;
  size: Size;
  render: (d: TvData) => ReactNode;
}

function buildWidgets(snapshot: TvData["snapshot"]): Record<string, WidgetDef> {
  const f = (d: TvData) => funnelOf(d);
  const a = (d: TvData) => adTotals(d.ads);
  const calls = (d: TvData) => d.calls?.totals;
  const base: Record<string, WidgetDef> = {
    "kpi-hoje": {
      title: "Leads hoje",
      size: "kpi",
      render: (d) => (
        <Kpi label="Leads hoje" value={d.leads?.summary.hoje ?? 0} hint="entraram desde 00h" />
      ),
    },
    "kpi-mes": {
      title: "Leads no período",
      size: "kpi",
      render: (d) => (
        <Kpi label="Leads no período" value={f(d).leads} tone="info" hint="criados no PipeRun" />
      ),
    },
    "kpi-sql": {
      title: "SQL",
      size: "kpi",
      render: (d) => {
        const c = f(d);
        return (
          <Kpi
            label="SQL no período"
            value={c.sql}
            tone="warning"
            hint={c.leads ? `${Math.round((c.sql / c.leads) * 100)}% dos leads` : ""}
          />
        );
      },
    },
    "kpi-contratos": {
      title: "Contratos assinados",
      size: "kpi",
      render: (d) => (
        <Kpi
          label="Contratos assinados"
          value={f(d).contratoAssinado}
          tone="success"
          hint="no período"
        />
      ),
    },
    "kpi-roga-marcado": {
      title: "RoGa marcado",
      size: "kpi",
      render: (d) => (
        <Kpi
          label="RoGa marcado"
          value={f(d).rogaMarcado}
          tone="warning"
          hint="entradas no período"
        />
      ),
    },
    "kpi-roga-realizado": {
      title: "RoGa realizada",
      size: "kpi",
      render: (d) => {
        const c = f(d);
        return (
          <Kpi
            label="RoGa realizada"
            value={c.rogaRealizado}
            tone="success"
            hint={
              c.rogaMarcado
                ? `${Math.round((c.rogaRealizado / c.rogaMarcado) * 100)}% dos marcados`
                : "entradas no período"
            }
          />
        );
      },
    },
    "kpi-abertos": {
      title: "Negócios abertos",
      size: "kpi",
      render: (d) => (
        <Kpi
          label="Negócios abertos"
          value={d.snapshot?.totals.open ?? 0}
          tone="info"
          hint="todos os funis"
        />
      ),
    },
    "kpi-valor": {
      title: "Valor em aberto",
      size: "kpi",
      render: (d) => (
        <Kpi
          label="Valor em aberto"
          value={d.snapshot?.totals.value ?? 0}
          format={brl}
          tone="success"
          hint="soma dos negócios abertos"
        />
      ),
    },
    "kpi-parados": {
      title: "Parados",
      size: "kpi",
      render: (d) => (
        <Kpi
          label="Parados +7 dias"
          value={d.snapshot?.totals.stalled ?? 0}
          tone="warning"
          hint="sem mudar de fase"
        />
      ),
    },
    "kpi-sem-contato": {
      title: "Sem contato",
      size: "kpi",
      render: (d) => (
        <Kpi
          label="Nunca contatados"
          value={d.snapshot?.totals.neverContacted ?? 0}
          tone="critical"
          hint="abertos sem 1º contato"
        />
      ),
    },
    "leads-dia": { title: "Leads por dia", size: "lg", render: (d) => <LeadsPorDia d={d} /> },
    "feed-leads": { title: "Chegando agora", size: "sm", render: (d) => <FeedLeads d={d} /> },
    funil: {
      title: "Funil de vendas (no período)",
      size: "full",
      render: (d) => <FunilLeads d={d} />,
    },
    medidores: { title: "Conversão entre fases", size: "full", render: (d) => <Medidores d={d} /> },
    "todos-funis": {
      title: "Todos os funis hoje (negócios abertos por fase)",
      size: "full",
      render: (d) => <TodosFunis d={d} />,
    },
    time: { title: "Carteira por responsável", size: "md", render: (d) => <Time d={d} /> },
    origem: { title: "Leads por canal", size: "md", render: (d) => <PorOrigem d={d} /> },
    inscricao: { title: "Onde se inscreveram", size: "lg", render: (d) => <PorInscricao d={d} /> },
    uf: { title: "Leads por estado", size: "sm", render: (d) => <PorUf d={d} /> },
    radar: { title: "Radar de leads (7 dias)", size: "full", render: (d) => <RadarLeads d={d} /> },
    fluxo: { title: "Da origem até a fase atual", size: "full", render: (d) => <Fluxo d={d} /> },
    mapa: { title: "Melhores horários de entrada", size: "full", render: (d) => <Mapa d={d} /> },
    qualidade: { title: "Qualidade por canal", size: "md", render: (d) => <Qualidade d={d} /> },
    "kpi-invest": {
      title: "Investimento",
      size: "kpi",
      render: (d) => (
        <Kpi label="Investimento" value={a(d).spend} format={brl} hint="Meta + Google" />
      ),
    },
    "kpi-resultados": {
      title: "Resultados",
      size: "kpi",
      render: (d) => (
        <Kpi label="Leads de mídia" value={a(d).results} tone="info" hint="resultados reportados" />
      ),
    },
    "kpi-cpl": {
      title: "CPL",
      size: "kpi",
      render: (d) => (
        <Kpi
          label="Custo por lead"
          value={a(d).cpl}
          format={brl}
          tone="warning"
          hint="investido ÷ resultados"
        />
      ),
    },
    "kpi-ctr": {
      title: "CTR",
      size: "kpi",
      render: (d) => (
        <Kpi
          label="CTR de link"
          value={a(d).ctr * 100}
          format={(n) => `${(n / 100).toFixed(2).replace(".", ",")}%`}
          tone="success"
          hint="cliques ÷ impressões"
        />
      ),
    },
    "invest-canal": {
      title: "Investimento por canal",
      size: "sm",
      render: (d) => <InvestimentoCanal d={d} />,
    },
    "invest-dia": {
      title: "Investimento por dia",
      size: "md",
      render: (d) => <InvestimentoDia d={d} />,
    },
    "top-campanhas": {
      title: "Campanhas que mais gastam",
      size: "lg",
      render: (d) => <TopCampanhas d={d} />,
    },
    "kpi-ligacoes": {
      title: "Ligações",
      size: "kpi",
      render: (d) => (
        <Kpi label="Ligações no período" value={calls(d)?.totalCalls ?? 0} hint="3C+" />
      ),
    },
    "kpi-atendidas": {
      title: "Atendidas",
      size: "kpi",
      render: (d) => (
        <Kpi
          label="Atendidas"
          value={calls(d)?.connectedCalls ?? 0}
          tone="success"
          hint="contato efetivo"
        />
      ),
    },
    "kpi-taxa": {
      title: "Taxa de atendimento",
      size: "kpi",
      render: (d) => {
        const t = calls(d);
        const pct = t && t.totalCalls ? (t.connectedCalls / t.totalCalls) * 100 : 0;
        return <Kpi label="Taxa de atendimento" value={pct} format={(n) => `${n}%`} tone="info" />;
      },
    },
    "kpi-tempo": {
      title: "Tempo falado",
      size: "kpi",
      render: (d) => (
        <Kpi
          label="Horas falando"
          value={(calls(d)?.totalSpeakingSeconds ?? 0) / 3600}
          format={(n) => `${n} h`}
          tone="warning"
        />
      ),
    },
    "ligacoes-dia": { title: "Ligações por dia", size: "lg", render: (d) => <LigacoesDia d={d} /> },
    ranking: {
      title: "Ranking de atendimentos",
      size: "sm",
      render: (d) => <RankingAgentes d={d} />,
    },
  };

  // Um widget por funil: fase a fase, com cor da etapa no PipeRun.
  for (const p of snapshot?.pipelines ?? []) {
    base[`funil-${p.id}`] = {
      title: p.name,
      size: "md",
      render: () => <StagesBar pipeline={p} />,
    };
  }
  return base;
}

interface Scene {
  id: string;
  title: string;
  icon: LucideIcon;
  widgets: string[];
}

function buildScenes(snapshot: TvData["snapshot"]): Scene[] {
  // Negócios do PipeRun desta conta não costumam ter valor: sem soma, o card só ocuparia espaço.
  const hasValue = (snapshot?.totals.value ?? 0) > 0;
  const scenes: Scene[] = [
    {
      id: "geral",
      title: "Visão geral",
      icon: Activity,
      widgets: [
        "kpi-hoje",
        "kpi-mes",
        "kpi-abertos",
        "kpi-valor",
        "leads-dia",
        "feed-leads",
        "funil",
        "todos-funis",
        "kpi-sql",
        "kpi-roga-marcado",
        "kpi-roga-realizado",
        "kpi-contratos",
        "kpi-parados",
        "kpi-sem-contato",
      ],
    },
    {
      id: "funis",
      title: "Funis e fases",
      icon: GitBranch,
      widgets: [
        "kpi-abertos",
        "kpi-valor",
        "kpi-parados",
        "kpi-sem-contato",
        ...(snapshot?.pipelines ?? []).map((p) => `funil-${p.id}`),
      ],
    },
    {
      id: "radar",
      title: "Radar",
      icon: RadarIcon,
      widgets: [
        "kpi-hoje",
        "kpi-mes",
        "kpi-sql",
        "kpi-sem-contato",
        "radar",
        "inscricao",
        "uf",
        "origem",
        "qualidade",
        "fluxo",
        "mapa",
      ],
    },
    {
      id: "conversao",
      title: "Conversão",
      icon: LayoutGrid,
      widgets: [
        "kpi-mes",
        "kpi-sql",
        "kpi-roga-marcado",
        "kpi-roga-realizado",
        "kpi-contratos",
        "kpi-hoje",
        "funil",
        "medidores",
      ],
    },
    {
      id: "time",
      title: "Time",
      icon: Users,
      widgets: [
        "kpi-abertos",
        "kpi-parados",
        "kpi-sem-contato",
        "kpi-valor",
        "time",
        "ranking",
        "kpi-ligacoes",
        "kpi-atendidas",
        "ligacoes-dia",
      ],
    },
    {
      id: "campanhas",
      title: "Campanhas",
      icon: Megaphone,
      widgets: [
        "kpi-invest",
        "kpi-resultados",
        "kpi-cpl",
        "kpi-ctr",
        "invest-dia",
        "invest-canal",
        "top-campanhas",
      ],
    },
    {
      id: "ligacoes",
      title: "Ligações",
      icon: Phone,
      widgets: [
        "kpi-ligacoes",
        "kpi-atendidas",
        "kpi-taxa",
        "kpi-tempo",
        "ligacoes-dia",
        "ranking",
      ],
    },
  ];
  if (hasValue) return scenes;
  return scenes.map((sc) => ({
    ...sc,
    widgets: [...new Set(sc.widgets.map((w) => (w === "kpi-valor" ? "kpi-parados" : w)))],
  }));
}

// ---------- Layout arrastável ----------

type Layout = Record<string, string[]>;

function readLayout(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Layout) : {};
  } catch {
    return {};
  }
}

function orderFor(scene: Scene, saved: Layout): string[] {
  const known = new Set(scene.widgets);
  const kept = (saved[scene.id] ?? []).filter((id) => known.has(id));
  return [...kept, ...scene.widgets.filter((id) => !kept.includes(id))];
}

/** Fonte(s) de dados de cada widget — o esqueleto aparece só até a SUA fonte chegar. */
function sourcesOf(id: string): TvSource[] {
  if (/^(kpi-invest|kpi-resultados|kpi-cpl|kpi-ctr|invest-|top-campanhas)/.test(id)) return ["ads"];
  if (/^(kpi-ligacoes|kpi-atendidas|kpi-taxa|kpi-tempo|ligacoes-dia|ranking)/.test(id))
    return ["calls"];
  if (/^(kpi-abertos|kpi-valor|kpi-parados|kpi-sem-contato|todos-funis|time|funil-\d)/.test(id))
    return ["snapshot"];
  if (/^(kpi-sql|kpi-contratos|kpi-roga|funil$|medidores)/.test(id)) return ["leads", "events"];
  return ["leads"];
}

function WidgetSkeleton({ kpi }: { kpi: boolean }) {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true">
      {kpi ? (
        <>
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-9 w-20 rounded bg-muted" />
          <div className="h-3 w-32 rounded bg-muted" />
        </>
      ) : (
        <>
          <div className="h-3 w-2/3 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-5/6 rounded bg-muted" />
          <div className="h-24 w-full rounded-xl bg-muted/70" />
        </>
      )}
    </div>
  );
}

/** Conteúdo memorizado: arrastar um card não pode redesenhar os gráficos dos outros. */
const WidgetBody = memo(function WidgetBody({
  id,
  def,
  data,
}: {
  id: string;
  def: WidgetDef;
  data: TvData;
}) {
  const waiting = sourcesOf(id).some((src) => data.pending[src]);
  return waiting ? <WidgetSkeleton kpi={def.size === "kpi"} /> : <>{def.render(data)}</>;
});

function WidgetCard({
  id,
  def,
  data,
  editing,
  className,
}: {
  id: string;
  def: WidgetDef;
  data: TvData;
  editing: boolean;
  className?: string;
}) {
  const isKpi = def.size === "kpi";
  return (
    <div
      className={cn(
        "relative h-full rounded-2xl border border-border/70 bg-card p-5 shadow-sm",
        className,
      )}
    >
      {editing && (
        <GripVertical className="absolute right-3 top-3 size-4 text-primary" aria-hidden="true" />
      )}
      {!isKpi && (
        <h3 className="mb-4 font-display text-sm font-semibold text-muted-foreground">
          {def.title}
        </h3>
      )}
      <div className={cn(editing && "pointer-events-none", isKpi && "h-full")}>
        <WidgetBody id={id} def={def} data={data} />
      </div>
    </div>
  );
}

// Mola suave ao reordenar (inspirado no "Draggable Grid Dashboard" do 21st · uilayout.contact).
const SORT_TRANSITION = { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" } as const;

function SortableWidget({
  id,
  def,
  data,
  editing,
}: {
  id: string;
  def: WidgetDef;
  data: TvData;
  editing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
    transition: SORT_TRANSITION,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        SIZE_CLASS[def.size],
        editing && "cursor-grab touch-none",
        "will-change-transform",
      )}
      {...(editing ? { ...attributes, ...listeners } : {})}
    >
      <motion.div
        className="h-full"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: isDragging ? 0.35 : 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <WidgetCard
          id={id}
          def={def}
          data={data}
          editing={editing}
          className={cn(
            !editing && "transition-shadow hover:shadow-md",
            editing && "border-dashed border-primary/50",
            isDragging && "border-primary/70",
          )}
        />
      </motion.div>
    </div>
  );
}

// ---------- Painel ----------

export function TvDashboard({ userName }: { userName: string }) {
  const reduce = useReducedMotion();
  const [sceneIdx, setSceneIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tv, setTv] = useState(false);
  const [layout, setLayout] = useState<Layout>({});
  const [now, setNow] = useState<Date | null>(null);

  const today = todayDateString();
  const [preset, setPreset] = useState<RangePreset>("30");
  const [customRange, setCustomRange] = useState<DateRange>({ from: today, to: today });
  const [funis, setFunis] = useState<string[]>([]);
  const [incluirOutbound, setIncluirOutbound] = useState(false);
  const range = useMemo(() => rangeFor(preset, customRange, today), [preset, customRange, today]);
  const filters: TvFilters = useMemo(
    () => ({ range, funis, incluirOutbound }),
    [range, funis, incluirOutbound],
  );

  // Recupera os filtros da última visita (ficam só neste navegador).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        preset?: RangePreset;
        custom?: DateRange;
        funis?: string[];
        incluirOutbound?: boolean;
      };
      if (saved.preset) setPreset(saved.preset);
      if (saved.custom) setCustomRange(saved.custom);
      if (saved.funis) setFunis(saved.funis);
      if (typeof saved.incluirOutbound === "boolean") setIncluirOutbound(saved.incluirOutbound);
    } catch {
      // Sem localStorage: os filtros valem só nesta sessão.
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ preset, custom: customRange, funis, incluirOutbound }),
      );
    } catch {
      // ignorado
    }
  }, [preset, customRange, funis, incluirOutbound]);

  const leadsQ = useQuery({
    queryKey: ["tv", "leads", range],
    queryFn: () => getLeadsRecentesData({ data: range }),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  const snapshotQ = useQuery({
    queryKey: ["tv", "snapshot"],
    queryFn: () => getHubSnapshot(),
    refetchInterval: 3 * 60_000,
  });
  const adsQ = useQuery({
    queryKey: ["tv", "ads", range],
    queryFn: () => getAdMetricsData({ data: range }),
    refetchInterval: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const callsQ = useQuery({
    queryKey: ["tv", "calls", range],
    queryFn: () => getCallMetricsData({ data: range }),
    refetchInterval: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const eventsQ = useQuery({
    queryKey: ["tv", "events", range, funis.join(","), incluirOutbound],
    queryFn: () =>
      getFunnelConversaoData({
        data: {
          range,
          pipelineNames: funis,
          light: true,
          excludePipelines: incluirOutbound ? [] : ["OUTBOUND"],
        },
      }),
    refetchInterval: 3 * 60_000,
    placeholderData: keepPreviousData,
  });

  const leadsFiltered = useMemo(
    () => filterLeadsData(leadsQ.data ?? null, filters, range),
    [leadsQ.data, filters, range],
  );
  const snapshotFiltered = useMemo(
    () => filterSnapshot(snapshotQ.data ?? null, filters),
    [snapshotQ.data, filters],
  );
  const hiddenOutbound = useMemo(
    () => (leadsQ.data?.leads ?? []).filter((l) => isOutbound(l.pipelineName)).length,
    [leadsQ.data],
  );

  const data: TvData = useMemo(
    () => ({
      leads: leadsFiltered,
      ads: adsQ.data ?? null,
      calls: callsQ.data ?? null,
      snapshot: snapshotFiltered,
      events: eventsQ.data ?? null,
      pending: {
        leads: leadsQ.isPending,
        ads: adsQ.isPending,
        calls: callsQ.isPending,
        snapshot: snapshotQ.isPending,
        events: eventsQ.isPending,
      },
    }),
    [
      leadsFiltered,
      adsQ.data,
      callsQ.data,
      snapshotFiltered,
      eventsQ.data,
      leadsQ.isPending,
      adsQ.isPending,
      callsQ.isPending,
      snapshotQ.isPending,
      eventsQ.isPending,
    ],
  );

  const defs = useMemo(() => buildWidgets(data.snapshot), [data.snapshot]);
  const scenes = useMemo(() => buildScenes(data.snapshot), [data.snapshot]);

  useEffect(() => setLayout(readLayout()), []);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setTv(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleTv = useCallback(async () => {
    const next = !tv;
    setTv(next);
    if (next) setEditing(false);
    try {
      if (next) await document.documentElement.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // Fullscreen negado pelo navegador: o modo TV continua valendo como overlay.
    }
  }, [tv]);

  const scene = scenes[sceneIdx % scenes.length]!;
  const order = orderFor(scene, layout);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const rotating = !paused && !editing && !reduce;

  const nextScene = useCallback(() => setSceneIdx((i) => (i + 1) % scenes.length), [scenes.length]);

  function saveLayout(next: Layout) {
    setLayout(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Sem localStorage: o layout vale só nesta sessão.
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    saveLayout({ ...layout, [scene.id]: arrayMove(order, from, to) });
  }

  function resetLayout() {
    const { [scene.id]: _removed, ...rest } = layout;
    saveLayout(rest);
  }

  const firstName = userName.split(/[.\s]+/)[0] ?? userName;

  return (
    <div
      data-tv={tv}
      className={cn(
        "group/tv",
        tv && "fixed inset-0 z-[60] overflow-auto bg-background surface-grid p-6 lg:p-10",
      )}
    >
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Hub da Expansão
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight group-data-[tv=true]/tv:text-4xl">
            {tv ? "bLOw · Expansão" : `Olá, ${firstName}`}
          </h1>
        </div>

        <nav
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted/60 p-1"
          aria-label="Cenas"
        >
          {scenes.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSceneIdx(i)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                i === sceneIdx
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {i === sceneIdx && (
                <motion.span
                  layoutId="tv-scene-pill"
                  className="absolute inset-0 rounded-full bg-primary shadow-sm shadow-primary/30"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <s.icon className="relative size-3.5" />
              <span className="relative">{s.title}</span>
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-right leading-tight">
            <p className="font-display text-xl font-semibold tabular-nums group-data-[tv=true]/tv:text-3xl">
              {now?.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }) ?? "--:--:--"}
            </p>
            <p className="text-xs text-muted-foreground">
              {now?.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              }) ?? ""}
            </p>
          </div>
          <ToolButton
            label={paused ? "Retomar rotação" : "Pausar rotação"}
            onClick={() => setPaused((p) => !p)}
            active={paused}
          >
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </ToolButton>
          {!tv && (
            <ToolButton
              label="Reorganizar widgets"
              onClick={() => setEditing((e) => !e)}
              active={editing}
            >
              {editing ? <LayoutGrid className="size-4" /> : <Move className="size-4" />}
            </ToolButton>
          )}
          {editing && (
            <ToolButton label="Restaurar layout desta cena" onClick={resetLayout}>
              <RotateCcw className="size-4" />
            </ToolButton>
          )}
          <ToolButton
            label={tv ? "Sair do modo TV" : "Modo TV (tela cheia)"}
            onClick={toggleTv}
            active={tv}
          >
            {tv ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </ToolButton>
        </div>
      </div>

      <div className="mb-6 h-0.5 overflow-hidden rounded-full bg-border/60">
        {rotating ? (
          <motion.div
            key={`${scene.id}-${sceneIdx}`}
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: ROTATE_MS / 1000, ease: "linear" }}
            onAnimationComplete={nextScene}
          />
        ) : (
          <div className="h-full w-full bg-primary/30" />
        )}
      </div>

      {!tv && (
        <TvFilterBar
          preset={preset}
          range={range}
          onPreset={setPreset}
          onCustomRange={(r) => {
            setCustomRange(r);
            setPreset("custom");
          }}
          pipelineOptions={(snapshotQ.data?.pipelines ?? []).map((p) => p.name)}
          funis={funis}
          onFunis={setFunis}
          incluirOutbound={incluirOutbound}
          onIncluirOutbound={setIncluirOutbound}
          hiddenOutbound={hiddenOutbound}
        />
      )}

      {editing && (
        <p className="mb-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-2 text-sm text-primary">
          Arraste os blocos para reorganizar esta cena. O layout fica salvo neste navegador.
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={scene.id}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-12 gap-4">
                {order.map((id) => {
                  const def = defs[id];
                  return def ? (
                    <SortableWidget key={id} id={id} def={def} data={data} editing={editing} />
                  ) : null;
                })}
              </div>
            </SortableContext>
            <DragOverlay
              dropAnimation={{ duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
              zIndex={70}
            >
              {activeId && defs[activeId] ? (
                <div className="rotate-[0.6deg] scale-[1.02] cursor-grabbing">
                  <WidgetCard
                    id={activeId}
                    def={defs[activeId]}
                    data={data}
                    editing
                    className="border-primary/60 shadow-2xl ring-2 ring-primary/30"
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </motion.div>
      </AnimatePresence>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Leads de {range.from.split("-").reverse().join("/")} a{" "}
        {range.to.split("-").reverse().join("/")} · funis em tempo real · PipeRun, 3C+, Meta e
        Google Ads · atualiza sozinho
      </p>
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground",
        active && "border-primary/40 bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}
