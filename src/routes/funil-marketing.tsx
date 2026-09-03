import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { CheckCircle2, Download, Inbox } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";

import { getLeadsRecentesData } from "@/services/leads-recentes-service";
import { getAdMetricsData } from "@/services/ad-metrics-service";
import { adChannelFor } from "@/lib/ad-metrics";
import { defaultDateRange, type DateRange, type LeadRecente } from "@/lib/leads-recentes";
import { canAccessPage } from "@/lib/page-access";
import { DateRangePicker } from "@/components/hub/DateRangePicker";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/hub/primitives";
import { FadeIn, Stagger, StaggerItem } from "@/components/hub/motion";
import { FunnelChart, type FunnelStage } from "@/components/hub/FunnelChart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/funil-marketing")({
  beforeLoad: ({ context }) => {
    if (!canAccessPage(context.user, "funil-marketing")) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Funil de Marketing — hubLOw BLOW" },
      {
        name: "description",
        content:
          "Indicadores semanais de marketing por canal, no formato da planilha 'Indicadores Expansão' — leads e custo reais, alimentado automaticamente.",
      },
    ],
  }),
  component: FunilMarketingPage,
});

// Mesmo agrupamento de canal da planilha "Indicadores Expansão" (Geral / Facebook Ads /
// Google / Orgânico / Rapha Mattos) — mapeado a partir da origem (UTM) e do funil real do
// PipeRun, já que não existe um campo "canal" pronto no CRM.
const CHANNEL_ORDER = ["Facebook Ads", "Google", "Orgânico", "Rapha Mattos", "Outros"] as const;

// Cor fixa por canal (não por posição pós-filtro) — assim tirar/pôr um canal do
// gráfico nunca "repinta" os outros. Paleta categórica validada (contraste + daltonismo)
// da design skill, na mesma ordem de --color-chart-1..5 em styles.css.
const CHANNEL_COLOR: Record<(typeof CHANNEL_ORDER)[number], string> = {
  "Facebook Ads": "var(--color-chart-1)",
  Google: "var(--color-chart-2)",
  Orgânico: "var(--color-chart-3)",
  "Rapha Mattos": "var(--color-chart-4)",
  Outros: "var(--color-chart-5)",
};

// Só o funil de expansão/franquia entra aqui — Blow Academy, Sucesso do Franqueado e
// Implantação também vivem no PipeRun mas são outras iniciativas (curso, franqueado já
// ativo, onboarding pós-venda), não geração de lead de expansão. Sem esse filtro o
// "Novos Leads" do Geral contava tudo isso junto — confirmado contra a planilha
// "Leadings Semanais" pra semana de 20-26/08/2026 (149 negócios no PipeRun no total,
// 117 só nesses dois funis, 116 na planilha do time).
const MARKETING_FUNNEL_PIPELINES = new Set(["PRÉ VENDAS", "EXPANSÃO CLOSER", "FUNIL RAPHA MATTOS"]);

function isMarketingFunnelLead(lead: LeadRecente): boolean {
  return MARKETING_FUNNEL_PIPELINES.has(lead.pipelineName.toUpperCase());
}

function channelFor(lead: LeadRecente): string {
  if (lead.pipelineName.toLowerCase().includes("rapha mattos")) return "Rapha Mattos";
  if (lead.origin === "Meta (pago)") return "Facebook Ads";
  if (lead.origin === "Google") return "Google";
  if (lead.origin === "Meta (orgânico)" || lead.origin === "Sem UTM") return "Orgânico";
  return "Outros";
}

// Canais que o time pediu pra poder olhar um período específico, independente do
// range global da página (ex: comparar só uma semana do Facebook sem afetar o resto).
const CHANNELS_WITH_OWN_RANGE = new Set(["Facebook Ads", "Google"]);

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// O time fecha a semana de quinta a quarta (não segunda a domingo) — conferido contra
// os rótulos de semana da planilha "Indicadores Expansão" (ex: "13-19", "20-26" de
// agosto/2026 começam sempre numa quinta). Colunas em Seg-Dom faziam o dashboard
// mostrar total semanal diferente do que o time via na planilha de referência, mesmo
// com o dado diário batendo certinho.
function thursdayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = (d.getUTCDay() - 4 + 7) % 7; // dias desde a última quinta-feira (getUTCDay: Qui=4)
  return addDaysIso(dateStr, -day);
}

