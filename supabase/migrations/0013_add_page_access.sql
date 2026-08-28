-- Controle de acesso por aba, por usuário. Substitui o antigo tasks_access
-- (boolean, só pra Tarefas) por um array genérico de chaves de página — cobre
-- Tarefas e todas as outras abas do menu (Visão Geral e Usuários ficam de fora:
-- a primeira é a home, sempre visível; a segunda já é super_admin-only à parte).

alter table app_users add column if not exists page_access jsonb not null default '[]'::jsonb;

-- Backfill pra não quebrar ninguém: hoje essas 5 abas já eram abertas pra
-- qualquer usuário logado (sem nenhum controle), então todo mundo que já tem
-- conta continua vendo elas.
update app_users
set page_access = '["leads-recentes","funil-marketing","daily-expansao","automacoes","incidentes"]'::jsonb
where page_access = '[]'::jsonb;

-- Tarefas entra na mesma lista, herdando quem já tinha tasks_access = true.
update app_users
set page_access = page_access || '["tarefas"]'::jsonb
where tasks_access = true
  and not (page_access @> '["tarefas"]'::jsonb);

alter table app_users drop column if exists tasks_access;
