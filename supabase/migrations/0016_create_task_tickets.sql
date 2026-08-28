-- Chamados: abertura de chamado técnico (fornecedor terceiro ou time BLOW) que já
-- nasce como uma tarefa dentro do projeto certo. Status/prioridade/responsável do
-- chamado é o da tarefa vinculada (task_id) — uma fonte de verdade só, sem duplicar
-- estado. requester_id nullable de propósito: fecha a porta pro canal de e-mail
-- futuro (reporter sem conta no hub).

create table if not exists task_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number serial,
  task_id uuid not null references tasks(id) on delete cascade,
  channel text not null default 'site',
  requester_id uuid references app_users(id) on delete set null,
  requester_name text not null,
  requester_email text,
  created_at timestamptz not null default now()
);

create index if not exists task_tickets_task_id_idx on task_tickets (task_id);

alter table task_tickets enable row level security;
