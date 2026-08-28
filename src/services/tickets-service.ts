import { createServerFn } from "@tanstack/react-start";

import { requireChamadosAccess } from "@/lib/session";
import { escapeHtml } from "@/lib/html";
import { accessibleProjectIdsFor } from "@/lib/task-project-access-store";
import { createTask, updateTask } from "@/lib/tasks-store";
import { createTicket, getTicket, listTickets } from "@/lib/task-tickets-store";
import { listUsers } from "@/lib/users-store";
import { sendEmail } from "@/lib/resend-client";
import type { Task } from "@/types/tasks";
import type { Ticket, TicketInput } from "@/types/tickets";

function isAdminLike(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

/** Avisa admin/super_admin com e-mail cadastrado que um chamado novo chegou
 * (best-effort — sendEmail nunca lança). */
async function notifyAdminsOfNewTicket(ticket: Ticket, task: Task): Promise<void> {
  const users = await listUsers();
  const recipients = users.filter((u) => isAdminLike(u.role) && u.email);
  const projectLine = task.project
    ? ` no projeto <strong>${escapeHtml(task.project.name)}</strong>`
    : "";
  const description = task.description.trim()
    ? escapeHtml(task.description).replace(/\n/g, "<br>")
    : "Sem descrição.";
  await Promise.all(
    recipients.map((u) =>
      sendEmail({
        to: u.email!,
        subject: `Novo chamado #${ticket.ticketNumber}: ${task.title}`,
        html: `
          <p>Novo chamado aberto por ${escapeHtml(ticket.requesterName)}${projectLine}.</p>
          <p><strong>#${ticket.ticketNumber} — ${escapeHtml(task.title)}</strong></p>
          <p>${description}</p>
        `,
      }),
    ),
  );
}

export const createTicketFn = createServerFn({ method: "POST" })
  .validator((input: TicketInput) => input)
  .handler(async ({ data }) => {
    const user = await requireChamadosAccess();
    const allowed = await accessibleProjectIdsFor(user);
    if (data.projectId && allowed !== undefined && !allowed.includes(data.projectId)) {
      throw new Error("Você não tem acesso a esse projeto.");
    }

    const task = await createTask({
      title: data.title,
      description: data.description,
      projectId: data.projectId,
    });

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
