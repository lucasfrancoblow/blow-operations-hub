// Tipos de domínio do Hub de Operações BLOW.
// Futuro: estes tipos devem espelhar as tabelas do Supabase e as
// propriedades das bases do Notion (Automations / Incidents / Credentials).

export type Platform = "n8n" | "Make";

export type AutomationStatus = "Ativa" | "Pausada" | "Em manutenção" | "Descontinuada";

export type HealthStatus = "Saudável" | "Atenção" | "Crítica";

export type Area =
  | "Marketing"
  | "Comercial"
  | "Implantação"
  | "People"
  | "Operações"
  | "Não classificada";

export type IncidentSeverity = "Crítica" | "Alta" | "Média" | "Baixa";

export type IncidentStatus = "Aberto" | "Investigando" | "Resolvido";

export type SystemStatus = "Operacional" | "Degradado" | "Fora do ar";

export type CredentialType = "OAuth2" | "API Key" | "Basic Auth" | "Webhook";

export type CredentialStatus = "Ativa" | "Revisão pendente" | "Expirada";

export interface FlowNode {
  id: string;
  name: string;
  type: string;
  status: HealthStatus;
  description: string;
}

export interface AutomationEvent {
  id: string;
  date: string;
  author: string;
  description: string;
}

export interface Automation {
  id: string;
  code: string;
  name: string;
  platform: Platform;
  area: Area;
  status: AutomationStatus;
  health: HealthStatus;
  owner: string;
  lastError: string | null;
  lastErrorAt: string | null;
  openIncidents: number;
  lastReview: string;
  objective: string;
  description: string;
  trigger: string;
  frequency: string;
  lastRun: string;
  nextRun: string | null;
  successRate: number;
  avgDurationSec: number;
  runsLast30d: number;
  systems: string[];
  credentialIds: string[];
  documentationId: string | null;
  externalUrl: string;
  flow: FlowNode[];
  history: AutomationEvent[];
  /** Só presente quando a automação vem de verdade do n8n (ver n8n-metrics.ts). */
  realCredentials?: Array<{ id: string; type: string; name: string; nodes: string[] }>;
}

export interface IncidentOccurrence {
  date: string;
  count: number;
}

export interface Incident {
  id: string;
  code: string;
  title: string;
  summary: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  category: string;
  automationId: string;
  automationName: string;
  failedNode: string;
  httpCode: number | null;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  owner: string;
  aiSummary: string;
  facts: string[];
  probableCause: string;
  suggestedFix: string;
  evidence: string;
  n8nExecutionUrl: string;
  notionUrl: string;
  timeline: IncidentOccurrence[];
}

export interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  status: SystemStatus;
  dependentAutomations: number;
  openIncidents: number;
  lastCheck: string;
  owner: string;
  environment: string;
}

/**
 * Credencial = SOMENTE metadados operacionais.
 * Nunca armazenar segredo, token, senha ou client secret aqui.
 */
export interface Credential {
  id: string;
  name: string;
  system: string;
  type: CredentialType;
  location: string;
  owner: string;
  status: CredentialStatus;
  lastReview: string;
  nextReview: string;
  relatedAutomations: string[];
  notes: string;
}

export interface Documentation {
  id: string;
  code: string;
  title: string;
  area: Area;
  platform: Platform;
  systems: string[];
  objective: string;
  flowSummary: string;
  dependencies: string[];
  referencedCredentials: string[];
  postmanTests: string[];
  contingencyPlan: string;
  owner: string;
  updatedAt: string;
}

export interface DailyIncidentPoint {
  date: string;
  total: number;
  criticos: number;
}

export interface CategoryPoint {
  category: string;
  total: number;
}
