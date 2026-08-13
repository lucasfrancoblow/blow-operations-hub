import { createServerFn } from "@tanstack/react-start";

import { loadLeadsRecentesData, type LeadsRecentesData } from "@/lib/leads-recentes";
import { isSupabaseConfigured, supabaseUpsert } from "@/lib/supabase-client";

// Cache em memória do processo do servidor: evita repaginar negócios + funis + etapas
// a cada query independente disparada pela tela na mesma janela de segundos.
let cache: { data: LeadsRecentesData | null; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

/** Leads criados nos últimos 14 dias no PipeRun, com status de validação manual do time. */
export const getLeadsRecentesData = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeadsRecentesData | null> => {
    if (cache && cache.expiresAt > Date.now()) return cache.data;
    const data = await loadLeadsRecentesData();
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  },
);

interface ValidarLeadInput {
  dealId: number;
  validadoPor: string;
  observacao?: string | undefined;
}

/** Marca um lead como conferido pelo time. Guardado no Supabase (não existe campo assim no PipeRun). */
export const validarLead = createServerFn({ method: "POST" })
  .validator((input: ValidarLeadInput) => input)
  .handler(async ({ data }) => {
    if (!isSupabaseConfigured()) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.");
    }
    await supabaseUpsert("leads_validacao", [
      {
        deal_id: data.dealId,
        validado: true,
        validado_por: data.validadoPor,
        observacao: data.observacao ?? null,
      },
    ]);
    cache = null; // força recarregar na próxima leitura
  });
