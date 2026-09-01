import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { CalendarClock, Link2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";
import { TaskPriorityBadge } from "@/components/hub/badges";
import type { Task, TaskPriority } from "@/types/tasks";

const PRIORITY_BORDER: Record<TaskPriority, string> = {
  Crítica: "border-l-critical",
  Alta: "border-l-primary",
  Média: "border-l-warning",
  Baixa: "border-l-info",
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
        "cursor-grab space-y-2 rounded-lg border border-l-4 border-border/60 bg-card/90 p-3 text-left shadow-sm transition-colors active:cursor-grabbing",
        PRIORITY_BORDER[task.priority],
        "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5",
        dragOverlay && "rotate-2 border-primary/50 shadow-lg shadow-primary/20",
      )}
    >
      <p className="text-sm font-medium leading-snug text-foreground">
        <span className="text-muted-foreground">#{task.taskNumber}</span> {task.title}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <TaskPriorityBadge value={task.priority} />
        {task.storyPoints !== null && (
          <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {task.storyPoints} pts
          </span>
        )}
        {task.estimatedHours !== null && (
          <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {formatHours(task.estimatedHours)}
          </span>
        )}
      </div>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {(task.assignee || task.dueDate || task.reference) && (
        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2.5">
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
          </div>
          {task.assignee && (
            <span
              title={displayName(task.assignee)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
            >
              {displayName(task.assignee).charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
