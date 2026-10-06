// Endpoint MCP (Streamable HTTP) que o Claude chama. O "link pessoal" é o último pedaço
// da URL: /api/mcp/<token>. Marco 1: um token único vindo de MCP_LINK_TOKEN; links
// pessoais revogáveis (tabela + tela no hub) vêm no próximo marco.

import { createFileRoute } from "@tanstack/react-router";

import { handleRpc, linkTokenMatches } from "@/lib/mcp-server";
import { json } from "@/lib/piperun-webhook";

export const Route = createFileRoute("/api/mcp/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!linkTokenMatches(params.token)) return json(401, { error: "Link inválido." });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(400, { error: "Corpo inválido." });
        }

        // Lote de mensagens: responde só às que têm id.
        if (Array.isArray(body)) {
          const replies = (await Promise.all(body.map(handleRpc))).filter((r) => r !== null);
          return replies.length ? Response.json(replies) : new Response(null, { status: 202 });
        }
        const reply = await handleRpc(body);
        return reply === null ? new Response(null, { status: 202 }) : Response.json(reply);
      },
      // Sem stream do servidor para o cliente: o transporte permite responder 405.
      GET: () => new Response(null, { status: 405, headers: { Allow: "POST" } }),
    },
  },
});
