import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LayoutGrid, Rows3, Search, Workflow } from "lucide-react";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, PageHeader, TablePagination, TableSkeleton } from "@/components/hub/primitives";
import { AutomationStatusBadge, HealthBadge, PlatformBadge } from "@/components/hub/badges";

export const Route = createFileRoute("/automacoes/")({
  head: () => ({
    meta: [
      { title: "Automações — hubLOw BLOW" },
      {
        name: "description",
        content: "Inventário de automações n8n e Make da BLOW com status, saúde e responsáveis.",
      },
      { property: "og:title", content: "Automações — hubLOw BLOW" },
      {
        property: "og:description",
        content: "Filtre automações por plataforma, área, status e saúde operacional.",
      },
    ],
  }),
  component: AutomationsPage,
});

const PAGE_SIZE = 25;

function AutomationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.automations,
    queryFn: hubService.listAutomations,
  });

  const [view, setView] = useState<"tabela" | "cards">("tabela");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [area, setArea] = useState("todas");
  const [health, setHealth] = useState("todas");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return (data ?? []).filter((a) => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (platform !== "todas" && a.platform !== platform) return false;
      if (status !== "todos" && a.status !== status) return false;
      if (area !== "todas" && a.area !== area) return false;
      if (health !== "todas" && a.health !== health) return false;
      return true;
    });
  }, [data, search, platform, status, area, health]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automações"
        subtitle="Inventário de workflows do n8n e cenários do Make"
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
            <Button
              size="sm"
              variant={view === "tabela" ? "secondary" : "ghost"}
              onClick={() => setView("tabela")}
            >
              <Rows3 className="h-4 w-4" /> Tabela
            </Button>
            <Button
              size="sm"
              variant={view === "cards" ? "secondary" : "ghost"}
              onClick={() => setView("cards")}
            >
              <LayoutGrid className="h-4 w-4" /> Cards
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 rounded-xl border border-border/70 bg-card/60 p-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="relative xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome"
            className="pl-9"
          />
        </div>
        <FilterSelect
          value={platform}
          onChange={setPlatform}
          allLabel="Todas as plataformas"
          allValue="todas"
          options={["n8n", "Make"]}
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          allLabel="Todos os status"
          allValue="todos"
          options={["Ativa", "Pausada", "Em manutenção", "Descontinuada"]}
        />
        <FilterSelect
          value={area}
          onChange={setArea}
          allLabel="Todas as áreas"
          allValue="todas"
          options={["Marketing", "Comercial", "Implantação", "People", "Operações"]}
        />
        <FilterSelect
          value={health}
          onChange={setHealth}
          allLabel="Toda a saúde"
          allValue="todas"
          options={["Saudável", "Atenção", "Crítica"]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Workflow className="h-5 w-5" />}
          title="Nenhuma automação encontrada"
          description="Ajuste os filtros ou limpe a busca para ver todos os workflows."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setPlatform("todas");
                setStatus("todos");
                setArea("todas");
                setHealth("todas");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : view === "tabela" ? (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/60">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Nome</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Saúde</TableHead>
                  <TableHead className="min-w-[200px]">Último erro</TableHead>
                  <TableHead className="text-center">Incidentes</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Última revisão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Link
                        to="/automacoes/$automationId"
                        params={{ automationId: a.id }}
                        className="font-medium hover:text-primary"
                      >
                        {a.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{a.code}</p>
                    </TableCell>
                    <TableCell>
                      <PlatformBadge value={a.platform} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.area}</TableCell>
                    <TableCell>
                      <AutomationStatusBadge value={a.status} />
                    </TableCell>
                    <TableCell>
                      <HealthBadge value={a.health} />
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      {a.lastError ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block truncate text-sm text-muted-foreground">
                              {a.lastError}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{a.lastError}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{a.openIncidents}</TableCell>
                    <TableCell className="text-muted-foreground">{a.owner}</TableCell>
                    <TableCell className="text-muted-foreground">{a.lastReview}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            current={current}
            totalPages={pages}
            totalItems={filtered.length}
            itemLabel="automações"
            onPageChange={setPage}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <Card key={a.id} className="border-border/70 bg-card/70 transition-colors hover:border-primary/40">
              <CardContent className="space-y-3 py-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{a.code}</p>
                    <Link
                      to="/automacoes/$automationId"
                      params={{ automationId: a.id }}
                      className="line-clamp-2 font-medium hover:text-primary"
                    >
                      {a.name}
                    </Link>
                  </div>
                  <HealthBadge value={a.health} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <PlatformBadge value={a.platform} />
                  <PlatformBadge value={a.area} />
                  <AutomationStatusBadge value={a.status} />
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{a.objective}</p>
                <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <span>{a.owner}</span>
                  <span>{a.openIncidents} incidentes abertos</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  allValue,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
  allValue: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allValue}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
