// Login/logout e gestão de usuários. Sem cadastro público: só um admin cria conta
// pela tela "Usuários" (ver src/routes/usuarios.tsx). Sessão é o cookie selado que o
// próprio TanStack Start gerencia (ver getSessionConfig em @/lib/auth).

import { createServerFn } from "@tanstack/react-start";
import { getSession, updateSession, clearSession } from "@tanstack/react-start/server";

import { getSessionConfig, verifyPassword, type SessionUser, type UserRole } from "@/lib/auth";
import {
  createUser,
  findUserByUsername,
  listUsers,
  setUserActive,
  setUserPassword,
} from "@/lib/users-store";

async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession<SessionUser>(getSessionConfig());
  const { id, username, role } = session.data;
  if (!id || !username || role !== "admin") {
    throw new Error("Só um admin pode fazer isso.");
  }
  return { id, username, role };
}

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    try {
      const session = await getSession<SessionUser>(getSessionConfig());
      const { id, username, role } = session.data;
      if (!id || !username || !role) return null;
      return { id, username, role };
    } catch {
      return null;
    }
  },
);

export const loginFn = createServerFn({ method: "POST" })
  .validator((input: { username: string; password: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const user = await findUserByUsername(data.username);
    if (!user || !user.active || !verifyPassword(data.password, user.passwordHash)) {
      return { ok: false, error: "Usuário ou senha inválidos." };
    }
    await updateSession<SessionUser>(getSessionConfig(), {
      id: user.id,
      username: user.username,
      role: user.role,
    });
    return { ok: true };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await clearSession(getSessionConfig());
});

export const listUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const users = await listUsers();
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
  }));
});

export const createUserFn = createServerFn({ method: "POST" })
  .validator((input: { username: string; password: string; role: UserRole }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    const created = await createUser(data);
    return { id: created.id, username: created.username, role: created.role };
  });

export const setUserActiveFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; active: boolean }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    await setUserActive(data.id, data.active);
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; password: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    await setUserPassword(data.id, data.password);
  });
