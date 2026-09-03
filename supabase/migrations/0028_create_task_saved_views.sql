-- Views salvas: combinação de filtros (busca, responsáveis, prioridade,
-- agrupamento) que o usuário guarda com um nome pra reaplicar depois. Por
-- usuário — não é compartilhado entre o time.

create table if not exists task_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists task_saved_views_user_idx on task_saved_views (user_id);

alter table task_saved_views enable row level security;
