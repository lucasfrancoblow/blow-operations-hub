// Tipos de domínio da ferramenta de Tarefas/Backlog interna do hub.
// Espelha supabase/migrations/0003_create_tasks.sql.

export type TaskStatus = "Backlog" | "Em andamento" | "Bloqueado" | "Em revisão" | "Concluído";

export type TaskPriority = "Baixa" | "Média" | "Alta" | "Crítica";

export type TaskReferenceType = "lead" | "incidente";

export const TASK_STATUSES: TaskStatus[] = [
  "Backlog",
  "Em andamento",
  "Bloqueado",
  "Em revisão",
  "Concluído",
];

export const TASK_PRIORITIES: TaskPriority[] = ["Baixa", "Média", "Alta", "Crítica"];

export interface TaskReference {
  type: TaskReferenceType;
  id: string;
  label: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  tags: string[];
  dueDate: string | null;
  reference: TaskReference | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  description?: string | undefined;
  status?: TaskStatus | undefined;
  priority?: TaskPriority | undefined;
  assignee?: string | undefined;
  tags?: string[] | undefined;
  dueDate?: string | null | undefined;
  reference?: TaskReference | null | undefined;
}
