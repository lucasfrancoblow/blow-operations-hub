-- Nem todo usuário deve ver a aba "Tarefas" — admin libera por usuário na tela
-- "Usuários". Default true preserva o comportamento atual (todo mundo já via).

alter table app_users add column if not exists tasks_access boolean not null default true;
