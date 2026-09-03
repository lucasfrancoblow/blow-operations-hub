-- Configuração por coluna do board: limite de WIP (nº máximo de tarefas antes
-- do contador da coluna acusar) e a partir de quantos dias parada nesse status
-- uma tarefa conta como "envelhecendo". null = sem limite/sem aviso nessa coluna.

create table if not exists task_board_settings (
  status text primary key,
  wip_limit integer,
  aging_threshold_days integer
);

alter table task_board_settings enable row level security;

insert into task_board_settings (status, wip_limit, aging_threshold_days) values
  ('Aguardando aceite', null, null),
  ('Backlog', null, null),
  ('Em andamento', null, 3),
  ('Bloqueado', null, 3),
  ('Em revisão', null, 3),
  ('Concluído', null, null),
  ('Recusada', null, null)
on conflict (status) do nothing;
