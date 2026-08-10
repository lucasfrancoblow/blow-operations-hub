import {
  automations,
  credentials,
  documentation,
  incidents,
  incidentsByCategory,
  incidentsByDay,
  integrations,
} from "@/data/mock";
import { getN8nOperationalData } from "@/services/n8n-service";
import type { Automation, Credential, Documentation, Incident, Integration } from "@/types/hub";

/**
 * Camada de serviço do hub.
 *
 * Quando N8N_BASE_URL/N8N_API_KEY estão configurados, tudo abaixo vem de verdade
 * da API do n8n (ver src/lib/n8n-metrics.ts): automações, incidentes, overview,
 * documentação e credenciais (metadados — nunca o segredo). "Sistemas e integrações"
 * também usa contagens reais (quantas automações/incidentes usam cada sistema), mas
 * como só o n8n tem API própria conectada aqui, o status de saúde dos demais sistemas
 * (Make, PipeRun, Google Ads...) fica como "Não verificado" até termos a API deles.
 * Sem N8N_BASE_URL/N8N_API_KEY configurados, cai nos dados mockados abaixo com um
 * pequeno delay simulando rede.
 *
 * Futuro: credentials → Supabase (tabelas + RLS); documentation → Notion API;
 * status real dos demais sistemas → API de cada um.
 */

const LATENCY = 400;

function delay<T>(data: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export const hubService = {
  listAutomations: async (): Promise<Automation[]> => {
    const real = await getN8nOperationalData();
    if (real) return real.automations;
    return delay(automations);
  },
  getAutomation: async (id: string): Promise<Automation | undefined> => {
    const real = await getN8nOperationalData();
    if (real) return real.automations.find((a) => a.id === id);
    return delay(automations.find((a) => a.id === id));
  },
  listIncidents: async (): Promise<Incident[]> => {
    const real = await getN8nOperationalData();
    if (real) return real.incidents;
    return delay(incidents);
  },
  listIncidentsByAutomation: async (automationId: string): Promise<Incident[]> => {
    const real = await getN8nOperationalData();
    if (real) return real.incidents.filter((i) => i.automationId === automationId);
    return delay(incidents.filter((i) => i.automationId === automationId));
  },
  listIntegrations: async (): Promise<Integration[]> => {
    const real = await getN8nOperationalData();
    if (real) return real.integrations;
    return delay(integrations);
  },
  listCredentials: async (): Promise<Credential[]> => {
    const real = await getN8nOperationalData();
    if (real) return real.credentials;
    return delay(credentials);
  },
  listDocumentation: async (): Promise<Documentation[]> => {
    const real = await getN8nOperationalData();
    if (real) return real.documentation;
    return delay(documentation);
  },
  getOverview: async () => {
    const real = await getN8nOperationalData();
    if (real) return real.overview;
    return delay({
      activeAutomations: automations.filter((a) => a.status === "Ativa").length,
      openIncidents: incidents.filter((i) => i.status !== "Resolvido").length,
      criticalIncidents: incidents.filter(
        (i) => i.severity === "Crítica" && i.status !== "Resolvido",
      ).length,
      healthyAutomations: automations.filter((a) => a.health === "Saudável").length,
      incidentsByDay,
      incidentsByCategory,
    });
  },
};

export const queryKeys = {
  automations: ["automations"] as const,
  automation: (id: string) => ["automations", id] as const,
  incidents: ["incidents"] as const,
  incidentsByAutomation: (id: string) => ["incidents", "automation", id] as const,
  integrations: ["integrations"] as const,
  credentials: ["credentials"] as const,
  documentation: ["documentation"] as const,
  overview: ["overview"] as const,
};
