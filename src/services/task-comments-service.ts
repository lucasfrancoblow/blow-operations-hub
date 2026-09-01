import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser } from "@/lib/session";
import { canAccessPage } from "@/lib/page-access";
import { requireTaskAccess } from "@/lib/task-project-access-store";
import { getTask } from "@/lib/tasks-store";
import { getTicketByTaskId } from "@/lib/task-tickets-store";
import { createComment, listComments } from "@/lib/task-comments-store";
import { findUserById } from "@/lib/users-store";
import { sendEmail } from "@/lib/resend-client";
import { escapeHtml } from "@/lib/html";
import type { SessionUser } from "@/lib/auth";
import type { Task } from "@/types/tasks";
import type { TaskComment } from "@/types/comments";

/** Quem tem acesso a Tarefas usa o controle por projeto já existente; quem só
 * tem Chamados (fornecedor/externo) só comenta na tarefa por trás do próprio
 * chamado. */
async function requireCommentAccess(user: SessionUser, taskId: string): Promise<Task> {
  if (canAccessPage(user, "tarefas")) {
    return requireTaskAccess(user, taskId);
  }
  const ticket = await getTicketByTaskId(taskId);
  if (!ticket || ticket.requesterId !== user.id) {
    throw new Error("Você não tem acesso a essa tarefa.");
  }
  const task = await getTask(taskId);
  if (!task) throw new Error("Tarefa não encontrada.");
  return task;
}

/** Avisa todo mundo envolvido na tarefa (quem abriu, responsável, e o
 * solicitante do chamado vinculado, se houver) — exceto quem acabou de
 * comentar. Best-effort: sendEmail nunca lança. */
async function notifyParticipantsOfComment(
  task: Task,
  comment: TaskComment,
  actingUser: SessionUser,
): Promise<void> {
  const ticket = await getTicketByTaskId(task.id);
  const participantIds = new Set<string>();
  if (task.createdBy) participantIds.add(task.createdBy.id);
  if (task.assigneeId) participantIds.add(task.assigneeId);
  if (ticket?.requesterId) participantIds.add(ticket.requesterId);
  participantIds.delete(actingUser.id);
  if (participantIds.size === 0) return;

  const commenterName = escapeHtml(actingUser.fullName || actingUser.username);
  const body = escapeHtml(comment.body).replace(/\n/g, "<br>");

  await Promise.all(
    Array.from(participantIds).map(async (id) => {
      const participant = await findUserById(id);
      if (!participant?.email) return;
      await sendEmail({
        to: participant.email,
        subject: `Novo comentário na tarefa #${task.taskNumber}: ${task.title}`,
        html: `
          <p>${commenterName} comentou na tarefa <strong>#${task.taskNumber} — ${escapeHtml(task.title)}</strong>:</p>
          <p>${body}</p>
        `,
      });
    }),
  );
}

export const listCommentsFn = createServerFn({ method: "GET" })
  .validator((input: { taskId: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    await requireCommentAccess(user, data.taskId);
    return listComments(data.taskId);
  });

export const createCommentFn = createServerFn({ method: "POST" })
  .validator((input: { taskId: string; body: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    const task = await requireCommentAccess(user, data.taskId);
    const body = data.body.trim();
    if (!body) throw new Error("Comentário vazio.");
    const comment = await createComment({ taskId: data.taskId, authorId: user.id, body });
    await notifyParticipantsOfComment(task, comment, user);
    return comment;
  });
