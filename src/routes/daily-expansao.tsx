import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Download, Headphones } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getDailyExpansaoData } from "@/services/daily-expansao-service";
import { defaultDateRange, type DateRange } from "@/lib/leads-recentes";
import type { CloserDayMetrics, SdrDayMetrics } from "@/lib/daily-expansao";
import { canAccessPage } from "@/lib/page-access";
import { DateRangePicker } from "@/components/hub/DateRangePicker";
import {
  CardsSkeleton,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/hub/primitives";
import { FadeIn } from "@/components/hub/motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/daily-expansao")({
  beforeLoad: ({ context }) => {
    if (!canAccessPage(context.user, "daily-expansao")) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Daily Expansão — hubLOw BLOW" },
      {
        name: "description",
        content:
          "Métricas diárias de Allana e Júlia (SDR) e Andrey (Closer), lidas direto da planilha 'Daily Expansão' do time de Expansão.",
      },
    ],
  }),
  component: DailyExpansaoPage,
});

function fmtDM(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function sum(values: Array<number | null>): number {
  return values.reduce((total: number, v) => total + (v ?? 0), 0);
}

function SdrSection({
  name,
  rows,
  barColor,
}: {
  name: string;
  rows: SdrDayMetrics[];
  barColor: string;
}) {
  const totals = {
    leadsNovos: sum(rows.map((r) => r.leadsNovos)),
    contatosEfetivos: sum(rows.map((r) => r.contatosEfetivos)),
    sqls: sum(rows.map((r) => r.sqls)),
    reunioesAgendadas: sum(rows.map((r) => r.reunioesAgendadas)),
  };

  return (
    <SectionCard title={name}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Leads novos" value={totals.leadsNovos} accent="primary" />
          <StatCard label="Contatos efetivos" value={totals.contatosEfetivos} accent="primary" />
          <StatCard label="SQLs" value={totals.sqls} accent="warning" tone="warning" />
          <StatCard
            label="Reuniões agendadas"
            value={totals.reunioesAgendadas}
            accent="success"
            tone="success"
          />
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ left: -20, right: 8, top: 8 }}>
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
              <Bar dataKey="leadsNovos" name="Leads novos" fill={barColor} radius={4} />
              <Bar dataKey="sqls" name="SQLs" fill="var(--color-chart-3)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pl-3 pr-4 font-medium">Data</th>
                <th className="py-2 pr-4 text-right font-medium">Novos</th>
                <th className="py-2 pr-4 text-right font-medium">Follow-up</th>
                <th className="py-2 pr-4 text-right font-medium">Tentativas</th>
                <th className="py-2 pr-4 text-right font-medium">Tempo médio</th>
                <th className="py-2 pr-4 text-right font-medium">Contatos ef.</th>
                <th className="py-2 pr-4 text-right font-medium">SQLs</th>
                <th className="py-2 pr-4 text-right font-medium">Reuniões</th>
                <th className="py-2 pr-4 text-right font-medium">Quentes</th>
                <th className="py-2 pr-4 font-medium">Bloqueio</th>
                <th className="py-2 pr-4 font-medium">Compromisso do dia</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice()
                .reverse()
                .map((r) => (
                  <tr key={r.date} className="border-b border-border/40">
                    <td className="py-2 pl-3 pr-4 text-muted-foreground">{fmtDM(r.date)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.leadsNovos ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.leadsTrabalhados ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.tentativas ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.tempoMedioLigacaoMin != null ? `${r.tempoMedioLigacaoMin} min` : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.contatosEfetivos ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.sqls ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.reunioesAgendadas ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.leadsQuentes ?? "—"}</td>
                    <td
                      className={cn(
                        "py-2 pr-4",
                        r.bloqueio ? "text-critical" : "text-muted-foreground",
                      )}
                    >
                      {r.bloqueio ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.compromissoDoDia ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  );
}

function CloserSection({ rows }: { rows: CloserDayMetrics[] }) {
  const totals = {
    reunioesRealizadas: sum(rows.map((r) => r.reunioesRealizadas)),
    noShows: sum(rows.map((r) => r.noShows)),
    contratosPropostos: sum(rows.map((r) => r.oportunidadesGeradas)),
    vendas: sum(rows.map((r) => r.vendas)),
  };

  return (
    <SectionCard title="Andrey — Closer">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Reuniões realizadas"
            value={totals.reunioesRealizadas}
            accent="primary"
          />
          <StatCard label="No-shows" value={totals.noShows} accent="warning" tone="warning" />
          <StatCard
            label="Oportunidades geradas"
            value={totals.contratosPropostos}
            accent="primary"
          />
          <StatCard label="Vendas" value={totals.vendas} accent="success" tone="success" />
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ left: -20, right: 8, top: 8 }}>
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
              <Bar
                dataKey="reunioesRealizadas"
                name="Reuniões realizadas"
                fill="var(--color-chart-4)"
                radius={4}
              />
              <Bar dataKey="vendas" name="Vendas" fill="var(--color-chart-5)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[1400px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pl-3 pr-4 font-medium">Data</th>
                <th className="py-2 pr-4 text-right font-medium">Reuniões prev.</th>
                <th className="py-2 pr-4 text-right font-medium">Reuniões real.</th>
                <th className="py-2 pr-4 text-right font-medium">No-shows</th>
                <th className="py-2 pr-4 text-right font-medium">Oport. geradas</th>
                <th className="py-2 pr-4 text-right font-medium">RoGa realizado</th>
                <th className="py-2 pr-4 text-right font-medium">Follow-ups prev.</th>
                <th className="py-2 pr-4 text-right font-medium">Follow-ups real.</th>
                <th className="py-2 pr-4 text-right font-medium">Vendas</th>
                <th className="py-2 pr-4 text-right font-medium">Forecast semana</th>
                <th className="py-2 pr-4 text-right font-medium">Oport. prioritárias</th>
                <th className="py-2 pr-4 font-medium">Bloqueio</th>
                <th className="py-2 pr-4 font-medium">Compromisso do dia</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice()
                .reverse()
                .map((r) => (
                  <tr key={r.date} className="border-b border-border/40">
                    <td className="py-2 pl-3 pr-4 text-muted-foreground">{fmtDM(r.date)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.reunioesPrevistas ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.reunioesRealizadas ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.noShows ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.oportunidadesGeradas ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.rogaRealizado ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.followUpsPrevistos ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.followUpsRealizados ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.vendas ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.forecastSemana ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.oportunidadesPrioritarias ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-4",
                        r.bloqueio ? "text-critical" : "text-muted-foreground",
                      )}
                    >
                      {r.bloqueio ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.compromissoDoDia ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  );
}

function DailyExpansaoPage() {
  const [range, setRange] = useState<DateRange>(() => defaultDateRange());

  const { data, isLoading } = useQuery({
    queryKey: ["daily-expansao", range.from, range.to],
    queryFn: () => getDailyExpansaoData({ data: range }),
    refetchInterval: 120_000,
  });

  const bloqueios = data
    ? [
        ...data.allana
          .filter((r) => r.bloqueio)
          .map((r) => ({ pessoa: "Allana", date: r.date, bloqueio: r.bloqueio! })),
        ...data.julia
          .filter((r) => r.bloqueio)
          .map((r) => ({ pessoa: "Júlia", date: r.date, bloqueio: r.bloqueio! })),
        ...data.andrey
          .filter((r) => r.bloqueio)
          .map((r) => ({ pessoa: "Andrey", date: r.date, bloqueio: r.bloqueio! })),
      ].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  function exportCsv() {
    if (!data) return;
    const rows: Array<Record<string, unknown>> = [
      ...data.allana.map((r) => ({
        pessoa: "Allana",
        papel: "SDR",
        data: r.date,
        leads_novos: r.leadsNovos,
        contatos_efetivos: r.contatosEfetivos,
        sqls: r.sqls,
        reunioes_agendadas: r.reunioesAgendadas,
        reunioes_realizadas: "",
        no_shows: "",
        oportunidades_geradas: "",
        vendas: "",
        bloqueio: r.bloqueio ?? "",
        compromisso_do_dia: r.compromissoDoDia ?? "",
      })),
      ...data.julia.map((r) => ({
        pessoa: "Júlia",
        papel: "SDR",
        data: r.date,
        leads_novos: r.leadsNovos,
        contatos_efetivos: r.contatosEfetivos,
        sqls: r.sqls,
        reunioes_agendadas: r.reunioesAgendadas,
        reunioes_realizadas: "",
        no_shows: "",
        oportunidades_geradas: "",
        vendas: "",
        bloqueio: r.bloqueio ?? "",
        compromisso_do_dia: r.compromissoDoDia ?? "",
      })),
      ...data.andrey.map((r) => ({
        pessoa: "Andrey",
        papel: "Closer",
        data: r.date,
        leads_novos: "",
        contatos_efetivos: "",
        sqls: "",
        reunioes_agendadas: "",
        reunioes_realizadas: r.reunioesRealizadas,
        no_shows: r.noShows,
        oportunidades_geradas: r.oportunidadesGeradas,
        vendas: r.vendas,
        bloqueio: r.bloqueio ?? "",
        compromisso_do_dia: r.compromissoDoDia ?? "",
      })),
    ];
    downloadCsv(`daily-expansao-${range.from}_${range.to}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Expansão"
        subtitle="Leads, SQLs, reuniões e vendas do time de Expansão — direto da planilha 'Daily Expansão'"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker value={range} onChange={setRange} />
            <Button variant="outline" size="sm" disabled={!data} onClick={exportCsv}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <CardsSkeleton />
      ) : !data ? (
        <EmptyState
          icon={<Headphones className="h-5 w-5" />}
          title="Planilha do Drive não configurada"
          description="Defina GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY e GOOGLE_DAILY_EXPANSAO_FILE_ID no ambiente do servidor."
        />
      ) : (
        <FadeIn className="space-y-6">
          {bloqueios.length > 0 && (
            <div className="rounded-xl border border-critical/30 bg-critical/8 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-critical">
                <AlertTriangle className="h-4 w-4" /> {bloqueios.length} bloqueio(s) no período
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {bloqueios.map((b, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{fmtDM(b.date)}</span> ·{" "}
                    {b.pessoa}: {b.bloqueio}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Planilha atualizada em{" "}
              {new Date(data.updatedAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </p>
          )}

          <SdrSection name="Allana — SDR" rows={data.allana} barColor="var(--color-chart-1)" />
          <SdrSection name="Júlia — SDR" rows={data.julia} barColor="var(--color-chart-2)" />
          <CloserSection rows={data.andrey} />
        </FadeIn>
      )}
    </div>
  );
}
