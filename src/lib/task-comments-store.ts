// Persistência de comentários de tarefa (ver supabase/migrations/0018_create_task_comments.sql).
// Mesmo padrão de task-attachments-store.ts.

import {
  isSupabaseConfigured,
  supabaseDelete,
  supabaseInsertReturning,
  supabaseSelect,
} from "@/lib/supabase-client";
import type { TaskComment } from "@/types/comments";

interface CommentRow {
  id: string;
  task_id: string;
  author_id: string | null;
  author: { id: string; username: string; full_name: string | null } | null;
  body: string;
  created_at: string;
}

const COMMENT_SELECT = "*,author:app_users(id,username,full_name)";

function fromRow(row: CommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    author: row.author
      ? { id: row.author.id, username: row.author.username, fullName: row.author.full_name }
      : null,
    body: row.body,
    createdAt: row.created_at,
  };
}

function requireSupabase(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.");
  }
}

/** Nº de comentários de várias tarefas de uma vez (1 query, não 1 por card) —
 * usado por tasks-store.ts pra badge de comentários no board inteiro. */
export async function countCommentsForTasks(taskIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (taskIds.length === 0 || !isSupabaseConfigured()) return counts;
  const rows = await supabaseSelect<{ task_id: string }>("task_comments", {
    select: "task_id",
    task_id: `in.(${taskIds.join(",")})`,
  });
  for (const row of rows) counts[row.task_id] = (counts[row.task_id] ?? 0) + 1;
  return counts;
}

export async function listComments(taskId: string): Promise<TaskComment[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<CommentRow>("task_comments", {
    select: COMMENT_SELECT,
    task_id: `eq.${taskId}`,
    order: "created_at.asc",
  });
  return rows.map(fromRow);
}

export async function createComment(input: {
  taskId: string;
  authorId: string | null;
  body: string;
}): Promise<TaskComment> {
  requireSupabase();
  const [row] = await supabaseInsertReturning<Record<string, unknown>, CommentRow>(
    "task_comments",
    [{ task_id: input.taskId, author_id: input.authorId, body: input.body }],
    { select: COMMENT_SELECT },
  );
  if (!row) throw new Error("Comentário criado, mas não foi possível recarregá-lo.");
  return fromRow(row);
}

export async function getComment(id: string): Promise<TaskComment | null> {
  if (!isSupabaseConfigured()) return null;
  const rows = await supabaseSelect<CommentRow>("task_comments", {
    select: COMMENT_SELECT,
    id: `eq.${id}`,
    limit: "1",
  });
  return rows[0] ? fromRow(rows[0]) : null;
}

/** Diferente de arquivar tarefa: comentário excluído some de verdade (DELETE
 * físico) — é um item pequeno e a UI já confirma antes de chamar isso. */
export async function deleteComment(id: string): Promise<void> {
  requireSupabase();
  await supabaseDelete("task_comments", id);
}
