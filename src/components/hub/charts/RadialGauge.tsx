"use client";
// Inspirado no Animated Radial Chart do 21st.dev (isaiahbjork): arco semicircular animado.

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

import { AnimatedNumber } from "@/components/hub/motion";
import { cn } from "@/lib/utils";

export function RadialGauge({
  value,
  label,
  hint,
  color = "var(--color-primary)",
  className,
}: {
  /** 0 a 100 */
  value: number;
  label: string;
  hint?: string;
  color?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const pct = Math.max(0, Math.min(100, value));
  const r = 54;
  const arc = Math.PI * r;
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg
        viewBox="0 0 140 84"
        className="w-full max-w-[11rem]"
        role="img"
        aria-label={`${label}: ${Math.round(pct)}%`}
      >
        <defs>
          <linearGradient id={`g-${id}`} x1="0" x2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <path
          d="M 16 70 A 54 54 0 0 1 124 70"
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <motion.path
          d="M 16 70 A 54 54 0 0 1 124 70"
          fill="none"
          stroke={`url(#g-${id})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={arc}
          initial={{ strokeDashoffset: reduce ? arc * (1 - pct / 100) : arc }}
          animate={{ strokeDashoffset: arc * (1 - pct / 100) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="-mt-9 text-center">
        <AnimatedNumber
          value={Math.round(pct)}
          formatter={(n) => `${n}%`}
          className="font-display text-2xl font-semibold tabular-nums"
        />
      </div>
      <p className="mt-2 text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
