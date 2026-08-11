// Reconciliação de incidentes com o Supabase (ver supabase/migrations/0001_create_incidents.sql).
//
// O n8n ao vivo continua sendo a fonte da verdade sobre estar Aberto ou Resolvido.
// Esta tabela só PRESERVA o retrato de um incidente já visto: se ele saiu do
// histórico consultado no n8n (ver ERROR_HISTORY_PAGES em n8n-metrics.ts) mas já foi
// visto antes, ele continua aparecendo como Resolvido em vez de simplesmente
// desaparecer da tela.
//
// Se SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não estiverem configurados, ou se o
// Supabase falhar por qualquer motivo, a reconciliação é ignorada silenciosamente —
// o hub continua funcionando só com os dados ao vivo, como antes.

import { isSupabaseConfigured, supabaseSelect, supabaseUpsert } from "@/lib/supabase-client";
import type { Incident, IncidentOccurrence, IncidentSeverity, IncidentStatus } from "@/types/hub";

interface IncidentRow {
  id: string;
  automation_id: string;
  code: string;
  title: string;
  summary: string | null;
  severity: string;
  status: string;
  category: string | null;
  automation_name: string;
  failed_node: string | null;
  http_code: number | null;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  owner: string | null;
  ai_summary: string | null;
  facts: string[];
  probable_cause: string | null;
  suggested_fix: string | null;
  evidence: string | null;
  n8n_execution_url: string | null;
  notion_url: string | null;
  timeline: IncidentOccurrence[];
}

function toRow(incident: Incident): IncidentRow {
  return {
    id: incident.id,
    automation_id: incident.automationId,
    code: incident.code,
    title: incident.title,
    summary: incident.summary,
    severity: incident.severity,
    status: incident.status,
    category: incident.category,
    automation_name: incident.automationName,
    failed_node: incident.failedNode,
    http_code: incident.httpCode,
    occurrences: incident.occurrences,
    first_seen: incident.firstSeen,
    last_seen: incident.lastSeen,
    owner: incident.owner,
    ai_summary: incident.aiSummary,
    facts: incident.facts,
    probable_cause: incident.probableCause,
    suggested_fix: incident.suggestedFix,
    evidence: incident.evidence,
    n8n_execution_url: incident.n8nExecutionUrl,
    notion_url: incident.notionUrl,
    timeline: incident.timeline,
  };
}

function fromRow(row: IncidentRow): Incident {
  return {
    id: row.id,
    automationId: row.automation_id,
    code: row.code,
    title: row.title,
    summary: row.summary ?? "",
    severity: row.severity as IncidentSeverity,
    status: row.status as IncidentStatus,
    category: row.category ?? "",
    automationName: row.automation_name,
    failedNode: row.failed_node ?? "",
    httpCode: row.http_code,
    occurrences: row.occurrences,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    owner: row.owner ?? "",
    aiSummary: row.ai_summary ?? "",
    facts: row.facts ?? [],
    probableCause: row.probable_cause ?? "",
    suggestedFix: row.suggested_fix ?? "",
    evidence: row.evidence ?? "",
    n8nExecutionUrl: row.n8n_execution_url ?? "",
    notionUrl: row.notion_url ?? "",
    timeline: row.timeline ?? [],
  };
}

/**
 * Salva o retrato atual dos incidentes ao vivo e devolve a lista completa: os ao
 * vivo + qualquer incidente já visto antes que não apareceu mais no n8n (marcado
 * como Resolvido, já que não há mais evidência de erro nele).
 */
export async function reconcileIncidents(liveIncidents: Incident[]): Promise<Incident[]> {
  if (!isSupabaseConfigured()) return liveIncidents;

  try {
    await supabaseUpsert("incidents", liveIncidents.map(toRow));

    const allRows = await supabaseSelect<IncidentRow>("incidents", "select=*");
    const liveIds = new Set(liveIncidents.map((i) => i.id));

    const historicalOnly = allRows
      .filter((row) => !liveIds.has(row.id))
      .map((row) => fromRow({ ...row, status: "Resolvido" }));

    return [...liveIncidents, ...historicalOnly];
  } catch (error) {
    console.error("Falha ao reconciliar incidentes com o Supabase:", error);
    return liveIncidents;
  }
}
