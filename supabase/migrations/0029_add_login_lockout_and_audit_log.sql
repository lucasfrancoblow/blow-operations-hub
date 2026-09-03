-- Rate limiting simples de login (sem lib externa): conta tentativas erradas
-- e bloqueia temporariamente depois de várias seguidas — hoje não existia
-- nenhum limite, então dava pra tentar senha infinitas vezes num usuário.

alter table app_users add column if not exists failed_login_attempts integer not null default 0;
alter table app_users add column if not exists locked_until timestamptz;

-- Log de ações sensíveis sobre contas (trocar papel, redefinir senha,
-- ativar/desativar) — hoje essas mudanças eram silenciosas, sem nenhum
-- registro de quem fez o quê.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references app_users(id),
  action text not null,
  target_user_id uuid references app_users(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_target_user_idx on audit_log (target_user_id);

alter table audit_log enable row level security;
