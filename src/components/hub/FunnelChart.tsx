import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export interface FunnelStage {
  label: string;
  value: number;
  accent?: "primary" | "info" | "warning" | "success";
}

const ACCENT_CLASS: Record<NonNullable<FunnelStage["accent"]>, string> = {
  primary: "from-primary/90 to-primary/60 shadow-primary/30",
  info: "from-info/90 to-info/60 shadow-info/30",
  warning: "from-warning/90 to-warning/60 shadow-warning/30",
  success: "from-success/90 to-success/60 shadow-success/30",
};

/** Funil de verdade — cada etapa afunila proporcional ao volume da primeira, com a
 * taxa de conversão real entre uma etapa e a próxima. Nada de bar chart genérico. */
export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      {stages.map((stage, i) => {
        const widthPct = Math.max(6, (stage.value / max) * 100);
        const prev = i > 0 ? stages[i - 1] : null;
        const convPct =
          prev && prev.value > 0 ? Math.round((stage.value / prev.value) * 100) : null;

        return (
          <div key={stage.label} className="flex w-full flex-col items-center">
            {i > 0 && (
              <div className="flex flex-col items-center py-1 text-muted-foreground">
                <ChevronDown className="h-3.5 w-3.5" />
                {convPct !== null && (
                  <span className="text-[11px] font-medium tabular-nums">{convPct}%</span>
                )}
              </div>
            )}
            <motion.div
              initial={reduce ? undefined : { width: 0, opacity: 0 }}
              animate={reduce ? undefined : { width: `${widthPct}%`, opacity: 1 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              style={reduce ? { width: `${widthPct}%` } : undefined}
              className={`relative flex h-11 min-w-[40%] items-center justify-between gap-3 rounded-lg bg-gradient-to-r px-4 text-sm font-medium text-primary-foreground shadow-lg transition-shadow hover:shadow-xl ${ACCENT_CLASS[stage.accent ?? "primary"]}`}
            >
              <span className="truncate">{stage.label}</span>
              <span className="shrink-0 font-display text-base tabular-nums">{stage.value}</span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
