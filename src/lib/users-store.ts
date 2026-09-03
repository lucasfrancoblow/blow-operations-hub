// Persistência dos usuários do hub (ver supabase/migrations/0004_create_app_users.sql).

import {
  isSupabaseConfigured,
  supabaseSelect,
  supabaseUpdate,
  supabaseUpsert,
} from "@/lib/supabase-client";
import { hashPassword } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";

interface AppUserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  active: boolean;
  page_access: string[];
  full_name: string | null;
  email: string | null;
  phone: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
}

export interface AppUser {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  pageAccess: string[];
  fullName: string | null;
  email: string | null;
  phone: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
}

function fromRow(row: AppUserRow): AppUser {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
    active: row.active,
    pageAccess: row.page_access ?? [],
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    failedLoginAttempts: row.failed_login_attempts ?? 0,
    lockedUntil: row.locked_until,
    createdAt: row.created_at,
  };
}

function requireSupabase(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.");
  }
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function findUserByUsername(username: string): Promise<AppUser | null> {
  if (!isSupabaseConfigured()) return null;
  const rows = await supabaseSelect<AppUserRow>("app_users", {
    select: "*",
    username: `eq.${normalizeUsername(username)}`,
    limit: "1",
  });
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function listUsers(): Promise<AppUser[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<AppUserRow>("app_users", {
    select: "*",
    order: "created_at.asc",
  });
  return rows.map(fromRow);
}

export async function findUserById(id: string): Promise<AppUser | null> {
  if (!isSupabaseConfigured()) return null;
  const rows = await supabaseSelect<AppUserRow>("app_users", {
    select: "*",
    id: `eq.${id}`,
    limit: "1",
  });
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createUser(input: {
  username: string;
  password: string;
  role: UserRole;
  fullName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
}): Promise<AppUser> {
  requireSupabase();
  const username = normalizeUsername(input.username);
  const existing = await findUserByUsername(username);
  if (existing) {
    throw new Error(`Já existe um usuário "${username}".`);
  }
  await supabaseUpsert("app_users", [
    {
      username,
      password_hash: hashPassword(input.password),
      role: input.role,
      active: true,
      full_name: input.fullName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
    },
  ]);
  const created = await findUserByUsername(username);
  if (!created) throw new Error("Usuário criado, mas não foi possível recarregá-lo.");
  return created;
}

export async function setUserProfile(
  id: string,
  patch: { fullName?: string | undefined; email?: string | undefined; phone?: string | undefined },
): Promise<void> {
  requireSupabase();
  await supabaseUpdate("app_users", id, {
    full_name: patch.fullName?.trim() || null,
    email: patch.email?.trim() || null,
    phone: patch.phone?.trim() || null,
    updated_at: new Date().toISOString(),
  });
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  requireSupabase();
  await supabaseUpdate("app_users", id, { active, updated_at: new Date().toISOString() });
}

export async function setUserPageAccess(id: string, pageAccess: string[]): Promise<void> {
  requireSupabase();
  await supabaseUpdate("app_users", id, {
    page_access: pageAccess,
    updated_at: new Date().toISOString(),
  });
}

export async function setUserRole(id: string, role: UserRole): Promise<void> {
  requireSupabase();
  if (role !== "super_admin") {
    const superAdmins = await supabaseSelect<{ id: string }>("app_users", {
      select: "id",
      role: "eq.super_admin",
    });
    if (superAdmins.length === 1 && superAdmins[0]!.id === id) {
      throw new Error("Não dá pra rebaixar o único super admin — promova outra conta antes.");
    }
  }
  await supabaseUpdate("app_users", id, { role, updated_at: new Date().toISOString() });
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  requireSupabase();
  await supabaseUpdate("app_users", id, {
    password_hash: hashPassword(password),
    updated_at: new Date().toISOString(),
  });
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/** Nunca lançava antes: dava pra tentar senha errada infinitas vezes num
 * mesmo usuário. Depois de 5 tentativas seguidas, bloqueia por 15 minutos. */
export async function registerFailedLogin(id: string, currentAttempts: number): Promise<void> {
  requireSupabase();
  const attempts = currentAttempts + 1;
  const patch: Record<string, unknown> = { failed_login_attempts: attempts };
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    patch["locked_until"] = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
    patch["failed_login_attempts"] = 0;
  }
  await supabaseUpdate("app_users", id, patch);
}

export async function clearFailedLogins(id: string): Promise<void> {
  requireSupabase();
  await supabaseUpdate("app_users", id, { failed_login_attempts: 0, locked_until: null });
}
