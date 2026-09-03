-- "Destaque/urgente" (pin visual, separado da coluna "priority" que já existe)
-- e o momento em que o status mudou por último — precisa ser um campo próprio,
-- separado de updated_at (que muda em qualquer edição, não só troca de coluna),
-- senão o cálculo de "há quantos dias está parado nessa coluna" fica errado
-- toda vez que alguém só edita a descrição sem mexer no status.

alter table tasks add column if not exists highlighted boolean not null default false;
alter table tasks add column if not exists status_changed_at timestamptz not null default now();
