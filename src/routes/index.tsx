import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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
import { Activity, AlertTriangle, Plus, ShieldAlert, ShieldCheck } from "lucide-react";

import { hubService, queryKeys } from "@/services/hub-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardsSkeleton, EmptyState, PageHeader, SectionCard } from "@/components/hub/primitives";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/hub/motion";
import {
  CredentialStatusBadge,
  HealthBadge,
  IncidentStatusBadge,
  SeverityBadge,
  SystemStatusBadge,
} from "@/components/hub/badges";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "hubLOw — Visão operacional das automações BLOW" },
      {
        name: "description",
        content:
          "Dashboard executivo com automações ativas, incidentes abertos e status dos sistemas integrados da BLOW.",
      },
      { property: "og:title", content: "hubLOw — Visão operacional das automações BLOW" },
      {
        property: "og:description",
        content: "Acompanhe automações, incidentes e integrações da BLOW em um único painel.",
      },
    ],
  }),
  component: Overview,
});

function MetricCard({
  label,
  value,
  icon,
  tone,
  hint,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
  hint: string;
  loading?: boolean;
}) {
  return (
    <Card className="h-full border-border/70 bg-card/70 transition-shadow hover:shadow-lg hover:shadow-black/5">
      <CardContent className="flex items-start gap-3 py-5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-12" />
          ) : (
            <p className="mt-0.5 text-2xl font-semibold">
              <AnimatedNumber value={value} />
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Overview() {
  const [period, setPeriod] = useState("30");
  const overview = useQuery({ queryKey: queryKeys.overview, queryFn: hubService.getOverview });
  const automations = useQuery({
    queryKey: queryKeys.automations,
    queryFn: hubService.listAutomations,
  });
  const incidents = useQuery({ queryKey: queryKeys.incidents, queryFn: hubService.listIncidents });
  const integrations = useQuery({
    queryKey: queryKeys.integrations,
    queryFn: hubService.listIntegrations,
  });
  const credentials = useQuery({
    queryKey: queryKeys.credentials,
    queryFn: hubService.listCredentials,
  });

  const days = Number(period);
  const series = (overview.data?.incidentsByDay ?? []).slice(-days);

  const recentIncidents = (incidents.data ?? [])
    .filter((i) => i.status !== "Resolvido")
    .slice(0, 5);
  const attention = (automations.data ?? []).filter((a) => a.health !== "Saudável").slice(0, 5);
  const reviewSoon = (credentials.data ?? [])
    .filter((c) => c.status !== "Ativa")
    .concat((credentials.data ?? []).filter((c) => c.status === "Ativa"))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="hubLOw"
        subtitle="Visão operacional das automações e integrações"
        actions={
          <>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => toast.success("Fluxo de criação será integrado ao n8n.")}>
              <Plus className="h-4 w-4" /> Nova automação
            </Button>
          </>
        }
      />

      {overview.isLoading ? (
        <CardsSkeleton />
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem>
            <MetricCard
              label="Automações ativas"
              value={overview.data?.activeAutomations ?? 0}
              icon={<Activity className="h-5 w-5 text-primary" />}
              tone="bg-primary/12"
              hint="Em execução nas plataformas"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              label="Incidentes abertos"
              value={overview.data?.openIncidents ?? 0}
              icon={<AlertTriangle className="h-5 w-5 text-warning" />}
              tone="bg-warning/12"
              hint="Aberto ou investigando"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              label="Incidentes críticos"
              value={overview.data?.criticalIncidents ?? 0}
              icon={<ShieldAlert className="h-5 w-5 text-critical" />}
              tone="bg-critical/12"
              hint="Impacto direto em operação"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              label="Automações saudáveis"
              value={overview.data?.healthyAutomations ?? 0}
              icon={<ShieldCheck className="h-5 w-5 text-success" />}
              tone="bg-success/12"
              hint="Sem falhas recentes"
            />
          </StaggerItem>
        </Stagger>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title={`Incidentes por dia — últimos ${days} dias`} className="lg:col-span-2">
          {overview.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
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
                    name="Total"
                    stroke="var(--color-primary)"
                    fill="url(#gTotal)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="criticos"
                    name="Críticos"
                    stroke="var(--color-critical)"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Incidentes por categoria de erro">
          {overview.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={overview.data?.incidentsByCategory ?? []}
                  layout="vertical"
                  margin={{ left: 40, right: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
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
                    dataKey="category"
                    width={110}
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
                  <Bar dataKey="total" name="Ocorrências" fill="var(--color-primary)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Incidentes recentes"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/incidentes">Ver todos</Link>
            </Button>
          }
        >
          {incidents.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : recentIncidents.length === 0 ? (
            <EmptyState title="Nenhum incidente aberto" description="Tudo operando normalmente." />
          ) : (
            <ul className="divide-y divide-border/70">
              {recentIncidents.map((i) => (
                <li key={i.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/incidentes"
                      search={{ incidente: i.id }}
                      className="truncate text-sm font-medium hover:text-primary"
                    >
                      {i.code} · {i.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {i.automationName}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <SeverityBadge value={i.severity} />
                    <IncidentStatusBadge value={i.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Automações que exigem atenção"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/automacoes">Ver todas</Link>
            </Button>
          }
        >
          {automations.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : attention.length === 0 ? (
            <EmptyState title="Nenhuma automação em risco" />
          ) : (
            <ul className="divide-y divide-border/70">
              {attention.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/automacoes/$automationId"
                      params={{ automationId: a.id }}
                      className="truncate text-sm font-medium hover:text-primary"
                    >
                      {a.name}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.platform} · {a.area} · {a.owner}
                    </p>
                  </div>
                  <HealthBadge value={a.health} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Credenciais próximas de revisão">
          {credentials.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ul className="divide-y divide-border/70">
              {reviewSoon.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.system} · revisar em {c.nextReview}
                    </p>
                  </div>
                  <CredentialStatusBadge value={c.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Status geral por sistema">
          {integrations.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(integrations.data ?? []).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
                >
                  <span className="truncate text-sm">{s.name}</span>
                  <SystemStatusBadge value={s.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
