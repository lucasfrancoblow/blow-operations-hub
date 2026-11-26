// Coleta do relatório comercial: PipeRun (ao vivo) e ligações da 3C Plus já sincronizadas
// em call_metrics_daily (o job das 03:00 grava o dia anterior). Cada fonte falha sozinha:
// quem chama mostra "indisponível" em vez de um número errado.

import { loadCallMetrics, type CallMetricRow } from "@/lib/call-metrics";
import {
  fetchDealsByIds,
  fetchDealsClosedInRange,
  fetchLostReasons,
  fetchStageEntradasInRange,
  fetchStages,
  fetchUsers,
  isPipeRunConfigured,
} from "@/lib/piperun-client";
import { ehCardDeTeste } from "@/lib/relatorio-funil-b2b/eventos";
import {
  FUNIL_POR_ID,
  FUNIS,
  type Entrada,
  type Fechado,
  type FunilChave,
  type InfoNegocio,
  type Janela,
} from "./calculo";

export interface DadosPipeRun {
  etapas: Record<FunilChave, Array<{ id: number; nome: string }>>;
  entradas: Entrada[];
  negocios: Map<number, InfoNegocio>;
  fechados: Fechado[];
}

export async function coletarLigacoes(mes: Janela): Promise<CallMetricRow[]> {
  const dados = await loadCallMetrics(mes);
  if (dados === null) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados.");
  return dados.rows;
}

export async function coletarPipeRun(mes: Janela): Promise<DadosPipeRun> {
  if (!isPipeRunConfigured()) throw new Error("PIPERUN_API_KEY não configurada.");
  const chaves = Object.keys(FUNIS) as FunilChave[];

  const [listasEtapas, historico, fechadosBrutos, usuarios, motivos] = await Promise.all([
    Promise.all(chaves.map((k) => fetchStages(FUNIS[k].id))),
    fetchStageEntradasInRange(mes.from, mes.to),
    fetchDealsClosedInRange(mes.from, mes.to),
    fetchUsers(),
    fetchLostReasons(),
  ]);

  const etapas = {} as DadosPipeRun["etapas"];
  const etapaDoFunil = new Map<number, FunilChave>();
  chaves.forEach((k, i) => {
    const lista = [...listasEtapas[i]!].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    etapas[k] = lista.map((e) => ({ id: e.id, nome: e.name }));
    for (const e of lista) etapaDoFunil.set(e.id, k);
  });

  const nomeUsuario = new Map(usuarios.map((u) => [u.id, u.name] as const));
  const nomeMotivo = new Map(motivos.map((m) => [m.id, m.name] as const));
  const dono = (id: number | null) => (id ? (nomeUsuario.get(id) ?? `Usuário ${id}`) : "Sem dono");

  const doFunil = historico.filter(
    (h) => etapaDoFunil.has(h.in_stage_id) && !(h as { deleted_at?: string | null }).deleted_at,
  );
  const ids = [...new Set(doFunil.map((h) => h.deal_id))];
  const deals = await fetchDealsByIds(ids);

  const negocios = new Map<number, InfoNegocio>();
  for (const d of deals) {
    const funil = FUNIL_POR_ID[d.pipeline_id];
    if (!funil || ehCardDeTeste(d.title ?? "")) continue;
    negocios.set(d.id, { funil, dono: dono(d.owner_id) });
  }

  // O dono é o ATUAL do negócio (o histórico de etapa não diz quem moveu).
  const entradas: Entrada[] = doFunil
    .filter((h) => negocios.has(h.deal_id))
    .map((h) => ({ dealId: h.deal_id, stageId: h.in_stage_id, dia: h.in_date.slice(0, 10) }));

  const fechados: Fechado[] = [];
  for (const d of fechadosBrutos) {
    const funil = FUNIL_POR_ID[d.pipeline_id];
    if (!funil || !d.closed_at || ehCardDeTeste(d.title ?? "")) continue;
    if (d.status !== 1 && d.status !== 3) continue;
    const motivo = d.lost_reason_id ? (nomeMotivo.get(d.lost_reason_id) ?? null) : null;
    if (motivo && /^teste?$/i.test(motivo.trim())) continue; // card de teste perdido como "Teste"
    fechados.push({
      dealId: d.id,
      funil,
      dono: dono(d.owner_id),
      ganho: d.status === 1,
      motivo,
      dia: d.closed_at.slice(0, 10),
    });
  }

  return { etapas, entradas, negocios, fechados };
}
