// Regras do funil e histórico de execuções (ver supabase/migrations/0032_create_funnel_rules.sql).

import {
  isSupabaseConfigured,
  supabaseDelete,
  supabaseInsertReturning,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/supabase-client";

export type RuleMode = "simulacao" | "ativa";
export type RunOutcome = "violacao_simulada" | "devolvido" | "erro";

export interface FunnelRule {
  id: string;
  name: string;
  pipelineId: number;
  targetStageId: number;
  requiredStageId: number;
  returnStageId: number;
  addComment: boolean;
  commentText: string;
  mode: RuleMode;
  enabled: boolean;
  createdAt: string;
}

export type FunnelRuleInput = Omit<FunnelRule, "id" | "createdAt">;

export interface FunnelRuleRun {
  id: string;
  ruleId: string | null;
  ruleName: string;
  dealId: number;
  dealTitle: string | null;
  outcome: RunOutcome;
  detail: string | null;
  createdAt: string;
}

interface RuleRow {
  id: string;
  name: string;
  pipeline_id: number;
  target_stage_id: number;
  required_stage_id: number;
  return_stage_id: number;
  add_comment: boolean;
  comment_text: string;
  mode: RuleMode;
  enabled: boolean;
  created_at: string;
}

interface RunRow {
  id: string;
  rule_id: string | null;
  rule_name: string;
  deal_id: number;
  deal_title: string | null;
  outcome: RunOutcome;
  detail: string | null;
  created_at: string;
}

const RULES = "funnel_rules";
const RUNS = "funnel_rule_runs";

function toRule(r: RuleRow): FunnelRule {
  return {
    id: r.id,
    name: r.name,
    pipelineId: Number(r.pipeline_id),
    targetStageId: Number(r.target_stage_id),
    requiredStageId: Number(r.required_stage_id),
    returnStageId: Number(r.return_stage_id),
    addComment: r.add_comment,
    commentText: r.comment_text,
    mode: r.mode,
    enabled: r.enabled,
    createdAt: r.created_at,
  };
}

function toRow(input: Partial<FunnelRuleInput>): Partial<RuleRow> {
  const row: Partial<RuleRow> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.pipelineId !== undefined) row.pipeline_id = input.pipelineId;
  if (input.targetStageId !== undefined) row.target_stage_id = input.targetStageId;
  if (input.requiredStageId !== undefined) row.required_stage_id = input.requiredStageId;
  if (input.returnStageId !== undefined) row.return_stage_id = input.returnStageId;
  if (input.addComment !== undefined) row.add_comment = input.addComment;
  if (input.commentText !== undefined) row.comment_text = input.commentText;
  if (input.mode !== undefined) row.mode = input.mode;
  if (input.enabled !== undefined) row.enabled = input.enabled;
  return row;
}

function toRun(r: RunRow): FunnelRuleRun {
  return {
    id: r.id,
    ruleId: r.rule_id,
    ruleName: r.rule_name,
    dealId: Number(r.deal_id),
    dealTitle: r.deal_title,
    outcome: r.outcome,
    detail: r.detail,
    createdAt: r.created_at,
  };
}

export async function listRules(): Promise<FunnelRule[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<RuleRow>(RULES, { select: "*", order: "created_at.asc" });
  return rows.map(toRule);
}

/** Regras ligadas que protegem essa etapa daquele funil. */
export async function listActiveRulesFor(
  pipelineId: number,
  targetStageId: number,
): Promise<FunnelRule[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<RuleRow>(RULES, {
    select: "*",
    pipeline_id: `eq.${pipelineId}`,
    target_stage_id: `eq.${targetStageId}`,
    enabled: "eq.true",
  });
  return rows.map(toRule);
}

export async function createRule(input: FunnelRuleInput, createdBy: string): Promise<FunnelRule> {
  const [row] = await supabaseInsertReturning<Partial<RuleRow> & { created_by: string }, RuleRow>(
    RULES,
    [{ ...toRow(input), created_by: createdBy }],
  );
  return toRule(row!);
}

export async function updateRule(id: string, patch: Partial<FunnelRuleInput>): Promise<void> {
  await supabaseUpdate<Partial<RuleRow> & { updated_at: string }>(RULES, id, {
    ...toRow(patch),
    updated_at: new Date().toISOString(),
  });
}

export async function deleteRule(id: string): Promise<void> {
  await supabaseDelete(RULES, id);
}

export async function listRecentRuns(limit = 100): Promise<FunnelRuleRun[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<RunRow>(RUNS, {
    select: "*",
    order: "created_at.desc",
    limit: String(limit),
  });
  return rows.slice(0, limit).map(toRun);
}

/** Execuções de uma regra pra um negócio (mais recentes primeiro). */
export async function listRunsForDeal(ruleId: string, dealId: number): Promise<FunnelRuleRun[]> {
  const rows = await supabaseSelect<RunRow>(RUNS, {
    select: "*",
    rule_id: `eq.${ruleId}`,
    deal_id: `eq.${dealId}`,
    order: "created_at.desc",
  });
  return rows.map(toRun);
}

export async function recordRun(run: Omit<FunnelRuleRun, "id" | "createdAt">): Promise<void> {
  await supabaseInsertReturning<RunRowInsert>(RUNS, [
    {
      rule_id: run.ruleId,
      rule_name: run.ruleName,
      deal_id: run.dealId,
      deal_title: run.dealTitle,
      outcome: run.outcome,
      detail: run.detail,
    },
  ]);
}

type RunRowInsert = Omit<RunRow, "id" | "created_at">;
