// Visibilidade por projeto de Tarefas (ver
// supabase/migrations/0014_create_task_project_access.sql). admin/super_admin
// bypassam isso inteiro (ver src/lib/page-access.ts) — só "member" precisa de
// linha aqui pra enxergar um projeto.

import {
  isSupabaseConfigured,
  supabaseDeleteWhere,
  supabaseSelect,
  supabaseUpsert,
} from "@/lib/supabase-client";
import type { SessionUser } from "@/lib/auth";

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

/** admin/super_admin não têm restrição por projeto (undefined = sem filtro no
 * store que consumir isso); "member" só vê os projetos liberados pra ele —
 * usado por tasks-service.ts e tickets-service.ts. */
export async function accessibleProjectIdsFor(user: SessionUser): Promise<string[] | undefined> {
  if (user.role === "admin" || user.role === "super_admin") return undefined;
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
