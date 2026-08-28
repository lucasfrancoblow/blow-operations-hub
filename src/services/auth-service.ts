// Login/logout e gestão de usuários. Sem cadastro público: só o super admin cria
// conta pela tela "Usuários" (ver src/routes/usuarios.tsx). Sessão é o cookie selado
// que o próprio TanStack Start gerencia (ver getSessionConfig em @/lib/auth).

import { createServerFn } from "@tanstack/react-start";
import { getSession, updateSession, clearSession } from "@tanstack/react-start/server";

import { getSessionConfig, verifyPassword, type SessionUser, type UserRole } from "@/lib/auth";
import {
  createUser,
  findUserByUsername,
  listUsers,
  setUserActive,
  setUserPassword,
  setUserProfile,
  setUserRole,
  setUserTasksAccess,
} from "@/lib/users-store";

// Só o super admin gerencia usuários (tela "Usuários") — "admin" continua existindo
// só pros outros privilégios que já tinha (ex.: ver a aba Tarefas sempre).
async function requireSuperAdmin(): Promise<SessionUser> {
  const session = await getSession<SessionUser>(getSessionConfig());
  const { id, username, role, tasksAccess } = session.data;
  if (!id || !username || role !== "super_admin") {
    throw new Error("Só o super admin pode fazer isso.");
  }
  return { id, username, role, tasksAccess: tasksAccess ?? true };
}

async function requireUser(): Promise<SessionUser> {
  const session = await getSession<SessionUser>(getSessionConfig());
  const { id, username, role, tasksAccess } = session.data;
  if (!id || !username || !role) {
    throw new Error("É preciso estar logado.");
  }
  return { id, username, role, tasksAccess: tasksAccess ?? true };
}

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    try {
      const session = await getSession<SessionUser>(getSessionConfig());
      const { id, username, role, tasksAccess } = session.data;
      if (!id || !username || !role) return null;
      return { id, username, role, tasksAccess: tasksAccess ?? true };
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
      tasksAccess: user.tasksAccess,
    });
    return { ok: true };
  });

/** Lista mínima de usuários ativos pra alimentar o seletor de responsável nas
 * tarefas — qualquer usuário logado pode ver (não é admin-only como listUsersFn). */
export const listActiveUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  const users = await listUsers();
  return users.filter((u) => u.active).map((u) => ({ id: u.id, username: u.username }));
});

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await clearSession(getSessionConfig());
});

export const listUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireSuperAdmin();
  const users = await listUsers();
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    active: u.active,
    tasksAccess: u.tasksAccess,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    createdAt: u.createdAt,
  }));
});

interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  fullName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
}

export const createUserFn = createServerFn({ method: "POST" })
  .validator((input: CreateUserInput) => input)
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const created = await createUser(data);
    return { id: created.id, username: created.username, role: created.role };
  });

export const setUserProfileFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      fullName?: string | undefined;
      email?: string | undefined;
      phone?: string | undefined;
    }) => input,
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    await setUserProfile(data.id, data);
  });

export const setUserActiveFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; active: boolean }) => input)
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    await setUserActive(data.id, data.active);
  });

export const setTasksAccessFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; tasksAccess: boolean }) => input)
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    await setUserTasksAccess(data.id, data.tasksAccess);
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; password: string }) => input)
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    await setUserPassword(data.id, data.password);
  });

export const setUserRoleFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; role: UserRole }) => input)
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    await setUserRole(data.id, data.role);
  });
