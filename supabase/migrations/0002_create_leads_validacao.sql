-- Validação manual de leads recém-chegados pelo time.
--
-- Por que essa tabela existe: a lista de "leads recentes" é recalculada a cada carga
-- a partir dos negócios abertos/fechados no PipeRun (sem persistência própria). Mas
-- "esse lead foi conferido pelo time" é um estado que precisa sobreviver entre cargas
-- e não existe em nenhum campo do PipeRun — por isso mora aqui.

create table if not exists leads_validacao (
  deal_id bigint primary key,             -- id do negócio no PipeRun
  validado boolean not null default true,
  validado_por text,
  observacao text,
  created_at timestamptz not null default now()
);

-- Acesso só pelo servidor (service_role key), nunca pelo navegador do usuário final —
-- então RLS fica travado por padrão (nenhuma policy = nenhum acesso via chave anon).
alter table leads_validacao enable row level security;
