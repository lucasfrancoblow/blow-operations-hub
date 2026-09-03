// Log de ações sensíveis sobre contas (ver supabase/migrations/0029_add_login_lockout_and_audit_log.sql).
// Antes trocar o papel de alguém ou redefinir senha era silencioso — nenhum
// registro de quem fez o quê.

import { isSupabaseConfigured, supabaseInsertReturning } from "@/lib/supabase-client";

export type AuditAction = "role_changed" | "password_reset" | "user_activated" | "user_deactivated";

export async function logAuditEvent(input: {
  actorId: string;
  action: AuditAction;
  targetUserId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabaseInsertReturning("audit_log", [
    {
      actor_id: input.actorId,
      action: input.action,
      target_user_id: input.targetUserId,
      details: input.details ?? {},
    },
  ]);
}
