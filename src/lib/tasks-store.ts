// Persistência das tarefas do backlog interno (ver supabase/migrations/0003_create_tasks.sql,
// 0007_create_task_projects.sql e 0008_add_task_assignee_id.sql).

import {
  isSupabaseConfigured,
  supabaseDelete,
  supabaseInsertReturning,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/supabase-client";
import type { Task, TaskInput, TaskPriority, TaskReference, TaskStatus } from "@/types/tasks";

export interface TaskRow {
  id: string;
  task_number: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  project_id: string | null;
  project: { id: string; name: string; color: string } | null;
  assignee_id: string | null;
  assignee: { id: string; username: string } | null;
  tags: string[];
  due_date: string | null;
  reference: TaskReference | null;
  position: number;
  created_at: string;
  updated_at: string;
}

// Embed via PostgREST (funciona porque project_id/assignee_id são FKs de verdade):
// já traz nome do projeto e username do responsável sem join manual no código.
// Exportado: task-tickets-store.ts reusa pra embutir a tarefa vinculada de um chamado.
export const TASK_SELECT = "*,project:task_projects(id,name,color),assignee:app_users(id,username)";

export function fromRow(row: TaskRow): Task {
  return {
    id: row.id,
    taskNumber: row.task_number,
    title: row.title,
    description: row.description ?? "",
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    projectId: row.project_id,
    project: row.project,
    assigneeId: row.assignee_id,
    assignee: row.assignee,
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

/**
 * `accessibleProjectIds` — quando informado (usuário "member"), só devolve
 * tarefas sem projeto ("Sem projeto", sempre visível) ou dentro de um desses
 * projetos. `undefined` = sem filtro (admin/super_admin, que veem tudo).
 */
export async function listTasks(accessibleProjectIds?: string[]): Promise<Task[]> {
  if (!isSupabaseConfigured()) return [];
  const filters: Record<string, string> = {
    select: TASK_SELECT,
    order: "position.asc,created_at.asc",
  };
  if (accessibleProjectIds) {
    filters["or"] =
      accessibleProjectIds.length > 0
        ? `(project_id.is.null,project_id.in.(${accessibleProjectIds.join(",")}))`
        : "(project_id.is.null)";
  }
  const rows = await supabaseSelect<TaskRow>("tasks", filters);
  return rows.map(fromRow);
}

export async function getTask(id: string): Promise<Task | null> {
  if (!isSupabaseConfigured()) return null;
  const rows = await supabaseSelect<TaskRow>("tasks", {
    select: TASK_SELECT,
    id: `eq.${id}`,
    limit: "1",
  });
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createTask(input: TaskInput): Promise<Task> {
  requireSupabase();
  const [row] = await supabaseInsertReturning<Record<string, unknown>, TaskRow>(
    "tasks",
    [
      {
        title: input.title,
        description: input.description ?? "",
        status: input.status ?? "Backlog",
        priority: input.priority ?? "Média",
        project_id: input.projectId ?? null,
        assignee_id: input.assigneeId ?? null,
        tags: input.tags ?? [],
        due_date: input.dueDate ?? null,
        reference: input.reference ?? null,
      },
    ],
    { select: TASK_SELECT },
  );
  if (!row) throw new Error("Tarefa criada, mas não foi possível recarregá-la.");
  return fromRow(row);
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<void> {
  requireSupabase();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row["title"] = patch.title;
  if (patch.description !== undefined) row["description"] = patch.description;
  if (patch.status !== undefined) row["status"] = patch.status;
  if (patch.priority !== undefined) row["priority"] = patch.priority;
  if (patch.projectId !== undefined) row["project_id"] = patch.projectId;
  if (patch.assigneeId !== undefined) row["assignee_id"] = patch.assigneeId;
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
