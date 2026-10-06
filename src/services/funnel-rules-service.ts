import { createServerFn } from "@tanstack/react-start";

import { requirePageAccess } from "@/lib/session";
import { fetchPipelines, fetchStages, isPipeRunConfigured } from "@/lib/piperun-client";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import {
  createRule,
  deleteRule,
  listRecentRuns,
  listRules,
  updateRule,
  type FunnelRule,
  type FunnelRuleInput,
  type FunnelRuleRun,
  type RuleMode,
} from "@/lib/funnel-rules-store";

export interface StageOption {
  id: number;
  name: string;
}
export interface PipelineOption {
  id: number;
  name: string;
  stages: StageOption[];
}

export interface FunnelRulesData {
  configured: boolean;
  webhookReady: boolean;
  rules: FunnelRule[];
  runs: FunnelRuleRun[];
  pipelines: PipelineOption[];
}

async function loadPipelines(): Promise<PipelineOption[]> {
  const pipelines = await fetchPipelines();
  return Promise.all(
    pipelines.map(async (p) => {
      const stages = await fetchStages(p.id);
      return {
        id: p.id,
        name: p.name,
        stages: [...stages]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((s) => ({ id: s.id, name: s.name })),
      };
    }),
  );
}

export const getFunnelRulesDataFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<FunnelRulesData> => {
    await requirePageAccess("regras-funil");
    const configured = isSupabaseConfigured() && isPipeRunConfigured();
    if (!configured) {
      return { configured, webhookReady: false, rules: [], runs: [], pipelines: [] };
    }
    const [rules, runs, pipelines] = await Promise.all([
      listRules(),
      listRecentRuns(100),
      loadPipelines(),
    ]);
    return {
      configured,
      webhookReady: Boolean(process.env["FUNNEL_RULES_WEBHOOK_SECRET"]),
      rules,
      runs,
      pipelines,
    };
  },
);

/** Confere que as 3 etapas existem no funil escolhido e que a regra faz sentido. */
async function validateRule(input: FunnelRuleInput): Promise<void> {
  if (!input.name.trim()) throw new Error("Dê um nome para a regra.");
  if (input.requiredStageId === input.targetStageId) {
    throw new Error("A etapa obrigatória precisa ser diferente da etapa protegida.");
  }
  if (input.returnStageId === input.targetStageId) {
    throw new Error("O card não pode voltar para a própria etapa protegida.");
  }
  const stages = await fetchStages(input.pipelineId);
  const ids = new Set(stages.map((s) => s.id));
  for (const id of [input.targetStageId, input.requiredStageId, input.returnStageId]) {
    if (!ids.has(id)) throw new Error("Uma das etapas escolhidas não pertence a esse funil.");
  }
}

function sanitize(input: FunnelRuleInput): FunnelRuleInput {
  const mode: RuleMode = input.mode === "ativa" ? "ativa" : "simulacao";
  return {
    ...input,
    name: input.name.trim().slice(0, 120),
    commentText: input.commentText.trim().slice(0, 500),
    mode,
  };
}

export const createFunnelRuleFn = createServerFn({ method: "POST" })
  .validator((input: FunnelRuleInput) => input)
  .handler(async ({ data }) => {
    const user = await requirePageAccess("regras-funil");
    const input = sanitize(data);
    await validateRule(input);
    return createRule(input, user.username);
  });

export const updateFunnelRuleFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; patch: Partial<FunnelRuleInput> }) => input)
  .handler(async ({ data }) => {
    await requirePageAccess("regras-funil");
    const { id, patch } = data;
    // Edição completa (formulário): confere funil/etapas. Liga/desliga e modo mandam só o campo.
    if (patch.pipelineId !== undefined) await validateRule(sanitize(patch as FunnelRuleInput));
    if (patch.name !== undefined) patch.name = patch.name.trim().slice(0, 120);
    if (patch.commentText !== undefined) patch.commentText = patch.commentText.trim().slice(0, 500);
    if (patch.mode !== undefined && patch.mode !== "ativa" && patch.mode !== "simulacao") {
      throw new Error("Modo inválido.");
    }
    await updateRule(id, patch);
  });

export const deleteFunnelRuleFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requirePageAccess("regras-funil");
    await deleteRule(data.id);
  });
