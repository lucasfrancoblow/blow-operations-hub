import { DateRangePicker } from "@/components/hub/DateRangePicker";
import { MultiSelectFilter } from "@/components/hub/MultiSelectFilter";
import { Switch } from "@/components/ui/switch";
import { lastDaysRange, monthRange } from "@/components/hub/tv/tv-data";
import { type DateRange } from "@/lib/leads-recentes";
import { cn } from "@/lib/utils";

export type RangePreset = "hoje" | "7" | "30" | "mes" | "custom";

export const PRESET_LABELS: Array<{ id: Exclude<RangePreset, "custom">; label: string }> = [
  { id: "hoje", label: "Hoje" },
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "mes", label: "Mês" },
];

export function rangeFor(preset: RangePreset, custom: DateRange, today: string): DateRange {
  switch (preset) {
    case "hoje":
      return { from: today, to: today };
    case "7":
      return lastDaysRange(today, 7);
    case "mes":
      return monthRange(today);
    case "custom":
      return custom;
    default:
      return lastDaysRange(today, 30);
  }
}

export function TvFilterBar({
  preset,
  range,
  onPreset,
  onCustomRange,
  pipelineOptions,
  funis,
  onFunis,
  incluirOutbound,
  onIncluirOutbound,
  hiddenOutbound,
}: {
  preset: RangePreset;
  range: DateRange;
  onPreset: (preset: Exclude<RangePreset, "custom">) => void;
  onCustomRange: (range: DateRange) => void;
  pipelineOptions: string[];
  funis: string[];
  onFunis: (next: string[]) => void;
  incluirOutbound: boolean;
  onIncluirOutbound: (next: boolean) => void;
  /** Quantos negócios do Outbound foram deixados de fora no período (aviso). */
  hiddenOutbound: number;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm">
      <div className="flex rounded-full bg-muted/60 p-1">
        {PRESET_LABELS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPreset(p.id)}
            aria-pressed={preset === p.id}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              preset === p.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <DateRangePicker value={range} onChange={onCustomRange} />
      <MultiSelectFilter
        label="Funil"
        options={pipelineOptions}
        selected={funis}
        onChange={onFunis}
      />
      <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <Switch checked={incluirOutbound} onCheckedChange={onIncluirOutbound} />
        <span>
          Incluir Outbound
          {!incluirOutbound && hiddenOutbound > 0 && (
            <span className="ml-1 text-warning">
              ({hiddenOutbound.toLocaleString("pt-BR")} fora: prospecção em lista)
            </span>
          )}
        </span>
      </label>
    </div>
  );
}
