import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ListTodo, Save, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, PageHeader } from "@/components/hub/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskBoard } from "@/components/hub/tasks/TaskBoard";
import { TaskMobileList } from "@/components/hub/tasks/TaskMobileList";
import { TaskBacklogList } from "@/components/hub/tasks/TaskBacklogList";
import { TaskDetailSheet } from "@/components/hub/tasks/TaskDetailSheet";
import { TaskCommandPalette } from "@/components/hub/tasks/TaskCommandPalette";
import { UserMultiSelect } from "@/components/hub/tasks/UserMultiSelect";
import { ProjectSwitcher, UNASSIGNED_PROJECT_ID } from "@/components/hub/tasks/ProjectSwitcher";
import { canAccessPage } from "@/lib/page-access";
import { listActiveUsersFn } from "@/services/auth-service";
import {
  createSavedViewFn,
  createTaskFn,
  deleteSavedViewFn,
  getBoardSettingsFn,
  getTasks,
  listProjectsFn,
  listSavedViewsFn,
  reorderBacklogFn,
  reorderTasksFn,
  updateBoardSettingsFn,
  updateTaskFn,
} from "@/services/tasks-service";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskSavedViewFilters,
  type TaskStatus,
} from "@/types/tasks";
import type { TaskGroupBy } from "@/components/hub/tasks/TaskColumn";

const GROUP_BY_LABEL: Record<TaskGroupBy, string> = {
  none: "Nenhum",
  priority: "Prioridade",
  assignee: "Responsável",
};

