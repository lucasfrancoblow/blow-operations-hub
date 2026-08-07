// Monta Automation/Incident/Overview reais a partir da API do n8n.
// Server-only (usa n8n-client, que depende de process.env). Sem persistência:
// tudo é recalculado a cada carga a partir do histórico de execuções do n8n.

import {
  fetchN8nExecutionError,
  fetchN8nRecentExecutions,
  fetchN8nWorkflows,
  getN8nBaseUrl,
  isN8nConfigured,
  type N8nExecution,
  type N8nExecutionError,
  type N8nWorkflow,
} from "@/lib/n8n-client";
import type {
  Automation,
  CategoryPoint,
  DailyIncidentPoint,
  Documentation,
  HealthStatus,
  Incident,
  IncidentSeverity,
} from "@/types/hub";

const EXECUTION_WINDOW_PAGES = 6; // ~1500 execuções recentes, todas as automações misturadas
const MAX_ERROR_DETAIL_FETCHES = 30;

interface WorkflowStats {
  totalCount: number;
  successCount: number;
  errorCount: number;
  lastStatus: string;
  lastAt: string;
  firstErrorAt: string | null;
  lastErrorAt: string | null;
  lastErrorExecutionId: string | null;
  durationsMs: number[];
  errorDates: string[];
}

export interface N8nOperationalData {
  automations: Automation[];
  incidents: Incident[];
  documentation: Documentation[];
  overview: {
    activeAutomations: number;
    openIncidents: number;
    criticalIncidents: number;
    healthyAutomations: number;
    incidentsByDay: DailyIncidentPoint[];
    incidentsByCategory: CategoryPoint[];
  };
}

function buildStats(executions: N8nExecution[]): Map<string, WorkflowStats> {
  const map = new Map<string, WorkflowStats>();
  // n8n devolve execuções mais novas primeiro por padrão — cada workflow assume
  // status/hora da PRIMEIRA ocorrência que aparecer (a mais recente).
  for (const e of executions) {
    let stats = map.get(e.workflowId);
    if (!stats) {
      stats = {
        totalCount: 0,
        successCount: 0,
        errorCount: 0,
        lastStatus: e.status,
        lastAt: e.startedAt,
        firstErrorAt: null,
        lastErrorAt: null,
        lastErrorExecutionId: null,
        durationsMs: [],
        errorDates: [],
      };
      map.set(e.workflowId, stats);
    }
    stats.totalCount += 1;
    if (e.status === "success") stats.successCount += 1;
    if (e.status === "error") {
      stats.errorCount += 1;
      stats.errorDates.push(e.startedAt.slice(0, 10));
      if (!stats.lastErrorAt) {
        stats.lastErrorAt = e.startedAt;
        stats.lastErrorExecutionId = e.id;
      }
      stats.firstErrorAt = e.startedAt; // sobrescrito a cada erro mais antigo processado
    }
    if (e.stoppedAt) {
      const durationMs = new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime();
      if (Number.isFinite(durationMs) && durationMs >= 0) stats.durationsMs.push(durationMs);
    }
  }
  return map;
}

function stripNodePrefix(type: string): string {
  return type.replace("n8n-nodes-base.", "");
}

const CORE_NODE_TYPES = new Set([
  "if",
  "set",
  "code",
  "merge",
  "switch",
  "noOp",
  "wait",
  "filter",
  "splitInBatches",
  "splitOut",
  "aggregate",
  "scheduleTrigger",
  "manualTrigger",
  "errorTrigger",
  "start",
  "stickyNote",
  "executeWorkflow",
  "executeWorkflowTrigger",
  "respondToWebhook",
  "webhook",
  "httpRequest",
]);

const KNOWN_SYSTEM_LABELS: Record<string, string> = {
  supabase: "Supabase",
  googleSheets: "Google Sheets",
  googleSheetsTrigger: "Google Sheets",
  slack: "Slack",
  telegram: "Telegram",
  notion: "Notion",
  hubspot: "HubSpot",
  pipedrive: "Pipedrive",
  gmail: "Gmail",
  gmailTrigger: "Gmail",
  googleCalendar: "Google Calendar",
  postgres: "PostgreSQL",
  mySql: "MySQL",
  emailSend: "E-mail (SMTP)",
  whatsApp: "WhatsApp",
  airtable: "Airtable",
  googleDrive: "Google Drive",
  openAi: "OpenAI",
};

