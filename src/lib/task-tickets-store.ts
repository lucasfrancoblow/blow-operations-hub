// Persistência de Chamados (ver supabase/migrations/0016_create_task_tickets.sql).
// Sempre traz a tarefa vinculada embutida (mesmo TASK_SELECT de tasks-store.ts) —
// status/prioridade/responsável do chamado vêm de lá, sem estado duplicado aqui.

import {
  isSupabaseConfigured,
  supabaseInsertReturning,
  supabaseSelect,
} from "@/lib/supabase-client";
import { TASK_SELECT, attachRelations, type TaskRow } from "@/lib/tasks-store";
import type { Ticket, TicketChannel } from "@/types/tickets";

interface TicketRow {
  id: string;
  ticket_number: number;
  task_id: string;
  channel: string;
  requester_id: string | null;
  requester_name: string;
  requester_email: string | null;
  created_at: string;
  task: TaskRow;
}

const TICKET_SELECT = `*,task:tasks(${TASK_SELECT})`;

async function fromRow(row: TicketRow): Promise<Ticket> {
  const [task] = await attachRelations([row.task]);
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    taskId: row.task_id,
    channel: row.channel as TicketChannel,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    createdAt: row.created_at,
    task: task!,
  };
}

function requireSupabase(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.");
  }
}

/** `requesterId` — quando informado, só devolve os chamados abertos por esse
 * usuário. `undefined` = sem filtro (admin/super_admin, que veem todos). */
export async function listTickets(requesterId?: string): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return [];
  const filters: Record<string, string> = { select: TICKET_SELECT, order: "created_at.desc" };
  if (requesterId) filters["requester_id"] = `eq.${requesterId}`;
  const rows = await supabaseSelect<TicketRow>("task_tickets", filters);
  return Promise.all(rows.map(fromRow));
}

export async function getTicket(id: string): Promise<Ticket | null> {
  if (!isSupabaseConfigured()) return null;
  const rows = await supabaseSelect<TicketRow>("task_tickets", {
    select: TICKET_SELECT,
    id: `eq.${id}`,
    limit: "1",
  });
  return rows[0] ? fromRow(rows[0]) : null;
}

/** Chamado vinculado a uma tarefa, se houver — usado pra checar se quem está
 * comentando numa tarefa é o solicitante do chamado por trás dela (fornecedor
 * sem acesso a Tarefas). */
export async function getTicketByTaskId(taskId: string): Promise<Ticket | null> {
  if (!isSupabaseConfigured()) return null;
  const rows = await supabaseSelect<TicketRow>("task_tickets", {
    select: TICKET_SELECT,
    task_id: `eq.${taskId}`,
    limit: "1",
  });
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createTicket(input: {
  taskId: string;
  channel: TicketChannel;
  requesterId: string | null;
  requesterName: string;
  requesterEmail: string | null;
}): Promise<Ticket> {
  requireSupabase();
  const [row] = await supabaseInsertReturning<Record<string, unknown>, TicketRow>(
    "task_tickets",
    [
      {
        task_id: input.taskId,
        channel: input.channel,
        requester_id: input.requesterId,
        requester_name: input.requesterName,
        requester_email: input.requesterEmail,
      },
    ],
    { select: TICKET_SELECT },
  );
  if (!row) throw new Error("Chamado criado, mas não foi possível recarregá-lo.");
  return fromRow(row);
}
