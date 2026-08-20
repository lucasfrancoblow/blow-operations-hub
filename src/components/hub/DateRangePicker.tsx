import { useState } from "react";
import type { DateRange as DayPickerRange } from "react-day-picker";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "@/lib/leads-recentes";

const PRESETS = [
  { label: "Últimos 7 dias", days: 7 },
  { label: "Últimos 14 dias", days: 14 },
  { label: "Últimos 30 dias", days: 30 },
  { label: "Últimos 90 dias", days: 90 },
];

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  // Seleção em andamento dentro do popover. Começa vazia toda vez que abre — se
  // reaproveitássemos o range já confirmado, o primeiro clique cairia "dentro" dele e o
  // react-day-picker trataria isso como reset instantâneo pra um dia só (o bug relatado:
  // clicar uma vez virava "19/08 — 19/08"). Vazio força sempre 2 cliques: 1º = início,
  // 2º = fim, como num calendário de viagem.
  const [draft, setDraft] = useState<DayPickerRange | undefined>(undefined);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start gap-2 font-normal">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {formatBR(value.from)} — {formatBR(value.to)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col gap-1 border-b border-border/60 p-2 sm:flex-row sm:border-b-0 sm:border-r">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => {
                const to = new Date();
                const from = new Date();
                from.setDate(from.getDate() - (preset.days - 1));
                onChange({ from: toISO(from), to: toISO(to) });
                setOpen(false);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={draft}
          defaultMonth={new Date(`${value.from}T00:00:00`)}
          onSelect={(range) => {
            // O react-day-picker devolve {from: dia, to: dia} já no 1º clique (ele trata
            // um clique isolado como "range de 1 dia completo"). Se aceitássemos isso como
            // range final, fechava direto no primeiro clique — daí só guardamos o dia
            // inicial e esperamos o 2º clique pra virar range de verdade.
            const startingFresh = !draft || (draft.from && draft.to);
            if (startingFresh) {
              setDraft({ from: range?.from, to: undefined });
              return;
            }
            setDraft(range);
            if (range?.from && range?.to) {
              onChange({ from: toISO(range.from), to: toISO(range.to) });
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
