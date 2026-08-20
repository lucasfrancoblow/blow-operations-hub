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
import { TaskPriorityBadge } from "@/components/hub/badges";
import { EmptyState } from "@/components/hub/primitives";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/types/tasks";

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
                className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-card/90 p-3"
                onClick={() => onOpenTask(task)}
              >
                <div className="min-w-0 space-y-1.5">
                  <p className="text-sm font-medium leading-snug">{task.title}</p>
                  <TaskPriorityBadge value={task.priority} />
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
