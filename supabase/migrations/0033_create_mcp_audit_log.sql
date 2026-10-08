-- Registro de tudo que o conector MCP do PipeRun escreve (mover, ganhar/perder, excluir...).
-- O token do PipeRun é compartilhado, então esse é o rastro de "quem pediu o quê" pelo Claude.
-- `before` guarda o negócio antes da ação — é o que permite recriar um card excluído.

create table if not exists mcp_audit_log (
  id uuid primary key default gen_random_uuid(),
  tool text not null,
  deal_id bigint,
  args jsonb not null default '{}'::jsonb,
  before jsonb,
  outcome text not null check (outcome in ('executado', 'erro')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists mcp_audit_log_created_idx on mcp_audit_log (created_at desc);
create index if not exists mcp_audit_log_deal_idx on mcp_audit_log (deal_id, created_at desc);

alter table mcp_audit_log enable row level security;
