// Fonte única de verdade pras abas controláveis por usuário (ver
// supabase/migrations/0013_add_page_access.sql). Visão Geral (/) e Usuários
// (/usuarios) ficam fora dessa lista: a primeira é a home (sempre visível pra
// quem está logado), a segunda já é super_admin-only à parte.

import type { SessionUser } from "@/lib/auth";

export const PAGE_KEYS = [
  "leads-recentes",
  "funil-marketing",
  "daily-expansao",
  "automacoes",
  "incidentes",
  "tarefas",
  "chamados",
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  "leads-recentes": "Radar de Leads",
  "funil-marketing": "Funil de MKT",
  "daily-expansao": "Daily Expansão",
  automacoes: "Automações",
  incidentes: "Incidentes",
  tarefas: "Tarefas",
  chamados: "Chamados",
};

function isAdminLike(role: SessionUser["role"] | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/** admin/super_admin sempre podem; member só se a página estiver em pageAccess. */
export function canAccessPage(user: SessionUser | null | undefined, key: PageKey): boolean {
  if (!user) return false;
  if (isAdminLike(user.role)) return true;
  return user.pageAccess.includes(key);
}
