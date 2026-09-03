import { createServerFn } from "@tanstack/react-start";

import { requireChamadosAccess } from "@/lib/session";
import { escapeHtml } from "@/lib/html";
import { requireAccessibleProject } from "@/lib/task-project-access-store";
import { createTask, updateTask } from "@/lib/tasks-store";
import { createTicket, getTicket, listTickets } from "@/lib/task-tickets-store";
import { listUsers } from "@/lib/users-store";
import { sendEmail } from "@/lib/resend-client";
import { renderEmailTemplate, ticketDeepLink } from "@/lib/email-template";
import type { Task } from "@/types/tasks";
import type { Ticket, TicketInput } from "@/types/tickets";

function isAdminLike(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

// Endereço fixo do time de suporte — recebe todo chamado novo além de
// admin/super_admin com e-mail cadastrado. Mesmo Resend/domínio já configurado
// (RESEND_API_KEY/RESEND_FROM_EMAIL): enviar pra outro endereço não exige conta nova.
const SUPPORT_INBOX_EMAIL = "suporte@meublow.com.br";

/** Avisa admin/super_admin com e-mail cadastrado (+ SUPPORT_INBOX_EMAIL) que um
 * chamado novo chegou (best-effort — sendEmail nunca lança). */
async function notifyAdminsOfNewTicket(ticket: Ticket, task: Task): Promise<void> {
  const users = await listUsers();
  const adminEmails = users.filter((u) => isAdminLike(u.role) && u.email).map((u) => u.email!);
  const recipients = [...new Set([...adminEmails, SUPPORT_INBOX_EMAIL])];

  const projectLine = task.project ? ` na User Story ${escapeHtml(task.project.name)}` : "";
  const description = task.description.trim()
    ? escapeHtml(task.description).replace(/\n/g, "<br>")
    : "Sem descrição.";
  await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `Novo chamado #${ticket.ticketNumber}: ${task.title}`,
        html: renderEmailTemplate({
          eyebrow: "Novo chamado",
          heading: `Novo chamado aberto por ${escapeHtml(ticket.requesterName)}${projectLine}`,
          highlightTitle: `#${ticket.ticketNumber} — ${escapeHtml(task.title)}`,
          highlightBody: description,
          ctaLabel: "Ver chamado",
          ctaUrl: ticketDeepLink(ticket.ticketNumber),
          footerText: "Você recebeu este e-mail porque é admin/super admin no hubLOw.",
        }),
      }),
    ),
  );
}

/** Confirma pro próprio solicitante que o chamado foi recebido (best-effort —
 * sendEmail nunca lança). Só dispara se ele informou e-mail. */
async function notifyRequesterOfNewTicket(ticket: Ticket, task: Task): Promise<void> {
  if (!ticket.requesterEmail) return;
  await sendEmail({
    to: ticket.requesterEmail,
    subject: `Recebemos seu chamado #${ticket.ticketNumber}: ${task.title}`,
    html: renderEmailTemplate({
      eyebrow: "Chamado recebido",
      heading: `Recebemos seu chamado #${ticket.ticketNumber}`,
      intro: `Olá, ${escapeHtml(ticket.requesterName)}. Seu chamado foi recebido e nossa equipe já foi avisada.`,
      highlightTitle: `#${ticket.ticketNumber} — ${escapeHtml(task.title)}`,
      ctaLabel: "Ver chamado",
      ctaUrl: ticketDeepLink(ticket.ticketNumber),
      footerText: "Você recebeu este e-mail porque abriu este chamado no hubLOw.",
    }),
  });
}

export const createTicketFn = createServerFn({ method: "POST" })
  .validator((input: TicketInput) => input)
  .handler(async ({ data }) => {
    const user = await requireChamadosAccess();
    await requireAccessibleProject(user, data.projectId);

    const task = await createTask(
      {
        title: data.title,
        description: data.description,
        projectId: data.projectId,
        status: "Aguardando aceite",
        priority: data.priority,
        dueDate: data.dueDate,
      },
      user.id,
    );

    const ticket = await createTicket({
      taskId: task.id,
      channel: "site",
      requesterId: user.id,
      requesterName: data.requesterName,
      requesterEmail: data.requesterEmail,
    });

    await updateTask(task.id, {
      reference: { type: "chamado", id: ticket.id, label: `Chamado #${ticket.ticketNumber}` },
    });

    await notifyAdminsOfNewTicket(ticket, task);
    await notifyRequesterOfNewTicket(ticket, task);

    return ticket;
  });

export const listTicketsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireChamadosAccess();
  return listTickets(isAdminLike(user.role) ? undefined : user.id);
});

export const getTicketFn = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireChamadosAccess();
    const ticket = await getTicket(data.id);
    if (!ticket) throw new Error("Chamado não encontrado.");
    if (!isAdminLike(user.role) && ticket.requesterId !== user.id) {
      throw new Error("Você não tem acesso a esse chamado.");
    }
    return ticket;
  });

/** Edição limitada pro solicitante (ou admin/super_admin): só título e
 * descrição do chamado — status, prioridade, projeto, responsável, prazo,
 * tags, anexos e exclusão continuam exclusivos de quem tem acesso a Tarefas
 * de verdade (via TaskDetailSheet). Não exige requireTasksAccess: quem só tem
 * a aba Chamados também pode corrigir o próprio pedido. */
export const updateTicketDetailsFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; title: string; description: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireChamadosAccess();
    const ticket = await getTicket(data.id);
    if (!ticket) throw new Error("Chamado não encontrado.");
    if (!isAdminLike(user.role) && ticket.requesterId !== user.id) {
      throw new Error("Você não tem acesso a esse chamado.");
    }
    await updateTask(ticket.taskId, { title: data.title, description: data.description });
  });
