// Envio do PDF ao Slack: files.getUploadURLExternal + upload + files.completeUploadExternal.
// Escopos do bot: chat:write e files:write. O bot precisa estar no canal.

const SLACK_API = "https://slack.com/api";

function exigirEnv(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`${nome} não configurada no ambiente.`);
  return v;
}

interface RespostaSlack {
  ok: boolean;
  error?: string;
  [chave: string]: unknown;
}

async function chamar(
  metodo: string,
  token: string,
  corpo: URLSearchParams | Record<string, unknown>,
): Promise<RespostaSlack> {
  const ehForm = corpo instanceof URLSearchParams;
  const res = await fetch(`${SLACK_API}/${metodo}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": ehForm
        ? "application/x-www-form-urlencoded"
        : "application/json; charset=utf-8",
    },
    body: ehForm ? corpo : JSON.stringify(corpo),
  });
  const json = (await res.json()) as RespostaSlack;
  if (!res.ok || !json.ok) throw new Error(`Slack ${metodo} falhou: ${json.error ?? res.status}`);
  return json;
}

export function configuracaoSlack(): { token: string; canal: string } {
  return { token: exigirEnv("SLACK_BOT_TOKEN"), canal: exigirEnv("SLACK_CHANNEL_ID") };
}

export async function enviarPdf(opcoes: {
  pdf: Buffer;
  nomeArquivo: string;
  titulo: string;
  comentario: string;
}): Promise<void> {
  const { token, canal } = configuracaoSlack();
  const url = await chamar(
    "files.getUploadURLExternal",
    token,
    new URLSearchParams({ filename: opcoes.nomeArquivo, length: String(opcoes.pdf.byteLength) }),
  );
  const up = await fetch(String(url["upload_url"]), {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: new Uint8Array(opcoes.pdf),
  });
  if (!up.ok) throw new Error(`Upload do PDF para o Slack falhou: HTTP ${up.status}`);
  await chamar("files.completeUploadExternal", token, {
    files: [{ id: url["file_id"], title: opcoes.titulo }],
    channel_id: canal,
    initial_comment: opcoes.comentario,
  });
}

export async function enviarMensagem(texto: string): Promise<void> {
  const { token, canal } = configuracaoSlack();
  await chamar("chat.postMessage", token, { channel: canal, text: texto });
}
