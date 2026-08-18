import { useEffect } from "react";
import { Plus, Search } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { TaskPriorityBadge } from "@/components/hub/badges";
import type { Task } from "@/types/tasks";

export function TaskCommandPalette({
  open,
  onOpenChange,
  tasks,
  onCreate,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onCreate: () => void;
  onSelect: (task: Task) => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar tarefa ou criar uma nova..." />
      <CommandList>
        <CommandEmpty>Nenhuma tarefa encontrada.</CommandEmpty>
        <CommandGroup heading="Ações">
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onCreate();
            }}
          >
            <Plus className="h-4 w-4" /> Nova tarefa
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Tarefas">
          {tasks.map((task) => (
            <CommandItem
              key={task.id}
              value={task.title}
              onSelect={() => {
                onOpenChange(false);
                onSelect(task);
              }}
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 truncate">{task.title}</span>
              <TaskPriorityBadge value={task.priority} />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
