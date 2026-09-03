-- Subtarefas completas: uma subtarefa é só uma linha normal de "tasks" com um
-- pai setado — reaproveita status/prioridade/responsáveis/prazo que já
-- existem em vez de duplicar tudo isso numa tabela paralela. listTasks()
-- filtra parent_task_id is null pra não misturar subtarefa com o board principal.

alter table tasks add column if not exists parent_task_id uuid references tasks(id) on delete cascade;

create index if not exists tasks_parent_task_id_idx on tasks (parent_task_id);