// Muitas integrações reais (Google Ads, PipeRun, Meta...) passam por nós genéricos
// (httpRequest/webhook) sem um node dedicado no n8n. Nesses casos, procuramos a pista
// no NOME que o time já deu ao nó — convenção observada nos workflows da BLOW.
const NAME_HINT_LABELS: Array<[RegExp, string]> = [
  [/google[\s-]?ads/i, "Google Ads"],
  [/piperun/i, "PipeRun"],
  [/meta|facebook/i, "Meta Ads"],
  [/whatsapp/i, "WhatsApp"],
  [/slack/i, "Slack"],
  [/sheets?/i, "Google Sheets"],
  [/notion/i, "Notion"],
  [/supabase/i, "Supabase"],
];

function detectSystems(nodes: N8nWorkflow["nodes"]): string[] {
  const found = new Set<string>();
  for (const node of nodes) {
    const type = stripNodePrefix(node.type);
    const knownLabel = KNOWN_SYSTEM_LABELS[type];
    if (knownLabel) {
      found.add(knownLabel);
      continue;
    }
    if (CORE_NODE_TYPES.has(type)) continue;
    const hint = NAME_HINT_LABELS.find(([pattern]) => pattern.test(node.name));
    if (hint) {
      found.add(hint[1]);
    }
  }
  return Array.from(found);
}

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  scheduleTrigger: "Automação agendada",
  webhook: "Integração via webhook",
  manualTrigger: "Execução manual",
  errorTrigger: "Tratamento de erros",
  executeWorkflowTrigger: "Sub-workflow (chamado por outra automação)",
  emailReadImap: "Gatilho por e-mail",
};

function classifyAutomationType(triggerNode: N8nWorkflow["nodes"][number] | undefined): string {
  if (!triggerNode) return "Tipo não identificado";
  const type = stripNodePrefix(triggerNode.type);
  return TRIGGER_TYPE_LABELS[type] ?? `Gatilho: ${type}`;
}

interface RealCredentialRef {
  id: string;
  type: string;
  name: string;
  nodes: string[];
}

function extractCredentials(nodes: N8nWorkflow["nodes"]): RealCredentialRef[] {
  const byId = new Map<string, RealCredentialRef>();
  for (const node of nodes) {
    if (!node.credentials) continue;
    for (const [credType, ref] of Object.entries(node.credentials)) {
      let entry = byId.get(ref.id);
      if (!entry) {
        entry = { id: ref.id, type: credType, name: ref.name, nodes: [] };
        byId.set(ref.id, entry);
      }
      entry.nodes.push(node.name);
    }
  }
  return Array.from(byId.values());
}

function toAutomation(
  workflow: N8nWorkflow,
  stats: WorkflowStats | undefined,
  errorDetail: N8nExecutionError | null,
  baseUrl: string,
): Automation {
  const hasData = Boolean(stats && stats.totalCount > 0);
  const successRate = hasData ? Math.round((stats!.successCount / stats!.totalCount) * 100) : 100;
  const health: HealthStatus = !hasData
    // Sem execução na janela analisada: workflow pausado não é "problema", só não roda.
    // Workflow ativo sem dado nenhum merece um olhar (baixa frequência ou nunca rodou).
    ? workflow.active
      ? "Atenção"
      : "Saudável"
    : stats!.lastStatus === "error"
      ? "Crítica"
      : stats!.errorCount > 0
        ? "Atenção"
        : "Saudável";
  const avgDurationSec =
    hasData && stats!.durationsMs.length > 0
      ? Math.round(stats!.durationsMs.reduce((a, b) => a + b, 0) / stats!.durationsMs.length / 1000)
      : 0;
  const triggerNode = workflow.nodes.find((n) => /trigger|webhook|cron|schedule/i.test(n.type));
  const systems = detectSystems(workflow.nodes);
  const realCredentials = extractCredentials(workflow.nodes);
  const automationType = classifyAutomationType(triggerNode);

  return {
    id: `n8n-${workflow.id}`,
    code: `N8N-${workflow.id.slice(0, 6).toUpperCase()}`,
    name: workflow.name,
    platform: "n8n",
    area: "Não classificada",
    status: workflow.active ? "Ativa" : "Pausada",
    health,
    owner: "Não definido",
    lastError:
      hasData && stats!.lastStatus === "error"
        ? errorDetail?.message ?? "Falha na última execução."
        : null,
    lastErrorAt: stats?.lastErrorAt ?? null,
    openIncidents: 0, // preenchido depois de calcular os incidentes
    lastReview: workflow.updatedAt,
    objective: `${automationType} · sincronizado automaticamente do n8n (área e responsável ainda não classificados).`,
    description:
      systems.length > 0 || realCredentials.length > 0
        ? `Sistemas envolvidos: ${systems.length > 0 ? systems.join(", ") : "nenhum identificado"}. Credenciais utilizadas: ${
            realCredentials.length > 0 ? realCredentials.map((c) => c.name).join(", ") : "nenhuma detectada"
          }.`
        : "Nenhum sistema externo ou credencial identificado nos nós deste workflow.",
    trigger: triggerNode ? stripNodePrefix(triggerNode.type) : "Não identificado",
    frequency: "—",
    lastRun: stats?.lastAt ?? workflow.updatedAt,
    nextRun: null,
    successRate,
    avgDurationSec,
    runsLast30d: hasData ? stats!.totalCount : 0,
    systems,
    credentialIds: [],
    realCredentials,
    documentationId: `n8n-doc-${workflow.id}`,
    externalUrl: `${baseUrl}/workflow/${workflow.id}`,
    flow: workflow.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: stripNodePrefix(n.type),
      status: errorDetail?.node === n.name ? "Crítica" : "Saudável",
      description: "",
    })),
    history: [
      { id: `${workflow.id}-created`, date: workflow.createdAt, author: "n8n", description: "Workflow criado" },
      {
        id: `${workflow.id}-updated`,
        date: workflow.updatedAt,
        author: "n8n",
        description: "Última atualização salva no n8n",
      },
    ],
  };
}

