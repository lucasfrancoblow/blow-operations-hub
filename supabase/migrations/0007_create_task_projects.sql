-- Tarefas passam a viver dentro de projetos (tipo board do Jira/Azure DevOps) —
-- cada projeto agrupa suas próprias tarefas e o usuário troca de projeto na tela.

create table if not exists task_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'orange',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nullable de propósito: tarefas sem projeto (dado antigo ou backlog geral) caem
-- num pseudo-projeto "Sem projeto" resolvido na UI, sem precisar de backfill.
alter table tasks add column if not exists project_id uuid references task_projects(id) on delete set null;

create index if not exists tasks_project_id_idx on tasks (project_id);

-- Acesso só pelo servidor (service_role key) — mesmo padrão das outras tabelas do hub.
alter table task_projects enable row level security;
