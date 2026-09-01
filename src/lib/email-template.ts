// Moldura visual única pra todo e-mail transacional do hubLOw (atribuição,
// aceite/recusa, comentário, chamado novo) — antes cada notificação montava
// seu próprio HTML solto, sem marca nem link de volta pro app. Estilos
// inline de propósito: e-mail não confia em <style>/classe CSS.
//
// Todo texto interpolado (título de tarefa, descrição, corpo de comentário,
// nome de usuário) já deve chegar escapado via escapeHtml — este helper não
// escapa nada sozinho, só monta a moldura.

const BRAND_ORANGE = "#ea580c";
const SUCCESS_GREEN = "#107c10";
const CRITICAL_RED = "#c9372c";

export const EMAIL_TONE = {
  brand: BRAND_ORANGE,
  success: SUCCESS_GREEN,
  critical: CRITICAL_RED,
} as const;

const DEFAULT_APP_URL = "https://blow-operations-hub.vercel.app";

/** URL base do app pros links "Ver tarefa"/"Ver chamado" nos e-mails —
 * configurável via APP_URL, com fallback pro domínio de produção conhecido. */
export function getAppUrl(): string {
  return process.env["APP_URL"] ?? DEFAULT_APP_URL;
}

/** Abre a tarefa direto (exige login) — usado por quem tem acesso a Tarefas. */
export function taskDeepLink(taskNumber: number): string {
  return `${getAppUrl()}/tarefas?task=${taskNumber}`;
}

/** Abre o chamado direto (exige login) — usado pelo solicitante de um
 * chamado, que pode não ter acesso à aba Tarefas. */
export function ticketDeepLink(ticketNumber: number): string {
  return `${getAppUrl()}/chamados?ticket=${ticketNumber}`;
}

export interface EmailTemplateInput {
  /** Rótulo curto em maiúsculas acima do título, ex: "Nova atribuição". */
  eyebrow: string;
  /** Cor do eyebrow — usa EMAIL_TONE.brand/success/critical. Padrão: brand. */
  eyebrowColor?: string;
  heading: string;
  /** Parágrafo de contexto entre o título e o card de destaque. */
  intro?: string;
  /** Título dentro do card cinza de destaque, ex: "#13 — Nome da tarefa". */
  highlightTitle?: string;
  /** Corpo dentro do card de destaque — descrição, trecho de comentário etc. */
  highlightBody?: string;
  /** Nota pequena e discreta entre o destaque e o botão. */
  note?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerText: string;
}

export function renderEmailTemplate(input: EmailTemplateInput): string {
  const eyebrowColor = input.eyebrowColor ?? EMAIL_TONE.brand;
  const highlight = input.highlightTitle
    ? `
        <div style="background:#faf9f8;border:1px solid #efece9;border-radius:6px;padding:14px 16px;margin:0 0 ${input.note ? "8px" : "24px"};">
          <p style="margin:0 0 ${input.highlightBody ? "6px" : "0"};font-size:14px;font-weight:600;color:#201f1e;">${input.highlightTitle}</p>
          ${input.highlightBody ? `<p style="margin:0;font-size:13.5px;line-height:1.55;color:#6b6866;">${input.highlightBody}</p>` : ""}
        </div>`
    : "";
  const cta = input.ctaUrl
    ? `<a href="${input.ctaUrl}" style="display:inline-block;background:${EMAIL_TONE.brand};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:6px;">${input.ctaLabel ?? "Ver tarefa"} →</a>`
    : "";

  return `
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e1de;border-radius:8px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="padding:20px 28px;border-bottom:1px solid #efece9;">
        <span style="font-size:17px;font-weight:700;color:${EMAIL_TONE.brand};">hubLOw</span>
        <span style="font-size:12px;color:#948f8c;margin-left:6px;">BLOW Operações</span>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${eyebrowColor};">${input.eyebrow}</p>
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;color:#201f1e;">${input.heading}</h1>
        ${input.intro ? `<p style="margin:0 0 20px;font-size:14.5px;line-height:1.6;color:#4a4744;">${input.intro}</p>` : ""}
        ${highlight}
        ${input.note ? `<p style="margin:16px 0 20px;font-size:12.5px;color:#948f8c;">${input.note}</p>` : ""}
        ${cta}
      </div>
      <div style="padding:16px 28px;background:#faf9f8;border-top:1px solid #efece9;">
        <p style="margin:0;font-size:12px;color:#948f8c;">${input.footerText}</p>
      </div>
    </div>
  `;
}
