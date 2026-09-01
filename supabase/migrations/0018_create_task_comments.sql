-- Comentários por tarefa (também usados na thread de um chamado, já que um
-- chamado é uma tarefa por baixo dos panos). Quem pode comentar é decidido no
-- código (src/services/task-comments-service.ts): time com acesso a Tarefas
-- pro projeto da tarefa, ou o solicitante do chamado vinculado.

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid references app_users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_id_idx on task_comments (task_id);

alter table task_comments enable row level security;
