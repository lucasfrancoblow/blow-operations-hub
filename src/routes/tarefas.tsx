import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
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
import { displayName } from "@/lib/display-name";
import { TaskBoard } from "@/components/hub/tasks/TaskBoard";
import { TaskMobileList } from "@/components/hub/tasks/TaskMobileList";
import { TaskDetailSheet } from "@/components/hub/tasks/TaskDetailSheet";
import { TaskCommandPalette } from "@/components/hub/tasks/TaskCommandPalette";
import { ProjectSwitcher, UNASSIGNED_PROJECT_ID } from "@/components/hub/tasks/ProjectSwitcher";
import { canAccessPage } from "@/lib/page-access";
import { listActiveUsersFn } from "@/services/auth-service";
import { getTasks, listProjectsFn, reorderTasksFn, updateTaskFn } from "@/services/tasks-service";
import { TASK_PRIORITIES, type Task, type TaskStatus } from "@/types/tasks";

export const Route = createFileRoute("/tarefas")({
  beforeLoad: ({ context }) => {
    if (!canAccessPage(context.user, "tarefas")) {
      throw redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    project: typeof search["project"] === "string" ? (search["project"] as string) : undefined,
  }),
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
  const { user } = Route.useRouteContext();
  const canManageAccess = user?.role === "super_admin";
  const { project: projectParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/tarefas" });
  const selectedProject = projectParam ?? UNASSIGNED_PROJECT_ID;

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => getTasks(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["task-projects"],
    queryFn: () => listProjectsFn(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["assignable-users"],
    queryFn: () => listActiveUsersFn(),
  });

  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("todos");
  const [priority, setPriority] = useState("todas");
  const [selected, setSelected] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>("Backlog");

  const scopedTasks = useMemo(
    () =>
      tasks.filter((t) =>
        selectedProject === UNASSIGNED_PROJECT_ID ? !t.projectId : t.projectId === selectedProject,
      ),
    [tasks, selectedProject],
  );

  const filtered = useMemo(
    () =>
      scopedTasks.filter((t) => {
        if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
        if (assignee !== "todos" && t.assigneeId !== assignee) return false;
        if (priority !== "todas" && t.priority !== priority) return false;
        return true;
      }),
    [scopedTasks, search, assignee, priority],
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

  function selectProject(id: string) {
    void navigate({ to: ".", search: { project: id } });
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

      <ProjectSwitcher
        projects={projects}
        selected={selectedProject}
        onSelect={selectProject}
        canManageAccess={canManageAccess}
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
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {displayName(u)}
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

      <TaskDetailSheet
        task={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        defaultProjectId={selectedProject === UNASSIGNED_PROJECT_ID ? null : selectedProject}
      />

      <TaskCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        tasks={scopedTasks}
        onCreate={openCreate}
        onSelect={openTask}
      />
    </div>
  );
}
