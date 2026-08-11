-- Persistência de incidentes reais do n8n.
--
-- Por que essa tabela existe: os incidentes hoje são recalculados a cada carga a
-- partir do histórico de execuções do n8n. Um erro antigo (mesmo já resolvido) pode
-- sair da janela consultada e desaparecer da tela sem aviso. Esta tabela guarda um
-- retrato de cada incidente já visto, pra ele continuar aparecendo (como Resolvido)
-- mesmo que o n8n não devolva mais aquele histórico.
--
-- Fonte da verdade de "está aberto ou resolvido agora" continua sendo o n8n ao vivo;
-- esta tabela só preserva o que já foi visto uma vez.

create table if not exists incidents (
  id text primary key,                    -- mesmo id usado no app: "n8n-inc-<workflowId>"
  automation_id text not null,            -- "n8n-<workflowId>"
  code text not null,
  title text not null,
  summary text,
  severity text not null,                 -- Crítica | Alta | Média | Baixa
  status text not null,                   -- Aberto | Investigando | Resolvido
  category text,
  automation_name text not null,
  failed_node text,
  http_code integer,
  occurrences integer not null default 0,
  first_seen timestamptz not null,
  last_seen timestamptz not null,
  owner text,
  ai_summary text,
  facts jsonb not null default '[]'::jsonb,
  probable_cause text,
  suggested_fix text,
  evidence text,
  n8n_execution_url text,
  notion_url text,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incidents_automation_id_idx on incidents (automation_id);
create index if not exists incidents_status_idx on incidents (status);

-- Acesso só pelo servidor (service_role key), nunca pelo navegador do usuário final —
-- então RLS fica travado por padrão (nenhuma policy = nenhum acesso via chave anon).
alter table incidents enable row level security;