export const Route = createFileRoute("/tarefas")({
  beforeLoad: ({ context }) => {
    if (!canAccessPage(context.user, "tarefas")) {
      throw redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    project: typeof search["project"] === "string" ? (search["project"] as string) : undefined,
    view: search["view"] === "backlog" ? ("backlog" as const) : undefined,
    task: typeof search["task"] === "string" ? (search["task"] as string) : undefined,
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
  const { project: projectParam, view: viewParam, task: taskParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/tarefas" });
  const selectedProject = projectParam ?? UNASSIGNED_PROJECT_ID;
  const view = viewParam ?? "board";

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

  const { data: boardSettings = [] } = useQuery({
    queryKey: ["task-board-settings"],
    queryFn: () => getBoardSettingsFn(),
  });

  const { data: savedViews = [] } = useQuery({
    queryKey: ["task-saved-views"],
    queryFn: () => listSavedViewsFn(),
  });

  const [search, setSearch] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [priority, setPriority] = useState("todas");
  const [highlightedOnly, setHighlightedOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<TaskGroupBy>("none");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>("Backlog");
  const [autoOpenedFor, setAutoOpenedFor] = useState<string | null>(null);

  // Deep-link do e-mail (/tarefas?task=13) — abre a tarefa certa assim que a
  // lista carrega. Guardado por autoOpenedFor pra não reabrir sozinho se o
  // usuário fechar o modal e a lista der refetch depois (ex.: outra edição).
  useEffect(() => {
    if (!taskParam || taskParam === autoOpenedFor) return;
    const found = tasks.find((t) => String(t.taskNumber) === taskParam);
    if (found) {
      setSelected(found);
      setDetailOpen(true);
      setAutoOpenedFor(taskParam);
    }
  }, [taskParam, tasks, autoOpenedFor]);

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
        if (assigneeIds.length > 0 && !t.assigneeIds.some((id) => assigneeIds.includes(id)))
          return false;
        if (priority !== "todas" && t.priority !== priority) return false;
        if (highlightedOnly && !t.highlighted) return false;
        return true;
      }),
    [scopedTasks, search, assigneeIds, priority, highlightedOnly],
  );

  function applyFilters(filters: TaskSavedViewFilters) {
    setSearch(filters.search ?? "");
    setAssigneeIds(filters.assigneeIds ?? []);
    setPriority(filters.priority ?? "todas");
    setHighlightedOnly(filters.highlightedOnly ?? false);
    setGroupBy(filters.groupBy ?? "none");
  }

  const saveViewMutation = useMutation({
    mutationFn: (name: string) =>
      createSavedViewFn({
        data: { name, filters: { search, assigneeIds, priority, highlightedOnly, groupBy } },
      }),
    onError: (error: Error) => toast.error(`Não foi possível salvar a view: ${error.message}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["task-saved-views"] }),
  });

  const deleteViewMutation = useMutation({
    mutationFn: (id: string) => deleteSavedViewFn({ data: { id } }),
    onError: (error: Error) => toast.error(`Não foi possível excluir a view: ${error.message}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["task-saved-views"] }),
  });

  const boardSettingsMutation = useMutation({
    mutationFn: (input: {
      status: TaskStatus;
      patch: { wipLimit?: number | null; agingThresholdDays?: number | null };
    }) => updateBoardSettingsFn({ data: input }),
    onError: (error: Error) => toast.error(`Não foi possível salvar: ${error.message}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["task-board-settings"] }),
  });

  const highlightMutation = useMutation({
    mutationFn: ({ id, highlighted }: { id: string; highlighted: boolean }) =>
      updateTaskFn({ data: { id, patch: { highlighted } } }),
    onError: (error: Error) =>
      toast.error(`Não foi possível atualizar o destaque: ${error.message}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: (updates: Array<{ id: string; status: TaskStatus; position: number }>) =>
      reorderTasksFn({ data: { updates } }),
    onError: (error: Error) => toast.error(`Não foi possível mover a tarefa: ${error.message}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const reorderBacklogMutation = useMutation({
    mutationFn: (updates: Array<{ id: string; backlogPosition: number }>) =>
      reorderBacklogFn({ data: { updates } }),
    onError: (error: Error) => toast.error(`Não foi possível reordenar: ${error.message}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const quickCreateMutation = useMutation({
    mutationFn: (title: string) =>
      createTaskFn({
        data: {
          title,
          status: TASK_STATUSES[0],
          projectId: selectedProject === UNASSIGNED_PROJECT_ID ? null : selectedProject,
        },
      }),
    onError: (error: Error) => toast.error(`Não foi possível criar a tarefa: ${error.message}`),
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
    void navigate({ to: ".", search: { project: id, view: viewParam, task: taskParam } });
  }

  function selectView(next: "board" | "backlog") {
    void navigate({
      to: ".",
      search: {
        project: projectParam,
        view: next === "backlog" ? "backlog" : undefined,
        task: taskParam,
      },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarefas"
        subtitle="Backlog interno do time — atalho Cmd+K pra criar ou buscar rápido"
      />

      <ProjectSwitcher
        projects={projects}
        selected={selectedProject}
        onSelect={selectProject}
        canManageAccess={canManageAccess}
      />

      <Tabs value={view} onValueChange={(v) => selectView(v as "board" | "backlog")}>
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="backlog">Backlogs</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título"
          />
          <UserMultiSelect
            users={users}
            selected={assigneeIds}
            onChange={setAssigneeIds}
            placeholder="Todos os responsáveis"
          />
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

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={highlightedOnly} onCheckedChange={setHighlightedOnly} />
            Só urgentes
          </label>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Agrupar por</span>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as TaskGroupBy)}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GROUP_BY_LABEL) as TaskGroupBy[]).map((g) => (
                  <SelectItem key={g} value={g}>
                    {GROUP_BY_LABEL[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Views
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {savedViews.length === 0 && (
                <DropdownMenuItem disabled>Nenhuma view salva ainda</DropdownMenuItem>
              )}
              {savedViews.map((v) => (
                <DropdownMenuItem
                  key={v.id}
                  onSelect={() => applyFilters(v.filters)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{v.name}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteViewMutation.mutate(v.id);
                    }}
                    className="text-muted-foreground hover:text-critical"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  const name = window.prompt("Nome da view:");
                  if (name?.trim()) saveViewMutation.mutate(name.trim());
                }}
              >
                <Save className="h-3.5 w-3.5" /> Salvar filtro atual
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            title="Configurar colunas"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isLoading && filtered.length === 0 && view === "backlog" ? (
        <EmptyState
          icon={<ListTodo className="h-5 w-5" />}
          title="Nenhuma tarefa encontrada"
          description="Ajuste os filtros ou crie a primeira tarefa na visão Board."
        />
      ) : view === "backlog" ? (
        <TaskBacklogList
          tasks={filtered}
          onOpenTask={openTask}
          onReorder={(updates) => reorderBacklogMutation.mutate(updates)}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <TaskBoard
              tasks={filtered}
              onOpenTask={openTask}
              onReorder={(updates) => reorderMutation.mutate(updates)}
              onQuickCreate={(title) => quickCreateMutation.mutate(title)}
              onToggleHighlight={(task) =>
                highlightMutation.mutate({ id: task.id, highlighted: !task.highlighted })
              }
              settings={boardSettings}
              groupBy={groupBy}
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
        onNavigateToTask={openTask}
      />

      <TaskCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        tasks={scopedTasks}
        onCreate={openCreate}
        onSelect={openTask}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limite de WIP e aviso de "parada"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Status</span>
              <span>Limite de WIP</span>
              <span>Envelhece em (dias)</span>
            </div>
            {boardSettings.map((s) => (
              <div key={s.status} className="grid grid-cols-3 items-center gap-2 text-sm">
                <span className="truncate">{s.status}</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="Sem limite"
                  defaultValue={s.wipLimit ?? ""}
                  onBlur={(e) =>
                    boardSettingsMutation.mutate({
                      status: s.status,
                      patch: { wipLimit: e.target.value ? Number(e.target.value) : null },
                    })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Dias p/ envelhecer"
                  defaultValue={s.agingThresholdDays ?? ""}
                  onBlur={(e) =>
                    boardSettingsMutation.mutate({
                      status: s.status,
                      patch: {
                        agingThresholdDays: e.target.value ? Number(e.target.value) : null,
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
