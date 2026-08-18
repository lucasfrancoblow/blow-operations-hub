import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { CalendarClock, Link2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { TaskPriorityBadge } from "@/components/hub/badges";
import type { Task } from "@/types/tasks";

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
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
        "cursor-grab space-y-2 rounded-lg border border-border/70 bg-card/90 p-3 text-left shadow-sm transition-colors active:cursor-grabbing",
        "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5",
        dragOverlay && "rotate-2 border-primary/50 shadow-lg shadow-primary/20",
      )}
    >
      <p className="text-sm font-medium leading-snug text-foreground">{task.title}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <TaskPriorityBadge value={task.priority} />
        {task.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>

      {(task.assignee || task.dueDate || task.reference) && (
        <div className="flex flex-wrap items-center gap-2.5 pt-1 text-[11px] text-muted-foreground">
          {task.assignee && (
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                {task.assignee.charAt(0).toUpperCase()}
              </span>
              {task.assignee}
            </span>
          )}
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
      )}
    </motion.div>
  );
}
