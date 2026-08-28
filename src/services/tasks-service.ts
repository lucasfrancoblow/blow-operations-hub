import { createServerFn } from "@tanstack/react-start";

import { createTask, deleteTask, listTasks, reorderTasks, updateTask } from "@/lib/tasks-store";
import { createTaskProject, listTaskProjects, updateTaskProject } from "@/lib/task-projects-store";
import type { Task, TaskInput, TaskStatus } from "@/types/tasks";

export const getTasks = createServerFn({ method: "GET" }).handler(async (): Promise<Task[]> =>
  listTasks(),
);

export const createTaskFn = createServerFn({ method: "POST" })
  .validator((input: TaskInput) => input)
  .handler(async ({ data }) => {
    await createTask(data);
  });

interface UpdateTaskInput {
  id: string;
  patch: Partial<TaskInput>;
}

export const updateTaskFn = createServerFn({ method: "POST" })
  .validator((input: UpdateTaskInput) => input)
  .handler(async ({ data }) => {
    await updateTask(data.id, data.patch);
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
