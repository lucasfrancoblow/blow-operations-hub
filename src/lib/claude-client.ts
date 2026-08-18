// Cliente server-only para a API de Mensagens da Claude (nunca importar de código de
// cliente: depende de ANTHROPIC_API_KEY, que só existe em process.env no servidor).
//
// Sem SDK: chama a Messages API direto via fetch, no mesmo padrão usado pra n8n,
// PipeRun e Supabase neste projeto. Usado só pra sugestões curtas (assistente de
// tarefas), então sempre com saída estruturada via output_config.format.

const MODEL = "claude-haiku-4-5";
const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

function getApiKey(): string | null {
  return process.env["ANTHROPIC_API_KEY"] ?? null;
}

export function isClaudeConfigured(): boolean {
  return getApiKey() !== null;
}

interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
}

/**
 * Chama a Claude pedindo saída em JSON conforme `schema` e devolve o objeto já
 * parseado. Lança erro se a chave não estiver configurada, se a API responder
 * com erro, ou se a resposta não vier em texto/JSON válido.
 */
export async function callClaudeJson<T>(params: {
  system: string;
  prompt: string;
  schema: JsonSchema;
  maxTokens?: number;
}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: params.maxTokens ?? 512,
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
      output_config: {
        format: { type: "json_schema", schema: params.schema },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Claude API respondeu ${response.status}: ${body}`);
  }

  const data = await response.json();

  if (data.stop_reason === "refusal") {
    throw new Error("Claude recusou a solicitação.");
  }

  const textBlock = (data.content as Array<{ type: string; text?: string }>).find(
    (block) => block.type === "text",
  );
  if (!textBlock?.text) {
    throw new Error("Claude não retornou texto na resposta.");
  }

  return JSON.parse(textBlock.text) as T;
}
