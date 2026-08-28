-- Anexos (docs/fotos) por tarefa. Upload vai direto do navegador pro Supabase
-- Storage via signed URL (nunca passa pela função serverless do Vercel), então o
-- bucket é privado — leitura/escrita só através de URLs assinadas geradas pelo
-- servidor com a service_role key.

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

create table if not exists task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  content_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists task_attachments_task_id_idx on task_attachments (task_id);

-- Acesso só pelo servidor (service_role key) — mesmo padrão das outras tabelas do hub.
alter table task_attachments enable row level security;
