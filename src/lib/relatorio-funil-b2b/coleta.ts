// Coleta de dados do relatório (rede): PipeRun, planilha Backup Leads e Supabase.
// Cada fonte falha de forma independente; quem chama decide o que marcar como indisponível.

import { JWT } from "google-auth-library";
import {
  fetchDealsByIds,
  fetchDealsByPipeline,
  fetchStageEntradasInRange,
  isPipeRunConfigured,
  type PipeRunDeal,
} from "@/lib/piperun-client";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import { loadAdMetrics } from "@/lib/ad-metrics";
import { classificarCanal, indexarBackup, normalizarNome, type IndiceBackup } from "./canais";
import {
  construirEventos,
  ehCardDeTeste,
  type LinhaHistorico,
  type ResultadoEventos,
} from "./eventos";
import type { LinhaAd } from "./gasto";
import type { Periodo } from "./periodo";
import { ETAPAS, PIPELINE_IDS } from "./tipos";

export const BACKUP_LEADS_SHEET_ID = "1fW2an285i4423NWcZuVwv8k2MSxZ6oSXFSl1mtJXjhc";
export const BACKUP_LEADS_ABA = "Geral - Novo";

function customField(deal: PipeRunDeal, nome: string): string | null {
  return deal.customFields?.find((c) => c.name === nome)?.value ?? null;
}

/** Primeiro e último dia a buscar: cobre a média de 7 dias e o mês até o fim do período. */
export function janelaDeBusca(p: Periodo): { from: string; to: string } {
  return { from: p.media7From < p.mesFrom ? p.media7From : p.mesFrom, to: p.to };
}

export async function coletarEventosPipeRun(
  periodo: Periodo,
  backup: IndiceBackup | null,
): Promise<ResultadoEventos> {
  if (!isPipeRunConfigured()) throw new Error("PIPERUN_API_KEY não configurada.");
  const { from, to } = janelaDeBusca(periodo);

  const [historico, dealsOutbound] = await Promise.all([
    fetchStageEntradasInRange(from, to),
    fetchDealsByPipeline(PIPELINE_IDS.outbound),
  ]);
  const linhas: LinhaHistorico[] = historico
    .filter((h) => ETAPAS[h.in_stage_id] && !(h as { deleted_at?: string | null }).deleted_at)
    .map((h) => ({
      dealId: h.deal_id,
      inStageId: h.in_stage_id,
      outStageId: h.out_stage_id,
      inDate: h.in_date,
      outDate: h.out_date,
    }));

  const ids = Array.from(new Set(linhas.map((l) => l.dealId)));
  const deals = new Map((await fetchDealsByIds(ids)).map((d) => [d.id, d] as const));
  const nomesOutbound = new Set(dealsOutbound.map((d) => normalizarNome(d.title ?? "")));

  return construirEventos(linhas, (dealId, funil) => {
    const deal = deals.get(dealId);
    const titulo = deal?.title ?? "";
    if (ehCardDeTeste(titulo)) return { excluir: "teste" };
    if (funil === "outbound") return { canal: "Outbound", semOrigem: false };
    if (funil === "closer" && nomesOutbound.has(normalizarNome(titulo))) {
      return { canal: "Outbound", semOrigem: false };
    }
    if (!deal) return { canal: "Orgânico", semOrigem: true };
    return classificarCanal(
      {
        titulo,
        criadoEm: deal.created_at,
        originId: deal.origin_id,
        utmSource: customField(deal, "utm_source"),
        utmCampaign: customField(deal, "utm_campaign"),
      },
      backup,
    );
  });
}

/** "10/08/2026, 09:41:06" -> "2026-08-10 09:41:06" (Brasília). null se não for uma data. */
export function dataBackupParaIso(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}:\d{2}:\d{2})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}` : null;
}

export function linhasDoBackup(valores: string[][]): Array<{
  nome: string;
  data: string;
  utmSource: string;
  utmCampaign: string;
}> {
  const out = [];
  for (const row of valores.slice(1)) {
    const data = dataBackupParaIso(row[0] ?? "");
    if (!data) continue;
    out.push({
      nome: row[1] ?? "",
      data,
      utmSource: row[7] ?? "",
      utmCampaign: row[9] ?? "",
    });
  }
  return out;
}

/** Lê a aba "Geral - Novo" da planilha Backup Leads com a service account (somente leitura). */
export async function lerBackupLeads(): Promise<IndiceBackup> {
  const email = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];
  const key = process.env["GOOGLE_PRIVATE_KEY"];
  if (!email || !key)
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY não configuradas.");
  const client = new JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const res = await client.request<{ values?: string[][] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${BACKUP_LEADS_SHEET_ID}/values/${encodeURIComponent(`'${BACKUP_LEADS_ABA}'!A:J`)}`,
  });
  const valores = res.data.values;
  if (!valores || valores.length < 2) throw new Error("Planilha Backup Leads vazia.");
  return indexarBackup(linhasDoBackup(valores));
}

/** Gasto de anúncios (ad_metrics_daily) cobrindo a janela de busca. */
export async function coletarGasto(periodo: Periodo): Promise<LinhaAd[]> {
  if (!isSupabaseConfigured())
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados.");
  const { from, to } = janelaDeBusca(periodo);
  const rows = await loadAdMetrics({ from, to });
  if (rows === null) throw new Error("Supabase não configurado.");
  return rows.map((r) => ({
    data_referencia: r.data_referencia,
    canal: r.canal,
    campanha: r.campanha,
    valor_usado: Number(r.valor_usado) || 0,
  }));
}
