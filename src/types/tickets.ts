// Tipos de domínio de Chamados. Espelha supabase/migrations/0016_create_task_tickets.sql.
// Um chamado é uma `task` com metadados de quem/como abriu — status, prioridade e
// responsável do chamado são os da tarefa vinculada (task), sem estado duplicado.

import type { Task } from "@/types/tasks";

export type TicketChannel = "site" | "email" | "slack" | "whatsapp";

export interface Ticket {
  id: string;
  ticketNumber: number;
  taskId: string;
  channel: TicketChannel;
  requesterId: string | null;
  requesterName: string;
  requesterEmail: string | null;
  createdAt: string;
  task: Task;
}

export interface TicketInput {
  projectId: string | null;
  title: string;
  description: string;
  requesterName: string;
  requesterEmail: string | null;
}
