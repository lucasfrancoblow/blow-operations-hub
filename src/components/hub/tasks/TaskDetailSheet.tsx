import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, Pin, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";
import { listActiveUsersFn } from "@/services/auth-service";
import {
  createSubtaskFn,
  createTaskFn,
  deleteTaskFn,
  getTaskFn,
  listProjectsFn,
  listSubtasksFn,
  updateTaskFn,
} from "@/services/tasks-service";
import { suggestPriorityFn, suggestSubtasksFn, summarizeTaskFn } from "@/services/tasks-ai-service";
import { TaskAttachments } from "@/components/hub/tasks/TaskAttachments";
import { TaskComments } from "@/components/hub/tasks/TaskComments";
import { STATUS_DOT } from "@/components/hub/tasks/TaskColumn";
import { UserMultiSelect } from "@/components/hub/tasks/UserMultiSelect";
import { UNASSIGNED_PROJECT_ID, projectColorDot } from "@/components/hub/tasks/ProjectSwitcher";
import { TASK_PRIORITIES, TASK_STATUSES, type Task, type TaskInput } from "@/types/tasks";

const ACCEPT_STATUS: Task["status"] = "Aguardando aceite";
const ACCEPTED_STATUS: Task["status"] = "Backlog";
const REJECTED_STATUS: Task["status"] = "Recusada";

type FormState = {
  title: string;
  description: string;
  status: Task["status"];
  priority: Task["priority"];
  projectId: string;
  assigneeIds: string[];
  highlighted: boolean;
  tags: string;
  storyPoints: string;
  estimatedHours: string;
  dueDate: string;
};

function toFormState(task: Task | null, defaultProjectId: string | null): FormState {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "Backlog",
    priority: task?.priority ?? "Média",
    projectId: (task ? task.projectId : defaultProjectId) ?? UNASSIGNED_PROJECT_ID,
    assigneeIds: task?.assigneeIds ?? [],
    highlighted: task?.highlighted ?? false,
    tags: task?.tags.join(", ") ?? "",
    storyPoints:
      task?.storyPoints !== null && task?.storyPoints !== undefined ? String(task.storyPoints) : "",
    estimatedHours:
      task?.estimatedHours !== null && task?.estimatedHours !== undefined
        ? String(task.estimatedHours)
        : "",
    dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : "",
  };
}

function toInput(form: FormState): TaskInput {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    priority: form.priority,
    projectId: form.projectId === UNASSIGNED_PROJECT_ID ? null : form.projectId,
    assigneeIds: form.assigneeIds,
    highlighted: form.highlighted,
    tags: form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    storyPoints: form.storyPoints.trim() ? Number(form.storyPoints) : null,
    estimatedHours: form.estimatedHours.trim() ? Number(form.estimatedHours) : null,
    dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
  };
}

/** Aba "Subtarefas" — lista compacta com criação inline; clicar numa
 * subtarefa navega o próprio sheet pra ela (sem dialog aninhado). */
