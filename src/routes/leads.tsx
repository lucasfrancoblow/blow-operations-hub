import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Snowflake } from "lucide-react";

import { cn } from "@/lib/utils";
import { getPipeRunLeadsData } from "@/services/piperun-service";
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

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Leads em risco — hubLOw BLOW" },
      {
        name: "description",
        content: "Negócios abertos no PipeRun sem contato recente, priorizados por dias parados.",
      },
      { property: "og:title", content: "Leads em risco — hubLOw BLOW" },
      {
        property: "og:description",
        content:
          "Dados reais do CRM: leads frios, nunca contatados ou parados há muito tempo no funil.",
      },
    ],
  }),
  component: LeadsPage,
});

const PAGE_SIZE = 25;
const DAY_FILTERS = [
  { value: "0", label: "Todos" },
  { value: "3", label: "3+ dias sem contato" },
  { value: "7", label: "7+ dias sem contato" },
  { value: "14", label: "14+ dias sem contato" },
  { value: "30", label: "30+ dias sem contato" },
];

function severityTone(days: number, everContacted: boolean): string {
  if (!everContacted || days >= 30) return "border-critical/35 bg-critical/12 text-critical";
  if (days >= 7) return "border-warning/30 bg-warning/12 text-warning";
  return "border-border bg-muted/40 text-muted-foreground";
}

function DaysBadge({ days, everContacted }: { days: number; everContacted: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        severityTone(days, everContacted),
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {everContacted ? `${days}d sem contato` : "Nunca contatado"}
    </span>
  );
}

function formatCurrency(value: number): string {
  if (!value) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function LeadsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["piperun", "leads-risco"],
    queryFn: () => getPipeRunLeadsData(),
    refetchInterval: 120_000,
  });

  const [search, setSearch] = useState("");
  const [pipeline, setPipeline] = useState("todos");
  const [minDays, setMinDays] = useState("7");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const threshold = Number(minDays);
    return (data?.leads ?? []).filter((l) => {
      if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (pipeline !== "todos" && l.pipelineName !== pipeline) return false;
      if (threshold > 0 && l.daysSinceContact < threshold) return false;
      return true;
    });
  }, [data, search, pipeline, minDays]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads em risco"
        subtitle="Negócios abertos no PipeRun sem contato recente — dados reais do CRM"
      />

      {!isLoading && !data ? (
        <EmptyState
          icon={<Snowflake className="h-5 w-5" />}
          title="PipeRun não configurado"
          description="Defina PIPERUN_API_KEY no ambiente do servidor para ver os leads reais aqui."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-border/70 bg-card/70">
                  <CardContent className="py-5">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
                    <div className="mt-2 h-7 w-12 animate-pulse rounded bg-muted/60" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <Card className="border-border/70 bg-card/70">
                  <CardContent className="py-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Negócios abertos
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{data!.summary.totalOpen}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/70">
                  <CardContent className="py-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      7+ dias sem contato
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-warning">
                      {data!.summary.over7Days}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/70">
                  <CardContent className="py-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      30+ dias sem contato
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-critical">
                      {data!.summary.over30Days}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/70">
                  <CardContent className="py-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Nunca contatados
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-critical">
                      {data!.summary.neverContacted}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="grid gap-3 rounded-xl border border-border/70 bg-card/60 p-3 sm:grid-cols-3">
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
              value={minDays}
              onValueChange={(v) => {
                setMinDays(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_FILTERS.map((f) => (
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
              icon={<Snowflake className="h-5 w-5" />}
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
                      <TableHead>Responsável</TableHead>
                      <TableHead>Dias sem contato</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((lead) => (
                      <TableRow key={lead.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{lead.title}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.pipelineName}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.stageName}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.ownerName}</TableCell>
                        <TableCell>
                          <DaysBadge
                            days={lead.daysSinceContact}
                            everContacted={lead.everContacted}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatCurrency(lead.value)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(lead.createdAt.replace(" ", "T")).toLocaleDateString("pt-BR")}
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
    </div>
  );
}
