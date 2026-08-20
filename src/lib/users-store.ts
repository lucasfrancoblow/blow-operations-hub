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
  created_at: string;
}

export interface AppUser {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

function fromRow(row: AppUserRow): AppUser {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
    active: row.active,
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

export async function createUser(input: {
  username: string;
  password: string;
  role: UserRole;
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
    },
  ]);
  const created = await findUserByUsername(username);
  if (!created) throw new Error("Usuário criado, mas não foi possível recarregá-lo.");
  return created;
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  requireSupabase();
  await supabaseUpdate("app_users", id, { active, updated_at: new Date().toISOString() });
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  requireSupabase();
  await supabaseUpdate("app_users", id, {
    password_hash: hashPassword(password),
    updated_at: new Date().toISOString(),
  });
}
