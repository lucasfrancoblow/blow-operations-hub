import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Activity,
  GripVertical,
  LayoutGrid,
  Maximize2,
  Megaphone,
  Minimize2,
  Pause,
  Phone,
  Play,
  RotateCcw,
  Move,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

import { AnimatedNumber } from "@/components/hub/motion";
import {
  adsByChannel,
  adTotals,
  brl,
  funnelCounts,
  int,
  monthRange,
  topCampaigns,
  type TvData,
} from "@/components/hub/tv/tv-data";
import { parsePipeRunDate, todayDateString } from "@/lib/leads-recentes";
import { cn } from "@/lib/utils";
import { getAdMetricsData } from "@/services/ad-metrics-service";
import { getCallMetricsData } from "@/services/call-metrics-service";
import { getLeadsRecentesData } from "@/services/leads-recentes-service";

const ROTATE_MS = 25_000;
const STORAGE_KEY = "hublow-tv-layout-v1";
const EASE = [0.16, 1, 0.3, 1] as const;

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

// ---------- Widgets ----------

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
  tone?: "primary" | "success" | "info" | "warning";
}) {
  const toneBar = {
    primary: "bg-primary",
    success: "bg-success",
    info: "bg-info",
    warning: "bg-warning",
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
      <span className={cn("h-1 w-10 rounded-full", toneBar)} />
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
  return <div className="h-56 w-full group-data-[tv=true]/tv:h-72">{children}</div>;
}

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
};

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

