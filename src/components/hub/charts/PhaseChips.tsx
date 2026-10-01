"use client";

import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export interface PhaseChip {
  key: string;
  label: string;
  count: number;
  color?: string | null;
  /** Texto pequeno, ex.: "3 paradas". */
  sub?: string;
}

/** Fases do funil como chips clicáveis (multi-seleção), com barra proporcional à quantidade. */
export function PhaseChips({
  items,
  selected,
  onToggle,
  className,
}: {
  items: PhaseChip[];
  selected: string[];
  onToggle: (key: string) => void;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item, i) => {
        const active = selected.includes(item.key);
        return (
          <motion.button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            aria-pressed={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.03 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "relative min-w-32 overflow-hidden rounded-xl border px-3 py-2 text-left transition-colors",
              active
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/50",
            )}
          >
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: item.color ?? "var(--color-primary)" }}
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="mt-0.5 block text-lg font-semibold tabular-nums">{item.count}</span>
            {item.sub && (
              <span className="block text-[11px] text-muted-foreground">{item.sub}</span>
            )}
            <span
              className="absolute inset-x-0 bottom-0 h-1 origin-left bg-primary/70"
              style={{
                transform: `scaleX(${item.count / max})`,
                background: item.color ?? undefined,
              }}
            />
          </motion.button>
        );
      })}
    </div>
  );
}
