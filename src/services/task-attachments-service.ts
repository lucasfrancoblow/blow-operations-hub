// Upload de anexos vai direto navegador -> Supabase Storage via URL assinada (não
// passa pela função serverless, então não sofre o limite de corpo de requisição do
// Vercel). Este serviço só emite/revoga as URLs assinadas e guarda os metadados.

import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";

import { getSessionConfig, type SessionUser } from "@/lib/auth";
import { createSignedUploadUrl, createSignedUrl } from "@/lib/supabase-client";
import {
  TASK_ATTACHMENTS_BUCKET,
  createTaskAttachment,
  deleteTaskAttachment,
  listTaskAttachments,
} from "@/lib/task-attachments-store";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB
// 5min: dá margem tanto pro clique de abrir/baixar quanto pra miniatura de imagem
// ficar visível enquanto o painel de anexos estiver aberto.
const SIGNED_URL_TTL_SECONDS = 300;

async function requireSessionUser(): Promise<SessionUser> {
  const session = await getSession<SessionUser>(getSessionConfig());
  const { id, username, role, tasksAccess } = session.data;
  if (!id || !username || !role) {
    throw new Error("É preciso estar logado.");
  }
  return { id, username, role, tasksAccess: tasksAccess ?? true };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(-140);
}

interface CreateUploadInput {
  taskId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export const createAttachmentUploadFn = createServerFn({ method: "POST" })
  .validator((input: CreateUploadInput) => input)
  .handler(async ({ data }) => {
    await requireSessionUser();
    if (data.sizeBytes > MAX_ATTACHMENT_BYTES) {
      throw new Error(
        `Arquivo maior que o limite de ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB por anexo.`,
      );
    }
    const storagePath = `tasks/${data.taskId}/${randomUUID()}-${sanitizeFileName(data.fileName)}`;
    const uploadUrl = await createSignedUploadUrl(TASK_ATTACHMENTS_BUCKET, storagePath);
    return { storagePath, uploadUrl };
  });

interface ConfirmUploadInput {
  taskId: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export const confirmAttachmentFn = createServerFn({ method: "POST" })
  .validator((input: ConfirmUploadInput) => input)
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    await createTaskAttachment({
      taskId: data.taskId,
      fileName: data.fileName,
      storagePath: data.storagePath,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
      uploadedBy: user.id,
    });
  });

export const listAttachmentsFn = createServerFn({ method: "GET" })
  .validator((input: { taskId: string }) => input)
  .handler(async ({ data }) => {
    await requireSessionUser();
    return listTaskAttachments(data.taskId);
  });

export const getAttachmentUrlFn = createServerFn({ method: "POST" })
  .validator((input: { storagePath: string }) => input)
  .handler(async ({ data }) => {
    await requireSessionUser();
    return createSignedUrl(TASK_ATTACHMENTS_BUCKET, data.storagePath, SIGNED_URL_TTL_SECONDS);
  });

export const deleteAttachmentFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireSessionUser();
    await deleteTaskAttachment(data.id);
  });
