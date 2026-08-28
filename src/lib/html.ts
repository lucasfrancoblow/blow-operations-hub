/** Escapa texto livre antes de interpolar em e-mail/HTML — evita que um título,
 * descrição etc. quebre a marcação ou injete HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
