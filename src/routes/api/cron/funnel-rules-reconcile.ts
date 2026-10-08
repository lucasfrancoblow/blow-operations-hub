// Varredura periódica das regras do funil (chamada a cada minuto pelo agendador do
// Supabase). Garante que a regra roda mesmo quando o webhook do PipeRun não chega.
// Autenticação: o mesmo segredo do webhook, no cabeçalho Authorization (Bearer).

import { createFileRoute } from "@tanstack/react-router";

import { reconcileRecentMoves } from "@/lib/funnel-rules-engine";
import { json, secretMatches } from "@/lib/piperun-webhook";

async function handle(request: Request): Promise<Response> {
  if (!process.env["FUNNEL_RULES_WEBHOOK_SECRET"]) {
    return json(503, { error: "Webhook não configurado no servidor." });
  }
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer)) return json(401, { error: "Não autorizado." });

  try {
    return json(200, { ...(await reconcileRecentMoves()) });
  } catch (error) {
    console.error("[funnel-rules-reconcile] falha", error);
    return json(500, { error: "Falha ao varrer as regras do funil." });
  }
}

export const Route = createFileRoute("/api/cron/funnel-rules-reconcile")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
