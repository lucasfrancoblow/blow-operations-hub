// Nome pra mostrar pra humano: nome completo quando existir, senão o usuário
// de login. Puro e seguro pro client — usar em qualquer lugar que hoje mostra
// `.username` cru (responsável, autor de comentário, quem fez upload, avatar...).

export function displayName(
  user: { fullName?: string | null; username: string } | null | undefined,
): string {
  if (!user) return "—";
  return user.fullName?.trim() || user.username;
}
