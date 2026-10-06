// Motor das regras do funil: chamado quando o PipeRun avisa (webhook deal_moved) que um
// negócio mudou de etapa. Sempre decide em cima do estado REAL do negócio na API do
// PipeRun — o corpo do webhook só diz "olhe o negócio X", nunca é confiado.

import {
  addDealNote,
  fetchDealById,
  fetchDealStageHistory,
  moveDealToStage,
} from "@/lib/piperun-client";
import {
  listActiveRulesFor,
  listRunsForDeal,
  recordRun,
  type FunnelRule,
} from "@/lib/funnel-rules-store";

// Webhooks do PipeRun podem chegar em duplicidade; um mesmo negócio+regra não é
// reprocessado dentro dessa janela.
const DEDUPE_WINDOW_MS = 2 * 60 * 1000;

export type CheckResult =
  | { status: "ignorado"; reason: string }
  | { status: "ok" }
  | { status: "violacao"; applied: boolean };

export async function checkDealMove(dealId: number): Promise<CheckResult> {
  const deal = await fetchDealById(dealId);
  if (!deal) return { status: "ignorado", reason: "negócio não encontrado no PipeRun" };
  if (deal.status !== 0) return { status: "ignorado", reason: "negócio não está aberto" };

  const rules = await listActiveRulesFor(deal.pipeline_id, deal.stage_id);
  if (rules.length === 0) return { status: "ignorado", reason: "nenhuma regra para essa etapa" };

  const history = await fetchDealStageHistory(dealId);
  let worst: CheckResult = { status: "ok" };

  for (const rule of rules) {
    const result = await applyRule(rule, deal.id, deal.title, deal.pipeline_id, history);
    if (result.status === "violacao") worst = result;
  }
  return worst;
}

async function applyRule(
  rule: FunnelRule,
  dealId: number,
  dealTitle: string,
  pipelineId: number,
  history: Awaited<ReturnType<typeof fetchDealStageHistory>>,
): Promise<CheckResult> {
  const previousRuns = await listRunsForDeal(rule.id, dealId);

  const last = previousRuns[0];
  if (last && Date.now() - new Date(last.createdAt).getTime() < DEDUPE_WINDOW_MS) {
    return { status: "ignorado", reason: "já tratado há instantes" };
  }

  // Regra "uma vez só": se o hub já devolveu esse card por essa regra, a segunda tentativa
  // passa — o aviso já foi dado e quem decide é o time.
  if (previousRuns.some((r) => r.outcome === "devolvido")) return { status: "ok" };

  if (history.some((h) => h.in_stage_id === rule.requiredStageId)) return { status: "ok" };

  if (rule.mode === "simulacao") {
    await recordRun({
      ruleId: rule.id,
      ruleName: rule.name,
      dealId,
      dealTitle,
      outcome: "violacao_simulada",
      detail: "Pulou a etapa obrigatória. Modo simulação: nada foi alterado no PipeRun.",
    });
    return { status: "violacao", applied: false };
  }

  try {
    await moveDealToStage(dealId, pipelineId, rule.returnStageId);
    if (rule.addComment) {
      try {
        await addDealNote(dealId, rule.commentText);
      } catch {
        // O comentário é só aviso; o importante (devolver o card) já foi feito.
      }
    }
    await recordRun({
      ruleId: rule.id,
      ruleName: rule.name,
      dealId,
      dealTitle,
      outcome: "devolvido",
      detail: "Pulou a etapa obrigatória e foi devolvido.",
    });
    return { status: "violacao", applied: true };
  } catch (error) {
    await recordRun({
      ruleId: rule.id,
      ruleName: rule.name,
      dealId,
      dealTitle,
      outcome: "erro",
      detail: error instanceof Error ? error.message : "Erro desconhecido ao devolver o card.",
    });
    return { status: "violacao", applied: false };
  }
}
