// Persistência dos projetos de Tarefas (ver supabase/migrations/0007_create_task_projects.sql).

import {
  isSupabaseConfigured,
  supabaseSelect,
  supabaseUpdate,
  supabaseUpsert,
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

export async function listTaskProjects(): Promise<TaskProject[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<TaskProjectRow>("task_projects", {
    select: "*",
    order: "created_at.asc",
  });
  return rows.map(fromRow);
}

export async function createTaskProject(input: { name: string; color: string }): Promise<void> {
  requireSupabase();
  await supabaseUpsert("task_projects", [{ name: input.name, color: input.color }]);
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
