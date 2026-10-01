// Itens do sino de notificações do TopNav. Hoje não há sinais ativos: os
// módulos de tarefas, chamados e incidentes saíram do hub. Mantém o contrato
// para receber alertas de leads (ex.: lead sem resposta) numa próxima etapa.

import { createServerFn } from "@tanstack/react-start";

import { requireSessionUser } from "@/lib/session";

export interface NotificationItem {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: "critical" | "warning";
}

export const getNotificationsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<NotificationItem[]> => {
    await requireSessionUser();
    return [];
  },
);
