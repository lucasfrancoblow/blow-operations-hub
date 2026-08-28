import { createServerFn } from "@tanstack/react-start";

import { requireTasksAccess } from "@/lib/session";
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
  listProjectMemberIds,
  revokeProjectAccess,
} from "@/lib/task-project-access-store";
import { findUserById } from "@/lib/users-store";
import { sendEmail } from "@/lib/resend-client";
import type { Task, TaskInput, TaskStatus } from "@/types/tasks";

/** Só admin/super_admin gerenciam quem enxerga qual projeto — é uma ação de
 * controle de acesso, não uma ação normal de uso de Tarefas. */
async function requireProjectManager(): Promise<SessionUser> {
  const user = await requireTasksAccess();
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new Error("Só admin/super admin gerenciam acesso a projetos.");
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

export const createTaskFn = createServerFn({ method: "POST" })
  .validator((input: TaskInput) => input)
  .handler(async ({ data }) => {
    await requireTasksAccess();
    const task = await createTask(data);
    if (task.assigneeId) await notifyAssignee(task);
  });

interface UpdateTaskInput {
  id: string;
  patch: Partial<TaskInput>;
}

export const updateTaskFn = createServerFn({ method: "POST" })
  .validator((input: UpdateTaskInput) => input)
  .handler(async ({ data }) => {
    await requireTasksAccess();
    const previous = data.patch.assigneeId !== undefined ? await getTask(data.id) : null;
    await updateTask(data.id, data.patch);
    const newAssigneeId = data.patch.assigneeId;
    if (newAssigneeId && newAssigneeId !== previous?.assigneeId) {
      const updated = await getTask(data.id);
      if (updated) await notifyAssignee(updated);
    }
  });

interface ReorderTasksInput {
  updates: Array<{ id: string; status: TaskStatus; position: number }>;
}

export const reorderTasksFn = createServerFn({ method: "POST" })
  .validator((input: ReorderTasksInput) => input)
  .handler(async ({ data }) => {
    await requireTasksAccess();
    await reorderTasks(data.updates);
  });

export const deleteTaskFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireTasksAccess();
    await deleteTask(data.id);
  });

export const listProjectsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireTasksAccess();
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
  patch: Partial<{ name: string; color: string; archived: boolean }>;
}

export const updateProjectFn = createServerFn({ method: "POST" })
  .validator((input: UpdateProjectInput) => input)
  .handler(async ({ data }) => {
    await requireTasksAccess();
    await updateTaskProject(data.id, data.patch);
  });

export const listProjectMembersFn = createServerFn({ method: "GET" })
  .validator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    await requireProjectManager();
    return listProjectMemberIds(data.projectId);
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
