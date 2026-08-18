// Persistência das tarefas do backlog interno (ver supabase/migrations/0003_create_tasks.sql).

import {
  isSupabaseConfigured,
  supabaseDelete,
  supabaseSelect,
  supabaseUpdate,
  supabaseUpsert,
} from "@/lib/supabase-client";
import type { Task, TaskInput, TaskPriority, TaskReference, TaskStatus } from "@/types/tasks";

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  tags: string[];
  due_date: string | null;
  reference: TaskReference | null;
  position: number;
  created_at: string;
  updated_at: string;
}

function fromRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    assignee: row.assignee ?? "",
    tags: row.tags ?? [],
    dueDate: row.due_date,
    reference: row.reference,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireSupabase(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.");
  }
}

export async function listTasks(): Promise<Task[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<TaskRow>("tasks", {
    select: "*",
    order: "position.asc,created_at.asc",
  });
  return rows.map(fromRow);
}

export async function createTask(input: TaskInput): Promise<void> {
  requireSupabase();
  await supabaseUpsert("tasks", [
    {
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "Backlog",
      priority: input.priority ?? "Média",
      assignee: input.assignee ?? "",
      tags: input.tags ?? [],
      due_date: input.dueDate ?? null,
      reference: input.reference ?? null,
    },
  ]);
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<void> {
  requireSupabase();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row["title"] = patch.title;
  if (patch.description !== undefined) row["description"] = patch.description;
  if (patch.status !== undefined) row["status"] = patch.status;
  if (patch.priority !== undefined) row["priority"] = patch.priority;
  if (patch.assignee !== undefined) row["assignee"] = patch.assignee;
  if (patch.tags !== undefined) row["tags"] = patch.tags;
  if (patch.dueDate !== undefined) row["due_date"] = patch.dueDate;
  if (patch.reference !== undefined) row["reference"] = patch.reference;
  await supabaseUpdate("tasks", id, row);
}

/** Atualiza status + posição de várias tarefas de uma vez (drag and drop entre colunas). */
export async function reorderTasks(
  updates: Array<{ id: string; status: TaskStatus; position: number }>,
): Promise<void> {
  requireSupabase();
  await Promise.all(
    updates.map((u) =>
      supabaseUpdate("tasks", u.id, {
        status: u.status,
        position: u.position,
        updated_at: new Date().toISOString(),
      }),
    ),
  );
}

export async function deleteTask(id: string): Promise<void> {
  requireSupabase();
  await supabaseDelete("tasks", id);
}
