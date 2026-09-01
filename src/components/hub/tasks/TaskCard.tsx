import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { CalendarClock, Link2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";
import type { Task, TaskPriority } from "@/types/tasks";

// Ícone de tipo do work item no Azure é um quadrado colorido antes do título —
// como este app não tem "tipos" (Bug/Task/User Story), usamos a cor da
// prioridade nesse mesmo lugar, mantendo o mesmo papel visual.
const PRIORITY_ICON: Record<TaskPriority, string> = {
  Crítica: "bg-critical",
  Alta: "bg-primary",
  Média: "bg-warning",
  Baixa: "bg-info",
};

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export function TaskCard({
  task,
  onOpen,
  dragOverlay = false,
}: {
  task: Task;
  onOpen?: (task: Task) => void;
  dragOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
  });

  const style = dragOverlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  return (
    <motion.div
      ref={dragOverlay ? undefined : setNodeRef}
      style={style}
      {...(dragOverlay ? {} : attributes)}
      {...(dragOverlay ? {} : listeners)}
      layout={!dragOverlay}
      initial={dragOverlay ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      onClick={() => !dragOverlay && onOpen?.(task)}
      className={cn(
        "cursor-grab space-y-1.5 rounded-md border border-border bg-card p-2.5 text-left shadow-sm transition-colors active:cursor-grabbing",
        "hover:border-primary/50 hover:shadow-md",
        dragOverlay && "rotate-2 border-primary/50 shadow-lg shadow-primary/20",
      )}
    >
      <div className="flex items-start gap-1.5">
        <span
          className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-sm", PRIORITY_ICON[task.priority])}
          title={task.priority}
        />
        <p className="min-w-0 text-sm leading-snug text-foreground">
          <span className="text-muted-foreground">#{task.taskNumber}</span> {task.title}
        </p>
      </div>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pl-4">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end justify-between gap-2 pl-4 pt-0.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {task.dueDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> {formatDueDate(task.dueDate)}
            </span>
          )}
          {task.reference && (
            <span className="inline-flex items-center gap-1">
              <Link2 className="h-3 w-3" /> {task.reference.label}
            </span>
          )}
          {task.estimatedHours !== null && (
            <span className="inline-flex items-center gap-1">
              {formatHours(task.estimatedHours)}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {task.assignee && (
            <span
              title={displayName(task.assignee)}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
            >
              {displayName(task.assignee).charAt(0).toUpperCase()}
            </span>
          )}
          {task.storyPoints !== null && (
            <span
              title="Story points"
              className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold text-foreground"
            >
              {task.storyPoints}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
