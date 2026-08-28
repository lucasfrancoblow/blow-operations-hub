// Notificação por e-mail via Resend (API REST direto por fetch, sem SDK — mesmo
// padrão do resto do projeto). Fica inerte (não quebra nada) enquanto
// RESEND_API_KEY / RESEND_FROM_EMAIL não estiverem configuradas no servidor.

function getResendConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export function isResendConfigured(): boolean {
  return getResendConfig() !== null;
}

/**
 * Envia um e-mail transacional. Best-effort: nunca lança — uma notificação que
 * falha (Resend fora do ar, config ausente etc.) não pode derrubar a ação
 * principal (criar/mover uma tarefa, por exemplo), só fica registrada no log.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const config = getResendConfig();
  if (!config) return;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`Resend respondeu ${response.status} ao enviar e-mail: ${body}`);
    }
  } catch (error) {
    console.error("Falha ao enviar e-mail via Resend:", error);
  }
}
