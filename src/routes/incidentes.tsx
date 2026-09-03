import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";

import { canAccessPage } from "@/lib/page-access";
import { hubService, queryKeys } from "@/services/hub-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  SortableHeader,
  StatCard,
  TablePagination,
  TableSkeleton,
  useSortState,
} from "@/components/hub/primitives";
import { Stagger, StaggerItem } from "@/components/hub/motion";
import { IncidentStatusBadge, SeverityBadge } from "@/components/hub/badges";
import { IncidentDetailSheet } from "@/components/hub/IncidentDetailSheet";

export const Route = createFileRoute("/incidentes")({
  beforeLoad: ({ context }) => {
    if (!canAccessPage(context.user, "incidentes")) {
      throw redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    incidente:
      typeof search["incidente"] === "string" ? (search["incidente"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Incidentes — hubLOw BLOW" },
      {
        name: "description",
        content:
          "Central de incidentes das automações BLOW com severidade, diagnóstico e solução sugerida.",
      },
      { property: "og:title", content: "Incidentes — hubLOw BLOW" },
      {
        property: "og:description",
        content: "Acompanhe incidentes abertos, em investigação e resolvidos das automações BLOW.",
      },
    ],
  }),
  component: IncidentsPage,
});

const PAGE_SIZE = 25;

const SEVERITY_RANK: Record<string, number> = { Baixa: 0, Média: 1, Alta: 2, Crítica: 3 };
const STATUS_RANK: Record<string, number> = { Resolvido: 0, Investigando: 1, Aberto: 2 };

type SortKey = "severity" | "status" | "occurrences" | "lastSeen";

function IncidentsPage() {
  const { user } = Route.useRouteContext();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.incidents,
    queryFn: hubService.listIncidents,
  });
  const { incidente } = Route.useSearch();
  const navigate = useNavigate({ from: "/incidentes" });

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [category, setCategory] = useState("todas");
  const [automation, setAutomation] = useState("todas");
  const [page, setPage] = useState(1);
  const { sort, toggleSort } = useSortState<SortKey>();

  const categories = Array.from(new Set((data ?? []).map((i) => i.category)));
  const automationNames = Array.from(new Set((data ?? []).map((i) => i.automationName)));

  const filtered = useMemo(
    () =>
      (data ?? []).filter((i) => {
        if (search && !`${i.code} ${i.title}`.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (severity !== "todas" && i.severity !== severity) return false;
        if (status !== "todos" && i.status !== status) return false;
        if (category !== "todas" && i.category !== category) return false;
        if (automation !== "todas" && i.automationName !== automation) return false;
        return true;
      }),
    [data, search, severity, status, category, automation],
  );

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "severity":
          return (SEVERITY_RANK[a.severity]! - SEVERITY_RANK[b.severity]!) * dir;
        case "status":
          return (STATUS_RANK[a.status]! - STATUS_RANK[b.status]!) * dir;
        case "occurrences":
          return (a.occurrences - b.occurrences) * dir;
        case "lastSeen":
          return (new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime()) * dir;
      }
    });
  }, [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const selected = (data ?? []).find((i) => i.id === incidente) ?? null;

  const counts = {
    abertos: (data ?? []).filter((i) => i.status === "Aberto").length,
    investigando: (data ?? []).filter((i) => i.status === "Investigando").length,
    resolvidos: (data ?? []).filter((i) => i.status === "Resolvido").length,
    criticos: (data ?? []).filter((i) => i.severity === "Crítica" && i.status !== "Resolvido")
      .length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidentes"
        subtitle="Falhas capturadas automaticamente pela Central de Erros"
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            {
              label: "Abertos",
              value: counts.abertos,
              tone: "critical",
              accent: "critical",
              active: status === "Aberto",
              onClick: () => {
                setStatus((s) => (s === "Aberto" ? "todos" : "Aberto"));
                setPage(1);
              },
            },
            {
              label: "Investigando",
              value: counts.investigando,
              tone: "warning",
              accent: "warning",
              active: status === "Investigando",
              onClick: () => {
                setStatus((s) => (s === "Investigando" ? "todos" : "Investigando"));
                setPage(1);
              },
            },
            {
              label: "Resolvidos",
              value: counts.resolvidos,
              tone: "success",
              accent: "success",
              active: status === "Resolvido",
              onClick: () => {
                setStatus((s) => (s === "Resolvido" ? "todos" : "Resolvido"));
                setPage(1);
              },
            },
            {
              label: "Críticos",
              value: counts.criticos,
              tone: "critical",
              accent: "critical",
              active: severity === "Crítica",
              onClick: () => {
                setSeverity((s) => (s === "Crítica" ? "todas" : "Crítica"));
                if (status === "Resolvido") setStatus("todos");
                setPage(1);
              },
            },
          ] as const
        ).map((c) => (
          <StaggerItem key={c.label}>
            <StatCard
              label={c.label}
              value={c.value}
              tone={c.tone}
              accent={c.accent}
              active={c.active}
              onClick={c.onClick}
            />
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid gap-3 rounded-xl border border-border/60 bg-card/60 p-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar incidente"
            className="pl-9"
          />
        </div>
        <Filter
          value={severity}
          onChange={setSeverity}
          all="todas"
          allLabel="Todas as severidades"
          options={["Crítica", "Alta", "Média", "Baixa"]}
        />
        <Filter
          value={status}
          onChange={setStatus}
          all="todos"
          allLabel="Todos os status"
          options={["Aberto", "Investigando", "Resolvido"]}
        />
        <Filter
          value={category}
          onChange={setCategory}
          all="todas"
          allLabel="Todas as categorias"
          options={categories}
        />
        <Filter
          value={automation}
          onChange={setAutomation}
          all="todas"
          allLabel="Todas as automações"
          options={automationNames}
        />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Nenhum incidente encontrado"
          description="Nenhum registro corresponde aos filtros selecionados."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/60">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    label="Severidade"
                    sortKey="severity"
                    active={sort}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    active={sort}
                    onSort={toggleSort}
                  />
                  <TableHead className="min-w-[260px]">Resumo</TableHead>
                  <TableHead>Automação</TableHead>
                  <TableHead>Nó com falha</TableHead>
                  <TableHead>HTTP</TableHead>
                  <SortableHeader
                    label="Ocorrências"
                    sortKey="occurrences"
                    active={sort}
                    onSort={toggleSort}
                    className="text-center"
                  />
                  <SortableHeader
                    label="Última ocorrência"
                    sortKey="lastSeen"
                    active={sort}
                    onSort={toggleSort}
                  />
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((i) => (
                  <TableRow
                    key={i.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate({ to: ".", search: { incidente: i.id } })}
                  >
                    <TableCell>
                      <SeverityBadge value={i.severity} />
                    </TableCell>
                    <TableCell>
                      <IncidentStatusBadge value={i.status} />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{i.code}</p>
                      <p className="text-sm text-muted-foreground">{i.title}</p>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {i.automationName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.failedNode}</TableCell>
                    <TableCell className="text-muted-foreground">{i.httpCode ?? "—"}</TableCell>
                    <TableCell className="text-center">{i.occurrences}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(i.lastSeen).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.owner}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            current={current}
            totalPages={pages}
            totalItems={filtered.length}
            itemLabel="incidentes"
            onPageChange={setPage}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Precisa do contexto do workflow?{" "}
        <Link to="/automacoes" className="text-primary hover:underline">
          Ver automações
        </Link>
      </p>

      <IncidentDetailSheet
        incident={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) navigate({ to: ".", search: { incidente: undefined } });
        }}
        user={user}
      />
    </div>
  );
}

function Filter({
  value,
  onChange,
  options,
  all,
  allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  all: string;
  allLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={all}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
