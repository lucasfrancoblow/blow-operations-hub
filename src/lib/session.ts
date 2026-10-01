// Leitura do usuário logado a partir do cookie de sessão — usado pelos serviços
// (server functions) que precisam saber quem está pedindo, além do próprio
// auth-service.ts (login/logout/gestão de usuários). Server-only.

import { getSession, updateSession } from "@tanstack/react-start/server";

import { getSessionConfig, type SessionUser } from "@/lib/auth";
import { canAccessPage, type PageKey } from "@/lib/page-access";

// A expiração da sessão é "criada em + duração" e o h3 não a estende sozinho a cada uso.
// Para o login nunca vencer enquanto a pessoa usa o hub, reemitimos o cookie (com nova
// data de criação) quando a sessão tem mais que isso.
const RENEW_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

async function renewSessionIfOld(session: { createdAt: number }) {
  if (!session.createdAt || Date.now() - session.createdAt < RENEW_AFTER_MS) return;
  try {
    session.createdAt = Date.now();
    await updateSession<SessionUser>(getSessionConfig());
  } catch (error) {
    // Falha ao renovar não pode deslogar quem tem sessão válida.
    console.error("Falha ao renovar a sessão:", error);
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession<SessionUser>(getSessionConfig());
  const { id, username, fullName, role, pageAccess } = session.data;
  if (!id || !username || !role) return null;
  await renewSessionIfOld(session);
  return { id, username, fullName: fullName ?? null, role, pageAccess: pageAccess ?? [] };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("É preciso estar logado.");
  return user;
}

/** Usado por qualquer server function ligada a uma aba controlável (leads,
 * funil, ligações, campanhas) — fecha a brecha de hoje onde esconder a aba no
 * menu não impedia chamar a função direto. */
export async function requirePageAccess(key: PageKey): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (!canAccessPage(user, key)) {
    throw new Error("Você não tem acesso a essa página.");
  }
  return user;
}
