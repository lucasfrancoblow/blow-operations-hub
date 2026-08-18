-- Tarefas/backlog interno do time de operações (ferramenta própria, no lugar de
-- Jira/Monday/Linear). Uso é só do time do hub (poucas pessoas), sem necessidade
-- de multi-tenant nem de histórico de auditoria por enquanto.

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  status text not null default 'Backlog',   -- Backlog | Em andamento | Bloqueado | Em revisão | Concluído
  priority text not null default 'Média',   -- Baixa | Média | Alta | Crítica
  assignee text not null default '',
  tags jsonb not null default '[]'::jsonb,
  due_date timestamptz,
  reference jsonb,                          -- { type: "lead"|"incidente", id, label } | null
  position integer not null default 0,      -- ordem dentro da coluna de status
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_status_idx on tasks (status);

-- Acesso só pelo servidor (service_role key), nunca pelo navegador do usuário final —
-- então RLS fica travado por padrão (nenhuma policy = nenhum acesso via chave anon).
alter table tasks enable row level security;
