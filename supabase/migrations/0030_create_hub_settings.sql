-- Preferências operacionais do hub (tela "Configurações") — antes os
-- switches/inputs dessa tela só mostravam um toast "(simulado)" e nada era
-- lido nem persistido de verdade. Linha única (id fixo "default"): são
-- preferências do hub como um todo, não por usuário.

create table if not exists hub_settings (
  id text primary key default 'default',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table hub_settings enable row level security;

insert into hub_settings (id, settings) values ('default', '{}'::jsonb)
on conflict (id) do nothing;
