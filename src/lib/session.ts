// Leitura do usuário logado a partir do cookie de sessão — usado pelos serviços
// (server functions) que precisam saber quem está pedindo, além do próprio
// auth-service.ts (login/logout/gestão de usuários). Server-only.

import { getSession } from "@tanstack/react-start/server";

import { getSessionConfig, type SessionUser } from "@/lib/auth";
import { canAccessPage } from "@/lib/page-access";

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession<SessionUser>(getSessionConfig());
  const { id, username, role, pageAccess } = session.data;
  if (!id || !username || !role) return null;
  return { id, username, role, pageAccess: pageAccess ?? [] };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("É preciso estar logado.");
  return user;
}

/** Usado por qualquer server function ligada a Tarefas (tasks, projetos, anexos)
 * — fecha a brecha de hoje onde esconder a aba no menu não impedia chamar a
 * função direto. */
export async function requireTasksAccess(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (!canAccessPage(user, "tarefas")) {
    throw new Error("Você não tem acesso a Tarefas.");
  }
  return user;
}
