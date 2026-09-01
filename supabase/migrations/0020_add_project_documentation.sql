-- Espaço de documentação por User Story (task_projects) — texto em markdown,
-- renderizado no client via src/lib/markdown.ts (subconjunto seguro, sem HTML
-- crú do usuário).

alter table task_projects add column if not exists documentation text;
