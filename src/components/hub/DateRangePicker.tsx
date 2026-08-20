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

  const selected: DayPickerRange = {
    from: new Date(`${value.from}T00:00:00`),
    to: new Date(`${value.to}T00:00:00`),
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          selected={selected}
          defaultMonth={selected.from}
          onSelect={(range) => {
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
