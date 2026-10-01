"use client";
// Inspirado no Sankey Diagram do 21st.dev (bklitai/sankey-chart): faixas curvas animadas
// com destaque no hover. Versão própria, sem visx: duas colunas (origem → fase).

import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export interface FlowLink {
  from: string;
  to: string;
  value: number;
}

const W = 760;
const LABEL_W = 170;
const NODE_W = 12;
const PAD = 24;

interface NodeLayout {
  name: string;
  total: number;
  y: number;
  h: number;
  used: number;
}

function stack(
  totals: Map<string, number>,
  order: string[],
  scale: number,
  H: number,
): Map<string, NodeLayout> {
  const out = new Map<string, NodeLayout>();
  const gaps = Math.max(0, order.length - 1) * PAD;
  const sum = order.reduce((s, n) => s + (totals.get(n) ?? 0), 0);
  let y = Math.max(0, (H - sum * scale - gaps) / 2);
  for (const name of order) {
    const total = totals.get(name) ?? 0;
    const h = Math.max(3, total * scale);
    out.set(name, { name, total, y, h, used: 0 });
    y += h + PAD;
  }
  return out;
}

export function OriginFlow({
  links,
  leftOrder,
  rightOrder,
  colorOf,
  className,
  unit = "leads",
}: {
  links: FlowLink[];
  /** Ordem das origens (topo → base). Padrão: maiores primeiro. */
  leftOrder?: string[];
  /** Ordem das fases (topo → base). Padrão: maiores primeiro. */
  rightOrder?: string[];
  colorOf: (origin: string) => string;
  className?: string;
  unit?: string;
}) {
  const reduce = useReducedMotion();
  const [hot, setHot] = useState<{ side: "l" | "r"; name: string } | null>(null);

  const layout = useMemo(() => {
    const valid = links.filter((l) => l.value > 0);
    const lt = new Map<string, number>();
    const rt = new Map<string, number>();
    for (const l of valid) {
      lt.set(l.from, (lt.get(l.from) ?? 0) + l.value);
      rt.set(l.to, (rt.get(l.to) ?? 0) + l.value);
    }
    const by = (m: Map<string, number>) =>
      [...m.keys()].sort((a, b) => (m.get(b) ?? 0) - (m.get(a) ?? 0));
    const lo = leftOrder ? leftOrder.filter((n) => lt.has(n)) : by(lt);
    const ro = rightOrder ? rightOrder.filter((n) => rt.has(n)) : by(rt);
    const rows = Math.max(lo.length, ro.length, 1);
    const H = Math.max(260, rows * 30 + 40);
    const total = [...lt.values()].reduce((s, v) => s + v, 0) || 1;
    const scale = (H - Math.max(lo.length, ro.length) * PAD) / total;
    const L = stack(lt, lo, Math.min(scale, 60), H);
    const R = stack(rt, ro, Math.min(scale, 60), H);
    const ribbons = [...valid]
      .sort(
        (a, b) => lo.indexOf(a.from) - lo.indexOf(b.from) || ro.indexOf(a.to) - ro.indexOf(b.to),
      )
      .map((l) => {
        const a = L.get(l.from)!;
        const b = R.get(l.to)!;
        const h = l.value * Math.min(scale, 60);
        const y0 = a.y + a.used;
        const y1 = b.y + b.used;
        a.used += h;
        b.used += h;
        return { ...l, y0, y1, h };
      });
    return { L, R, ribbons, H, total };
  }, [links, leftOrder, rightOrder]);

  if (layout.ribbons.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sem dados no período.</p>;
  }

  const x0 = LABEL_W + NODE_W;
  const x1 = W - LABEL_W - NODE_W;
  const mid = (x0 + x1) / 2;

  const dim = (from: string, to: string) =>
    hot && !((hot.side === "l" && hot.name === from) || (hot.side === "r" && hot.name === to));

  return (
    <div className={cn("w-full", className)}>
      <p className="mb-2 text-[11px] text-muted-foreground md:hidden">
        Deslize para o lado para ver tudo →
      </p>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${layout.H}`}
          className="mx-auto h-auto w-full min-w-[560px]"
          role="img"
          aria-label="Fluxo de leads da origem até a fase atual"
        >
          {layout.ribbons.map((r, i) => (
            <motion.path
              key={`${r.from}->${r.to}`}
              d={`M ${x0} ${r.y0} C ${mid} ${r.y0}, ${mid} ${r.y1}, ${x1} ${r.y1} L ${x1} ${r.y1 + r.h} C ${mid} ${r.y1 + r.h}, ${mid} ${r.y0 + r.h}, ${x0} ${r.y0 + r.h} Z`}
              fill={colorOf(r.from)}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: dim(r.from, r.to) ? 0.08 : 0.42 }}
              transition={{ duration: 0.5, delay: reduce ? 0 : i * 0.025 }}
              onMouseEnter={() => setHot({ side: "l", name: r.from })}
              onMouseLeave={() => setHot(null)}
            >
              <title>{`${r.from} → ${r.to}: ${r.value} ${unit}`}</title>
            </motion.path>
          ))}

          {[...layout.L.values()].map((n) => (
            <g
              key={`l-${n.name}`}
              onMouseEnter={() => setHot({ side: "l", name: n.name })}
              onMouseLeave={() => setHot(null)}
              className="cursor-default"
            >
              <rect x={LABEL_W} y={n.y} width={NODE_W} height={n.h} rx={3} fill={colorOf(n.name)} />
              <text
                x={LABEL_W - 8}
                y={n.y + n.h / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-foreground text-[12px] font-medium"
              >
                {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
                <tspan className="fill-muted-foreground font-normal" dx="6">
                  {n.total}
                </tspan>
              </text>
            </g>
          ))}

          {[...layout.R.values()].map((n) => (
            <g
              key={`r-${n.name}`}
              onMouseEnter={() => setHot({ side: "r", name: n.name })}
              onMouseLeave={() => setHot(null)}
              className="cursor-default"
            >
              <rect
                x={x1}
                y={n.y}
                width={NODE_W}
                height={n.h}
                rx={3}
                className="fill-foreground/80"
              />
              <text
                x={x1 + NODE_W + 8}
                y={n.y + n.h / 2}
                dominantBaseline="middle"
                className="fill-foreground text-[12px] font-medium"
              >
                {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
                <tspan className="fill-muted-foreground font-normal" dx="6">
                  {n.total}
                </tspan>
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
