import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";

import { hubService, queryKeys } from "@/services/hub-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/hub/primitives";
import { IncidentStatusBadge, SeverityBadge } from "@/components/hub/badges";
import { IncidentDetailSheet } from "@/components/hub/IncidentDetailSheet";

export const Route = createFileRoute("/incidentes")({
  validateSearch: (search: Record<string, unknown>) => ({
    incidente: typeof search.incidente === "string" ? search.incidente : undefined,
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

const PAGE_SIZE = 5;

function IncidentsPage() {
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

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Abertos", value: counts.abertos, tone: "text-critical" },
          { label: "Investigando", value: counts.investigando, tone: "text-warning" },
          { label: "Resolvidos", value: counts.resolvidos, tone: "text-success" },
          { label: "Críticos", value: counts.criticos, tone: "text-critical" },
        ].map((c) => (
          <Card key={c.label} className="border-border/70 bg-card/70">
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${c.tone}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-border/70 bg-card/60 p-3 md:grid-cols-2 xl:grid-cols-5">
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
        <Filter value={severity} onChange={setSeverity} all="todas" allLabel="Todas as severidades" options={["Crítica", "Alta", "Média", "Baixa"]} />
        <Filter value={status} onChange={setStatus} all="todos" allLabel="Todos os status" options={["Aberto", "Investigando", "Resolvido"]} />
        <Filter value={category} onChange={setCategory} all="todas" allLabel="Todas as categorias" options={categories} />
        <Filter value={automation} onChange={setAutomation} all="todas" allLabel="Todas as automações" options={automationNames} />
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
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/60">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[260px]">Resumo</TableHead>
                  <TableHead>Automação</TableHead>
                  <TableHead>Nó com falha</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead className="text-center">Ocorrências</TableHead>
                  <TableHead>Última ocorrência</TableHead>
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {filtered.length} incidentes · página {current} de {pages}
            </p>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                {Array.from({ length: pages }).map((_, idx) => (
                  <PaginationItem key={idx}>
                    <PaginationLink
                      href="#"
                      isActive={current === idx + 1}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(idx + 1);
                      }}
                    >
                      {idx + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
              </PaginationContent>
            </Pagination>
          </div>
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
