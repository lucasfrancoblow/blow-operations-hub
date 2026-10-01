import { FunnelChart as FunnelViz } from "@/components/ui/funnel-chart";

export interface FunnelStage {
  label: string;
  value: number;
  accent?: "primary" | "info" | "warning" | "success";
  /** Quantos negócios SAÍRAM dessa etapa (avançaram) no período — mesma coluna
   * "SAÍDA" do relatório nativo "Taxa de Conversão" do PipeRun. Opcional: nem toda
   * etapa tem um "saída" que faça sentido mostrar (ex.: a última do funil). */
  saida?: number;
}

const ACCENT_COLOR: Record<NonNullable<FunnelStage["accent"]>, string> = {
  primary: "var(--chart-2)",
  info: "var(--chart-1)",
  warning: "var(--chart-4)",
  success: "var(--chart-3)",
};

/** Funil do 21st (bklitai/funnel-chart): cada etapa afunila proporcional ao volume da
 * primeira; o rótulo mostra a conversão sobre a etapa anterior e a saída do PipeRun. */
export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  return (
    <FunnelViz
      orientation="horizontal"
      edges="curved"
      layers={3}
      className="mx-auto"
      style={{ aspectRatio: "3.4 / 1" }}
      data={stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1] : null;
        const conv = prev && prev.value > 0 ? Math.round((s.value / prev.value) * 100) : null;
        const hint = [
          conv !== null ? `${conv}% da etapa anterior` : null,
          s.saida !== undefined ? `saída: ${s.saida}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return {
          label: s.label,
          value: s.value,
          shape: Math.pow(s.value, 0.4),
          color: ACCENT_COLOR[s.accent ?? "primary"],
          ...(hint ? { hint } : {}),
        };
      })}
    />
  );
}
