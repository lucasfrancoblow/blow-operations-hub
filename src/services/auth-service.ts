// Login/logout e gestão de usuários. Sem cadastro público: só o super admin cria
// conta pela tela "Usuários" (ver src/routes/usuarios.tsx). Sessão é o cookie selado
// que o próprio TanStack Start gerencia (ver getSessionConfig em @/lib/auth).

import { createServerFn } from "@tanstack/react-start";
import { updateSession, clearSession } from "@tanstack/react-start/server";

import { getSessionConfig, verifyPassword, type SessionUser, type UserRole } from "@/lib/auth";
import { getSessionUser, requireSessionUser } from "@/lib/session";
import { escapeHtml } from "@/lib/html";
import { logAuditEvent } from "@/lib/audit-log-store";
import { sendEmail } from "@/lib/resend-client";
import { renderEmailTemplate } from "@/lib/email-template";
import {
  clearFailedLogins,
  createUser,
  findUserById,
  findUserByUsername,
  listUsers,
  registerFailedLogin,
  setUserActive,
  setUserPageAccess,
  setUserPassword,
  setUserProfile,
  setUserRole,
} from "@/lib/users-store";

/** Avisa os super_admin sempre que alguém troca papel/senha/ativação de uma
 * conta — antes era silencioso (best-effort: sendEmail nunca lança). */
async function notifyAdminsOfAccountChange(
  actor: SessionUser,
  targetUsername: string,
  summary: string,
): Promise<void> {
  const users = await listUsers();
  const recipients = users.filter((u) => u.role === "super_admin" && u.email).map((u) => u.email!);
  await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `Alteração de conta: ${targetUsername}`,
        html: renderEmailTemplate({
          eyebrow: "Alteração de conta",
          heading: summary,
          intro: `Feito por ${escapeHtml(actor.fullName ?? actor.username)}.`,
          footerText: "Você recebeu este e-mail porque é super admin no hubLOw.",
        }),
      }),
    ),
  );
}

// Só o super admin gerencia usuários (tela "Usuários") — "admin" continua existindo
// só pros outros privilégios que já tinha (ex.: ver todas as abas/projetos sempre).
async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (user.role !== "super_admin") {
    throw new Error("Só o super admin pode fazer isso.");
  }
  return user;
}

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    try {
      return await getSessionUser();
    } catch {
      return null;
    }
  },
);

export const loginFn = createServerFn({ method: "POST" })
  .validator((input: { username: string; password: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const user = await findUserByUsername(data.username);
    if (!user || !user.active) {
      return { ok: false, error: "Usuário ou senha inválidos." };
    }

    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      const minutesLeft = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60_000);
      return {
        ok: false,
        error: `Conta bloqueada por muitas tentativas erradas. Tente de novo em ${minutesLeft} min.`,
      };
    }

    if (!verifyPassword(data.password, user.passwordHash)) {
      await registerFailedLogin(user.id, user.failedLoginAttempts);
      return { ok: false, error: "Usuário ou senha inválidos." };
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) await clearFailedLogins(user.id);

    await updateSession<SessionUser>(getSessionConfig(), {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      pageAccess: user.pageAccess,
    });
    return { ok: true };
  });

/** Lista mínima de usuários ativos pra alimentar o seletor de responsável nas
 * tarefas — qualquer usuário logado pode ver (não é admin-only como listUsersFn). */
export const listActiveUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireSessionUser();
  const users = await listUsers();
  return users
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, username: u.username, fullName: u.fullName }));
});

/** Nome/e-mail do próprio usuário logado — usado pra pré-preencher o formulário
 * de abrir chamado (não expõe nada além disso, ao contrário de listUsersFn). */
export const getMyProfileFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSessionUser();
  const profile = await findUserById(session.id);
  return { fullName: profile?.fullName ?? null, email: profile?.email ?? null };
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
    pageAccess: u.pageAccess,
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
    const actor = await requireSuperAdmin();
    await setUserActive(data.id, data.active);
    const target = await findUserById(data.id);
    if (!target) return;
    await logAuditEvent({
      actorId: actor.id,
      action: data.active ? "user_activated" : "user_deactivated",
      targetUserId: data.id,
    });
    await notifyAdminsOfAccountChange(
      actor,
      target.username,
      `Usuário ${target.username} foi ${data.active ? "reativado" : "desativado"}`,
    );
  });

export const setUserPageAccessFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; pageAccess: string[] }) => input)
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    await setUserPageAccess(data.id, data.pageAccess);
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; password: string }) => input)
  .handler(async ({ data }) => {
    const actor = await requireSuperAdmin();
    await setUserPassword(data.id, data.password);
    const target = await findUserById(data.id);
    if (!target) return;
    await logAuditEvent({ actorId: actor.id, action: "password_reset", targetUserId: data.id });
    await notifyAdminsOfAccountChange(
      actor,
      target.username,
      `Senha de ${target.username} foi redefinida`,
    );
  });

export const setUserRoleFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; role: UserRole }) => input)
  .handler(async ({ data }) => {
    const actor = await requireSuperAdmin();
    const before = await findUserById(data.id);
    await setUserRole(data.id, data.role);
    if (!before) return;
    await logAuditEvent({
      actorId: actor.id,
      action: "role_changed",
      targetUserId: data.id,
      details: { from: before.role, to: data.role },
    });
    await notifyAdminsOfAccountChange(
      actor,
      before.username,
      `Papel de ${before.username} mudou de ${before.role} para ${data.role}`,
    );
  });
