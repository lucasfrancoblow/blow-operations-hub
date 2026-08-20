import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ListTodo, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/hub/primitives";
import { TaskBoard } from "@/components/hub/tasks/TaskBoard";
import { TaskMobileList } from "@/components/hub/tasks/TaskMobileList";
import { TaskDetailSheet } from "@/components/hub/tasks/TaskDetailSheet";
import { TaskCommandPalette } from "@/components/hub/tasks/TaskCommandPalette";
import { getTasks, reorderTasksFn, updateTaskFn } from "@/services/tasks-service";
import { TASK_PRIORITIES, type Task, type TaskStatus } from "@/types/tasks";

export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — hubLOw BLOW" },
      {
        name: "description",
        content: "Backlog e board de tarefas do time de operações BLOW.",
      },
    ],
  }),
  component: TarefasPage,
});

function TarefasPage() {
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => getTasks(),
  });

  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("todos");
  const [priority, setPriority] = useState("todas");
  const [selected, setSelected] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>("Backlog");

  const assignees = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean))),
    [tasks],
  );

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
        if (assignee !== "todos" && t.assignee !== assignee) return false;
        if (priority !== "todas" && t.priority !== priority) return false;
        return true;
      }),
    [tasks, search, assignee, priority],
  );

  const reorderMutation = useMutation({
    mutationFn: (updates: Array<{ id: string; status: TaskStatus; position: number }>) =>
      reorderTasksFn({ data: { updates } }),
    onError: (error: Error) => toast.error(`Não foi possível mover a tarefa: ${error.message}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      updateTaskFn({ data: { id, patch: { status } } }),
    onError: (error: Error) => toast.error(`Não foi possível mover a tarefa: ${error.message}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  function openTask(task: Task) {
    setSelected(task);
    setDetailOpen(true);
  }

  function openCreate() {
    setSelected(null);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarefas"
        subtitle="Backlog interno do time — atalho Cmd+K pra criar ou buscar rápido"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nova tarefa
          </Button>
        }
      />

      <div className="grid gap-3 rounded-xl border border-border/60 bg-card/60 p-3 sm:grid-cols-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título"
        />
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as prioridades</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-5 w-5" />}
          title="Nenhuma tarefa encontrada"
          description="Ajuste os filtros ou crie a primeira tarefa."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova tarefa
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <TaskBoard
              tasks={filtered}
              onOpenTask={openTask}
              onReorder={(updates) => reorderMutation.mutate(updates)}
            />
          </div>
          <div className="md:hidden">
            <TaskMobileList
              tasks={filtered}
              status={mobileStatus}
              onStatusChange={setMobileStatus}
              onOpenTask={openTask}
              onMoveTask={(task, status) => moveMutation.mutate({ id: task.id, status })}
            />
          </div>
        </>
      )}

      <TaskDetailSheet task={selected} open={detailOpen} onOpenChange={setDetailOpen} />

      <TaskCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        tasks={tasks}
        onCreate={openCreate}
        onSelect={openTask}
      />
    </div>
  );
}
