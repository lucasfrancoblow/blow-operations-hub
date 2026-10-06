// Webhook do PipeRun para negócio novo (evento deal_created): deixa a nota de BANT/SPIN
// nos cards que chegam à Reunião Prevista do funil Closer. Mesma autenticação do deal_moved.

import { createFileRoute } from "@tanstack/react-router";

import { addBantNoteIfNeeded } from "@/lib/bant-note";
import { json, readWebhook } from "@/lib/piperun-webhook";

export const Route = createFileRoute("/api/piperun-deal-created")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = await readWebhook(request);
        if (parsed instanceof Response) return parsed;

        try {
          return json(200, { ...(await addBantNoteIfNeeded(parsed.dealId)) });
        } catch (error) {
          console.error("[piperun-deal-created] falha ao montar a nota", parsed.dealId, error);
          return json(500, { error: "Falha ao processar o negócio." });
        }
      },
    },
  },
});
