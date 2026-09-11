import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  /** Vazio = "todos" (sem filtro aplicado) — mesma semântica dos filtros de único
   * valor que este componente substitui, só que agora aceita mais de um ao mesmo tempo. */
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

/** Combobox de múltipla escolha (Popover + Command + Checkbox) — substitui os Select
 * de valor único do Radar de Leads/Funil de Marketing pra poder combinar mais de uma
 * opção no mesmo filtro (ex.: "Pré Vendas" + "Expansão Closer" ao mesmo tempo). */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  className,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  function toggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((v) => v !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  const summary =
    selected.length === 0
      ? `Todos os ${label.toLowerCase()}`
      : selected.length === 1
        ? selected[0]
        : `${selected.length} ${label.toLowerCase()} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">{summary}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <CommandItem key={option} onSelect={() => toggle(option)}>
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                        isSelected ? "bg-primary text-primary-foreground" : "opacity-50",
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{option}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selected.length > 0 && (
            <div className="flex items-center justify-between border-t p-2">
              <div className="flex flex-wrap gap-1">
                {selected.slice(0, 3).map((v) => (
                  <Badge key={v} variant="secondary" className="max-w-[120px] truncate">
                    {v}
                  </Badge>
                ))}
                {selected.length > 3 && <Badge variant="secondary">+{selected.length - 3}</Badge>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onChange([])}
              >
                <X className="h-3 w-3" /> Limpar
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
