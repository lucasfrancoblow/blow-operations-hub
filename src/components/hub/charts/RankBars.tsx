"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

export interface RankRow {
  label: string;
  value: number;
  color?: string;
  /** Texto à direita; padrão: o próprio valor. */
  display?: string;
  sub?: string;
}

/** Ranking em barras horizontais animadas — leitura rápida de "quem lidera". */
export function RankBars({
  rows,
  className,
  empty = "Sem dados no período.",
}: {
  rows: RankRow[];
  className?: string;
  empty?: string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className={cn("space-y-3", className)}>
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {r.label}
              {r.sub && <span className="ml-2 text-xs text-muted-foreground">{r.sub}</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {r.display ?? r.value.toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full"
              style={{ background: r.color ?? "var(--color-primary)" }}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
