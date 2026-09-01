// Tipos e rótulos de papel de usuário, sem nenhuma dependência de servidor (crypto
// etc.) — pode ser importado com segurança por componentes client (ex: TopNav, pro
// rótulo do papel no menu). Ver @/lib/auth pro que precisa rodar só no servidor
// (hash de senha, sessão): esse arquivo reexporta os tipos daqui pra manter um único
// ponto de import (`@/lib/auth`) pro resto do código server-side.

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