function fmtDM(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Nunca deixa o range escolhido no filtro exceder o que foi realmente carregado
 * (o range da página) — evita mostrar zero "de mentira" pra dias que nem foram
 * buscados no PipeRun/Supabase ainda. Se o filtro do canal ficou de um período
 * completamente fora do range novo da página (ex: trocou o range lá em cima pra um
 * mês totalmente diferente do que tinha escolhido no Facebook), o recorte "from > to"
 * quebraria a tabela — nesse caso volta pro range da página inteiro. */
function clampRange(inner: DateRange, outer: DateRange): DateRange {
  const clamped = {
    from: inner.from < outer.from ? outer.from : inner.from,
    to: inner.to > outer.to ? outer.to : inner.to,
  };
  return clamped.from > clamped.to ? outer : clamped;
}

/** Colunas semana a semana (quinta a quarta, ver thursdayOf), recortadas nas pontas pro
 * range escolhido de verdade — sem isso, a 1ª/última coluna mostrava dias de fora do
 * período selecionado (ex: escolher 01–19/08 e ver rótulo indo até 23/08, que nem
 * tinha acontecido ainda). */
function buildWeekColumns(range: DateRange): Array<{ key: string; label: string; days: string[] }> {
  const columns: Array<{ key: string; label: string; days: string[] }> = [];
  let cursor = thursdayOf(range.from);
  while (cursor <= range.to) {
    const weekEnd = addDaysIso(cursor, 6);
    const spanStart = cursor < range.from ? range.from : cursor;
    const spanEnd = weekEnd > range.to ? range.to : weekEnd;
    const days: string[] = [];
    for (let d = spanStart; d <= spanEnd; d = addDaysIso(d, 1)) days.push(d);
    columns.push({
      key: cursor,
      label: spanStart === spanEnd ? fmtDM(spanStart) : `${fmtDM(spanStart)} – ${fmtDM(spanEnd)}`,
      days,
    });
    cursor = addDaysIso(cursor, 7);
  }
  return columns;
}

function sumDays(dayMap: Map<string, WeekCounts>, days: string[]): WeekCounts {
  const total = emptyCounts();
  for (const day of days) {
    const c = dayMap.get(day);
    if (!c) continue;
    total.novosLeads += c.novosLeads;
    total.sql += c.sql;
    total.reuniaoAgendada += c.reuniaoAgendada;
    total.reuniaoRealizada += c.reuniaoRealizada;
    total.contratoEnviado += c.contratoEnviado;
    total.contratoAssinado += c.contratoAssinado;
    total.investimento += c.investimento;
    total.cliquesLink += c.cliquesLink;
    total.visitasLp += c.visitasLp;
  }
  return total;
}

interface WeekCounts {
  novosLeads: number;
  sql: number;
  reuniaoAgendada: number;
  reuniaoRealizada: number;
  contratoEnviado: number;
  contratoAssinado: number;
  investimento: number;
  cliquesLink: number;
  visitasLp: number;
}

function emptyCounts(): WeekCounts {
  return {
    novosLeads: 0,
    sql: 0,
    reuniaoAgendada: 0,
    reuniaoRealizada: 0,
    contratoEnviado: 0,
    contratoAssinado: 0,
    investimento: 0,
    cliquesLink: 0,
    visitasLp: 0,
  };
}

function pct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${((num / den) * 100).toFixed(0)}%`;
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function costPer(spend: number, count: number): string {
  if (spend === 0 && count === 0) return "—";
  if (count === 0) return "—";
  return money(spend / count);
}

// Linhas exatamente como na planilha "Indicadores Expansão — Indicadores Semanais":
// Topo do Funil, Fundo de Funil e Taxas de Conversão.
const ROWS: Array<{
  label: string;
  group: "Topo do Funil" | "Fundo de Funil" | "Taxas de Conversão";
  value: (c: WeekCounts) => number | string;
}> = [
  { label: "Novos Leads", group: "Topo do Funil", value: (c) => c.novosLeads },
  { label: "Leads Qualificados (SQL)", group: "Topo do Funil", value: (c) => c.sql },
  { label: "Reunião Agendada (RA)", group: "Topo do Funil", value: (c) => c.reuniaoAgendada },
  { label: "Investimento", group: "Topo do Funil", value: (c) => money(c.investimento) },
  { label: "CPL", group: "Topo do Funil", value: (c) => costPer(c.investimento, c.novosLeads) },
  { label: "CPQL", group: "Topo do Funil", value: (c) => costPer(c.investimento, c.sql) },
  {
    label: "CPRA",
    group: "Topo do Funil",
    value: (c) => costPer(c.investimento, c.reuniaoAgendada),
  },
  {
    label: "Visitas LP",
    group: "Topo do Funil",
    value: (c) => (c.visitasLp > 0 ? c.visitasLp : "—"),
  },
  {
    label: "Connect Rate",
    group: "Topo do Funil",
    value: (c) => pct(c.visitasLp, c.cliquesLink),
  },
  { label: "CPV", group: "Topo do Funil", value: (c) => costPer(c.investimento, c.visitasLp) },
  { label: "RR (Reunião Realizada)", group: "Fundo de Funil", value: (c) => c.reuniaoRealizada },
  { label: "Contratos Enviados", group: "Fundo de Funil", value: (c) => c.contratoEnviado },
  { label: "Contratos Assinados", group: "Fundo de Funil", value: (c) => c.contratoAssinado },
  {
    label: "CPRR",
    group: "Fundo de Funil",
    value: (c) => costPer(c.investimento, c.reuniaoRealizada),
  },
  {
    label: "CPCE",
    group: "Fundo de Funil",
    value: (c) => costPer(c.investimento, c.contratoEnviado),
  },
  {
    label: "CPCA",
    group: "Fundo de Funil",
    value: (c) => costPer(c.investimento, c.contratoAssinado),
  },
  { label: "Taxa: NL → SQL", group: "Taxas de Conversão", value: (c) => pct(c.sql, c.novosLeads) },
  {
    label: "Taxa: SQL → RA",
    group: "Taxas de Conversão",
    value: (c) => pct(c.reuniaoAgendada, c.sql),
  },
  {
    label: "Taxa: RA → RR",
    group: "Taxas de Conversão",
    value: (c) => pct(c.reuniaoRealizada, c.reuniaoAgendada),
  },
  {
    label: "Taxa: RR → CE",
    group: "Taxas de Conversão",
    value: (c) => pct(c.contratoEnviado, c.reuniaoRealizada),
  },
  {
    label: "Taxa: CE → CA",
    group: "Taxas de Conversão",
    value: (c) => pct(c.contratoAssinado, c.contratoEnviado),
  },
  {
    label: "Taxa: NL → CA",
    group: "Taxas de Conversão",
    value: (c) => pct(c.contratoAssinado, c.novosLeads),
  },
];

/** Rosca de composição de leads por canal, com número total no centro e legenda com
 * valor + % direto no texto (não só cor) — não depende de discriminar cor pra ler o
 * dado, o que importa pro par menos contrastante da paleta (aqua/amarelo/magenta). */
function ChannelDonut({
  data,
}: {
  data: Array<{ channel: string; total: number; color: string }>;
}) {
  const total = data.reduce((sum, d) => sum + d.total, 0);

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Sem leads no período.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="channel"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--color-card)"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.channel} fill={entry.color} />
              ))}
            </Pie>
            <RTooltip
              formatter={(value: number, _name, item) => [
                `${value} (${Math.round((value / total) * 100)}%)`,
                item.payload.channel,
              ]}
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-[11px] text-muted-foreground">leads</span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-1.5 sm:w-auto">
        {data.map((entry) => (
          <li key={entry.channel} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="flex-1 text-muted-foreground">{entry.channel}</span>
            <span className="font-medium tabular-nums">{entry.total}</span>
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round((entry.total / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CHANNEL_FILTERS = ["Todos os canais", ...CHANNEL_ORDER] as const;

function FunilMarketingPage() {
  const [range, setRange] = useState<DateRange>(() => defaultDateRange());
  const [channelFilter, setChannelFilter] = useState<string>("Todos os canais");
  // Período próprio por canal (Facebook/Google) — pra ver uma janela diferente da
  // página sem afetar o resto. Recorta dentro dos dados já carregados no range global.
  const [channelRanges, setChannelRanges] = useState<Record<string, DateRange>>({});

  // Trocar o range lá em cima é trocar de página, basicamente — os filtros de canal
  // (Facebook/Google) eram um recorte daquela janela, então não faz sentido manter um
  // recorte "antigo" grudado quando a janela em si mudou pra outro período.
  function handleGlobalRangeChange(next: DateRange) {
    setRange(next);
    setChannelRanges({});
  }

  const { data, isLoading } = useQuery({
    queryKey: ["piperun", "leads-recentes", range.from, range.to],
    queryFn: () => getLeadsRecentesData({ data: range }),
    refetchInterval: 60_000,
  });

  const { data: adMetrics, isLoading: adLoading } = useQuery({
    queryKey: ["ad-metrics", range.from, range.to],
    queryFn: () => getAdMetricsData({ data: range }),
    refetchInterval: 60_000,
  });

  const table = useMemo(() => {
    if (!data) return null;

    const byChannelDay = new Map<string, Map<string, WeekCounts>>();
    for (const ch of [...CHANNEL_ORDER, "Geral"]) byChannelDay.set(ch, new Map());

    for (const l of data.leads) {
      if (!isMarketingFunnelLead(l)) continue;
      const day = l.createdAt.slice(0, 10);
      const ch = channelFor(l);
      for (const target of [ch, "Geral"]) {
        const m = byChannelDay.get(target)!;
        const cur = m.get(day) ?? emptyCounts();
        cur.novosLeads += 1;
        if (l.isSql) cur.sql += 1;
        if (l.isReuniaoAgendada) cur.reuniaoAgendada += 1;
        if (l.isReuniaoRealizada) cur.reuniaoRealizada += 1;
        if (l.isContratoEnviado) cur.contratoEnviado += 1;
        if (l.isContratoAssinado) cur.contratoAssinado += 1;
        m.set(day, cur);
      }
    }

    for (const row of adMetrics ?? []) {
      const day = row.data_referencia;
      const ch = adChannelFor(row);
      for (const target of [ch, "Geral"]) {
        const m = byChannelDay.get(target);
        if (!m) continue;
        const cur = m.get(day) ?? emptyCounts();
        cur.investimento += row.valor_usado ?? 0;
        cur.cliquesLink += row.cliques_link ?? 0;
        cur.visitasLp += row.visitas_lp ?? 0;
        m.set(day, cur);
      }
    }

    return { byChannelDay };
  }, [data, adMetrics]);

  const funnelTotals = useMemo(() => {
    if (!table) return null;
    const target = channelFilter === "Todos os canais" ? "Geral" : channelFilter;
    const dayMap = table.byChannelDay.get(target);
    if (!dayMap) return null;
    return sumDays(dayMap, Array.from(dayMap.keys()));
  }, [table, channelFilter]);

  // Composição de "Novos Leads" por canal no período — independe do filtro de canal
  // da página (que serve pra ver a TABELA de um canal só; a rosca é sempre a foto
  // geral de "de onde vêm os leads", senão viraria sempre uma fatia de 100%).
  const channelDonutData = useMemo(() => {
    if (!table) return [];
    return CHANNEL_ORDER.map((channel) => {
      const dayMap = table.byChannelDay.get(channel);
      const total = dayMap ? sumDays(dayMap, Array.from(dayMap.keys())).novosLeads : 0;
      return { channel, total, color: CHANNEL_COLOR[channel] };
    }).filter((d) => d.total > 0);
  }, [table]);

  const visibleChannels = useMemo(() => {
    // "Geral" é o resultado final somando tudo — vem primeiro, não depois dos canais
    // individuais que ele resume.
    const all = ["Geral", ...CHANNEL_ORDER] as const;
    if (channelFilter === "Todos os canais") return all;
    return all.filter((c) => c === channelFilter);
  }, [channelFilter]);

  const loading = isLoading || adLoading;

  function exportCsv() {
    if (!table) return;
    const rows: Array<Record<string, unknown>> = [];
    for (const channel of visibleChannels) {
      const dayMap = table.byChannelDay.get(channel);
      if (!dayMap) continue;
      const channelRange = clampRange(channelRanges[channel] ?? range, range);
      for (const col of buildWeekColumns(channelRange)) {
        const c = sumDays(dayMap, col.days);
        rows.push({
          canal: channel,
          semana: col.label,
          novos_leads: c.novosLeads,
          sql: c.sql,
          reuniao_agendada: c.reuniaoAgendada,
          reuniao_realizada: c.reuniaoRealizada,
          contrato_enviado: c.contratoEnviado,
          contrato_assinado: c.contratoAssinado,
          investimento: c.investimento,
          cliques_link: c.cliquesLink,
          visitas_lp: c.visitasLp,
        });
      }
    }
    downloadCsv(`funil-marketing-${range.from}_${range.to}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funil de Marketing"
        subtitle="Indicadores semanais por canal — mesmo formato da planilha 'Indicadores Expansão', agora automático"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_FILTERS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangePicker value={range} onChange={handleGlobalRangeChange} />
            <Button variant="outline" size="sm" disabled={!table} onClick={exportCsv}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        }
      />

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : !data || !table ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="PipeRun não configurado"
          description="Defina PIPERUN_API_KEY no ambiente do servidor para ver os dados reais aqui."
        />
      ) : (
        <FadeIn className="space-y-6">
          <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/8 px-4 py-3 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">
                Novos Leads, SQL, RA, RR, Contratos e Taxas de Conversão
              </span>{" "}
              vêm do PipeRun (etapa real de cada negócio).{" "}
              <span className="font-medium text-foreground">
                Investimento, CPL, CPQL, CPRA, CPRR, CPCE e CPCA
              </span>{" "}
              agora vêm de verdade do Meta Ads e do Google Ads — dois workflows no n8n gravam o
              custo por campanha direto no banco a cada hora.{" "}
              <span className="font-medium text-foreground">Orgânico</span> e{" "}
              <span className="font-medium text-foreground">Outros</span> não têm investimento por
              definição (não são mídia paga) — não é dado faltando.
            </p>
          </div>

          {funnelTotals && (
            <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
              <SectionCard
                title={`Funil — ${channelFilter === "Todos os canais" ? "Geral" : channelFilter}`}
              >
                <FunnelChart
                  stages={
                    [
                      { label: "Novos Leads", value: funnelTotals.novosLeads, accent: "primary" },
                      { label: "SQL", value: funnelTotals.sql, accent: "info" },
                      {
                        label: "Reunião Agendada",
                        value: funnelTotals.reuniaoAgendada,
                        accent: "warning",
                      },
                      {
                        label: "Reunião Realizada",
                        value: funnelTotals.reuniaoRealizada,
                        accent: "warning",
                      },
                      {
                        label: "Contrato Enviado",
                        value: funnelTotals.contratoEnviado,
                        accent: "success",
                      },
                      {
                        label: "Contrato Assinado",
                        value: funnelTotals.contratoAssinado,
                        accent: "success",
                      },
                    ] satisfies FunnelStage[]
                  }
                />
              </SectionCard>

              <SectionCard title="Novos Leads por canal">
                <ChannelDonut data={channelDonutData} />
              </SectionCard>
            </div>
          )}

          {funnelTotals && funnelTotals.investimento > 0 && (
            <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StaggerItem>
                <StatCard
                  label="Investimento no período"
                  value={Math.round(funnelTotals.investimento)}
                  accent="primary"
                  formatter={money}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="CPL médio"
                  value={
                    funnelTotals.novosLeads > 0
                      ? Math.round(funnelTotals.investimento / funnelTotals.novosLeads)
                      : 0
                  }
                  accent="primary"
                  formatter={money}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="CPQL médio"
                  value={
                    funnelTotals.sql > 0
                      ? Math.round(funnelTotals.investimento / funnelTotals.sql)
                      : 0
                  }
                  accent="warning"
                  tone="warning"
                  formatter={money}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="CPRA médio"
                  value={
                    funnelTotals.reuniaoAgendada > 0
                      ? Math.round(funnelTotals.investimento / funnelTotals.reuniaoAgendada)
                      : 0
                  }
                  accent="success"
                  tone="success"
                  formatter={money}
                />
              </StaggerItem>
            </Stagger>
          )}

          {visibleChannels.map((channel) => {
            const dayMap = table.byChannelDay.get(channel);
            if (!dayMap) return null;

            const totals = sumDays(dayMap, Array.from(dayMap.keys()));
            if (totals.novosLeads === 0 && totals.investimento === 0 && channel !== "Geral")
              return null;

            const hasOwnRange = CHANNELS_WITH_OWN_RANGE.has(channel);
            const channelRange = clampRange(channelRanges[channel] ?? range, range);
            const columns = buildWeekColumns(channelRange).map((col) => ({
              ...col,
              counts: sumDays(dayMap, col.days),
            }));

            let lastGroup = "";

            return (
              <SectionCard
                key={channel}
                title={channel}
                collapsible
                defaultCollapsed
                action={
                  hasOwnRange ? (
                    <DateRangePicker
                      value={channelRange}
                      onChange={(next) =>
                        setChannelRanges((prev) => ({ ...prev, [channel]: next }))
                      }
                    />
                  ) : undefined
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Métrica</th>
                        {columns.map((col) => (
                          <th key={col.key} className="py-2 pr-4 text-right font-medium">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ROWS.map((row) => {
                        const showGroupHeader = row.group !== lastGroup;
                        lastGroup = row.group;
                        return (
                          <Fragment key={row.label}>
                            {showGroupHeader && (
                              <tr key={`${channel}-${row.group}`}>
                                <td
                                  colSpan={columns.length + 1}
                                  className="bg-muted/40 py-1.5 pl-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                >
                                  {row.group}
                                </td>
                              </tr>
                            )}
                            <tr
                              key={`${channel}-${row.label}`}
                              className="border-b border-border/40"
                            >
                              <td className="py-2 pr-4 text-muted-foreground">{row.label}</td>
                              {columns.map((col) => (
                                <td
                                  key={col.key}
                                  className="py-2 pr-4 text-right font-medium tabular-nums"
                                >
                                  {row.value(col.counts)}
                                </td>
                              ))}
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            );
          })}
        </FadeIn>
      )}
    </div>
  );
}
