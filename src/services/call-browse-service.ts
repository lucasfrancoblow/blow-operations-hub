import { createServerFn } from "@tanstack/react-start";

import {
  fetchCallsForDay,
  isThreeCPlusConfigured,
  type ThreeCPlusCall,
} from "@/lib/threecplus-client";

const cache = new Map<string, { data: ThreeCPlusCall[]; expiresAt: number }>();
const CACHE_TTL_MS = 120_000;

/** Chamadas com agente real de um dia específico, direto da 3C Plus (ao vivo, sem
 * passar pelo Supabase) — pra auditoria pontual, não pro painel agregado. */
export const getCallsForDay = createServerFn({ method: "GET" })
  .validator((date: string) => date)
  .handler(async ({ data: date }): Promise<ThreeCPlusCall[] | null> => {
    if (!isThreeCPlusConfigured()) return null;
    const cached = cache.get(date);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const data = await fetchCallsForDay(date);
    cache.set(date, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  });
