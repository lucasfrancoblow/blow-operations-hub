import { AnimatePresence, motion } from "motion/react";
import { Inbox, MoreHorizontal } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/hub/primitives";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";
import { TASK_STATUSES, type Task, type TaskPriority, type TaskStatus } from "@/types/tasks";

// Mesmo papel do "ícone de tipo de work item" colorido do Azure — ver TaskCard.tsx.
const PRIORITY_ICON: Record<TaskPriority, string> = {
  Crítica: "bg-critical",
  Alta: "bg-primary",
  Média: "bg-warning",
  Baixa: "bg-info",
};

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export function TaskMobileList({
  tasks,
  status,
  onStatusChange,
  onOpenTask,
  onMoveTask,
}: {
  tasks: Task[];
  status: TaskStatus;
  onStatusChange: (status: TaskStatus) => void;
  onOpenTask: (task: Task) => void;
  onMoveTask: (task: Task, status: TaskStatus) => void;
}) {
  const visible = tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-3">
      <Tabs value={status} onValueChange={(v) => onStatusChange(v as TaskStatus)}>
        <TabsList className="w-full overflow-x-auto">
          {TASK_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="whitespace-nowrap">
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="Nada por aqui"
          description="Sem tarefas nesta coluna."
        />
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-2">
            {visible.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start justify-between gap-2 rounded-md border border-border bg-card p-2.5"
                onClick={() => onOpenTask(task)}
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <span
                      className={cn(
                        "mt-1 h-2.5 w-2.5 shrink-0 rounded-sm",
                        PRIORITY_ICON[task.priority],
                      )}
                      title={task.priority}
                    />
                    <p className="min-w-0 text-sm leading-snug">
                      <span className="text-muted-foreground">#{task.taskNumber}</span> {task.title}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-4 text-[11px] text-muted-foreground">
                    {task.estimatedHours !== null && (
                      <span>{formatHours(task.estimatedHours)}</span>
                    )}
                    {task.assignees.length > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                          {displayName(task.assignees[0]!).charAt(0).toUpperCase()}
                        </span>
                        {displayName(task.assignees[0]!)}
                        {task.assignees.length > 1 && ` +${task.assignees.length - 1}`}
                      </span>
                    )}
                    {task.storyPoints !== null && (
                      <span
                        title="Story points"
                        className="flex h-4 w-4 items-center justify-center rounded-full border border-border bg-muted text-[9px] font-semibold text-foreground"
                      >
                        {task.storyPoints}
                      </span>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {TASK_STATUSES.filter((s) => s !== task.status).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveTask(task, s);
                        }}
                      >
                        Mover para {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
