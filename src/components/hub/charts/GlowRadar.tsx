"use client";
// Inspirado no Radar Chart (glow) do 21st.dev (arihantcodes/radar-chart), sobre Recharts.

import { useId } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface RadarSeries {
  key: string;
  label: string;
  color: string;
}

export function GlowRadar({
  data,
  series,
  className,
}: {
  /** [{ metric: "SQL", a: 40, b: 25 }] — valores de 0 a 100. */
  data: Array<Record<string, string | number>>;
  series: RadarSeries[];
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={className ?? "h-72 w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="52%">
          <defs>
            <filter id={`glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          />
          <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(v) => `${Number(v).toFixed(0)}%`}
          />
          {series.map((s) => (
            <Radar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.2}
              strokeWidth={2}
              filter={`url(#glow-${id})`}
              animationDuration={900}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
