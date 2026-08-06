import {
  automations,
  credentials,
  documentation,
  incidents,
  incidentsByCategory,
  incidentsByDay,
  integrations,
} from "@/data/mock";
import type {
  Automation,
  Credential,
  Documentation,
  Incident,
  Integration,
} from "@/types/hub";

/**
 * Camada de serviço abstrata do hub.
 * Hoje devolve dados mockados com um pequeno delay para simular rede.
 *
 * Futuro:
 * - automations/incidents/credentials → Supabase (tabelas + RLS)
 * - documentation → Notion API
 * - execuções, nós e status → n8n API / Make API
 * Basta trocar a implementação abaixo mantendo as assinaturas.
 */

const LATENCY = 400;

function delay<T>(data: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export const hubService = {
  listAutomations: () => delay<Automation[]>(automations),
  getAutomation: (id: string) => delay<Automation | undefined>(automations.find((a) => a.id === id)),
  listIncidents: () => delay<Incident[]>(incidents),
  listIncidentsByAutomation: (automationId: string) =>
    delay<Incident[]>(incidents.filter((i) => i.automationId === automationId)),
  listIntegrations: () => delay<Integration[]>(integrations),
  listCredentials: () => delay<Credential[]>(credentials),
  listDocumentation: () => delay<Documentation[]>(documentation),
  getOverview: () =>
    delay({
      activeAutomations: automations.filter((a) => a.status === "Ativa").length,
      openIncidents: incidents.filter((i) => i.status !== "Resolvido").length,
      criticalIncidents: incidents.filter(
        (i) => i.severity === "Crítica" && i.status !== "Resolvido",
      ).length,
      healthyAutomations: automations.filter((a) => a.health === "Saudável").length,
      incidentsByDay,
      incidentsByCategory,
    }),
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
