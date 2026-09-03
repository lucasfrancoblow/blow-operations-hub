import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { displayName } from "@/lib/display-name";
import { TaskCard } from "@/components/hub/tasks/TaskCard";
import { TASK_PRIORITIES, type Task, type TaskStatus } from "@/types/tasks";

export const STATUS_DOT: Record<TaskStatus, string> = {
  "Aguardando aceite": "bg-primary",
  Backlog: "bg-muted-foreground",
  "Em andamento": "bg-info",
  Bloqueado: "bg-critical",
  "Em revisão": "bg-warning",
  Concluído: "bg-success",
  Recusada: "bg-critical",
};

export type TaskGroupBy = "none" | "priority" | "assignee";

/** Agrupamento é só uma re-apresentação visual da mesma lista ordenada por
 * "position" — não cria drop-zones novas pro dnd-kit, o board pequeno do
 * time não precisa de uma grade de swimlanes de verdade. */
function groupTasks(tasks: Task[], groupBy: TaskGroupBy): Array<{ label: string; tasks: Task[] }> {
  if (groupBy === "none") return [{ label: "", tasks }];

  if (groupBy === "priority") {
    const order = [...TASK_PRIORITIES].reverse();
    return order
      .map((priority) => ({ label: priority, tasks: tasks.filter((t) => t.priority === priority) }))
      .filter((g) => g.tasks.length > 0);
  }

  const groups = new Map<string, { label: string; tasks: Task[] }>();
  for (const task of tasks) {
    const key =
      task.assignees.length === 0
        ? "__none__"
        : task.assignees.length > 1
          ? "__many__"
          : task.assignees[0]!.id;
    const label =
      task.assignees.length === 0
        ? "Sem responsável"
        : task.assignees.length > 1
          ? "Vários responsáveis"
          : displayName(task.assignees[0]!);
    const group = groups.get(key) ?? { label, tasks: [] };
    group.tasks.push(task);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

export function TaskColumn({
  status,
  tasks,
  onOpenTask,
  onQuickCreate,
  onToggleHighlight,
  wipLimit,
  agingThresholdDays,
  groupBy = "none",
}: {
  status: TaskStatus;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  /** Só a primeira coluna recebe isso — ver comentário em TaskBoard.tsx. */
  onQuickCreate?: ((title: string) => void) | undefined;
  onToggleHighlight?: ((task: Task) => void) | undefined;
  wipLimit?: number | null | undefined;
  agingThresholdDays?: number | null | undefined;
  groupBy?: TaskGroupBy | undefined;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [adding, setAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");

  function submitQuickCreate() {
    const title = quickTitle.trim();
    if (!title) {
      setAdding(false);
      return;
    }
    onQuickCreate?.(title);
    setQuickTitle("");
  }

  const overLimit = Boolean(wipLimit) && tasks.length > wipLimit!;
  const groups = groupTasks(tasks, groupBy);

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-border px-1 pb-2">
        <h3 className="text-sm font-semibold text-foreground">{status}</h3>
        <span
          title={overLimit ? `Limite de WIP: ${wipLimit}` : undefined}
          className={cn(
            "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
            overLimit ? "bg-critical/15 text-critical" : "bg-muted text-muted-foreground",
          )}
        >
          {tasks.length}
          {wipLimit ? `/${wipLimit}` : ""}
        </span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-[120px] flex-1 flex-col gap-2 rounded-md bg-muted/30 p-2 transition-colors",
            isOver && "bg-primary/[0.06]",
          )}
        >
          {groups.map((group) => (
            <div key={group.label || "__all__"} className="flex flex-col gap-2">
              {group.label && (
                <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </span>
              )}
              <AnimatePresence initial={false}>
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={onOpenTask}
                    onToggleHighlight={onToggleHighlight}
                    agingThresholdDays={agingThresholdDays}
                  />
                ))}
              </AnimatePresence>
            </div>
          ))}

          {onQuickCreate ? (
            adding ? (
              <Input
                autoFocus
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitQuickCreate();
                  if (e.key === "Escape") {
                    setQuickTitle("");
                    setAdding(false);
                  }
                }}
                onBlur={() => {
                  submitQuickCreate();
                  setAdding(false);
                }}
                placeholder="Título da tarefa"
                className="h-8 bg-card text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-primary hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" /> Nova tarefa
              </button>
            )
          ) : null}
        </div>
      </SortableContext>
    </div>
  );
}
