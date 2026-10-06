// Webhook que o PipeRun chama quando um negócio muda de etapa (evento deal_moved).
// Autenticação: segredo na URL (?secret=...) comparado em tempo constante com
// FUNNEL_RULES_WEBHOOK_SECRET — o PipeRun não assina o corpo. O corpo em si não é
// confiável: só dele sai o id do negócio, e a decisão usa o estado real da API.

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

import { checkDealMove } from "@/lib/funnel-rules-engine";

function secretMatches(received: string | null): boolean {
  const expected = process.env["FUNNEL_RULES_WEBHOOK_SECRET"];
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** O formato exato do payload do PipeRun varia por evento; aceita as formas comuns. */
function extractDealId(body: unknown): number | null {
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

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/piperun-deal-moved")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env["FUNNEL_RULES_WEBHOOK_SECRET"]) {
          return json(503, { error: "Webhook não configurado no servidor." });
        }
        const secret = new URL(request.url).searchParams.get("secret");
        if (!secretMatches(secret)) return json(401, { error: "Não autorizado." });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(400, { error: "Corpo inválido." });
        }

        const dealId = extractDealId(body);
        if (dealId === null) return json(200, { status: "ignorado", reason: "sem id de negócio" });

        try {
          const result = await checkDealMove(dealId);
          return json(200, { ...result });
        } catch (error) {
          console.error("[piperun-deal-moved] falha ao checar o negócio", dealId, error);
          // 500 faz o PipeRun tentar de novo (se ele tiver reenvio); a regra é idempotente.
          return json(500, { error: "Falha ao processar o negócio." });
        }
      },
    },
  },
});
