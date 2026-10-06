// Webhook que o PipeRun chama quando um negócio muda de etapa (evento deal_moved).
// Autenticação: segredo na URL (?secret=...) — o PipeRun não assina o corpo. O corpo em
// si não é confiável: só dele sai o id do negócio, e a decisão usa o estado real da API.

import { createFileRoute } from "@tanstack/react-router";

import { checkDealMove } from "@/lib/funnel-rules-engine";
import { json, readWebhook } from "@/lib/piperun-webhook";

export const Route = createFileRoute("/api/piperun-deal-moved")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = await readWebhook(request);
        if (parsed instanceof Response) return parsed;

        try {
          return json(200, { ...(await checkDealMove(parsed.dealId)) });
        } catch (error) {
          console.error("[piperun-deal-moved] falha ao checar o negócio", parsed.dealId, error);
          // 500 faz o PipeRun tentar de novo (se ele tiver reenvio); a regra é idempotente.
          return json(500, { error: "Falha ao processar o negócio." });
        }
      },
    },
  },
});