function toDocumentation(workflow: N8nWorkflow): Documentation {
  const triggerNode = workflow.nodes.find((n) => /trigger|webhook|cron|schedule/i.test(n.type));
  const systems = detectSystems(workflow.nodes);
  const realCredentials = extractCredentials(workflow.nodes);
  const automationType = classifyAutomationType(triggerNode);

  return {
    id: `n8n-doc-${workflow.id}`,
    code: `DOC-${workflow.id.slice(0, 6).toUpperCase()}`,
    title: workflow.name,
    area: "Não classificada",
    platform: "n8n",
    systems,
    objective: `${automationType} · gerado automaticamente a partir do workflow no n8n.`,
    flowSummary: workflow.nodes.map((n) => n.name).join(" → ") || "Workflow sem nós.",
    dependencies: systems,
    referencedCredentials: realCredentials.map((c) => c.name),
    postmanTests: [],
    contingencyPlan:
      "Não definido — nenhum plano de contingência cadastrado para esta automação ainda.",
    owner: "Não definido",
    updatedAt: workflow.updatedAt.slice(0, 10),
  };
}

function toIncident(
  workflow: N8nWorkflow,
  stats: WorkflowStats,
  detail: N8nExecutionError | null,
  baseUrl: string,
): Incident {
  const isOpen = stats.lastStatus === "error";
  const severity: IncidentSeverity = isOpen ? (stats.errorCount >= 5 ? "Crítica" : "Alta") : "Baixa";

  const countByDate = new Map<string, number>();
  for (const date of stats.errorDates) countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  const timeline = Array.from(countByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    id: `n8n-inc-${workflow.id}`,
    code: `INC-${workflow.id.slice(0, 6).toUpperCase()}`,
    title: `Falha em ${workflow.name}`,
    summary: detail?.description ?? detail?.message ?? "Falha detectada na execução do workflow.",
    severity,
    status: isOpen ? "Aberto" : "Resolvido",
    category: detail?.name ?? "Falha de execução",
    automationId: `n8n-${workflow.id}`,
    automationName: workflow.name,
    failedNode: detail?.node ?? "Não identificado",
    httpCode: detail?.httpCode ?? null,
    occurrences: stats.errorCount,
    firstSeen: stats.firstErrorAt ?? stats.lastErrorAt ?? workflow.updatedAt,
    lastSeen: stats.lastErrorAt ?? workflow.updatedAt,
    owner: "Não definido",
    aiSummary:
      detail?.message ??
      "Detalhes da execução não disponíveis (execução expirada ou removida no n8n).",
    facts: detail
      ? [
          `Nó com falha: ${detail.node ?? "desconhecido"}`,
          detail.nodeType ? `Tipo do nó: ${stripNodePrefix(detail.nodeType)}` : null,
          detail.httpCode ? `Código HTTP: ${detail.httpCode}` : null,
          `${stats.errorCount} ocorrência(s) na janela analisada`,
        ].filter((f): f is string => Boolean(f))
      : [`${stats.errorCount} ocorrência(s) na janela analisada`],
    probableCause:
      detail?.description ?? "Não determinado automaticamente — abra a execução no n8n para detalhes.",
    suggestedFix: "Revisar o nó indicado e suas credenciais diretamente no n8n.",
    evidence: detail?.message ?? "Sem evidências detalhadas disponíveis.",
    n8nExecutionUrl: stats.lastErrorExecutionId
      ? `${baseUrl}/workflow/${workflow.id}/executions/${stats.lastErrorExecutionId}`
      : `${baseUrl}/workflow/${workflow.id}`,
    notionUrl: "",
    timeline,
  };
}

