-- Autenticação interna do hub — login só por usuário (sem cadastro público, sem
-- e-mail): o admin cria a conta e define a senha inicial; qualquer pessoa nova
-- só entra se um admin criar o usuário dela na tela "Usuários". `role` controla
-- acesso a páginas administrativas.

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,          -- sempre salvo em minúsculas
  password_hash text not null,            -- "<salt hex>:<hash hex>" (scrypt)
  role text not null default 'member',    -- admin | member
  active boolean not null default true,
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Acesso só pelo servidor (service_role key), nunca pelo navegador do usuário final —
-- então RLS fica travado por padrão (nenhuma policy = nenhum acesso via chave anon).
alter table app_users enable row level security;
