import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { createTaskFn, deleteTaskFn, listProjectsFn, updateTaskFn } from "@/services/tasks-service";
import { suggestPriorityFn, suggestSubtasksFn, summarizeTaskFn } from "@/services/tasks-ai-service";
import { TaskAttachments } from "@/components/hub/tasks/TaskAttachments";
import { TaskComments } from "@/components/hub/tasks/TaskComments";
import { STATUS_DOT } from "@/components/hub/tasks/TaskColumn";
import { UNASSIGNED_PROJECT_ID, projectColorDot } from "@/components/hub/tasks/ProjectSwitcher";
import { TASK_PRIORITIES, TASK_STATUSES, type Task, type TaskInput } from "@/types/tasks";

const UNASSIGNED_USER_ID = "none";
const ACCEPT_STATUS: Task["status"] = "Aguardando aceite";
const ACCEPTED_STATUS: Task["status"] = "Backlog";

type FormState = {
  title: string;
  description: string;
  status: Task["status"];
  priority: Task["priority"];
  projectId: string;
  assigneeId: string;
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
    assigneeId: task?.assigneeId ?? UNASSIGNED_USER_ID,
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
    assigneeId: form.assigneeId === UNASSIGNED_USER_ID ? null : form.assigneeId,
    tags: form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    storyPoints: form.storyPoints.trim() ? Number(form.storyPoints) : null,
    estimatedHours: form.estimatedHours.trim() ? Number(form.estimatedHours) : null,
    dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
  };
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
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string | null;
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
  const [tab, setTab] = useState<"detalhes" | "comentarios" | "anexos">("detalhes");

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
      invalidate();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(`Não foi possível excluir a tarefa: ${error.message}`),
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
  const assignedUser = users.find((u) => u.id === form.assigneeId) ?? null;

  function handleSave() {
    const input = toInput(form);
    if (isEditing) updateMutation.mutate(input);
    else createMutation.mutate(input);
  }

  function handleAccept() {
    setForm((f) => ({ ...f, status: ACCEPTED_STATUS }));
    updateMutation.mutate({ ...toInput(form), status: ACCEPTED_STATUS });
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
                {form.status === ACCEPT_STATUS ? (
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
                ) : null}
              </>
            ) : (
              <span>Nova tarefa</span>
            )}
          </div>

          <div className="flex flex-wrap gap-6 border-t border-border/60 pt-3">
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Responsável
              </span>
              <Select
                value={form.assigneeId}
                onValueChange={(v) => setForm((f) => ({ ...f, assigneeId: v }))}
              >
                <SelectTrigger className="h-7 w-fit gap-1.5 border-none bg-transparent px-0 text-sm shadow-none focus:ring-0">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {assignedUser ? displayName(assignedUser).charAt(0).toUpperCase() : "?"}
                  </span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_USER_ID}>Ninguém</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {displayName(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <TabsTrigger value="comentarios">Comentários</TabsTrigger>
                  <TabsTrigger value="anexos">Anexos</TabsTrigger>
                </TabsList>
                <TabsContent value="detalhes" className="pt-4">
                  {detailsContent}
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
                onClick={() => deleteMutation.mutate()}
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
    </Dialog>
  );
}