function buildOverview(
  automations: Automation[],
  incidents: Incident[],
  executions: N8nExecution[],
): N8nOperationalData["overview"] {
  const activeAutomations = automations.filter((a) => a.status === "Ativa").length;
  const openIncidents = incidents.filter((i) => i.status !== "Resolvido").length;
  const criticalIncidents = incidents.filter(
    (i) => i.severity === "Crítica" && i.status !== "Resolvido",
  ).length;
  const healthyAutomations = automations.filter((a) => a.health === "Saudável").length;

  const criticalWorkflowIds = new Set(
    incidents
      .filter((i) => i.severity === "Crítica" && i.status !== "Resolvido")
      .map((i) => i.automationId.replace("n8n-", "")),
  );

  // Pré-preenche os últimos 30 dias com zero — sem isso, dias sem erro simplesmente não
  // apareciam no array e o gráfico interpolava uma linha reta entre os poucos pontos
  // existentes, parecendo uma tendência de alta que não existe.
  const byDay = new Map<string, { total: number; criticos: number }>();
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    byDay.set(d.toISOString().slice(0, 10), { total: 0, criticos: 0 });
  }
  for (const e of executions) {
    if (e.status !== "error") continue;
    const date = e.startedAt.slice(0, 10);
    const entry = byDay.get(date);
    if (!entry) continue; // execução fora da janela de 30 dias
    entry.total += 1;
    if (criticalWorkflowIds.has(e.workflowId)) entry.criticos += 1;
  }
  const incidentsByDay: DailyIncidentPoint[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, total: v.total, criticos: v.criticos }));

  // Sem taxonomia de erro real no n8n: usamos as automações com mais incidentes
  // abertos no lugar de "categoria de erro".
  const incidentsByCategory: CategoryPoint[] = incidents
    .filter((i) => i.status !== "Resolvido")
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 8)
    .map((i) => ({ category: i.automationName, total: i.occurrences }));

  return { activeAutomations, openIncidents, criticalIncidents, healthyAutomations, incidentsByDay, incidentsByCategory };
}

export async function loadN8nOperationalData(): Promise<N8nOperationalData | null> {
  if (!isN8nConfigured()) return null;

  const baseUrl = getN8nBaseUrl();
  const [allWorkflows, executions] = await Promise.all([
    fetchN8nWorkflows(),
    fetchN8nRecentExecutions(EXECUTION_WINDOW_PAGES),
  ]);
  // O n8n mantém workflows arquivados na API mas os esconde da UI padrão — espelhamos isso aqui.
  const workflows = allWorkflows.filter((w) => !w.isArchived);

  const stats = buildStats(executions);
  const workflowsById = new Map(workflows.map((w) => [w.id, w] as const));

  const idsNeedingDetail = Array.from(stats.entries())
    .filter(([, s]) => s.errorCount > 0 && s.lastErrorExecutionId)
    .slice(0, MAX_ERROR_DETAIL_FETCHES);

  const detailByWorkflow = new Map<string, N8nExecutionError | null>();
  await Promise.all(
    idsNeedingDetail.map(async ([workflowId, s]) => {
      try {
        detailByWorkflow.set(workflowId, await fetchN8nExecutionError(s.lastErrorExecutionId!));
      } catch {
        detailByWorkflow.set(workflowId, null);
      }
    }),
  );

  const automations = workflows.map((w) =>
    toAutomation(w, stats.get(w.id), detailByWorkflow.get(w.id) ?? null, baseUrl),
  );
  const documentation = workflows.map((w) => toDocumentation(w));

  const incidents = Array.from(stats.entries())
    .filter(([, s]) => s.errorCount > 0)
    .map(([workflowId, s]) => {
      const workflow = workflowsById.get(workflowId);
      return workflow ? toIncident(workflow, s, detailByWorkflow.get(workflowId) ?? null, baseUrl) : null;
    })
    .filter((i): i is Incident => i !== null);

  const openCountByAutomation = new Map<string, number>();
  for (const inc of incidents) {
    if (inc.status === "Aberto") {
      openCountByAutomation.set(inc.automationId, (openCountByAutomation.get(inc.automationId) ?? 0) + 1);
    }
  }
  for (const a of automations) {
    a.openIncidents = openCountByAutomation.get(a.id) ?? 0;
  }

  const overview = buildOverview(automations, incidents, executions);

  return { automations, incidents, documentation, overview };
}
