"use client";
// Inspirado no Heat Calendar do 21st.dev (starc007/heat-calendar): uma só cor em 5 degraus,
// aqui em grade dia da semana × hora para achar o melhor horário de entrada de leads.

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const LEVELS = [0.06, 0.2, 0.38, 0.62, 0.9];

export function HourHeatmap({
  grid,
  className,
}: {
  /** grid[diaDaSemana 0=Dom][hora 0..23] = quantidade */
  grid: number[][];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [hot, setHot] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...grid.flat());
  const level = (v: number) => (v === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));

  return (
    <div className={cn("w-full", className)}>
      <p className="mb-2 text-[11px] text-muted-foreground md:hidden">
        Deslize para o lado para ver tudo →
      </p>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="ml-10 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-1 pb-1 text-center text-[10px] text-muted-foreground">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h}>{h % 3 === 0 ? `${h}h` : ""}</span>
            ))}
          </div>
          {grid.map((row, d) => (
            <div key={DAYS[d]} className="mb-1 flex items-center gap-2">
              <span className="w-8 text-right text-[11px] text-muted-foreground">{DAYS[d]}</span>
              <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-1">
                {row.map((v, h) => (
                  <motion.div
                    key={h}
                    initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: reduce ? 0 : (d * 24 + h) * 0.002 }}
                    onMouseEnter={() => setHot({ d, h })}
                    onMouseLeave={() => setHot(null)}
                    className={cn(
                      "aspect-square rounded-[5px] ring-primary transition-shadow",
                      hot?.d === d && hot?.h === h && "ring-2",
                    )}
                    style={{
                      background: `color-mix(in oklab, var(--color-primary) ${LEVELS[level(v)]! * 100}%, var(--color-muted))`,
                    }}
                    title={`${DAYS[d]} ${h}h: ${v} lead(s)`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {hot
            ? `${DAYS[hot.d]} às ${hot.h}h: ${grid[hot.d]?.[hot.h] ?? 0} lead(s)`
            : "Passe o mouse numa célula"}
        </span>
        <span className="flex items-center gap-1">
          menos
          {LEVELS.map((l) => (
            <span
              key={l}
              className="size-3 rounded-[4px]"
              style={{
                background: `color-mix(in oklab, var(--color-primary) ${l * 100}%, var(--color-muted))`,
              }}
            />
          ))}
          mais
        </span>
      </div>
    </div>
  );
}
