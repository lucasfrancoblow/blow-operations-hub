// Persistência dos anexos de tarefas (ver supabase/migrations/0009_create_task_attachments.sql).
// Os bytes do arquivo em si vivem no Supabase Storage (bucket "task-attachments");
// esta tabela só guarda os metadados.

import {
  deleteStorageObject,
  isSupabaseConfigured,
  supabaseDelete,
  supabaseSelect,
  supabaseUpsert,
} from "@/lib/supabase-client";
import type { TaskAttachment } from "@/types/tasks";

export const TASK_ATTACHMENTS_BUCKET = "task-attachments";

interface TaskAttachmentRow {
  id: string;
  task_id: string;
  file_name: string;
  storage_path: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  uploader: { id: string; username: string } | null;
  created_at: string;
}

const ATTACHMENT_SELECT = "*,uploader:app_users(id,username)";

function fromRow(row: TaskAttachmentRow): TaskAttachment {
  return {
    id: row.id,
    taskId: row.task_id,
    fileName: row.file_name,
    storagePath: row.storage_path,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploader,
    createdAt: row.created_at,
  };
}

function requireSupabase(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.");
  }
}

export async function listTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<TaskAttachmentRow>("task_attachments", {
    select: ATTACHMENT_SELECT,
    task_id: `eq.${taskId}`,
    order: "created_at.asc",
  });
  return rows.map(fromRow);
}

export async function getTaskAttachment(id: string): Promise<TaskAttachment | null> {
  if (!isSupabaseConfigured()) return null;
  const rows = await supabaseSelect<TaskAttachmentRow>("task_attachments", {
    select: ATTACHMENT_SELECT,
    id: `eq.${id}`,
    limit: "1",
  });
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createTaskAttachment(input: {
  taskId: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string | null;
}): Promise<void> {
  requireSupabase();
  await supabaseUpsert("task_attachments", [
    {
      task_id: input.taskId,
      file_name: input.fileName,
      storage_path: input.storagePath,
      content_type: input.contentType,
      size_bytes: input.sizeBytes,
      uploaded_by: input.uploadedBy,
    },
  ]);
}

export async function deleteTaskAttachment(id: string): Promise<void> {
  requireSupabase();
  const attachment = await getTaskAttachment(id);
  if (!attachment) return;
  await deleteStorageObject(TASK_ATTACHMENTS_BUCKET, attachment.storagePath);
  await supabaseDelete("task_attachments", id);
}
