// Configuração por coluna do board (ver supabase/migrations/0027_create_task_board_settings.sql):
// limite de WIP e limiar de "envelhecendo" por status.

import { isSupabaseConfigured, supabaseSelect, supabaseUpdateWhere } from "@/lib/supabase-client";
import { TASK_STATUSES, type TaskBoardSettings, type TaskStatus } from "@/types/tasks";

interface SettingsRow {
  status: string;
  wip_limit: number | null;
  aging_threshold_days: number | null;
}

function fromRow(row: SettingsRow): TaskBoardSettings {
  return {
    status: row.status as TaskStatus,
    wipLimit: row.wip_limit,
    agingThresholdDays: row.aging_threshold_days,
  };
}

/** Sempre devolve uma linha por status, mesmo que a tabela ainda não tenha
 * sido semeada num ambiente novo (fallback = sem limite/sem aviso). */
export async function getBoardSettings(): Promise<TaskBoardSettings[]> {
  if (!isSupabaseConfigured()) {
    return TASK_STATUSES.map((status) => ({ status, wipLimit: null, agingThresholdDays: null }));
  }
  const rows = await supabaseSelect<SettingsRow>("task_board_settings", { select: "*" });
  const byStatus = new Map(rows.map((r) => [r.status, fromRow(r)]));
  return TASK_STATUSES.map(
    (status) => byStatus.get(status) ?? { status, wipLimit: null, agingThresholdDays: null },
  );
}

export async function updateBoardSettings(
  status: TaskStatus,
  patch: Partial<Pick<TaskBoardSettings, "wipLimit" | "agingThresholdDays">>,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const row: Record<string, unknown> = {};
  if (patch.wipLimit !== undefined) row["wip_limit"] = patch.wipLimit;
  if (patch.agingThresholdDays !== undefined)
    row["aging_threshold_days"] = patch.agingThresholdDays;
  await supabaseUpdateWhere("task_board_settings", { status: `eq.${status}` }, row);
}
