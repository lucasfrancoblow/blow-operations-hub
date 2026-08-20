import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { CheckCircle2, Inbox } from "lucide-react";

import { getLeadsRecentesData } from "@/services/leads-recentes-service";
import { getAdMetricsData } from "@/services/ad-metrics-service";
import { adChannelFor } from "@/lib/ad-metrics";
import { defaultDateRange, type DateRange, type LeadRecente } from "@/lib/leads-recentes";
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

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  return addDaysIso(dateStr, -(day - 1));
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

/** Colunas semana a semana (segunda a domingo), recortadas nas pontas pro range
 * escolhido de verdade — sem isso, a 1ª/última coluna mostrava dias de fora do
 * período selecionado (ex: escolher 01–19/08 e ver rótulo indo até 23/08, que nem
 * tinha acontecido ainda). */
function buildWeekColumns(range: DateRange): Array<{ key: string; label: string; days: string[] }> {
  const columns: Array<{ key: string; label: string; days: string[] }> = [];
  let cursor = mondayOf(range.from);
  while (cursor <= range.to) {
    const weekSunday = addDaysIso(cursor, 6);
    const spanStart = cursor < range.from ? range.from : cursor;
    const spanEnd = weekSunday > range.to ? range.to : weekSunday;
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

  const visibleChannels = useMemo(() => {
    // "Geral" é o resultado final somando tudo — vem primeiro, não depois dos canais
    // individuais que ele resume.
    const all = ["Geral", ...CHANNEL_ORDER] as const;
    if (channelFilter === "Todos os canais") return all;
    return all.filter((c) => c === channelFilter);
  }, [channelFilter]);

  const loading = isLoading || adLoading;

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
          )}

          {funnelTotals && funnelTotals.investimento > 0 && (
            <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StaggerItem>
                <StatCard
                  label="Investimento no período"
                  value={Math.round(funnelTotals.investimento)}
                  accent="primary"
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="CPL médio (R$)"
                  value={
                    funnelTotals.novosLeads > 0
                      ? Math.round(funnelTotals.investimento / funnelTotals.novosLeads)
                      : 0
                  }
                  accent="info"
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="CPQL médio (R$)"
                  value={
                    funnelTotals.sql > 0
                      ? Math.round(funnelTotals.investimento / funnelTotals.sql)
                      : 0
                  }
                  accent="warning"
                  tone="warning"
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="CPRA médio (R$)"
                  value={
                    funnelTotals.reuniaoAgendada > 0
                      ? Math.round(funnelTotals.investimento / funnelTotals.reuniaoAgendada)
                      : 0
                  }
                  accent="success"
                  tone="success"
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
                            <tr key={`${channel}-${row.label}`} className="border-b border-border/40">
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
