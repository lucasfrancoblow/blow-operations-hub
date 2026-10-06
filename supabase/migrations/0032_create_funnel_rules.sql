-- Regras do funil (tela "Regras do funil"): a gestora cria regras do tipo "pra entrar na
-- etapa X, o negócio precisa ter passado antes pela etapa Y". Um webhook do PipeRun
-- (deal_moved) dispara a checagem; se violar, o hub devolve o card (modo "ativa") ou só
-- registra o que faria (modo "simulacao").

create table if not exists funnel_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pipeline_id bigint not null,
  -- Etapa protegida (ex.: SQL): entrar nela dispara a checagem.
  target_stage_id bigint not null,
  -- Etapa obrigatória (ex.: Atendimento): o negócio precisa ter passado por ela antes.
  required_stage_id bigint not null,
  -- Pra onde devolver o card quando a regra é violada (normalmente a etapa obrigatória).
  return_stage_id bigint not null,
  add_comment boolean not null default true,
  comment_text text not null default 'Este negócio voltou porque precisa passar pela etapa de Atendimento antes do SQL.',
  mode text not null default 'simulacao' check (mode in ('simulacao', 'ativa')),
  enabled boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funnel_rules_target_idx on funnel_rules (pipeline_id, target_stage_id);

-- Histórico: tudo que a checagem decidiu (inclusive "estava tudo certo" não é gravado,
-- só violações, devoluções e erros — senão a tabela cresceria a cada movimento do funil).
create table if not exists funnel_rule_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references funnel_rules(id) on delete set null,
  rule_name text not null,
  deal_id bigint not null,
  deal_title text,
  -- violacao_simulada: modo simulação, nada foi alterado no PipeRun.
  -- devolvido: card devolvido pro PipeRun.
  -- erro: falhou ao consultar/alterar o PipeRun.
  outcome text not null check (outcome in ('violacao_simulada', 'devolvido', 'erro')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists funnel_rule_runs_created_idx on funnel_rule_runs (created_at desc);
create index if not exists funnel_rule_runs_deal_idx on funnel_rule_runs (deal_id, created_at desc);

alter table funnel_rules enable row level security;
alter table funnel_rule_runs enable row level security;

-- Regra inicial pedida pela gestora: no PRÉ VENDAS (INBOUND), SQL só depois de Atendimento.
-- Começa em simulação: só registra, não mexe em nenhum card.
insert into funnel_rules
  (name, pipeline_id, target_stage_id, required_stage_id, return_stage_id, mode, enabled, created_by)
select
  'SQL só depois de Atendimento (Pré-vendas Inbound)',
  97638, 629005, 629004, 629004, 'simulacao', true, 'sistema'
where not exists (
  select 1 from funnel_rules where pipeline_id = 97638 and target_stage_id = 629005
);
