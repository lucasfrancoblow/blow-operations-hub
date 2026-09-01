// Núcleo de autenticação: hash de senha e config da sessão (cookie selado pelo
// TanStack Start — ver useSession/getSession/updateSession/clearSession em
// @tanstack/react-start/server). Sem biblioteca de auth externa: só scrypt (nativo do
// Node) pro hash e o mecanismo de sessão que o próprio framework já traz.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { SessionConfig } from "@tanstack/react-start/server";

import { ROLE_LABELS, type SessionUser, type UserRole } from "@/lib/user-role";

// Reexportados daqui pra não quebrar o resto do código server-side (que já importa
// tipo/papel de "@/lib/auth") — mas quem só precisa disso de um componente client
// (ex: TopNav) deve importar direto de "@/lib/user-role", que não puxa node:crypto
// pro bundle do navegador. Ver comentário desse arquivo pro porquê disso importar.
export { ROLE_LABELS, type SessionUser, type UserRole };

const KEY_LENGTH = 64;
const SESSION_COOKIE_NAME = "blow_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

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
