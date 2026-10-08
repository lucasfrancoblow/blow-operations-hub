// Pedaços comuns dos endpoints de webhook do PipeRun (segredo na URL + id do negócio).

import { timingSafeEqual } from "node:crypto";

export function secretMatches(received: string | null): boolean {
  const expected = process.env["FUNNEL_RULES_WEBHOOK_SECRET"];
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** O formato exato do payload do PipeRun varia por evento; aceita as formas comuns. */
export function extractDealId(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const data = (root["data"] ?? root["deal"] ?? root) as Record<string, unknown>;
  const candidates = [data["deal_id"], data["id"], root["deal_id"], root["id"]];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Valida segredo + corpo e devolve o id do negócio, ou a Response de erro pronta. */
export async function readWebhook(request: Request): Promise<{ dealId: number } | Response> {
  if (!process.env["FUNNEL_RULES_WEBHOOK_SECRET"]) {
    return json(503, { error: "Webhook não configurado no servidor." });
  }
  if (!secretMatches(new URL(request.url).searchParams.get("secret"))) {
    return json(401, { error: "Não autorizado." });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Corpo inválido." });
  }
  const dealId = extractDealId(body);
  if (dealId === null) {
    // Só os nomes das chaves (nunca valores): ajuda a ajustar o formato do payload.
    const keys = body && typeof body === "object" ? Object.keys(body).slice(0, 20) : [];
    console.warn("[piperun-webhook] corpo sem id de negócio; chaves:", keys.join(","));
    return json(200, { status: "ignorado", reason: "sem id de negócio" });
  }
  return { dealId };
}
