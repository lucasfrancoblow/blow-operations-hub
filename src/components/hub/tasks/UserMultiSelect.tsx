import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { TaskAssignee } from "@/types/tasks";

/** Combobox de múltipla seleção de pessoas — não existe um multi-select
 * pronto no design system (só o Select single-value do Radix), então isso
 * combina Popover + Command (cmdk) com chips removíveis. Usado tanto no
 * filtro do board quanto no picker de responsáveis da tarefa. */
export function UserMultiSelect({
  users,
  selected,
  onChange,
  placeholder = "Ninguém",
  variant = "default",
}: {
  users: TaskAssignee[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  /** "compact" = trigger sem borda/fundo, pra caber ao lado de Status/User
   * Story no cabeçalho do detalhe (mesmo espírito do Select ali). */
  variant?: "default" | "compact";
}) {
  const [open, setOpen] = useState(false);
  const selectedUsers = users.filter((u) => selected.includes(u.id));

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "compact" ? (
          <button
            type="button"
            className="flex h-7 w-fit items-center gap-1.5 rounded-md px-0 text-sm text-foreground hover:text-primary"
          >
            <div className="flex -space-x-1.5">
              {selectedUsers.length === 0 ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  ?
                </span>
              ) : (
                selectedUsers.slice(0, 3).map((u) => (
                  <span
                    key={u.id}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-card bg-primary/15 text-[10px] font-semibold text-primary"
                  >
                    {displayName(u).charAt(0).toUpperCase()}
                  </span>
                ))
              )}
            </div>
            <span className="truncate">
              {selectedUsers.length === 0
                ? placeholder
                : selectedUsers.length === 1
                  ? displayName(selectedUsers[0]!)
                  : `${selectedUsers.length} responsáveis`}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="flex min-h-9 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm"
          >
            {selectedUsers.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <div className="flex flex-1 flex-wrap gap-1">
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                  >
                    {displayName(u)}
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(u.id);
                      }}
                      className="hover:text-critical"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </span>
                ))}
              </div>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar pessoa..." />
          <CommandList>
            <CommandEmpty>Ninguém encontrado.</CommandEmpty>
            <CommandGroup>
              {users.map((u) => {
                const isSelected = selected.includes(u.id);
                return (
                  <CommandItem key={u.id} value={displayName(u)} onSelect={() => toggle(u.id)}>
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected && "bg-primary text-primary-foreground",
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                    {displayName(u)}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
