import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { CalendarClock, Clock, Link2, MessageSquare, Paperclip, Pin } from "lucide-react";

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

const MAX_AVATARS = 3;

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === "Concluído" || task.status === "Recusada") return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

function daysAging(task: Task, agingThresholdDays: number | null | undefined): number | null {
  if (!agingThresholdDays) return null;
  const days = Math.floor((Date.now() - new Date(task.statusChangedAt).getTime()) / 86_400_000);
  return days >= agingThresholdDays ? days : null;
}

export function TaskCard({
  task,
  onOpen,
  onToggleHighlight,
  agingThresholdDays,
  dragOverlay = false,
}: {
  task: Task;
  onOpen?: (task: Task) => void;
  onToggleHighlight?: ((task: Task) => void) | undefined;
  agingThresholdDays?: number | null | undefined;
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

  const overdue = isOverdue(task);
  const agingDays = daysAging(task, agingThresholdDays);
  const visibleAssignees = task.assignees.slice(0, MAX_AVATARS);
  const extraAssignees = task.assignees.length - visibleAssignees.length;

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
        task.highlighted && "border-l-2 border-l-critical",
        dragOverlay && "rotate-2 border-primary/50 shadow-lg shadow-primary/20",
      )}
    >
      <div className="flex items-start gap-1.5">
        <span
          className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-sm", PRIORITY_ICON[task.priority])}
          title={task.priority}
        />
        <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">
          <span className="text-muted-foreground">#{task.taskNumber}</span> {task.title}
        </p>
        {onToggleHighlight && (
          <button
            type="button"
            title={task.highlighted ? "Remover destaque" : "Marcar como urgente"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHighlight(task);
            }}
            className={cn(
              "shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-critical",
              task.highlighted && "text-critical",
            )}
          >
            <Pin className="h-3.5 w-3.5" fill={task.highlighted ? "currentColor" : "none"} />
          </button>
        )}
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

      <div className="flex flex-wrap items-center gap-2 pl-4 text-[11px] text-muted-foreground">
        {task.dueDate && (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              overdue && "font-semibold text-critical",
            )}
          >
            <CalendarClock className="h-3 w-3" /> {formatDueDate(task.dueDate)}
          </span>
        )}
        {agingDays !== null && (
          <span
            title={`Parada nessa coluna há ${agingDays} dia(s)`}
            className="inline-flex items-center gap-1 text-warning"
          >
            <Clock className="h-3 w-3" /> {agingDays}d
          </span>
        )}
        {task.subtaskTotal > 0 && (
          <span title="Subtarefas concluídas">
            {task.subtaskDone}/{task.subtaskTotal}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1" title="Comentários">
            <MessageSquare className="h-3 w-3" /> {task.commentCount}
          </span>
        )}
        {task.attachmentCount > 0 && (
          <span className="inline-flex items-center gap-1" title="Anexos">
            <Paperclip className="h-3 w-3" /> {task.attachmentCount}
          </span>
        )}
        {task.estimatedHours !== null && <span>{formatHours(task.estimatedHours)}</span>}
      </div>

      <div className="flex items-end justify-between gap-2 pl-4 pt-0.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {task.reference && (
            <span className="inline-flex items-center gap-1">
              <Link2 className="h-3 w-3" /> {task.reference.label}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center">
          <div className="flex -space-x-1.5">
            {visibleAssignees.map((assignee) => (
              <span
                key={assignee.id}
                title={displayName(assignee)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-card bg-primary/15 text-[10px] font-semibold text-primary"
              >
                {displayName(assignee).charAt(0).toUpperCase()}
              </span>
            ))}
            {extraAssignees > 0 && (
              <span
                title={`+${extraAssignees} responsável(is)`}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-card bg-muted text-[9px] font-semibold text-muted-foreground"
              >
                +{extraAssignees}
              </span>
            )}
          </div>
          {task.storyPoints !== null && (
            <span
              title="Story points"
              className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold text-foreground"
            >
              {task.storyPoints}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
