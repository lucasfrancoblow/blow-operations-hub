import { useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/hub/badges";
import { EmptyState } from "@/components/hub/primitives";
import type { Task } from "@/types/tasks";

// Ordem própria do Backlogs — não é a mesma coisa que "position" do Board
// (que é reiniciado por coluna/status, então misturar tudo por ela dava uma
// ordem sem sentido). Itens já ranqueados manualmente (backlogPosition
// definido) vêm primeiro, na ordem em que foram ranqueados; o resto cai por
// ordem de criação (task_number), que é a ordem padrão até alguém arrastar.
function sortForBacklog(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aRanked = a.backlogPosition !== null;
    const bRanked = b.backlogPosition !== null;
    if (aRanked && bRanked) return a.backlogPosition! - b.backlogPosition!;
    if (aRanked !== bRanked) return aRanked ? -1 : 1;
    return a.taskNumber - b.taskNumber;
  });
}

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function BacklogRow({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 border-b border-border/60 bg-card/60 px-3 py-2.5 text-sm last:border-b-0",
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 truncate text-left font-medium hover:text-primary"
      >
        <span className="mr-1.5 text-muted-foreground">#{task.taskNumber}</span>
        {task.title}
      </button>

      <div className="hidden w-36 shrink-0 sm:block">
        <TaskStatusBadge value={task.status} />
      </div>

      <div className="hidden w-24 shrink-0 md:block">
        <TaskPriorityBadge value={task.priority} />
      </div>

      <div className="hidden w-16 shrink-0 text-center text-xs text-muted-foreground lg:block">
        {task.storyPoints !== null ? `${task.storyPoints} pts` : "—"}
      </div>

      <div className="hidden w-16 shrink-0 text-center text-xs text-muted-foreground lg:block">
        {task.estimatedHours !== null ? formatHours(task.estimatedHours) : "—"}
      </div>

      <div className="hidden w-20 shrink-0 text-xs text-muted-foreground xl:flex xl:items-center xl:gap-1">
        {task.dueDate ? (
          <>
            <CalendarClock className="h-3 w-3" /> {formatDueDate(task.dueDate)}
          </>
        ) : (
          "—"
        )}
      </div>

      <div className="w-6 shrink-0">
        {task.assignee ? (
          <span
            title={displayName(task.assignee)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
          >
            {displayName(task.assignee).charAt(0).toUpperCase()}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function TaskBacklogList({
  tasks,
  onOpenTask,
  onReorder,
}: {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onReorder: (updates: Array<{ id: string; backlogPosition: number }>) => void;
}) {
  const [ordered, setOrdered] = useState<Task[]>(() => sortForBacklog(tasks));

  useEffect(() => {
    setOrdered(sortForBacklog(tasks));
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrdered((items) => {
      const oldIndex = items.findIndex((t) => t.id === active.id);
      const newIndex = items.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;

      const next = arrayMove(items, oldIndex, newIndex);
      onReorder(next.map((task, index) => ({ id: task.id, backlogPosition: index })));
      return next;
    });
  }

  if (ordered.length === 0) {
    return (
      <EmptyState
        icon={<GripVertical className="h-5 w-5" />}
        title="Nenhuma tarefa encontrada"
        description="Ajuste os filtros ou crie a primeira tarefa."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <div className="hidden items-center gap-3 border-b border-border/60 bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:flex">
        <span className="w-4" />
        <span className="min-w-0 flex-1">Título</span>
        <span className="hidden w-36 shrink-0 sm:block">Estado</span>
        <span className="hidden w-24 shrink-0 md:block">Prioridade</span>
        <span className="hidden w-16 shrink-0 text-center lg:block">Pts</span>
        <span className="hidden w-16 shrink-0 text-center lg:block">Horas</span>
        <span className="hidden w-20 shrink-0 xl:block">Prazo</span>
        <span className="w-6 shrink-0" />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ordered.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {ordered.map((task) => (
            <BacklogRow key={task.id} task={task} onOpen={onOpenTask} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
