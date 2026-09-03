// Resumo semanal de tarefas paradas/vencidas — chamado só pela rota de cron
// (src/routes/api/cron/task-digest.ts). Fica isolado num arquivo próprio (fora
// de tasks-service.ts) de propósito: é uma função solta, não uma
// `createServerFn`, então o plugin do TanStack Start não consegue recortá-la
// pro chunk de servidor — se ela vivesse num arquivo que o client importa
// (como tasks-service.ts, usado por tarefas.tsx), toda a cadeia de imports
// dela (findUserById -> users-store -> auth.ts -> node:crypto) vazaria pro
// bundle do navegador e quebrava a rota inteira (bug real encontrado ao
// testar — ver commit cd4b262 pra um caso parecido).

import { escapeHtml } from "@/lib/html";
import { findUserById, listUsers } from "@/lib/users-store";
import { getBoardSettings } from "@/lib/task-board-settings-store";
import { listTasks } from "@/lib/tasks-store";
import { sendEmail } from "@/lib/resend-client";
import { renderEmailTemplate, taskDeepLink } from "@/lib/email-template";
import type { Task } from "@/types/tasks";

export async function runWeeklyDigest(): Promise<{ staleCount: number; overdueCount: number }> {
  const [tasks, settings] = await Promise.all([listTasks(), getBoardSettings()]);
  const agingByStatus = new Map(settings.map((s) => [s.status, s.agingThresholdDays]));
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const stale = tasks.filter((t) => {
    const threshold = agingByStatus.get(t.status);
    if (!threshold) return false;
    return now - new Date(t.statusChangedAt).getTime() > threshold * DAY_MS;
  });
  const overdue = tasks.filter(
    (t) =>
      t.dueDate &&
      new Date(t.dueDate).getTime() < now &&
      t.status !== "Concluído" &&
      t.status !== "Recusada",
  );

  const byAssignee = new Map<string, Task[]>();
  for (const task of [...stale, ...overdue]) {
    for (const assignee of task.assignees) {
      const list = byAssignee.get(assignee.id) ?? [];
      if (!list.some((t) => t.id === task.id)) list.push(task);
      byAssignee.set(assignee.id, list);
    }
  }

  function taskLine(t: Task): string {
    const reason =
      stale.includes(t) && overdue.includes(t)
        ? "parada e com prazo vencido"
        : stale.includes(t)
          ? "parada há vários dias"
          : "com prazo vencido";
    return `<li><a href="${taskDeepLink(t.taskNumber)}">#${t.taskNumber} — ${escapeHtml(t.title)}</a> (${t.status}, ${reason})</li>`;
  }

  await Promise.all(
    Array.from(byAssignee.entries()).map(async ([userId, userTasks]) => {
      const user = await findUserById(userId);
      if (!user?.email) return;
      await sendEmail({
        to: user.email,
        subject: `Resumo semanal: ${userTasks.length} tarefa(s) precisando de atenção`,
        html: renderEmailTemplate({
          eyebrow: "Resumo semanal",
          heading: "Tarefas suas precisando de atenção",
          intro: `Olá, ${escapeHtml(user.fullName ?? user.username)}. Estas tarefas suas estão paradas há um tempo ou com o prazo vencido:`,
          highlightBody: `<ul>${userTasks.map(taskLine).join("")}</ul>`,
          footerText: "Você recebeu este e-mail porque é responsável por estas tarefas no hubLOw.",
        }),
      });
    }),
  );

  if (stale.length > 0 || overdue.length > 0) {
    const users = await listUsers();
    const admins = users.filter((u) => u.role === "super_admin" && u.email).map((u) => u.email!);
    await Promise.all(
      admins.map((to) =>
        sendEmail({
          to,
          subject: `Resumo semanal do board: ${stale.length} parada(s), ${overdue.length} vencida(s)`,
          html: renderEmailTemplate({
            eyebrow: "Resumo semanal",
            heading: "Visão geral do board de Tarefas",
            intro: `${stale.length} tarefa(s) parada(s) além do esperado e ${overdue.length} com prazo vencido.`,
            highlightBody: `<ul>${[...new Set([...stale, ...overdue])].map(taskLine).join("")}</ul>`,
            footerText: "Você recebeu este e-mail porque é super admin no hubLOw.",
          }),
        }),
      ),
    );
  }

  return { staleCount: stale.length, overdueCount: overdue.length };
}
