// Custo/desempenho de anúncios (Meta + Google Ads), alimentado por dois workflows no
// n8n (extrair-dados-meta, extrair-dados-google-ads) que gravam direto nesta tabela do
// Supabase a cada hora. Ver DateRange em @/lib/leads-recentes.

import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabase-client";
import type { DateRange } from "@/lib/leads-recentes";

export interface AdMetricRow {
  data_referencia: string;
  canal: "meta" | "google";
  campanha_id: string;
  campanha: string | null;
  valor_usado: number;
  resultados: number | null;
  impressoes: number | null;
  cliques_todos: number | null;
  cliques_link: number | null;
  visitas_lp: number | null;
}

/** Mesmo agrupamento de canal usado no Funil de Marketing — casos especiais de nome de
 * campanha (Rapha Mattos) prevalecem sobre o canal bruto (meta/google). */
export function adChannelFor(row: AdMetricRow): string {
  if ((row.campanha ?? "").toUpperCase().includes("RAPHA-MATTOS")) return "Rapha Mattos";
  if (row.canal === "meta") return "Facebook Ads";
  if (row.canal === "google") return "Google";
  return "Outros";
}

export async function loadAdMetrics(range: DateRange): Promise<AdMetricRow[] | null> {
  if (!isSupabaseConfigured()) return null;

  const rows = await supabaseSelect<AdMetricRow>("ad_metrics_daily", {
    select:
      "data_referencia,canal,campanha_id,campanha,valor_usado,resultados,impressoes,cliques_todos,cliques_link,visitas_lp",
    data_referencia: `gte.${range.from}`,
    order: "data_referencia.asc",
  });

  return rows.filter((r) => r.data_referencia <= range.to);
}
