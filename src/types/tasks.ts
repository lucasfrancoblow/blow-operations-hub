// Tipos de domínio da ferramenta de Tarefas/Backlog interna do hub.
// Espelha supabase/migrations/0003_create_tasks.sql.

export type TaskStatus =
  | "Aguardando aceite"
  | "Backlog"
  | "Em andamento"
  | "Bloqueado"
  | "Em revisão"
  | "Concluído"
  | "Recusada";

export type TaskPriority = "Baixa" | "Média" | "Alta" | "Crítica";

export type TaskReferenceType = "lead" | "incidente" | "chamado";

export const TASK_STATUSES: TaskStatus[] = [
  "Aguardando aceite",
  "Backlog",
  "Em andamento",
  "Bloqueado",
  "Em revisão",
  "Concluído",
  "Recusada",
];

export const TASK_PRIORITIES: TaskPriority[] = ["Baixa", "Média", "Alta", "Crítica"];

export interface TaskReference {
  type: TaskReferenceType;
  id: string;
  label: string;
}

export interface TaskProject {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  documentation: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignee {
  id: string;
  username: string;
  fullName: string | null;
}

export interface Task {
  id: string;
  taskNumber: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string | null;
  project: Pick<TaskProject, "id" | "name" | "color"> | null;
  assigneeIds: string[];
  assignees: TaskAssignee[];
  createdBy: TaskAssignee | null;
  tags: string[];
  storyPoints: number | null;
  estimatedHours: number | null;
  dueDate: string | null;
  reference: TaskReference | null;
  position: number;
  backlogPosition: number | null;
  highlighted: boolean;
  statusChangedAt: string;
  parentTaskId: string | null;
  commentCount: number;
  attachmentCount: number;
  subtaskTotal: number;
  subtaskDone: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  description?: string | undefined;
  status?: TaskStatus | undefined;
  priority?: TaskPriority | undefined;
  projectId?: string | null | undefined;
  assigneeIds?: string[] | undefined;
  tags?: string[] | undefined;
  storyPoints?: number | null | undefined;
  estimatedHours?: number | null | undefined;
  dueDate?: string | null | undefined;
  reference?: TaskReference | null | undefined;
  highlighted?: boolean | undefined;
  parentTaskId?: string | null | undefined;
}

export interface TaskBoardSettings {
  status: TaskStatus;
  wipLimit: number | null;
  agingThresholdDays: number | null;
}

export interface TaskSavedViewFilters {
  search?: string;
  assigneeIds?: string[];
  priority?: string;
  highlightedOnly?: boolean;
  groupBy?: "none" | "priority" | "assignee";
}

export interface TaskSavedView {
  id: string;
  name: string;
  filters: TaskSavedViewFilters;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: TaskAssignee | null;
  createdAt: string;
}
