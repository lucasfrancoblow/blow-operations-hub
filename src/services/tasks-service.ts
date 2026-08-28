import { createServerFn } from "@tanstack/react-start";

import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  reorderTasks,
  updateTask,
} from "@/lib/tasks-store";
import { createTaskProject, listTaskProjects, updateTaskProject } from "@/lib/task-projects-store";
import { findUserById } from "@/lib/users-store";
import { sendEmail } from "@/lib/resend-client";
import type { Task, TaskInput, TaskStatus } from "@/types/tasks";

export const getTasks = createServerFn({ method: "GET" }).handler(async (): Promise<Task[]> =>
  listTasks(),
);

/** Avisa por e-mail quem acabou de virar responsável por uma tarefa (best-effort:
 * sendEmail nunca lança, então isso nunca derruba a criação/atualização em si). */
async function notifyAssignee(assigneeId: string, taskTitle: string): Promise<void> {
  const user = await findUserById(assigneeId);
  if (!user?.email) return;
  await sendEmail({
    to: user.email,
    subject: `Nova tarefa atribuída a você: ${taskTitle}`,
    html: `<p>Olá, ${user.fullName ?? user.username}.</p><p>Você foi atribuído à tarefa <strong>${taskTitle}</strong> no hubLOw.</p>`,
  });
}

export const createTaskFn = createServerFn({ method: "POST" })
  .validator((input: TaskInput) => input)
  .handler(async ({ data }) => {
    await createTask(data);
    if (data.assigneeId) await notifyAssignee(data.assigneeId, data.title);
  });

interface UpdateTaskInput {
  id: string;
  patch: Partial<TaskInput>;
}

export const updateTaskFn = createServerFn({ method: "POST" })
  .validator((input: UpdateTaskInput) => input)
  .handler(async ({ data }) => {
    const previous = data.patch.assigneeId !== undefined ? await getTask(data.id) : null;
    await updateTask(data.id, data.patch);
    const newAssigneeId = data.patch.assigneeId;
    if (newAssigneeId && newAssigneeId !== previous?.assigneeId) {
      await notifyAssignee(newAssigneeId, data.patch.title ?? previous?.title ?? "Tarefa");
    }
  });

interface ReorderTasksInput {
  updates: Array<{ id: string; status: TaskStatus; position: number }>;
}

export const reorderTasksFn = createServerFn({ method: "POST" })
  .validator((input: ReorderTasksInput) => input)
  .handler(async ({ data }) => {
    await reorderTasks(data.updates);
  });

export const deleteTaskFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await deleteTask(data.id);
  });

export const listProjectsFn = createServerFn({ method: "GET" }).handler(async () =>
  listTaskProjects(),
);

export const createProjectFn = createServerFn({ method: "POST" })
  .validator((input: { name: string; color: string }) => input)
  .handler(async ({ data }) => {
    await createTaskProject(data);
  });

interface UpdateProjectInput {
  id: string;
  patch: Partial<{ name: string; color: string; archived: boolean }>;
}

export const updateProjectFn = createServerFn({ method: "POST" })
  .validator((input: UpdateProjectInput) => input)
  .handler(async ({ data }) => {
    await updateTaskProject(data.id, data.patch);
  });
