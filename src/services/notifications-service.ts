// Itens do sino de notificações do TopNav — antes era um toast fixo
// ("3 incidentes abertos exigem atenção") sempre igual, independente do que
// estivesse acontecendo de verdade. Agora agrega sinais reais e baratos:
// incidentes críticos (via cache de 45s já existente em n8n-service.ts) e
// tarefas (aguardando aceite / vencidas do próprio usuário, via Supabase).

import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser } from "@/lib/session";
import { canAccessPage } from "@/lib/page-access";
import { hubService } from "@/services/hub-service";
import { listTasks } from "@/lib/tasks-store";
import { accessibleProjectIdsFor } from "@/lib/task-project-access-store";

export interface NotificationItem {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: "critical" | "warning";
}

export const getNotificationsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<NotificationItem[]> => {
    const user = await requireSessionUser();
    const items: NotificationItem[] = [];

    if (canAccessPage(user, "incidentes")) {
      const overview = await hubService.getOverview();
      if (overview.criticalIncidents > 0) {
        items.push({
          id: "incidents-critical",
          label: `${overview.criticalIncidents} incidente(s) crítico(s) aberto(s)`,
          count: overview.criticalIncidents,
          href: "/incidentes",
          tone: "critical",
        });
      }
    }

    if (canAccessPage(user, "tarefas")) {
      const tasks = await listTasks(await accessibleProjectIdsFor(user));

      const waiting = tasks.filter((t) => t.status === "Aguardando aceite").length;
      if (waiting > 0) {
        items.push({
          id: "tasks-waiting",
          label: `${waiting} tarefa(s) aguardando aceite`,
          count: waiting,
          href: "/tarefas",
          tone: "warning",
        });
      }

      const now = Date.now();
      const overdueMine = tasks.filter(
        (t) =>
          t.assigneeIds.includes(user.id) &&
          t.dueDate &&
          new Date(t.dueDate).getTime() < now &&
          t.status !== "Concluído" &&
          t.status !== "Recusada",
      ).length;
      if (overdueMine > 0) {
        items.push({
          id: "tasks-overdue-mine",
          label: `${overdueMine} tarefa(s) sua(s) com prazo vencido`,
          count: overdueMine,
          href: "/tarefas",
          tone: "critical",
        });
      }
    }

    return items;
  },
);
