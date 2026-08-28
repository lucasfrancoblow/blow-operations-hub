import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser } from "@/lib/session";
import { loadDailyExpansaoData, type DailyExpansaoData } from "@/lib/daily-expansao";
import { defaultDateRange, type DateRange } from "@/lib/leads-recentes";

// Cache mais longo que o do PipeRun (30s): aqui um miss baixa o arquivo inteiro do
// Drive e reparseia o XLSX, bem mais caro que uma chamada de API — e a planilha é
// preenchida manualmente pelo time, então não faz sentido perseguir segundos de atraso.
const cache = new Map<string, { data: DailyExpansaoData | null; expiresAt: number }>();
const CACHE_TTL_MS = 120_000;

/** Métricas diárias de Allana/Júlia (SDR) e Andrey (Closer) no range informado
 * (default: últimos 14 dias), lidas da planilha "Daily Expansão" no Drive. */
export const getDailyExpansaoData = createServerFn({ method: "GET" })
  .validator((input?: DateRange) => input ?? defaultDateRange())
  .handler(async ({ data: range }): Promise<DailyExpansaoData | null> => {
    await requireSessionUser();
    const key = `${range.from}_${range.to}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const data = await loadDailyExpansaoData(range);
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  });
