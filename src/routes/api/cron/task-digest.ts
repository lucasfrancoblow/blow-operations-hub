// Rota chamada pelo Vercel Cron (ver vercel.json) — não é uma server function
// comum porque precisa ser alcançável por HTTP puro, sem sessão de usuário.
// Autenticação: o Vercel manda "Authorization: Bearer $CRON_SECRET"
// automaticamente quando essa env var existe no projeto (ver plano — falta
// criar CRON_SECRET no dashboard do Vercel pra isso funcionar em produção).

import { createFileRoute } from "@tanstack/react-router";

import { runWeeklyDigest } from "@/lib/task-digest";

export const Route = createFileRoute("/api/cron/task-digest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const result = await runWeeklyDigest();
        return Response.json(result);
      },
    },
  },
});
