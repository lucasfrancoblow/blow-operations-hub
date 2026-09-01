// Persistência de comentários de tarefa (ver supabase/migrations/0018_create_task_comments.sql).
// Mesmo padrão de task-attachments-store.ts.

import {
  isSupabaseConfigured,
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