function Funil({ d }: { d: TvData }) {
  const c = funnelCounts(d.leads);
  const steps = [
    { label: "Leads", value: c.leads },
    { label: "SQL", value: c.sql },
    { label: "Reunião agendada", value: c.reuniaoAgendada },
    { label: "Reunião realizada", value: c.reuniaoRealizada },
    { label: "Contrato enviado", value: c.contratoEnviado },
    { label: "Contrato assinado", value: c.contratoAssinado },
  ];
  const max = Math.max(1, steps[0]!.value);
  if (!c.leads) return <Empty>Sem leads no período.</Empty>;
  return (
    <ul className="space-y-3">
      {steps.map((s, i) => {
        const prev = i === 0 ? null : steps[i - 1]!.value;
        const conv = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold">{int(s.value)}</span>
                {conv !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">{conv}%</span>
                )}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, (s.value / max) * 100)}%` }}
                transition={{ duration: 0.9, ease: EASE, delay: i * 0.08 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
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
                {l.origin} · {l.stageName}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(l.createdAt)}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function BarList({
  rows,
  format = int,
}: {
  rows: Array<{ label: string; value: number }>;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <Empty>Sem dados no período.</Empty>;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate text-muted-foreground">{r.label}</span>
            <span className="font-semibold tabular-nums">{format(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ duration: 0.8, ease: EASE, delay: i * 0.06 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function PorOrigem({ d }: { d: TvData }) {
  const rows = (d.leads?.byOrigin ?? [])
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map((o) => ({ label: o.origin, value: o.total }));
  return <BarList rows={rows} />;
}

function PorFunil({ d }: { d: TvData }) {
  const rows = (d.leads?.byPipeline ?? [])
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map((o) => ({ label: o.pipeline, value: o.total }));
  return <BarList rows={rows} />;
}

function InvestimentoCanal({ d }: { d: TvData }) {
  const rows = adsByChannel(d.ads).map((c) => ({ label: c.channel, value: c.spend }));
  if (!d.ads) return <Empty>Métricas de anúncios não configuradas.</Empty>;
  return <BarList rows={rows} format={brl} />;
}

function InvestimentoDia({ d }: { d: TvData }) {
  const byDay = new Map<string, number>();
  for (const r of d.ads ?? []) {
    byDay.set(r.data_referencia, (byDay.get(r.data_referencia) ?? 0) + r.valor_usado);
  }
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
  const rows = (d.calls?.byAgent ?? [])
    .slice()
    .sort((a, b) => b.connectedCalls - a.connectedCalls)
    .slice(0, 7)
    .map((a) => ({ label: a.agentName, value: a.connectedCalls }));
  if (!d.calls) return <Empty>Métricas de ligações não configuradas.</Empty>;
  return <BarList rows={rows} />;
}

// ---------- Registro de widgets e cenas ----------

interface WidgetDef {
  title: string;
  size: Size;
  render: (d: TvData) => ReactNode;
}

function widgets(): Record<string, WidgetDef> {
  const f = (d: TvData) => funnelCounts(d.leads);
  const a = (d: TvData) => adTotals(d.ads);
  const calls = (d: TvData) => d.calls?.totals;
  return {
    "kpi-hoje": {
      title: "Leads hoje",
      size: "kpi",
      render: (d) => (
        <Kpi label="Leads hoje" value={d.leads?.summary.hoje ?? 0} hint="entraram desde 00h" />
      ),
    },
    "kpi-mes": {
      title: "Leads no mês",
      size: "kpi",
      render: (d) => (
        <Kpi label="Leads no mês" value={f(d).leads} tone="info" hint="criados no PipeRun" />
      ),
    },
    "kpi-sql": {
      title: "SQL",
      size: "kpi",
      render: (d) => {
        const c = f(d);
        return (
          <Kpi
            label="SQL no mês"
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
          hint="no mês"
        />
      ),
    },
    "leads-dia": { title: "Leads por dia", size: "lg", render: (d) => <LeadsPorDia d={d} /> },
    "feed-leads": { title: "Chegando agora", size: "sm", render: (d) => <FeedLeads d={d} /> },
    funil: { title: "Funil de vendas", size: "md", render: (d) => <Funil d={d} /> },
    origem: { title: "Leads por origem", size: "md", render: (d) => <PorOrigem d={d} /> },
    "por-funil": { title: "Leads por funil", size: "md", render: (d) => <PorFunil d={d} /> },
    "funil-grande": { title: "Funil de vendas", size: "lg", render: (d) => <Funil d={d} /> },
    "kpi-invest": {
      title: "Investimento",
      size: "kpi",
      render: (d) => (
        <Kpi
          label="Investimento"
          value={a(d).spend}
          format={brl}
          tone="primary"
          hint="Meta + Google"
        />
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
      render: (d) => <Kpi label="Ligações no mês" value={calls(d)?.totalCalls ?? 0} hint="3C+" />,
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
}

interface Scene {
  id: string;
  title: string;
  icon: LucideIcon;
  widgets: string[];
}

const SCENES: Scene[] = [
  {
    id: "geral",
    title: "Visão geral",
    icon: Activity,
    widgets: [
      "kpi-hoje",
      "kpi-mes",
      "kpi-sql",
      "kpi-contratos",
      "leads-dia",
      "feed-leads",
      "funil",
      "origem",
    ],
  },
  {
    id: "funil",
    title: "Funil",
    icon: TrendingUp,
    widgets: [
      "kpi-mes",
      "kpi-sql",
      "kpi-contratos",
      "kpi-hoje",
      "funil-grande",
      "origem",
      "por-funil",
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
    widgets: ["kpi-ligacoes", "kpi-atendidas", "kpi-taxa", "kpi-tempo", "ligacoes-dia", "ranking"],
  },
];

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
  });
  const isKpi = def.size === "kpi";
  return (
    <motion.div
      ref={setNodeRef}
      layout={!editing}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        SIZE_CLASS[def.size],
        "relative rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow",
        !editing && "hover:shadow-md",
        editing && "cursor-grab border-dashed border-primary/50 active:cursor-grabbing",
        isDragging && "z-10 scale-[1.02] shadow-xl ring-2 ring-primary/40",
      )}
      {...(editing ? { ...attributes, ...listeners } : {})}
    >
      {editing && (
        <GripVertical className="absolute right-3 top-3 size-4 text-primary" aria-hidden="true" />
      )}
      {!isKpi && (
        <h3 className="mb-4 font-display text-sm font-semibold text-muted-foreground">
          {def.title}
        </h3>
      )}
      <div
        className={cn("pointer-events-none", !editing && "pointer-events-auto", isKpi && "h-full")}
      >
        {def.render(data)}
      </div>
    </motion.div>
  );
}

// ---------- Painel ----------

export function TvDashboard({ userName }: { userName: string }) {
  const reduce = useReducedMotion();
  const defs = useMemo(widgets, []);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tv, setTv] = useState(false);
  const [layout, setLayout] = useState<Layout>({});
  const [now, setNow] = useState<Date | null>(null);

  const today = todayDateString();
  const range = monthRange(today);

  const leadsQ = useQuery({
    queryKey: ["tv", "leads", range],
    queryFn: () => getLeadsRecentesData({ data: range }),
    refetchInterval: 60_000,
  });
  const adsQ = useQuery({
    queryKey: ["tv", "ads", range],
    queryFn: () => getAdMetricsData({ data: range }),
    refetchInterval: 5 * 60_000,
  });
  const callsQ = useQuery({
    queryKey: ["tv", "calls", range],
    queryFn: () => getCallMetricsData({ data: range }),
    refetchInterval: 5 * 60_000,
  });
  const data: TvData = {
    leads: leadsQ.data ?? null,
    ads: adsQ.data ?? null,
    calls: callsQ.data ?? null,
  };
  const loading = leadsQ.isLoading;

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

  const scene = SCENES[sceneIdx]!;
  const order = orderFor(scene, layout);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const rotating = !paused && !editing && !reduce;

  const nextScene = useCallback(() => setSceneIdx((i) => (i + 1) % SCENES.length), []);

  function saveOrder(next: string[]) {
    const merged = { ...layout, [scene.id]: next };
    setLayout(merged);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Sem localStorage: o layout vale só nesta sessão.
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    saveOrder(arrayMove(order, from, to));
  }

  function resetLayout() {
    const { [scene.id]: _removed, ...rest } = layout;
    setLayout(rest);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    } catch {
      // ignorado
    }
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
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Hub da Expansão
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight group-data-[tv=true]/tv:text-4xl">
            {tv ? "bLOw · Expansão" : `Olá, ${firstName}`}
          </h1>
        </div>

        <nav className="flex items-center gap-1 rounded-full bg-muted/60 p-1" aria-label="Cenas">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSceneIdx(i)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
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

      {/* Barra de progresso da rotação */}
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

      {editing && (
        <p className="mb-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-2 text-sm text-primary">
          Arraste os blocos para reorganizar esta cena. O layout fica salvo neste navegador.
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-12 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-36 animate-pulse rounded-2xl bg-muted/70",
                i < 4 ? SIZE_CLASS.kpi : i < 6 ? SIZE_CLASS.md : SIZE_CLASS.md,
              )}
            />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={scene.id}
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
            </DndContext>
          </motion.div>
        </AnimatePresence>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Dados de {range.from.split("-").reverse().join("/")} a{" "}
        {range.to.split("-").reverse().join("/")} · PipeRun, 3C+, Meta e Google Ads · atualiza
        sozinho
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
