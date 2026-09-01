import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser, requireTasksAccess } from "@/lib/session";
import type { SessionUser } from "@/lib/auth";
import { escapeHtml } from "@/lib/html";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  reorderTasks,
  updateTask,
} from "@/lib/tasks-store";
import { createTaskProject, listTaskProjects, updateTaskProject } from "@/lib/task-projects-store";
import {
  accessibleProjectIdsFor,
  grantProjectAccess,
  listAccessibleProjectIds,
  listProjectMemberIds,
  requireAccessibleProject,
  requireTaskAccess,
  revokeProjectAccess,
} from "@/lib/task-project-access-store";
import { findUserById } from "@/lib/users-store";
import { sendEmail } from "@/lib/resend-client";
import type { Task, TaskInput, TaskStatus } from "@/types/tasks";

/** Só super_admin gerencia quem enxerga qual projeto — é uma ação de
 * controle de acesso, não uma ação normal de uso de Tarefas. "admin" continua
 * vendo todas as abas, mas pra projetos é restrito igual "member"/"external". */
async function requireProjectManager(): Promise<SessionUser> {
  const user = await requireTasksAccess();
  if (user.role !== "super_admin") {
    throw new Error("Só o super admin gerencia acesso a projetos.");
  }
  return user;
}

export const getTasks = createServerFn({ method: "GET" }).handler(async (): Promise<Task[]> => {
  const user = await requireTasksAccess();
  return listTasks(await accessibleProjectIdsFor(user));
});

/** Avisa por e-mail quem acabou de virar responsável por uma tarefa (best-effort:
 * sendEmail nunca lança, então isso nunca derruba a criação/atualização em si). */
async function notifyAssignee(task: Task): Promise<void> {
  if (!task.assigneeId) return;
  const user = await findUserById(task.assigneeId);
  if (!user?.email) return;
  const description = task.description.trim()
    ? escapeHtml(task.description).replace(/\n/g, "<br>")
    : "Sem descrição.";
  await sendEmail({
    to: user.email,
    subject: `Tarefa #${task.taskNumber} atribuída a você: ${task.title}`,
    html: `
      <p>Olá, ${escapeHtml(user.fullName ?? user.username)}.</p>
      <p>Você foi atribuído à tarefa <strong>#${task.taskNumber} — ${escapeHtml(task.title)}</strong> no hubLOw.</p>
      <p><strong>Descrição:</strong><br>${description}</p>
    `,
  });
}

/** Avisa por e-mail quem abriu a tarefa que o status mudou — só se quem abriu
 * não foi quem mexeu agora (best-effort: sendEmail nunca lança). */
async function notifyCreatorOfStatusChange(
  previous: Task,
  newStatus: TaskStatus,
  actingUserId: string,
): Promise<void> {
  if (!previous.createdBy || previous.createdBy.id === actingUserId) return;
  const creator = await findUserById(previous.createdBy.id);
  if (!creator?.email) return;
  await sendEmail({
    to: creator.email,
    subject: `Tarefa #${previous.taskNumber} mudou de status: ${newStatus}`,
    html: `
      <p>A tarefa <strong>#${previous.taskNumber} — ${escapeHtml(previous.title)}</strong> que você abriu mudou de status.</p>
      <p><strong>${escapeHtml(previous.status)}</strong> → <strong>${escapeHtml(newStatus)}</strong></p>
    `,
  });
}

export const createTaskFn = createServerFn({ method: "POST" })
  .validator((input: TaskInput) => input)
  .handler(async ({ data }) => {
    const user = await requireTasksAccess();
    await requireAccessibleProject(user, data.projectId ?? null);
    const task = await createTask(data, user.id);
    if (task.assigneeId) await notifyAssignee(task);
  });

interface UpdateTaskInput {
  id: string;
  patch: Partial<TaskInput>;
}

export const updateTaskFn = createServerFn({ method: "POST" })
  .validator((input: UpdateTaskInput) => input)
  .handler(async ({ data }) => {
    const user = await requireTasksAccess();
    const current = await requireTaskAccess(user, data.id);
    if (data.patch.projectId !== undefined) {
      await requireAccessibleProject(user, data.patch.projectId);
    }
    await updateTask(data.id, data.patch);
    const newAssigneeId = data.patch.assigneeId;
    if (newAssigneeId && newAssigneeId !== current.assigneeId) {
      const updated = await getTask(data.id);
      if (updated) await notifyAssignee(updated);
    }
    if (data.patch.status !== undefined && data.patch.status !== current.status) {
      await notifyCreatorOfStatusChange(current, data.patch.status, user.id);
    }
  });

interface ReorderTasksInput {
  updates: Array<{ id: string; status: TaskStatus; position: number }>;
}

export const reorderTasksFn = createServerFn({ method: "POST" })
  .validator((input: ReorderTasksInput) => input)
  .handler(async ({ data }) => {
    const user = await requireTasksAccess();
    const previousTasks = await Promise.all(data.updates.map((u) => requireTaskAccess(user, u.id)));
    await reorderTasks(data.updates);
    await Promise.all(
      data.updates.map((u, i) => {
        const previous = previousTasks[i]!;
        if (previous.status === u.status) return;
        return notifyCreatorOfStatusChange(previous, u.status, user.id);
      }),
    );
  });

export const deleteTaskFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTasksAccess();
    await requireTaskAccess(user, data.id);
    await deleteTask(data.id);
  });

// Não exige requireTasksAccess: quem só tem a aba Chamados (ex.: fornecedor
// externo) também precisa listar os projetos liberados pra ele pra escolher ao
// abrir um chamado. O resultado já vem filtrado por accessibleProjectIdsFor,
// então abrir esse acesso não vaza nada além do que o próprio chamador já vê.
export const listProjectsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSessionUser();
  return listTaskProjects(await accessibleProjectIdsFor(user));
});

export const createProjectFn = createServerFn({ method: "POST" })
  .validator((input: { name: string; color: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTasksAccess();
    const project = await createTaskProject(data);
    // Sem isso, quem acabou de criar o projeto não veria ele mesmo (oculto por
    // padrão) até um admin liberar — libera pra quem criou na hora.
    await grantProjectAccess(project.id, user.id);
  });

interface UpdateProjectInput {
  id: string;
  patch: Partial<{ name: string; color: string; archived: boolean; documentation: string | null }>;
}

export const updateProjectFn = createServerFn({ method: "POST" })
  .validator((input: UpdateProjectInput) => input)
  .handler(async ({ data }) => {
    const user = await requireTasksAccess();
    await requireAccessibleProject(user, data.id);
    await updateTaskProject(data.id, data.patch);
  });

export const listProjectMembersFn = createServerFn({ method: "GET" })
  .validator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    await requireProjectManager();
    return listProjectMemberIds(data.projectId);
  });

/** Ids de projeto liberados pra um usuário específico — usado na tela
 * "Usuários" pra montar o checklist de projetos dentro de "Editar perfil". */
export const listUserProjectAccessFn = createServerFn({ method: "GET" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    await requireProjectManager();
    return listAccessibleProjectIds(data.userId);
  });

export const grantProjectAccessFn = createServerFn({ method: "POST" })
  .validator((input: { projectId: string; userId: string }) => input)
  .handler(async ({ data }) => {
    await requireProjectManager();
    await grantProjectAccess(data.projectId, data.userId);
  });

export const revokeProjectAccessFn = createServerFn({ method: "POST" })
  .validator((input: { projectId: string; userId: string }) => input)
  .handler(async ({ data }) => {
    await requireProjectManager();
    await revokeProjectAccess(data.projectId, data.userId);
  });
