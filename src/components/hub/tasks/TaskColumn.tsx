import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence } from "motion/react";

import { cn } from "@/lib/utils";
import { TaskCard } from "@/components/hub/tasks/TaskCard";
import type { Task, TaskStatus } from "@/types/tasks";

export const STATUS_DOT: Record<TaskStatus, string> = {
  "Aguardando aceite": "bg-primary",
  Backlog: "bg-muted-foreground",
  "Em andamento": "bg-info",
  Bloqueado: "bg-critical",
  "Em revisão": "bg-warning",
  Concluído: "bg-success",
};

export function TaskColumn({
  status,
  tasks,
  onOpenTask,
}: {
  status: TaskStatus;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-border px-1 pb-2">
        <h3 className="text-sm font-semibold text-foreground">{status}</h3>
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
          {tasks.length}
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
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onOpen={onOpenTask} />
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </div>
  );
}
