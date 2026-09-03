import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser } from "@/lib/session";
import { getHubSettings, updateHubSettings, type HubSettings } from "@/lib/hub-settings-store";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import { isN8nConfigured } from "@/lib/n8n-client";

export const getHubSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireSessionUser();
  return getHubSettings();
});

export const updateHubSettingsFn = createServerFn({ method: "POST" })
  .validator((input: Partial<HubSettings>) => input)
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new Error("Só admin/super admin pode alterar configurações do hub.");
    }
    await updateHubSettings(data);
  });

export interface IntegrationStatus {
  name: string;
  description: string;
  connected: boolean;
}

/** Status real de cada integração planejada — antes essa lista era 100%
 * hardcoded (inclusive mostrando "Não conectado" pro Supabase, que já é o
 * banco de produção de todo o hub). */
export const getIntegrationStatusFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<IntegrationStatus[]> => {
    await requireSessionUser();
    return [
      {
        name: "Supabase",
        description: "Persistência de tarefas, usuários, incidentes e chamados.",
        connected: isSupabaseConfigured(),
      },
      {
        name: "n8n API",
        description: "Leitura de workflows, nós e execuções em tempo real.",
        connected: isN8nConfigured(),
      },
      {
        name: "Make API",
        description: "Status e histórico de cenários — ainda não integrado.",
        connected: false,
      },
      {
        name: "Notion API",
        description: "Sincronização bidirecional da base de documentação — ainda não integrado.",
        connected: false,
      },
    ];
  },
);
