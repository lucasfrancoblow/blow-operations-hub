// Persistência dos projetos de Tarefas (ver supabase/migrations/0007_create_task_projects.sql).

import {
  isSupabaseConfigured,
  supabaseInsertReturning,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/supabase-client";
import type { TaskProject } from "@/types/tasks";

interface TaskProjectRow {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

function fromRow(row: TaskProjectRow): TaskProject {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireSupabase(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.");
  }
}

/** `accessibleProjectIds` — quando informado (usuário "member"), só devolve os
 * projetos liberados pra ele. `undefined` = sem filtro (admin/super_admin). */
export async function listTaskProjects(accessibleProjectIds?: string[]): Promise<TaskProject[]> {
  if (!isSupabaseConfigured()) return [];
  if (accessibleProjectIds && accessibleProjectIds.length === 0) return [];
  const filters: Record<string, string> = { select: "*", order: "created_at.asc" };
  if (accessibleProjectIds) {
    filters["id"] = `in.(${accessibleProjectIds.join(",")})`;
  }
  const rows = await supabaseSelect<TaskProjectRow>("task_projects", filters);
  return rows.map(fromRow);
}

export async function createTaskProject(input: {
  name: string;
  color: string;
}): Promise<TaskProject> {
  requireSupabase();
  const [row] = await supabaseInsertReturning<{ name: string; color: string }, TaskProjectRow>(
    "task_projects",
    [{ name: input.name, color: input.color }],
  );
  if (!row) throw new Error("Projeto criado, mas não foi possível recarregá-lo.");
  return fromRow(row);
}

export async function updateTaskProject(
  id: string,
  patch: Partial<{ name: string; color: string; archived: boolean }>,
): Promise<void> {
  requireSupabase();
  await supabaseUpdate("task_projects", id, {
    ...patch,
    updated_at: new Date().toISOString(),
  });
}
