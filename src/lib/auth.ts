// Núcleo de autenticação: hash de senha e config da sessão (cookie selado pelo
// TanStack Start — ver useSession/getSession/updateSession/clearSession em
// @tanstack/react-start/server). Sem biblioteca de auth externa: só scrypt (nativo do
// Node) pro hash e o mecanismo de sessão que o próprio framework já traz.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { SessionConfig } from "@tanstack/react-start/server";

const KEY_LENGTH = 64;
const SESSION_COOKIE_NAME = "blow_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

// super_admin: só quem gerencia usuários (tela "Usuários") — hoje só lucas.franco.
// admin: papel intermediário — sempre vê todas as abas e todos os projetos de
// Tarefas (bypassa page_access/task_project_access), mas não acessa "Usuários".
// member/external: mesma restrição granular (page_access + acesso por projeto) —
// "external" é só uma etiqueta pra separar time interno de fornecedor/terceiro na
// tela "Usuários"; não muda nenhuma regra de permissão.
export type UserRole = "super_admin" | "admin" | "member" | "external";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  member: "Membro",
  external: "Externo",
};

export interface SessionUser {
  id: string;
  username: string;
  fullName: string | null;
  role: UserRole;
  /** Chaves de página liberadas pra esse usuário (ver src/lib/page-access.ts) — só
   * relevante pra "member"; admin/super_admin sempre têm acesso a tudo. */
  pageAccess: string[];
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hashHex, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function getSessionConfig(): SessionConfig {
  const password = process.env["AUTH_SESSION_SECRET"];
  if (!password || password.length < 32) {
    throw new Error(
      "AUTH_SESSION_SECRET não configurado (ou curto demais) no ambiente do servidor.",
    );
  }
  return {
    password,
    name: SESSION_COOKIE_NAME,
    maxAge: SESSION_MAX_AGE_SECONDS,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      path: "/",
    },
  };
}
