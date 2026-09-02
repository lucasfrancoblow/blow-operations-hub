import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser, requireTasksAccess } from "@/lib/session";
import type { SessionUser } from "@/lib/auth";
import { escapeHtml } from "@/lib/html";
import {
  archiveTask,
  createTask,
  getTask,
  listTasks,
  reorderBacklog,
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
import { findUserById, listUsers } from "@/lib/users-store";
import { sendEmail } from "@/lib/resend-client";
import { EMAIL_TONE, renderEmailTemplate, taskDeepLink } from "@/lib/email-template";
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
    html: renderEmailTemplate({
      eyebrow: "Nova atribuição",
      heading: `Você foi atribuído à tarefa #${task.taskNumber}`,
      intro: `Olá, ${escapeHtml(user.fullName ?? user.username)}. A tarefa abaixo foi atribuída a você no hubLOw.`,
      highlightTitle: `#${task.taskNumber} — ${escapeHtml(task.title)}`,
      highlightBody: description,
      ctaLabel: "Ver tarefa",
      ctaUrl: taskDeepLink(task.taskNumber),
      footerText: "Você recebeu este e-mail porque foi atribuído a esta tarefa no hubLOw.",
    }),
  });
}

/** Avisa por e-mail quem abriu a tarefa que o status mudou — só se quem abriu
 * não foi quem mexeu agora (best-effort: sendEmail nunca lança). Sair de
 * "Aguardando aceite" ganha um e-mail específico de aceite/recusa; qualquer
 * outra mudança de status usa o aviso genérico. */
async function notifyCreatorOfStatusChange(
  previous: Task,
  newStatus: TaskStatus,
  actingUserId: string,
): Promise<void> {
  if (!previous.createdBy || previous.createdBy.id === actingUserId) return;
  const creator = await findUserById(previous.createdBy.id);
  if (!creator?.email) return;

  if (previous.status === "Aguardando aceite" && newStatus !== "Aguardando aceite") {
    const accepted = newStatus !== "Recusada";
    await sendEmail({
      to: creator.email,
      subject: accepted
        ? `Tarefa #${previous.taskNumber} foi aceita`
        : `Tarefa #${previous.taskNumber} foi recusada`,
      html: renderEmailTemplate({
        eyebrow: accepted ? "Aceita" : "Recusada",
        eyebrowColor: accepted ? EMAIL_TONE.success : EMAIL_TONE.critical,
        heading: `Sua tarefa #${previous.taskNumber} foi ${accepted ? "aceita" : "recusada"}`,
        intro: accepted
          ? "A tarefa que você abriu entrou no fluxo de trabalho do time."
          : "A tarefa que você abriu não foi aceita pelo time.",
        highlightTitle: `#${previous.taskNumber} — ${escapeHtml(previous.title)}`,
        ctaLabel: "Ver tarefa",
        ctaUrl: taskDeepLink(previous.taskNumber),
        footerText: "Você recebeu este e-mail porque abriu esta tarefa no hubLOw.",
      }),
    });
    return;
  }

  await sendEmail({
    to: creator.email,
    subject: `Tarefa #${previous.taskNumber} mudou de status: ${newStatus}`,
    html: renderEmailTemplate({
      eyebrow: "Mudança de status",
      heading: `A tarefa #${previous.taskNumber} mudou de status`,
      intro: `<strong>${escapeHtml(previous.status)}</strong> → <strong>${escapeHtml(newStatus)}</strong>`,
      highlightTitle: `#${previous.taskNumber} — ${escapeHtml(previous.title)}`,
      ctaLabel: "Ver tarefa",
      ctaUrl: taskDeepLink(previous.taskNumber),
      footerText: "Você recebeu este e-mail porque abriu esta tarefa no hubLOw.",
    }),
  });
}

/** Avisa os super_admin (Lucas e Fernando) sempre que uma tarefa é excluída
 * (arquivada) — independente de quem excluiu (best-effort: sendEmail nunca
 * lança). Sem link "Ver tarefa": ela some das listas normais. */
async function notifyAdminsOfDeletion(task: Task, actingUser: SessionUser): Promise<void> {
  const users = await listUsers();
  const recipients = users.filter((u) => u.role === "super_admin" && u.email).map((u) => u.email!);
  await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `Tarefa #${task.taskNumber} foi excluída`,
        html: renderEmailTemplate({
          eyebrow: "Tarefa excluída",
          eyebrowColor: EMAIL_TONE.critical,
          heading: `A tarefa #${task.taskNumber} foi excluída`,
          intro: `Excluída por ${escapeHtml(actingUser.fullName ?? actingUser.username)}. Ela foi arquivada (não apagada de verdade) — se foi engano, é só pedir pra alguém com acesso ao banco recuperar.`,
          highlightTitle: `#${task.taskNumber} — ${escapeHtml(task.title)}`,
          footerText: "Você recebeu este e-mail porque é super admin no hubLOw.",
        }),
      }),
    ),
  );
}

/** Avisa os super_admin (Lucas e Fernando) de toda tarefa nova, independente
 * de quem criou ou se tem responsável — visão geral por cima da notificação
 * específica de atribuição (best-effort: sendEmail nunca lança). */
async function notifyAdminsOfNewTask(task: Task, actingUser: SessionUser): Promise<void> {
  const users = await listUsers();
  const recipients = users.filter((u) => u.role === "super_admin" && u.email).map((u) => u.email!);
  const description = task.description.trim()
    ? escapeHtml(task.description).replace(/\n/g, "<br>")
    : "Sem descrição.";
  await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `Nova tarefa #${task.taskNumber}: ${task.title}`,
        html: renderEmailTemplate({
          eyebrow: "Nova tarefa",
          heading: `Nova tarefa criada por ${escapeHtml(actingUser.fullName ?? actingUser.username)}`,
          highlightTitle: `#${task.taskNumber} — ${escapeHtml(task.title)}`,
          highlightBody: description,
          ctaLabel: "Ver tarefa",
          ctaUrl: taskDeepLink(task.taskNumber),
          footerText: "Você recebeu este e-mail porque é super admin no hubLOw.",
        }),
      }),
    ),
  );
}

export const createTaskFn = createServerFn({ method: "POST" })
  .validator((input: TaskInput) => input)
  .handler(async ({ data }) => {
    const user = await requireTasksAccess();
    await requireAccessibleProject(user, data.projectId ?? null);
    const task = await createTask(data, user.id);
    if (task.assigneeId) await notifyAssignee(task);
    await notifyAdminsOfNewTask(task, user);
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

interface ReorderBacklogInput {
  updates: Array<{ id: string; backlogPosition: number }>;
}

export const reorderBacklogFn = createServerFn({ method: "POST" })
  .validator((input: ReorderBacklogInput) => input)
  .handler(async ({ data }) => {
    const user = await requireTasksAccess();
    await Promise.all(data.updates.map((u) => requireTaskAccess(user, u.id)));
    await reorderBacklog(data.updates);
  });

export const deleteTaskFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTasksAccess();
    const task = await requireTaskAccess(user, data.id);
    await archiveTask(data.id);
    await notifyAdminsOfDeletion(task, user);
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
