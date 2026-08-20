import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Inbox } from "lucide-react";

import { cn } from "@/lib/utils";
import { getLeadsRecentesData } from "@/services/leads-recentes-service";
import type { LeadRecente } from "@/lib/leads-recentes";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  TablePagination,
  TableSkeleton,
} from "@/components/hub/primitives";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/hub/motion";
import { LeadDetailDialog } from "@/components/hub/LeadDetailDialog";

export const Route = createFileRoute("/leads-recentes")({
  head: () => ({
    meta: [
      { title: "Radar de Leads — hubLOw BLOW" },
      {
        name: "description",
        content: "Leads que chegaram nos últimos 14 dias no PipeRun, com o progresso real do CRM.",
      },
      { property: "og:title", content: "Radar de Leads — hubLOw BLOW" },
      {
        property: "og:description",
        content: "Feed em tempo real dos leads que entram no CRM, com progresso automático por etapa.",
      },
    ],
  }),
  component: LeadsRecentesPage,
});

const PAGE_SIZE = 25;
const PROGRESSO_FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "novo", label: "Novos" },
  { value: "andamento", label: "Em andamento" },
];

function ProgressoBadge({ emAndamento }: { emAndamento: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        emAndamento
          ? "border-success/30 bg-success/12 text-success"
          : "border-warning/30 bg-warning/12 text-warning",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {emAndamento ? "Em andamento" : "Novo"}
    </span>
  );
}

function formatCurrency(value: number): string {
  if (!value) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function LeadsRecentesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["piperun", "leads-recentes"],
    queryFn: () => getLeadsRecentesData(),
    refetchInterval: 60_000,
  });

  const [search, setSearch] = useState("");
  const [pipeline, setPipeline] = useState("todos");
  const [origem, setOrigem] = useState("todas");
  const [progresso, setProgresso] = useState("todos");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LeadRecente | null>(null);

  const filtered = useMemo(() => {
    return (data?.leads ?? []).filter((l) => {
      if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (pipeline !== "todos" && l.pipelineName !== pipeline) return false;
      if (origem !== "todas" && l.origin !== origem) return false;
      if (progresso === "novo" && l.emAndamento) return false;
      if (progresso === "andamento" && !l.emAndamento) return false;
      return true;
    });
  }, [data, search, pipeline, origem, progresso]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Radar de Leads"
        subtitle="Últimos 14 dias no PipeRun — dados reais, progresso automático por etapa"
      />

      {!isLoading && !data ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="PipeRun não configurado"
          description="Defina PIPERUN_API_KEY no ambiente do servidor para ver os leads reais aqui."
        />
      ) : (
        <>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-border/70 bg-card/70">
                  <CardContent className="py-5">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
                    <div className="mt-2 h-7 w-12 animate-pulse rounded bg-muted/60" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StaggerItem>
                <Card className="h-full border-border/70 bg-card/70 transition-shadow hover:shadow-lg hover:shadow-black/5">
                  <CardContent className="py-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total (14 dias)
                    </p>
                    <p className="mt-1 text-2xl font-semibold">
                      <AnimatedNumber value={data!.summary.total} />
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card className="h-full border-border/70 bg-card/70 transition-shadow hover:shadow-lg hover:shadow-black/5">
                  <CardContent className="py-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Últimas 24h
                    </p>
                    <p className="mt-1 text-2xl font-semibold">
                      <AnimatedNumber value={data!.summary.ultimasVintQuatroHoras} />
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card className="h-full border-border/70 bg-card/70 transition-shadow hover:shadow-lg hover:shadow-black/5">
                  <CardContent className="py-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Novos</p>
                    <p className="mt-1 text-2xl font-semibold text-warning">
                      <AnimatedNumber value={data!.summary.novos} />
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card className="h-full border-border/70 bg-card/70 transition-shadow hover:shadow-lg hover:shadow-black/5">
                  <CardContent className="py-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Em andamento
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-success">
                      <AnimatedNumber value={data!.summary.emAndamento} />
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
            </Stagger>
          )}

          <div className="grid gap-3 rounded-xl border border-border/70 bg-card/60 p-3 sm:grid-cols-2 xl:grid-cols-4">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome"
            />
            <Select
              value={pipeline}
              onValueChange={(v) => {
                setPipeline(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os funis</SelectItem>
                {(data?.pipelineNames ?? []).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={origem}
              onValueChange={(v) => {
                setOrigem(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as origens</SelectItem>
                {(data?.origins ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={progresso}
              onValueChange={(v) => {
                setProgresso(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROGRESSO_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Nenhum lead encontrado"
              description="Ajuste os filtros ou a busca."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card/60">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Nome</TableHead>
                      <TableHead>Funil</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Progresso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => setSelected(lead)}
                      >
                        <TableCell className="font-medium">{lead.title}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.pipelineName}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.stageName}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.origin}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.ownerName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatCurrency(lead.value)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(lead.createdAt.replace(" ", "T")).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <ProgressoBadge emAndamento={lead.emAndamento} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                current={current}
                totalPages={pages}
                totalItems={filtered.length}
                itemLabel="leads"
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      <LeadDetailDialog
        lead={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
