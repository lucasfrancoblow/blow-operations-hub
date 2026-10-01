"use client";
// Origem: 21st.dev · bklitai/funnel-chart (enxuto: sem padrões/gradientes/grade).

import { motion, useSpring, useTransform } from "motion/react";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface FunnelStage {
  label: string;
  value: number;
  displayValue?: string;
  color?: string;
  /** Texto pequeno extra sob o rótulo (ex.: "12% do anterior"). */
  hint?: string;
  /** Peso visual do formato (padrão: value). Permite comprimir a escala sem mentir nos números. */
  shape?: number;
}

export interface FunnelChartProps {
  data: FunnelStage[];
  orientation?: "horizontal" | "vertical";
  color?: string;
  layers?: number;
  className?: string;
  style?: CSSProperties;
  showPercentage?: boolean;
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  onStageClick?: (index: number) => void;
  formatPercentage?: (pct: number) => string;
  formatValue?: (value: number) => string;
  staggerDelay?: number;
  gap?: number;
  edges?: "curved" | "straight";
}

const fmtPct = (p: number) => `${Math.round(p)}%`;
const fmtVal = (v: number) => v.toLocaleString("pt-BR");
const springConfig = { stiffness: 120, damping: 20, mass: 1 };
const hoverSpring = { stiffness: 300, damping: 24 };

function hPath(a: number, b: number, w: number, H: number, scale: number, straight: boolean) {
  const my = H / 2;
  const h0 = a * H * 0.44 * scale;
  const h1 = b * H * 0.44 * scale;
  if (straight) return `M 0 ${my - h0} L ${w} ${my - h1} L ${w} ${my + h1} L 0 ${my + h0} Z`;
  const cx = w * 0.55;
  return `M 0 ${my - h0} C ${cx} ${my - h0}, ${w - cx} ${my - h1}, ${w} ${my - h1} L ${w} ${my + h1} C ${w - cx} ${my + h1}, ${cx} ${my + h0}, 0 ${my + h0} Z`;
}

function vPath(a: number, b: number, h: number, W: number, scale: number, straight: boolean) {
  const mx = W / 2;
  const w0 = a * W * 0.44 * scale;
  const w1 = b * W * 0.44 * scale;
  if (straight) return `M ${mx - w0} 0 L ${mx - w1} ${h} L ${mx + w1} ${h} L ${mx + w0} 0 Z`;
  const cy = h * 0.55;
  return `M ${mx - w0} 0 C ${mx - w0} ${cy}, ${mx - w1} ${h - cy}, ${mx - w1} ${h} L ${mx + w1} ${h} C ${mx + w1} ${h - cy}, ${mx + w0} ${cy}, ${mx + w0} 0 Z`;
}

function Ring({
  d,
  color,
  opacity,
  hovered,
  ringIndex,
  totalRings,
  horiz,
}: {
  d: string;
  color: string;
  opacity: number;
  hovered: boolean;
  ringIndex: number;
  totalRings: number;
  horiz: boolean;
}) {
  const extra = 1 + (ringIndex / Math.max(totalRings - 1, 1)) * 0.12;
  const scale = useSpring(1, { stiffness: 300 - ringIndex * 60, damping: 24 - ringIndex * 3 });
  useEffect(() => {
    scale.set(hovered ? extra : 1);
  }, [hovered, scale, extra]);
  return (
    <motion.path
      d={d}
      fill={color}
      opacity={opacity}
      style={{
        ...(horiz ? { scaleY: scale } : { scaleX: scale }),
        transformOrigin: "center center",
      }}
    />
  );
}

function Segment({
  index,
  a,
  b,
  w,
  h,
  color,
  layers,
  staggerDelay,
  hovered,
  dimmed,
  straight,
  horiz,
}: {
  index: number;
  a: number;
  b: number;
  w: number;
  h: number;
  color: string;
  layers: number;
  staggerDelay: number;
  hovered: boolean;
  dimmed: boolean;
  straight: boolean;
  horiz: boolean;
}) {
  const grow = useSpring(0, springConfig);
  const entrance = useTransform(grow, [0, 1], [0, 1]);
  const dim = useSpring(1, hoverSpring);
  useEffect(() => {
    dim.set(dimmed ? 0.4 : 1);
  }, [dimmed, dim]);
  useEffect(() => {
    const t = setTimeout(() => grow.set(1), index * staggerDelay * 1000);
    return () => clearTimeout(t);
  }, [grow, index, staggerDelay]);

  const rings = Array.from({ length: layers }, (_, l) => {
    const scale = 1 - (l / layers) * 0.35;
    return {
      d: horiz ? hPath(a, b, w, h, scale, straight) : vPath(a, b, h, w, scale, straight),
      opacity: 0.18 + (l / (layers - 1 || 1)) * 0.65,
    };
  });

  return (
    <motion.div
      className="pointer-events-none relative shrink-0 overflow-visible"
      style={{ width: w, height: h, zIndex: hovered ? 10 : 1, opacity: dim }}
    >
      <motion.div
        className="absolute inset-0 overflow-visible"
        style={{
          scaleX: horiz ? entrance : 1,
          scaleY: horiz ? 1 : entrance,
          transformOrigin: horiz ? "left center" : "center top",
        }}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          role="presentation"
          viewBox={`0 0 ${w} ${h}`}
        >
          {rings.map((r, i) => (
            <Ring
              key={r.opacity.toFixed(2)}
              color={color}
              d={r.d}
              hovered={hovered}
              opacity={r.opacity}
              ringIndex={i}
              totalRings={layers}
              horiz={horiz}
            />
          ))}
        </svg>
      </motion.div>
    </motion.div>
  );
}

