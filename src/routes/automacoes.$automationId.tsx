import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, BookOpen, ExternalLink, KeyRound, Pencil } from "lucide-react";

import { hubService, queryKeys } from "@/services/hub-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, KeyValue, SectionCard } from "@/components/hub/primitives";
import {
  AutomationStatusBadge,
  CredentialStatusBadge,
  HealthBadge,
  IncidentStatusBadge,
  PlatformBadge,
  SeverityBadge,
  SystemStatusBadge,
} from "@/components/hub/badges";
import { IncidentDetailSheet } from "@/components/hub/IncidentDetailSheet";
import type { Incident } from "@/types/hub";

export const Route = createFileRoute("/automacoes/$automationId")({
  head: () => ({
    meta: [
      { title: "Detalhe da automação — hubLOw BLOW" },
      {
        name: "description",
        content: "Fluxo, incidentes, integrações, credenciais e histórico de uma automação BLOW.",
      },
      { property: "og:title", content: "Detalhe da automação — hubLOw BLOW" },
      {
        property: "og:description",
        content: "Visão técnica completa de um workflow de automação da BLOW.",
      },
    ],
  }),
  component: AutomationDetail,
});

function AutomationDetail() {
  const { automationId } = Route.useParams();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const automation = useQuery({
    queryKey: queryKeys.automation(automationId),
    queryFn: () => hubService.getAutomation(automationId),
  });
  const incidents = useQuery({
    queryKey: queryKeys.incidentsByAutomation(automationId),
    queryFn: () => hubService.listIncidentsByAutomation(automationId),
  });
  const credentials = useQuery({
    queryKey: queryKeys.credentials,
    queryFn: hubService.listCredentials,
  });
  const integrations = useQuery({
    queryKey: queryKeys.integrations,
    queryFn: hubService.listIntegrations,
  });
  const docs = useQuery({
    queryKey: queryKeys.documentation,
    queryFn: hubService.listDocumentation,
  });

  if (automation.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-10 w-full max-w-xl rounded-lg" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  const a = automation.data;
  if (!a) {
    throw notFound();
  }

  const relatedCredentials = (credentials.data ?? []).filter((c) => a.credentialIds.includes(c.id));
  const relatedSystems = (integrations.data ?? []).filter((s) => a.systems.includes(s.name));
  const doc = (docs.data ?? []).find((d) => d.id === a.documentationId);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/70 bg-card/70 p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{a.code}</p>
            <h1 className="text-xl font-semibold sm:text-2xl">{a.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AutomationStatusBadge value={a.status} />
              <HealthBadge value={a.health} />
              <PlatformBadge value={a.platform} />
              <PlatformBadge value={a.area} />
              <span className="text-xs text-muted-foreground">Responsável: {a.owner}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild>
              <a href={a.externalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Abrir no {a.platform}
              </a>
            </Button>
            <Button variant="outline" onClick={() => toast.info("Edição será feita no n8n/Make.")}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button variant="outline" asChild>
              <Link to="/documentacao">
                <BookOpen className="h-4 w-4" /> Ver documentação
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="visao">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="visao">Visão geral</TabsTrigger>
            <TabsTrigger value="fluxo">Fluxo</TabsTrigger>
            <TabsTrigger value="incidentes">Incidentes</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
            <TabsTrigger value="credenciais">Credenciais</TabsTrigger>
            <TabsTrigger value="documentacao">Documentação</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="visao" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard title="Objetivo e descrição" className="lg:col-span-2">
              <p className="text-sm font-medium">{a.objective}</p>
              <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
              <Separator className="my-4" />
              <div className="grid gap-4 sm:grid-cols-2">
                <KeyValue label="Gatilho" value={a.trigger} />
                <KeyValue label="Frequência" value={a.frequency} />
                <KeyValue
                  label="Última execução"
                  value={new Date(a.lastRun).toLocaleString("pt-BR")}
                />
                <KeyValue
                  label="Próxima execução"
                  value={a.nextRun ? new Date(a.nextRun).toLocaleString("pt-BR") : "Sob evento"}
                />
              </div>
            </SectionCard>

            <SectionCard title="Métricas de saúde">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxa de sucesso</span>
                    <span className="font-medium">{a.successRate}%</span>
                  </div>
                  <Progress value={a.successRate} className="mt-2" />
                </div>
                <KeyValue label="Duração média" value={`${a.avgDurationSec}s`} />
                <KeyValue label="Execuções (30 dias)" value={a.runsLast30d} />
                <KeyValue label="Incidentes abertos" value={a.openIncidents} />
                <KeyValue label="Última revisão" value={a.lastReview} />
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Sistemas envolvidos">
            <div className="flex flex-wrap gap-2">
              {a.systems.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1 text-sm text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4">
          <SectionCard title="Fluxo de execução">
            {/* Futuro: substituir por leitura dos nós reais via API do n8n */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
              {a.flow.map((node, idx) => (
                <div key={node.id} className="flex flex-1 items-center gap-3">
                  <Card className="w-full border-border/70 bg-muted/20">
                    <CardContent className="space-y-2 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{node.name}</p>
                        <HealthBadge value={node.status} />
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block rounded border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                            {node.type}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Tipo do nó na plataforma {a.platform}</TooltipContent>
                      </Tooltip>
                      <p className="text-xs text-muted-foreground">{node.description}</p>
                    </CardContent>
                  </Card>
                  {idx < a.flow.length - 1 && (
                    <ArrowRight className="hidden h-5 w-5 shrink-0 text-primary lg:block" />
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="incidentes" className="mt-4">
          <SectionCard title="Incidentes relacionados">
            {incidents.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (incidents.data ?? []).length === 0 ? (
              <EmptyState title="Nenhum incidente registrado" description="Esta automação não gerou falhas." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="min-w-[220px]">Resumo</TableHead>
                      <TableHead>Nó com falha</TableHead>
                      <TableHead>HTTP</TableHead>
                      <TableHead className="text-center">Ocorrências</TableHead>
                      <TableHead>Última ocorrência</TableHead>
                      <TableHead>Responsável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(incidents.data ?? []).map((i) => (
                      <TableRow
                        key={i.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => setSelectedIncident(i)}
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
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="integracoes" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {relatedSystems.map((s) => (
              <Card key={s.id} className="border-border/70 bg-card/70">
                <CardContent className="space-y-2 py-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{s.name}</p>
                    <SystemStatusBadge value={s.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.openIncidents} incidentes abertos · responsável {s.owner}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="credenciais" className="mt-4">
          {a.realCredentials !== undefined ? (
            <SectionCard title="Credenciais usadas pelo workflow">
              <p className="mb-3 text-xs text-muted-foreground">
                Nome e tipo reais das credenciais configuradas no n8n para este workflow. O n8n
                nunca devolve o valor secreto pela API — só a referência.
              </p>
              {a.realCredentials.length === 0 ? (
                <EmptyState
                  icon={<KeyRound className="h-5 w-5" />}
                  title="Nenhuma credencial usada"
                  description="Este workflow não referencia nenhuma credencial cadastrada no n8n."
                />
              ) : (
                <ul className="divide-y divide-border/70">
                  {a.realCredentials.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          Tipo: {c.type} · Usada em: {c.nodes.join(", ")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          ) : (
            <SectionCard title="Credenciais de referência">
              <p className="mb-3 text-xs text-muted-foreground">
                Somente metadados operacionais. Nenhum segredo é exibido ou armazenado.
              </p>
              {relatedCredentials.length === 0 ? (
                <EmptyState
                  icon={<KeyRound className="h-5 w-5" />}
                  title="Nenhuma credencial vinculada"
                />
              ) : (
                <ul className="divide-y divide-border/70">
                  {relatedCredentials.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.system} · {c.type} · {c.location}
                        </p>
                      </div>
                      <CredentialStatusBadge value={c.status} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
        </TabsContent>

        <TabsContent value="documentacao" className="mt-4">
          {doc ? (
            <SectionCard title={doc.title}>
              <div className="grid gap-4 sm:grid-cols-2">
                <KeyValue label="Objetivo" value={doc.objective} />
                <KeyValue label="Fluxo" value={doc.flowSummary} />
                <KeyValue label="Dependências" value={doc.dependencies.join(", ")} />
                <KeyValue
                  label="Credenciais de referência"
                  value={doc.referencedCredentials.join(", ")}
                />
                <KeyValue label="Testes Postman" value={doc.postmanTests.join(" · ")} />
                <KeyValue label="Plano de contingência" value={doc.contingencyPlan} />
                <KeyValue label="Responsável" value={doc.owner} />
                <KeyValue label="Atualizado em" value={doc.updatedAt} />
              </div>
            </SectionCard>
          ) : (
            <EmptyState
              icon={<BookOpen className="h-5 w-5" />}
              title="Documentação não criada"
              description="Esta automação ainda não possui documento na base de conhecimento."
              action={
                <Button variant="outline" onClick={() => toast.success("Rascunho criado no Notion (simulado).")}>
                  Criar documentação
                </Button>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <SectionCard title="Histórico de alterações">
            <ol className="space-y-4 border-l border-border/70 pl-4">
              {a.history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <p className="text-sm font-medium">{h.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.date} · {h.author}
                  </p>
                </li>
              ))}
            </ol>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <IncidentDetailSheet
        incident={selectedIncident}
        open={Boolean(selectedIncident)}
        onOpenChange={(open) => !open && setSelectedIncident(null)}
      />
    </div>
  );
}
