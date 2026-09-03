import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ClipboardPlus, ExternalLink, Loader2 } from "lucide-react";
import { IncidentStatusBadge, SeverityBadge } from "@/components/hub/badges";
import { KeyValue } from "@/components/hub/primitives";
import { canAccessPage } from "@/lib/page-access";
import type { SessionUser } from "@/lib/auth";
import { createTaskFn } from "@/services/tasks-service";
import type { Incident } from "@/types/hub";
import type { TaskPriority } from "@/types/tasks";

const SEVERITY_TO_PRIORITY: Record<Incident["severity"], TaskPriority> = {
  Crítica: "Crítica",
  Alta: "Alta",
  Média: "Média",
  Baixa: "Baixa",
};

/** Painel de detalhe do incidente. O status do incidente em si continua
 * somente-leitura de propósito (a fonte da verdade é o n8n ao vivo — ver
 * incidents-store.ts — qualquer edição manual seria sobrescrita na próxima
 * reconciliação). Pra dar um jeito de ação real, "Criar tarefa" abre uma
 * tarefa de verdade (mutável, com responsável/status próprios) referenciando
 * o incidente, em vez de fingir que o incidente em si é editável. */
export function IncidentDetailSheet({
  incident,
  open,
  onOpenChange,
  user,
}: {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: SessionUser | null;
}) {
  const navigate = useNavigate();

  const createTaskMutation = useMutation({
    mutationFn: () => {
      if (!incident) throw new Error("Nenhum incidente selecionado.");
      return createTaskFn({
        data: {
          title: `${incident.code} — ${incident.title}`,
          description: incident.aiSummary || incident.summary,
          priority: SEVERITY_TO_PRIORITY[incident.severity],
          reference: {
            type: "incidente",
            id: incident.id,
            label: `${incident.code} — ${incident.title}`,
          },
        },
      });
    },
    onSuccess: (task) => {
      toast.success(`Tarefa #${task.taskNumber} criada a partir deste incidente.`, {
        action: {
          label: "Ver tarefa",
          onClick: () =>
            navigate({
              to: "/tarefas",
              search: { project: undefined, view: undefined, task: String(task.taskNumber) },
            }),
        },
      });
    },
    onError: (error: Error) => toast.error(`Não foi possível criar a tarefa: ${error.message}`),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {incident && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 text-left text-lg">
                {incident.code} · {incident.title}
              </SheetTitle>
              <SheetDescription className="text-left">{incident.summary}</SheetDescription>
              <div className="flex flex-wrap gap-2 pt-1">
                <SeverityBadge value={incident.severity} />
                <IncidentStatusBadge value={incident.status} />
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <KeyValue label="Automação afetada" value={incident.automationName} />
                <KeyValue label="Nó que falhou" value={incident.failedNode} />
                <KeyValue label="Código HTTP" value={incident.httpCode ?? "—"} />
                <KeyValue label="Ocorrências" value={incident.occurrences} />
                <KeyValue
                  label="Primeira ocorrência"
                  value={new Date(incident.firstSeen).toLocaleString("pt-BR")}
                />
                <KeyValue
                  label="Última ocorrência"
                  value={new Date(incident.lastSeen).toLocaleString("pt-BR")}
                />
                <KeyValue label="Categoria" value={incident.category} />
                <KeyValue label="Responsável" value={incident.owner} />
              </div>

              <Separator />

              <section>
                <h4 className="text-sm font-semibold">Resumo gerado por IA</h4>
                <p className="mt-1 text-sm text-muted-foreground">{incident.aiSummary}</p>
              </section>

              <section>
                <h4 className="text-sm font-semibold">Fatos observados</h4>
                <ul className="mt-2 space-y-1.5">
                  {incident.facts.map((f) => (
                    <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-lg border border-warning/25 bg-warning/8 p-3">
                <h4 className="text-sm font-semibold text-warning">Causa provável</h4>
                <p className="mt-1 text-sm text-muted-foreground">{incident.probableCause}</p>
              </section>

              <section className="rounded-lg border border-success/25 bg-success/8 p-3">
                <h4 className="text-sm font-semibold text-success">Solução sugerida</h4>
                <p className="mt-1 text-sm text-muted-foreground">{incident.suggestedFix}</p>
              </section>

              <section>
                <h4 className="text-sm font-semibold">Evidências técnicas</h4>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                  {incident.evidence}
                </pre>
              </section>

              <section>
                <h4 className="text-sm font-semibold">Linha do tempo de ocorrências</h4>
                <ol className="mt-3 space-y-3 border-l border-border/60 pl-4">
                  {incident.timeline.map((t) => (
                    <li key={t.date} className="relative text-sm">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <span className="font-medium">{t.date}</span>
                      <span className="ml-2 text-muted-foreground">{t.count} ocorrência(s)</span>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="flex flex-wrap gap-2">
                {user && canAccessPage(user, "tarefas") && (
                  <Button
                    size="sm"
                    disabled={createTaskMutation.isPending}
                    onClick={() => createTaskMutation.mutate()}
                  >
                    {createTaskMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ClipboardPlus className="h-4 w-4" />
                    )}
                    Criar tarefa
                  </Button>
                )}
                {incident.n8nExecutionUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={incident.n8nExecutionUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Abrir execução no n8n
                    </a>
                  </Button>
                )}
                {incident.notionUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={incident.notionUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Abrir no Notion
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
