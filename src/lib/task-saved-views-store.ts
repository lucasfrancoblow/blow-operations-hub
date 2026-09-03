// Views salvas de filtros do board (ver supabase/migrations/0028_create_task_saved_views.sql).
// Por usuário — não é compartilhado entre o time.

import {
  isSupabaseConfigured,
  supabaseDelete,
  supabaseInsertReturning,
  supabaseSelect,
} from "@/lib/supabase-client";
import type { TaskSavedView, TaskSavedViewFilters } from "@/types/tasks";

interface SavedViewRow {
  id: string;
  name: string;
  filters: TaskSavedViewFilters;
  created_at: string;
}

function fromRow(row: SavedViewRow): TaskSavedView {
  return { id: row.id, name: row.name, filters: row.filters ?? {}, createdAt: row.created_at };
}

export async function listSavedViews(userId: string): Promise<TaskSavedView[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<SavedViewRow>("task_saved_views", {
    select: "*",
    user_id: `eq.${userId}`,
    order: "created_at.asc",
  });
  return rows.map(fromRow);
}

export async function createSavedView(
  userId: string,
  name: string,
  filters: TaskSavedViewFilters,
): Promise<TaskSavedView> {
  const [row] = await supabaseInsertReturning<Record<string, unknown>, SavedViewRow>(
    "task_saved_views",
    [{ user_id: userId, name, filters }],
  );
  if (!row) throw new Error("View criada, mas não foi possível recarregá-la.");
  return fromRow(row);
}

export async function deleteSavedView(id: string): Promise<void> {
  await supabaseDelete("task_saved_views", id);
}
