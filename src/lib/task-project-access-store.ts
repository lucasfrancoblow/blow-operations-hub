// Visibilidade por projeto de Tarefas (ver
// supabase/migrations/0014_create_task_project_access.sql). Só "super_admin"
// bypassa isso inteiro (vê tudo sempre) — "admin" continua vendo todas as abas
// (src/lib/page-access.ts), mas pra projetos é tratado igual "member"/"external":
// só super_admin decide quem vê qual projeto.

import {
  isSupabaseConfigured,
  supabaseDeleteWhere,
  supabaseSelect,
  supabaseUpsert,
} from "@/lib/supabase-client";
import { getTask } from "@/lib/tasks-store";
import type { SessionUser } from "@/lib/auth";
import type { Task } from "@/types/tasks";

interface AccessRow {
  project_id: string;
  user_id: string;
}

/** Ids de projeto que esse usuário pode ver (vazio = nenhum, além de "Sem projeto"). */
export async function listAccessibleProjectIds(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<AccessRow>("task_project_access", {
    select: "project_id",
    user_id: `eq.${userId}`,
  });
  return rows.map((r) => r.project_id);
}

/** Só super_admin não tem restrição por projeto (undefined = sem filtro no
 * store que consumir isso); todo o resto — inclusive "admin" — só vê os
 * projetos liberados pra ele — usado por tasks-service.ts e tickets-service.ts. */
export async function accessibleProjectIdsFor(user: SessionUser): Promise<string[] | undefined> {
  if (user.role === "super_admin") return undefined;
  return listAccessibleProjectIds(user.id);
}

/** Ids de usuário liberados pra ver um projeto (pra montar a lista de "quem já tem acesso"). */
export async function listProjectMemberIds(projectId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<AccessRow>("task_project_access", {
    select: "user_id",
    project_id: `eq.${projectId}`,
  });
  return rows.map((r) => r.user_id);
}

/** Barra a ação se `projectId` não estiver entre os projetos liberados pro
 * usuário (só super_admin sempre passa). `null` ("Sem projeto") é sempre
 * permitido — mesma regra usada pra filtrar leitura em tasks-store.ts. Usado
 * por qualquer mutação que crie/mova algo pra dentro de um projeto (tasks,
 * anexos, o próprio projeto) — sem isso, esconder um projeto do menu não
 * impede escrever nele direto pela função de servidor. */
export async function requireAccessibleProject(
  user: SessionUser,
  projectId: string | null,
): Promise<void> {
  if (projectId === null) return;
  const allowed = await accessibleProjectIdsFor(user);
  if (allowed !== undefined && !allowed.includes(projectId)) {
    throw new Error("Você não tem acesso a esse projeto.");
  }
}

/** Busca a tarefa e confere que o usuário tem acesso ao projeto dela — usado
 * antes de qualquer leitura/escrita em uma tarefa específica (ou em algo
 * vinculado a ela, como um anexo) que não passe pelo listTasks já filtrado. */
export async function requireTaskAccess(user: SessionUser, taskId: string): Promise<Task> {
  const task = await getTask(taskId);
  if (!task) throw new Error("Tarefa não encontrada.");
  await requireAccessibleProject(user, task.projectId);
  return task;
}

export async function grantProjectAccess(projectId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabaseUpsert("task_project_access", [{ project_id: projectId, user_id: userId }]);
}

export async function revokeProjectAccess(projectId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabaseDeleteWhere("task_project_access", {
    project_id: `eq.${projectId}`,
    user_id: `eq.${userId}`,
  });
}
