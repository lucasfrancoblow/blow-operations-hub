import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { TaskCard } from "@/components/hub/tasks/TaskCard";
import { TaskColumn } from "@/components/hub/tasks/TaskColumn";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/types/tasks";

type Columns = Record<TaskStatus, Task[]>;

function groupByStatus(tasks: Task[]): Columns {
  const columns = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as Task[]])) as Columns;
  for (const task of [...tasks].sort((a, b) => a.position - b.position)) {
    columns[task.status].push(task);
  }
  return columns;
}

function findColumn(columns: Columns, id: string): TaskStatus | null {
  if ((TASK_STATUSES as string[]).includes(id)) return id as TaskStatus;
  for (const status of TASK_STATUSES) {
    if (columns[status].some((t) => t.id === id)) return status;
  }
  return null;
}

export function TaskBoard({
  tasks,
  onOpenTask,
  onReorder,
  onQuickCreate,
}: {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onReorder: (updates: Array<{ id: string; status: TaskStatus; position: number }>) => void;
  /** Chamado só a partir da primeira coluna (igual Azure: "add items in the
   * first column") — que aqui é "Aguardando aceite", já batendo com a regra
   * de toda tarefa nova nascer aguardando aceite. */
  onQuickCreate?: (title: string) => void;
}) {
  const [columns, setColumns] = useState<Columns>(() => groupByStatus(tasks));
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  useEffect(() => {
    setColumns(groupByStatus(tasks));
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  function handleDragStart(event: DragStartEvent) {
    const task = taskById.get(String(event.active.id));
    setActiveTask(task ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const sourceStatus = findColumn(columns, activeId);
    const targetStatus = findColumn(columns, overId);
    if (!sourceStatus || !targetStatus || sourceStatus === targetStatus) return;

    setColumns((prev) => {
      const sourceItems = prev[sourceStatus];
      const activeIndex = sourceItems.findIndex((t) => t.id === activeId);
      if (activeIndex === -1) return prev;

      const targetItems = prev[targetStatus];
      const overIndex = targetItems.findIndex((t) => t.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : targetItems.length;

      const movedTask = { ...sourceItems[activeIndex]!, status: targetStatus };
      const nextSource = sourceItems.filter((t) => t.id !== activeId);
      const nextTarget = [
        ...targetItems.slice(0, insertAt),
        movedTask,
        ...targetItems.slice(insertAt),
      ];

      return { ...prev, [sourceStatus]: nextSource, [targetStatus]: nextTarget };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const status = findColumn(columns, overId);
    if (!status) return;

    setColumns((prev) => {
      const items = prev[status];
      const activeIndex = items.findIndex((t) => t.id === activeId);
      const overIndex = items.findIndex((t) => t.id === overId);
      const reordered =
        activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex
          ? arrayMove(items, activeIndex, overIndex)
          : items;

      const next = { ...prev, [status]: reordered };

      onReorder(reordered.map((task, index) => ({ id: task.id, status, position: index })));

      return next;
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {TASK_STATUSES.map((status, index) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={columns[status]}
            onOpenTask={onOpenTask}
            onQuickCreate={index === 0 ? onQuickCreate : undefined}
          />
        ))}
      </div>

      <DragOverlay>{activeTask && <TaskCard task={activeTask} dragOverlay />}</DragOverlay>
    </DndContext>
  );
}