function SubtasksTab({
  parentTask,
  onNavigateToTask,
}: {
  parentTask: Task;
  onNavigateToTask: (task: Task) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

  const { data: subtasks = [] } = useQuery({
    queryKey: ["subtasks", parentTask.id],
    queryFn: () => listSubtasksFn({ data: { parentTaskId: parentTask.id } }),
  });

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      createSubtaskFn({ data: { title, parentTaskId: parentTask.id } }),
    onSuccess: () => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["subtasks", parentTask.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) => toast.error(`Não foi possível criar a subtarefa: ${error.message}`),
  });

  function submit() {
    const value = title.trim();
    if (!value) return;
    createMutation.mutate(value);
  }

  return (
    <div className="space-y-2">
      {subtasks.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma subtarefa ainda.</p>
      )}
      {subtasks.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onNavigateToTask(s)}
          className="flex w-full items-center gap-2 rounded-md border border-border bg-card p-2 text-left text-sm hover:border-primary/50"
        >
          <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[s.status])} />
          <span className="min-w-0 flex-1 truncate">
            <span className="text-muted-foreground">#{s.taskNumber}</span> {s.title}
          </span>
          {s.assignees[0] && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
              {displayName(s.assignees[0]).charAt(0).toUpperCase()}
            </span>
          )}
        </button>
      ))}
      <div className="flex gap-2 pt-1">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nova subtarefa"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button size="sm" disabled={!title.trim() || createMutation.isPending} onClick={submit}>
          {createMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </label>
  );
}

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  defaultProjectId = null,
  onNavigateToTask,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string | null;
  /** Troca a tarefa exibida sem fechar o sheet — usado pra abrir uma
   * subtarefa ou voltar pra tarefa-pai. */
  onNavigateToTask?: (task: Task) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => toFormState(task, defaultProjectId));

  const { data: users = [] } = useQuery({
    queryKey: ["assignable-users"],
    queryFn: () => listActiveUsersFn(),
    enabled: open,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["task-projects"],
    queryFn: () => listProjectsFn(),
    enabled: open,
  });
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [priorityHint, setPriorityHint] = useState<{
    priority: string;
    justification: string;
  } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [tab, setTab] = useState<"detalhes" | "subtarefas" | "comentarios" | "anexos">("detalhes");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toFormState(task, defaultProjectId));
      setSubtasks([]);
      setPriorityHint(null);
      setSummary(null);
      setTab("detalhes");
    }
  }, [open, task, defaultProjectId]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });

  const createMutation = useMutation({
    mutationFn: (input: TaskInput) => createTaskFn({ data: input }),
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(`Não foi possível criar a tarefa: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: (input: TaskInput) => updateTaskFn({ data: { id: task!.id, patch: input } }),
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(`Não foi possível salvar a tarefa: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTaskFn({ data: { id: task!.id } }),
    onSuccess: () => {
      setDeleteConfirmOpen(false);
      invalidate();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      setDeleteConfirmOpen(false);
      toast.error(`Não foi possível excluir a tarefa: ${error.message}`);
    },
  });

  const subtasksMutation = useMutation({
    mutationFn: () =>
      suggestSubtasksFn({ data: { title: form.title, description: form.description } }),
    onSuccess: setSubtasks,
    onError: (error: Error) => toast.error(`Assistente indisponível: ${error.message}`),
  });

  const priorityMutation = useMutation({
    mutationFn: () =>
      suggestPriorityFn({ data: { title: form.title, description: form.description } }),
    onSuccess: setPriorityHint,
    onError: (error: Error) => toast.error(`Assistente indisponível: ${error.message}`),
  });

  const summaryMutation = useMutation({
    mutationFn: () =>
      summarizeTaskFn({ data: { title: form.title, description: form.description } }),
    onSuccess: setSummary,
    onError: (error: Error) => toast.error(`Assistente indisponível: ${error.message}`),
  });

  const isEditing = Boolean(task);
  const canSave = form.title.trim().length > 0;

  const { data: parentTask } = useQuery({
    queryKey: ["task", task?.parentTaskId],
    queryFn: () => getTaskFn({ data: { id: task!.parentTaskId! } }),
    enabled: open && Boolean(task?.parentTaskId),
  });

  const highlightMutation = useMutation({
    mutationFn: (highlighted: boolean) =>
      updateTaskFn({ data: { id: task!.id, patch: { highlighted } } }),
    onSuccess: (_data, highlighted) => {
      setForm((f) => ({ ...f, highlighted }));
      invalidate();
    },
    onError: (error: Error) =>
      toast.error(`Não foi possível atualizar o destaque: ${error.message}`),
  });

  function handleSave() {
    const input = toInput(form);
    if (isEditing) updateMutation.mutate(input);
    else createMutation.mutate(input);
  }

  function handleAccept() {
    setForm((f) => ({ ...f, status: ACCEPTED_STATUS }));
    updateMutation.mutate({ ...toInput(form), status: ACCEPTED_STATUS });
  }

  function handleReject() {
    setForm((f) => ({ ...f, status: REJECTED_STATUS }));
    updateMutation.mutate({ ...toInput(form), status: REJECTED_STATUS });
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const aiDisabled = form.title.trim().length === 0;

  const detailsContent = (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <FieldLabel>Descrição</FieldLabel>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Contexto, critérios de aceite, links..."
          rows={5}
        />
      </div>

      <section className="space-y-3 rounded-lg border border-primary/25 bg-primary/[0.04] p-3">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" /> Assistente
        </h4>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={aiDisabled || subtasksMutation.isPending}
            onClick={() => subtasksMutation.mutate()}
          >
            {subtasksMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Sugerir subtarefas
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={aiDisabled || priorityMutation.isPending}
            onClick={() => priorityMutation.mutate()}
          >
            {priorityMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Sugerir prioridade
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={aiDisabled || summaryMutation.isPending}
            onClick={() => summaryMutation.mutate()}
          >
            {summaryMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Resumir
          </Button>
        </div>

        {subtasks.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-1.5 text-sm"
          >
            {subtasks.map((s) => (
              <li key={s} className="flex gap-2 text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {s}
              </li>
            ))}
          </motion.ul>
        )}

        {priorityHint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="text-sm text-muted-foreground"
          >
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  priority: priorityHint.priority as Task["priority"],
                }))
              }
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {priorityHint.priority}
            </button>{" "}
            — {priorityHint.justification}
          </motion.div>
        )}

        {summary && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="text-sm text-muted-foreground"
          >
            {summary}
          </motion.p>
        )}
      </section>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader className="space-y-3 pb-0">
          <DialogTitle className="sr-only">
            {isEditing && task ? `Tarefa #${task.taskNumber}` : "Nova tarefa"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing
              ? "Atualize os detalhes da tarefa."
              : "Descreva a tarefa e defina os campos iniciais."}
          </DialogDescription>

          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="O que precisa ser feito?"
            autoFocus
            className="h-auto border-none px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
          />

          {parentTask && onNavigateToTask && (
            <button
              type="button"
              onClick={() => onNavigateToTask(parentTask)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar para #{parentTask.taskNumber} —{" "}
              {parentTask.title}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {isEditing && task ? (
              <>
                <span>#{task.taskNumber}</span>
                {task.createdBy ? (
                  <>
                    <span>·</span>
                    <span>Aberto por {displayName(task.createdBy)}</span>
                  </>
                ) : null}
                <button
                  type="button"
                  title={form.highlighted ? "Remover destaque" : "Marcar como urgente"}
                  disabled={highlightMutation.isPending}
                  onClick={() => highlightMutation.mutate(!form.highlighted)}
                  className={cn(
                    "rounded p-0.5 text-muted-foreground/50 hover:text-critical",
                    form.highlighted && "text-critical",
                  )}
                >
                  <Pin className="h-3.5 w-3.5" fill={form.highlighted ? "currentColor" : "none"} />
                </button>
                {form.status === ACCEPT_STATUS ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={updateMutation.isPending}
                      onClick={handleAccept}
                    >
                      Aceitar tarefa
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs text-critical hover:text-critical"
                      disabled={updateMutation.isPending}
                      onClick={handleReject}
                    >
                      Recusar
                    </Button>
                  </>
                ) : null}
              </>
            ) : (
              <span>Nova tarefa</span>
            )}
          </div>

          <div className="flex flex-wrap gap-6 border-t border-border/60 pt-3">
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Responsáveis
              </span>
              <UserMultiSelect
                variant="compact"
                users={users}
                selected={form.assigneeIds}
                onChange={(ids) => setForm((f) => ({ ...f, assigneeIds: ids }))}
              />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </span>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as Task["status"] }))}
              >
                <SelectTrigger className="h-7 w-fit gap-1.5 border-none bg-transparent px-0 text-sm shadow-none focus:ring-0">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[form.status])} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
                        {s}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                User Story
              </span>
              <Select
                value={form.projectId}
                onValueChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
              >
                <SelectTrigger className="h-7 w-fit gap-1.5 border-none bg-transparent px-0 text-sm shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_PROJECT_ID}>Sem User Story</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", projectColorDot(p.color))} />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="grid gap-6 px-4 pb-8 sm:grid-cols-[1fr_260px]">
          <div className="min-w-0">
            {isEditing && task ? (
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList>
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="subtarefas">
                    Subtarefas
                    {task.subtaskTotal > 0 ? ` (${task.subtaskDone}/${task.subtaskTotal})` : ""}
                  </TabsTrigger>
                  <TabsTrigger value="comentarios">Comentários</TabsTrigger>
                  <TabsTrigger value="anexos">Anexos</TabsTrigger>
                </TabsList>
                <TabsContent value="detalhes" className="pt-4">
                  {detailsContent}
                </TabsContent>
                <TabsContent value="subtarefas" className="pt-4">
                  <SubtasksTab
                    parentTask={task}
                    onNavigateToTask={(t) => {
                      onNavigateToTask?.(t);
                      setTab("detalhes");
                    }}
                  />
                </TabsContent>
                <TabsContent value="comentarios" className="pt-4">
                  <TaskComments taskId={task.id} />
                </TabsContent>
                <TabsContent value="anexos" className="pt-4">
                  <TaskAttachments taskId={task.id} />
                </TabsContent>
              </Tabs>
            ) : (
              detailsContent
            )}
          </div>

          <div className="space-y-4 rounded-lg bg-muted/30 p-3 sm:border-l sm:border-border/60 sm:bg-transparent sm:p-0 sm:pl-5">
            <div className="space-y-1.5">
              <FieldLabel>Prioridade</FieldLabel>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Task["priority"] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel>Story Points</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.storyPoints}
                  onChange={(e) => setForm((f) => ({ ...f, storyPoints: e.target.value }))}
                  placeholder="—"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Horas est.</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.estimatedHours}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))}
                  placeholder="—"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Prazo</FieldLabel>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Tags</FieldLabel>
              <Input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="automação, sdr, bug"
              />
            </div>
          </div>

          <div className="col-span-full flex items-center justify-between border-t border-border/60 pt-4">
            {isEditing ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-critical hover:text-critical"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            ) : (
              <span />
            )}
            <Button size="sm" disabled={!canSave || saving} onClick={handleSave}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEditing ? "Salvar" : "Criar tarefa"}
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir a tarefa {task ? `#${task.taskNumber} — ${task.title}` : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso arquiva a tarefa inteira (junto com todos os comentários e anexos) — ela some das
              listas e do board. Não é uma exclusão de comentário: pra excluir só um comentário,
              abra a aba "Comentários" e use o excluir ao lado dele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-critical text-critical-foreground hover:bg-critical/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Excluir tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
