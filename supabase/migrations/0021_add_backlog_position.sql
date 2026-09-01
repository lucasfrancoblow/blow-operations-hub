-- A view "Backlogs" precisa de uma ordem própria, independente da ordem por
-- coluna do Board (campo "position", que é reiniciado a cada status — ex.:
-- "Backlog" e "Em andamento" cada um tem itens de position 0,1,2...). Sem um
-- campo dedicado, listar tudo junto por "position" misturava tarefas de
-- status diferentes de forma sem sentido. null = ainda não ordenado
-- manualmente no Backlogs (cai pro fallback por task_number).
alter table tasks add column if not exists backlog_position integer;
