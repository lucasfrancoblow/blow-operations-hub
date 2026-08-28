// Cliente server-only pra baixar arquivos binários do Google Drive via Service Account
// (nunca importar de código de cliente: depende de GOOGLE_PRIVATE_KEY, que só existe
// em process.env no servidor).
//
// Autenticação: JWT de Service Account com o escopo drive.readonly. O arquivo precisa
// estar compartilhado com o e-mail da service account (Drive → Compartilhar) — sem isso
// a API responde 404 mesmo com credencial válida, porque o Drive nunca "lista" um
// arquivo pra quem não tem acesso a ele.

import { JWT } from "google-auth-library";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

function getCredentials(): { email: string; key: string } | null {
  const email = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];
  const key = process.env["GOOGLE_PRIVATE_KEY"];
  if (!email || !key) return null;
  // A private key costuma vir com "\n" escapado quando colada como variável de
  // ambiente de uma linha só — sem essa troca o parser PEM rejeita a chave.
  return { email, key: key.replace(/\\n/g, "\n") };
}

export function isGoogleDriveConfigured(): boolean {
  return getCredentials() !== null;
}

let cachedClient: JWT | null = null;

function getClient(): JWT {
  const creds = getCredentials();
  if (!creds) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY não configuradas no servidor.",
    );
  }
  if (!cachedClient) {
    cachedClient = new JWT({ email: creds.email, key: creds.key, scopes: SCOPES });
  }
  return cachedClient;
}

/** Baixa os bytes crus de um arquivo do Drive (alt=media funciona pra qualquer binário
 * — xlsx, xlsm, pdf — diferente de arquivo nativo do Google, que exigiria /export). */
export async function downloadDriveFile(fileId: string): Promise<ArrayBuffer> {
  const client = getClient();
  const res = await client.request<ArrayBuffer>({
    url: `${DRIVE_FILES_URL}/${fileId}`,
    params: { alt: "media" },
    responseType: "arraybuffer",
  });
  return res.data;
}

/** Última modificação do arquivo no Drive — usado pra mostrar "planilha atualizada em
 * X" no dashboard, já que ela é preenchida manualmente pelo time, não por um sistema. */
export async function getDriveFileModifiedTime(fileId: string): Promise<string | null> {
  const client = getClient();
  const res = await client.request<{ modifiedTime?: string }>({
    url: `${DRIVE_FILES_URL}/${fileId}`,
    params: { fields: "modifiedTime" },
  });
  return res.data.modifiedTime ?? null;
}
