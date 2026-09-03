// Persistência das tarefas do backlog interno (ver supabase/migrations/0003_create_tasks.sql,
// 0007_create_task_projects.sql, 0008_add_task_assignee_id.sql, 0024..0026).

import {
  isSupabaseConfigured,
  supabaseDeleteWhere,
  supabaseInsertReturning,
  supabaseSelect,
  supabaseUpdate,
  supabaseUpsert,
} from "@/lib/supabase-client";
import { countAttachmentsForTasks } from "@/lib/task-attachments-store";
import { countCommentsForTasks } from "@/lib/task-comments-store";
import type {
  Task,
  TaskAssignee,
  TaskInput,
  TaskPriority,
  TaskReference,
  TaskStatus,
} from "@/types/tasks";

type EmbeddedUser = { id: string; username: string; full_name: string | null };

export interface TaskRow {
  id: string;
  task_number: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  project_id: string | null;
  project: { id: string; name: string; color: string } | null;
  created_by: string | null;
  creator: EmbeddedUser | null;
  tags: string[];
  story_points: number | null;
  estimated_hours: number | null;
  due_date: string | null;
  reference: TaskReference | null;
  position: number;
  backlog_position: number | null;
  highlighted: boolean;
  status_changed_at: string;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskRelations {
  assignees: TaskAssignee[];
  commentCount: number;
  attachmentCount: number;
  subtaskTotal: number;
  subtaskDone: number;
}

const EMPTY_RELATIONS: TaskRelations = {
  assignees: [],
  commentCount: 0,
  attachmentCount: 0,
  subtaskTotal: 0,
  subtaskDone: 0,
};

function fromEmbeddedUser(user: EmbeddedUser | null) {
  return user ? { id: user.id, username: user.username, fullName: user.full_name } : null;
}

/** PostgREST `in.(...)` — os ids vêm sempre do nosso próprio banco (nunca de
 * input externo direto), mas ainda assim são uuids, sem caractere especial. */
function inFilter(ids: string[]): string {
  return `in.(${ids.join(",")})`;
}

// Embed via PostgREST (funciona porque project_id/created_by são FKs de
// verdade): já traz nome do projeto e quem abriu, sem join manual.
// Exportado: task-tickets-store.ts reusa pra embutir a tarefa vinculada de um chamado.
export const TASK_SELECT =
  "*,project:task_projects(id,name,color),creator:app_users!created_by(id,username,full_name)";

export function fromRow(row: TaskRow, relations: TaskRelations = EMPTY_RELATIONS): Task {
  return {
    id: row.id,
    taskNumber: row.task_number,
    title: row.title,
    description: row.description ?? "",
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    projectId: row.project_id,
    project: row.project,
    assigneeIds: relations.assignees.map((a) => a.id),
    assignees: relations.assignees,
    createdBy: fromEmbeddedUser(row.creator),
    tags: row.tags ?? [],
    storyPoints: row.story_points,
    estimatedHours: row.estimated_hours,
    dueDate: row.due_date,
    reference: row.reference,
    position: row.position,
    backlogPosition: row.backlog_position,
    highlighted: row.highlighted,
    statusChangedAt: row.status_changed_at,
    parentTaskId: row.parent_task_id,
    commentCount: relations.commentCount,
    attachmentCount: relations.attachmentCount,
    subtaskTotal: relations.subtaskTotal,
    subtaskDone: relations.subtaskDone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireSupabase(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.");
  }
}

/** Responsáveis de várias tarefas de uma vez (1 query em lote, não 1 por
 * tarefa) — usado por listTasks/listSubtasks pra montar `assignees` de cada Task. */
async function listAssigneesForTasks(taskIds: string[]): Promise<Map<string, TaskAssignee[]>> {
  const byTask = new Map<string, TaskAssignee[]>();
  if (taskIds.length === 0 || !isSupabaseConfigured()) return byTask;
  const rows = await supabaseSelect<{ task_id: string; assignee: EmbeddedUser | null }>(
    "task_assignees",
    {
      select: "task_id,assignee:app_users!user_id(id,username,full_name)",
      task_id: inFilter(taskIds),
    },
  );
  for (const row of rows) {
    const assignee = fromEmbeddedUser(row.assignee);
    if (!assignee) continue;
    const list = byTask.get(row.task_id) ?? [];
    list.push(assignee);
    byTask.set(row.task_id, list);
  }
  return byTask;
}

/** Progresso de subtarefas (total e concluídas) de várias tarefas-pai de uma
 * vez — mesma técnica de "1 query em lote" usada pros responsáveis. */
async function subtaskProgressForParents(
  parentIds: string[],
): Promise<Map<string, { total: number; done: number }>> {
  const byParent = new Map<string, { total: number; done: number }>();
  if (parentIds.length === 0 || !isSupabaseConfigured()) return byParent;
  const rows = await supabaseSelect<{ parent_task_id: string; status: string }>("tasks", {
    select: "parent_task_id,status",
    parent_task_id: inFilter(parentIds),
    archived: "eq.false",
  });
  for (const row of rows) {
    const entry = byParent.get(row.parent_task_id) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (row.status === "Concluído") entry.done += 1;
    byParent.set(row.parent_task_id, entry);
  }
  return byParent;
}

/** Junta cada TaskRow com suas relações (responsáveis, contagem de
 * comentários/anexos, progresso de subtarefas) — sempre em lote, nunca 1
 * query por linha, mesmo com o board inteiro carregado de uma vez. Exportado:
 * task-tickets-store.ts reusa pra montar o `assignees` da tarefa embutida no
 * chamado (o embed aninhado `task:tasks(...)` não traz isso sozinho). */
export async function attachRelations(rows: TaskRow[]): Promise<Task[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [assigneesByTask, commentCounts, attachmentCounts, subtaskProgress] = await Promise.all([
    listAssigneesForTasks(ids),
    countCommentsForTasks(ids),
    countAttachmentsForTasks(ids),
    subtaskProgressForParents(ids),
  ]);
  return rows.map((row) =>
    fromRow(row, {
      assignees: assigneesByTask.get(row.id) ?? [],
      commentCount: commentCounts[row.id] ?? 0,
      attachmentCount: attachmentCounts[row.id] ?? 0,
      subtaskTotal: subtaskProgress.get(row.id)?.total ?? 0,
      subtaskDone: subtaskProgress.get(row.id)?.done ?? 0,
    }),
  );
}

/**
 * `accessibleProjectIds` — quando informado (usuário "member"), só devolve
 * tarefas sem projeto ("Sem projeto", sempre visível) ou dentro de um desses
 * projetos. `undefined` = sem filtro (admin/super_admin, que veem tudo).
 */
export async function listTasks(accessibleProjectIds?: string[]): Promise<Task[]> {
  if (!isSupabaseConfigured()) return [];
  const filters: Record<string, string> = {
    select: TASK_SELECT,
    archived: "eq.false",
    parent_task_id: "is.null",
    order: "position.asc,created_at.asc",
  };
  if (accessibleProjectIds) {
    filters["or"] =
      accessibleProjectIds.length > 0
        ? `(project_id.is.null,project_id.in.(${accessibleProjectIds.join(",")}))`
        : "(project_id.is.null)";
  }
  const rows = await supabaseSelect<TaskRow>("tasks", filters);
  return attachRelations(rows);
}

/** Subtarefas de uma tarefa-pai — não passam pelo listTasks (que só traz
 * parent_task_id is null), aparecem só dentro do detalhe da tarefa-pai. */
export async function listSubtasks(parentTaskId: string): Promise<Task[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseSelect<TaskRow>("tasks", {
    select: TASK_SELECT,
    archived: "eq.false",
    parent_task_id: `eq.${parentTaskId}`,
    order: "position.asc,created_at.asc",
  });
  return attachRelations(rows);
}

export async function getTask(id: string): Promise<Task | null> {
  if (!isSupabaseConfigured()) return null;
  const rows = await supabaseSelect<TaskRow>("tasks", {
    select: TASK_SELECT,
    id: `eq.${id}`,
    limit: "1",
  });
  if (!rows[0]) return null;
  const [task] = await attachRelations(rows);
  return task ?? null;
}

async function setAssignees(taskId: string, userIds: string[]): Promise<void> {
  await supabaseDeleteWhere("task_assignees", { task_id: `eq.${taskId}` });
  if (userIds.length === 0) return;
  await supabaseUpsert(
    "task_assignees",
    userIds.map((userId) => ({ task_id: taskId, user_id: userId })),
  );
}

// createdBy nunca vem do TaskInput (que é preenchido a partir do que o client manda)
// — é sempre o id de quem está logado, passado à parte pelo service layer.
export async function createTask(input: TaskInput, createdBy: string | null): Promise<Task> {
  requireSupabase();
  const [row] = await supabaseInsertReturning<Record<string, unknown>, TaskRow>(
    "tasks",
    [
      {
        title: input.title,
        description: input.description ?? "",
        status: input.status ?? "Aguardando aceite",
        priority: input.priority ?? "Média",
        project_id: input.projectId ?? null,
        created_by: createdBy,
        tags: input.tags ?? [],
        story_points: input.storyPoints ?? null,
        estimated_hours: input.estimatedHours ?? null,
        due_date: input.dueDate ?? null,
        reference: input.reference ?? null,
        highlighted: input.highlighted ?? false,
        parent_task_id: input.parentTaskId ?? null,
      },
    ],
    { select: TASK_SELECT },
  );
  if (!row) throw new Error("Tarefa criada, mas não foi possível recarregá-la.");
  if (input.assigneeIds && input.assigneeIds.length > 0) {
    await setAssignees(row.id, input.assigneeIds);
  }
  const created = await getTask(row.id);
  if (!created) throw new Error("Tarefa criada, mas não foi possível recarregá-la.");
  return created;
}

/** `previousStatus` vem de quem chama (o service layer já busca a tarefa atual
 * antes de decidir se notifica) — só usado pra saber se `status_changed_at`
 * precisa ser tocado, nunca pra decidir o que mais mudar. */
export async function updateTask(
  id: string,
  patch: Partial<TaskInput>,
  previousStatus?: TaskStatus,
): Promise<void> {
  requireSupabase();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row["title"] = patch.title;
  if (patch.description !== undefined) row["description"] = patch.description;
  if (patch.status !== undefined) {
    row["status"] = patch.status;
    if (patch.status !== previousStatus) row["status_changed_at"] = new Date().toISOString();
  }
  if (patch.priority !== undefined) row["priority"] = patch.priority;
  if (patch.projectId !== undefined) row["project_id"] = patch.projectId;
  if (patch.tags !== undefined) row["tags"] = patch.tags;
  if (patch.storyPoints !== undefined) row["story_points"] = patch.storyPoints;
  if (patch.estimatedHours !== undefined) row["estimated_hours"] = patch.estimatedHours;
  if (patch.dueDate !== undefined) row["due_date"] = patch.dueDate;
  if (patch.reference !== undefined) row["reference"] = patch.reference;
  if (patch.highlighted !== undefined) row["highlighted"] = patch.highlighted;
  if (patch.parentTaskId !== undefined) row["parent_task_id"] = patch.parentTaskId;
  await supabaseUpdate("tasks", id, row);
  if (patch.assigneeIds !== undefined) await setAssignees(id, patch.assigneeIds);
}

/** Atualiza status + posição de várias tarefas de uma vez (drag and drop entre
 * colunas). `previousStatus` de cada item vem de quem chama (mesma tarefa já
 * buscada antes, pra decidir notificação de mudança de status). */
export async function reorderTasks(
  updates: Array<{ id: string; status: TaskStatus; position: number; previousStatus: TaskStatus }>,
): Promise<void> {
  requireSupabase();
  await Promise.all(
    updates.map((u) =>
      supabaseUpdate("tasks", u.id, {
        status: u.status,
        position: u.position,
        updated_at: new Date().toISOString(),
        ...(u.status !== u.previousStatus ? { status_changed_at: new Date().toISOString() } : {}),
      }),
    ),
  );
}

/** Reordena a lista "Backlogs" — não mexe em status/position (isso é do
 * Board); é uma ordem própria, independente por design (ver migration 0021). */
export async function reorderBacklog(
  updates: Array<{ id: string; backlogPosition: number }>,
): Promise<void> {
  requireSupabase();
  await Promise.all(
    updates.map((u) =>
      supabaseUpdate("tasks", u.id, {
        backlog_position: u.backlogPosition,
        updated_at: new Date().toISOString(),
      }),
    ),
  );
}

/** "Excluir" na UI arquiva em vez de apagar de verdade (DELETE físico já causou
 * perda de dado por engano: um clique sem confirmação, tentando excluir um
 * comentário — que nem existe como ação — acabava excluindo a tarefa inteira e,
 * em cascata, os comentários dela). Arquivada some das listas (ver listTasks)
 * mas continua no banco, recuperável. */
export async function archiveTask(id: string): Promise<void> {
  requireSupabase();
  await supabaseUpdate("tasks", id, { archived: true, updated_at: new Date().toISOString() });
}
