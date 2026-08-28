-- Visibilidade por projeto de Tarefas: oculto por padrão, admin/super_admin
-- libera por usuário. admin/super_admin sempre veem tudo (bypass no código),
-- então só precisam de linha aqui os "member" que ganharam acesso a um projeto.

create table if not exists task_project_access (
  project_id uuid not null references task_projects(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table task_project_access enable row level security;
