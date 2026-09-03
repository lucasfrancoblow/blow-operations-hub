// Preferências operacionais do hub (ver supabase/migrations/0030_create_hub_settings.sql).
// Linha única ("default") — preferências do hub como um todo, não por usuário.

import { isSupabaseConfigured, supabaseSelect, supabaseUpdateWhere } from "@/lib/supabase-client";

export interface HubSettings {
  slackCriticalIncidents: boolean;
  dailyEmailSummary: boolean;
  credentialReviewAlerts: boolean;
  credentialReviewDays: number;
  criticalIncidentSlaHours: number;
}

const DEFAULTS: HubSettings = {
  slackCriticalIncidents: true,
  dailyEmailSummary: false,
  credentialReviewAlerts: true,
  credentialReviewDays: 90,
  criticalIncidentSlaHours: 4,
};

interface Row {
  settings: Partial<HubSettings>;
}

export async function getHubSettings(): Promise<HubSettings> {
  if (!isSupabaseConfigured()) return DEFAULTS;
  const rows = await supabaseSelect<Row>("hub_settings", { select: "settings", id: "eq.default" });
  return { ...DEFAULTS, ...(rows[0]?.settings ?? {}) };
}

export async function updateHubSettings(patch: Partial<HubSettings>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const current = await getHubSettings();
  await supabaseUpdateWhere(
    "hub_settings",
    { id: "eq.default" },
    { settings: { ...current, ...patch }, updated_at: new Date().toISOString() },
  );
}
