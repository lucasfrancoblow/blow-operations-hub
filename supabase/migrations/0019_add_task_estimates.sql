-- Story Points e horas estimadas por tarefa, estilo Azure Boards. Ambos
-- opcionais (null = não estimado ainda).

alter table tasks add column if not exists story_points numeric;
alter table tasks add column if not exists estimated_hours numeric;
