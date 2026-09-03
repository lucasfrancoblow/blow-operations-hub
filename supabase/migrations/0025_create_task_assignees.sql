-- Múltiplos responsáveis por tarefa: substitui a FK única "assignee_id" por
-- uma tabela de junção (lista simétrica — todo mundo atribuído tem o mesmo
-- peso, ver decisão registrada no plano). Backfill preserva quem já estava
-- atribuído antes de derrubar a coluna antiga.

create table if not exists task_assignees (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists task_assignees_user_idx on task_assignees (user_id);

alter table task_assignees enable row level security;

insert into task_assignees (task_id, user_id)
select id, assignee_id from tasks where assignee_id is not null
on conflict do nothing;

alter table tasks drop column if exists assignee_id;
