-- Métricas diárias de ligação da 3C Plus (discador), agregadas por agente + campanha +
-- status de chamada. Alimentada por um job externo (GitHub Actions, sync-3cplus-calls)
-- que lê o histórico bruto da API da 3C Plus (endpoint /calls, ~2-3 mil chamadas/dia,
-- na maioria ruído do próprio discador tentando conectar antes de um agente entrar) e
-- já entrega aqui só os totais por dia — sem isso, o hub precisaria paginar centenas
-- de chamadas a cada carregamento de tela pra montar qualquer gráfico.
--
-- Uma linha por (call_date, agent_id, campaign_id, status_id): o hub soma essas linhas
-- do jeito que precisar (total geral, por agente, por campanha, taxa de conexão —
-- status_id=7 "Finalizada" com agent_id preenchido é o proxy de "contato efetivo").

create table if not exists call_metrics_daily (
  call_date date not null,
  agent_id integer not null default 0,        -- 0 = nenhum agente conectado (ruído do discador)
  agent_name text not null default '-',
  campaign_id integer not null default 0,
  campaign_name text not null default '-',
  status_id integer not null,
  status_text text not null,
  total_calls integer not null default 0,
  total_calling_seconds integer not null default 0,   -- soma de calling_time (tempo discando)
  total_speaking_seconds integer not null default 0,  -- soma de speaking_with_agent_time
  recorded_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (call_date, agent_id, campaign_id, status_id)
);

create index if not exists call_metrics_daily_date_idx on call_metrics_daily (call_date);

-- Acesso só pelo servidor (service_role key) — mesmo padrão de ad_metrics_daily/incidents.
alter table call_metrics_daily enable row level security;