export function FunnelChart({
  data,
  orientation = "horizontal",
  color = "var(--chart-1)",
  layers = 3,
  className,
  style,
  showPercentage = true,
  hoveredIndex: hoveredProp,
  onHoverChange,
  onStageClick,
  formatPercentage = fmtPct,
  formatValue = fmtVal,
  staggerDelay = 0.12,
  gap = 4,
  edges = "curved",
}: FunnelChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });
  const [internalHover, setInternalHover] = useState<number | null>(null);
  const controlled = hoveredProp !== undefined;
  const hovered = controlled ? hoveredProp : internalHover;
  const setHovered = useCallback(
    (i: number | null) => {
      if (controlled) onHoverChange?.(i);
      else setInternalHover(i);
    },
    [controlled, onHoverChange],
  );

  const measure = useCallback(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    if (width > 0 && height > 0) setSz({ w: width, h: height });
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);

  const first = data[0];
  if (!first) return null;
  const max = Math.max(1, first.value);
  const n = data.length;
  // Escala pelo maior valor (não pelo primeiro): em relatórios por entrada de etapa, uma etapa
  // posterior pode ter mais negócios que a primeira.
  const shapeMax = Math.max(1e-9, ...data.map((d) => d.shape ?? d.value));
  const norms = data.map((d) => (d.shape ?? d.value) / shapeMax);
  const horiz = orientation === "horizontal";
  const { w: W, h: H } = sz;
  const totalGap = gap * (n - 1);
  const segW = horiz ? (W - totalGap) / n : W;
  const segH = horiz ? H : (H - totalGap) / n;

  return (
    <div
      ref={ref}
      className={cn("relative w-full select-none overflow-visible", className)}
      style={{ aspectRatio: horiz ? "2.2 / 1" : "1 / 1.8", ...style }}
    >
      {W > 0 && H > 0 && (
        <>
          <div
            className={cn(
              "absolute inset-0 flex overflow-visible",
              horiz ? "flex-row" : "flex-col",
            )}
            style={{ gap }}
          >
            {data.map((stage, i) => (
              <Segment
                key={stage.label}
                index={i}
                a={norms[i] ?? 0}
                b={norms[Math.min(i + 1, n - 1)] ?? 0}
                w={segW}
                h={segH}
                color={stage.color ?? color}
                layers={layers}
                staggerDelay={staggerDelay}
                hovered={hovered === i}
                dimmed={hovered !== null && hovered !== i}
                straight={edges === "straight"}
                horiz={horiz}
              />
            ))}
          </div>

          {data.map((stage, i) => {
            const pct = (stage.value / max) * 100;
            const pos: CSSProperties = horiz
              ? { left: (segW + gap) * i, width: segW, top: 0, height: H }
              : { top: (segH + gap) * i, height: segH, left: 0, width: W };
            const dimmed = hovered !== null && hovered !== i;
            const value = stage.displayValue ?? formatValue(stage.value);
            return (
              <motion.div
                key={`lbl-${stage.label}`}
                animate={{ opacity: dimmed ? 0.4 : 1 }}
                className={cn("absolute", onStageClick && "cursor-pointer")}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onStageClick?.(i)}
                style={{ ...pos, zIndex: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * staggerDelay + 0.25, duration: 0.35, ease: "easeOut" }}
                  className={cn(
                    "absolute inset-0 flex",
                    horiz ? "flex-col items-center" : "flex-row items-center",
                  )}
                >
                  {horiz ? (
                    <>
                      <div className="flex h-[16%] items-end justify-center pb-1">
                        <span className="whitespace-nowrap text-sm font-semibold">{value}</span>
                      </div>
                      <div className="flex flex-1 items-center justify-center">
                        {showPercentage && (
                          <span className="rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-background shadow-sm">
                            {formatPercentage(pct)}
                          </span>
                        )}
                      </div>
                      <div className="flex h-[20%] items-start justify-center px-1 pt-1">
                        <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight text-muted-foreground">
                          {stage.label}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex w-[22%] items-center justify-end pr-2">
                        <span className="whitespace-nowrap text-sm font-semibold">{value}</span>
                      </div>
                      <div className="flex flex-1 items-center justify-center">
                        {showPercentage && (
                          <span className="rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-background shadow-sm">
                            {formatPercentage(pct)}
                          </span>
                        )}
                      </div>
                      <div className="flex w-[34%] flex-col items-start justify-center pl-2">
                        <span className="truncate text-xs font-medium text-foreground">
                          {stage.label}
                        </span>
                        {stage.hint && (
                          <span className="truncate text-[11px] text-muted-foreground">
                            {stage.hint}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </>
      )}
    </div>
  );
}

FunnelChart.displayName = "FunnelChart";
export default FunnelChart;
