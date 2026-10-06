import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { canAccessPage } from "@/lib/page-access";
import type { FunnelRule, FunnelRuleInput, RunOutcome } from "@/lib/funnel-rules-store";
import {
  createFunnelRuleFn,
  deleteFunnelRuleFn,
  getFunnelRulesDataFn,
  updateFunnelRuleFn,
  type PipelineOption,
} from "@/services/funnel-rules-service";
import { EmptyState, PageHeader, SectionCard } from "@/components/hub/primitives";
import { FadeIn } from "@/components/hub/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/regras-funil")({
  beforeLoad: ({ context }) => {
    if (!canAccessPage(context.user, "regras-funil")) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Regras do funil — hubLOw BLOW" },
      {
        name: "description",
        content: "Impeça que negócios pulem etapas do funil no PipeRun.",
      },
    ],
  }),
  component: FunnelRulesPage,
});

const OUTCOME_LABEL: Record<RunOutcome, { text: string; tone: string }> = {
  violacao_simulada: {
    text: "Teria sido devolvido (simulação)",
    tone: "border-warning/30 bg-warning/12 text-warning",
  },
  devolvido: { text: "Devolvido", tone: "border-success/30 bg-success/12 text-success" },
  erro: { text: "Erro", tone: "border-destructive/30 bg-destructive/12 text-destructive" },
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stageName(pipelines: PipelineOption[], pipelineId: number, stageId: number): string {
  return (
    pipelines.find((p) => p.id === pipelineId)?.stages.find((s) => s.id === stageId)?.name ??
    `etapa ${stageId}`
  );
}

function pipelineName(pipelines: PipelineOption[], pipelineId: number): string {
  return pipelines.find((p) => p.id === pipelineId)?.name ?? `funil ${pipelineId}`;
}

function FunnelRulesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["funnel-rules"],
    queryFn: () => getFunnelRulesDataFn(),
    refetchInterval: 30_000,
  });

  // `undefined` = fechado; `null` = criando; regra = editando.
  const [editing, setEditing] = useState<FunnelRule | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<FunnelRule | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["funnel-rules"] });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");

  const patchMutation = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<FunnelRuleInput> }) =>
      updateFunnelRuleFn({ data: vars }),
    onSuccess: refresh,
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFunnelRuleFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Regra excluída.");
      setDeleting(null);
      refresh();
    },
    onError,
  });

  const pipelines = data?.pipelines ?? [];
  const rules = data?.rules ?? [];
  const runs = data?.runs ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regras do funil"
        subtitle="Evite que negócios pulem etapas no PipeRun. O hub confere cada movimentação e, se a regra for quebrada, devolve o card."
        actions={
          <Button onClick={() => setEditing(null)} disabled={!data?.configured}>
            <Plus className="mr-2 h-4 w-4" /> Nova regra
          </Button>
        }
      />

      {data && !data.configured && (
        <SectionCard title="Falta configurar">
          <p className="text-sm text-muted-foreground">
            O hub ainda não está conectado ao Supabase e ao PipeRun. Peça para o time técnico
            conferir as chaves no servidor.
          </p>
        </SectionCard>
      )}

      {data?.configured && !data.webhookReady && (
        <SectionCard title="Falta ligar o aviso do PipeRun">
          <p className="text-sm text-muted-foreground">
            As regras abaixo já podem ser criadas, mas só passam a valer depois que o time técnico
            ligar o aviso de &quot;negócio mudou de etapa&quot; do PipeRun para o hub.
          </p>
        </SectionCard>
      )}

      <FadeIn>
        <SectionCard title="Minhas regras">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rules.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="h-5 w-5" />}
              title="Nenhuma regra ainda"
              description='Clique em "Nova regra" para criar a primeira.'
            />
          ) : (
            <ul className="space-y-3">
              {rules.map((rule) => (
                <li key={rule.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{rule.name}</p>
                      <p className="text-sm text-muted-foreground">
                        No funil <b>{pipelineName(pipelines, rule.pipelineId)}</b>, para entrar em{" "}
                        <b>{stageName(pipelines, rule.pipelineId, rule.targetStageId)}</b> o negócio
                        precisa ter passado por{" "}
                        <b>{stageName(pipelines, rule.pipelineId, rule.requiredStageId)}</b>. Se
                        pular, ele volta para{" "}
                        <b>{stageName(pipelines, rule.pipelineId, rule.returnStageId)}</b>.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`on-${rule.id}`} className="text-sm">
                        {rule.enabled ? "Ligada" : "Desligada"}
                      </Label>
                      <Switch
                        id={`on-${rule.id}`}
                        checked={rule.enabled}
                        onCheckedChange={(enabled) =>
                          patchMutation.mutate({ id: rule.id, patch: { enabled } })
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={rule.mode === "ativa" ? "default" : "secondary"}>
                        {rule.mode === "ativa" ? "Valendo de verdade" : "Só observando"}
                      </Badge>
                      <Switch
                        aria-label="Valer de verdade"
                        checked={rule.mode === "ativa"}
                        onCheckedChange={(on) => {
                          if (on) {
                            const ok = window.confirm(
                              "A partir de agora, negócios que pularem a etapa serão devolvidos automaticamente no PipeRun. Continuar?",
                            );
                            if (!ok) return;
                          }
                          patchMutation.mutate({
                            id: rule.id,
                            patch: { mode: on ? "ativa" : "simulacao" },
                          });
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {rule.mode === "ativa"
                          ? "Devolve o card sozinho."
                          : "Só registra o que aconteceria, sem mexer em nada."}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(rule)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleting(rule)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </FadeIn>

      <FadeIn>
        <SectionCard title="O que aconteceu">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nada ainda. Quando alguém pular uma etapa, aparece aqui.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {runs.map((run) => {
                const label = OUTCOME_LABEL[run.outcome];
                return (
                  <li key={run.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="w-28 shrink-0 text-muted-foreground">
                      {fmtDateTime(run.createdAt)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <b>{run.dealTitle ?? `Negócio ${run.dealId}`}</b>{" "}
                      <span className="text-muted-foreground">
                        · #{run.dealId} · {run.ruleName}
                      </span>
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${label.tone}`}>
                      {label.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </FadeIn>

      {editing !== undefined && (
        <RuleDialog
          rule={editing}
          pipelines={pipelines}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            refresh();
          }}
        />
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir regra?</DialogTitle>
            <DialogDescription>
              &quot;{deleting?.name}&quot; deixa de valer. O histórico do que ela fez continua
              aparecendo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StageSelect({
  label,
  value,
  stages,
  onChange,
}: {
  label: string;
  value: number | null;
  stages: PipelineOption["stages"];
  onChange: (id: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value === null ? "" : String(value)}
        onValueChange={(v) => onChange(Number(v))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Escolha a etapa" />
        </SelectTrigger>
        <SelectContent>
          {stages.map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const DEFAULT_COMMENT =
  "Este negócio voltou porque precisa passar pela etapa anterior antes de avançar.";

function RuleDialog({
  rule,
  pipelines,
  onClose,
  onSaved,
}: {
  rule: FunnelRule | null;
  pipelines: PipelineOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [pipelineId, setPipelineId] = useState<number | null>(rule?.pipelineId ?? null);
  const [targetStageId, setTarget] = useState<number | null>(rule?.targetStageId ?? null);
  const [requiredStageId, setRequired] = useState<number | null>(rule?.requiredStageId ?? null);
  const [returnStageId, setReturn] = useState<number | null>(rule?.returnStageId ?? null);
  const [addComment, setAddComment] = useState(rule?.addComment ?? true);
  const [commentText, setCommentText] = useState(rule?.commentText ?? DEFAULT_COMMENT);

  const stages = pipelines.find((p) => p.id === pipelineId)?.stages ?? [];
  const complete =
    name.trim() !== "" &&
    pipelineId !== null &&
    targetStageId !== null &&
    requiredStageId !== null &&
    returnStageId !== null;

  const mutation = useMutation({
    mutationFn: async () => {
      const input: FunnelRuleInput = {
        name,
        pipelineId: pipelineId!,
        targetStageId: targetStageId!,
        requiredStageId: requiredStageId!,
        returnStageId: returnStageId!,
        addComment,
        commentText,
        // Regra nova sempre nasce só observando; ligar "valendo" é decisão explícita depois.
        mode: rule?.mode ?? "simulacao",
        enabled: rule?.enabled ?? true,
      };
      if (rule) await updateFunnelRuleFn({ data: { id: rule.id, patch: input } });
      else await createFunnelRuleFn({ data: input });
    },
    onSuccess: () => {
      toast.success(rule ? "Regra atualizada." : "Regra criada — começa só observando.");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  function changePipeline(id: number) {
    setPipelineId(id);
    setTarget(null);
    setRequired(null);
    setReturn(null);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regra" : "Nova regra"}</DialogTitle>
          <DialogDescription>
            Monte a frase: para entrar numa etapa, o negócio precisa ter passado por outra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Nome da regra</Label>
            <Input
              id="rule-name"
              value={name}
              placeholder="Ex.: SQL só depois de Atendimento"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Em qual funil?</Label>
            <Select
              value={pipelineId === null ? "" : String(pipelineId)}
              onValueChange={(v) => changePipeline(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha o funil" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <StageSelect
            label="Para entrar nesta etapa..."
            value={targetStageId}
            stages={stages}
            onChange={setTarget}
          />
          <StageSelect
            label="...o negócio precisa ter passado por esta"
            value={requiredStageId}
            stages={stages}
            onChange={(id) => {
              setRequired(id);
              if (returnStageId === null) setReturn(id);
            }}
          />
          <StageSelect
            label="Se pular, devolver o card para"
            value={returnStageId}
            stages={stages}
            onChange={setReturn}
          />

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="rule-comment">Deixar um comentário no card</Label>
              <Switch id="rule-comment" checked={addComment} onCheckedChange={setAddComment} />
            </div>
            {addComment && (
              <Textarea
                value={commentText}
                rows={3}
                maxLength={500}
                onChange={(e) => setCommentText(e.target.value)}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!complete || mutation.isPending} onClick={() => mutation.mutate()}>
            {rule ? "Salvar" : "Criar regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
