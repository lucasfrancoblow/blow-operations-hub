-- Exclusão de tarefa passa a ser soft-delete (archived), não mais DELETE físico.
-- Motivo: aconteceu de alguém clicar em "Excluir" tentando apagar só um comentário
-- (não existe exclusão de comentário na UI — só esse botão, que exclui a tarefa
-- inteira, sem nenhuma confirmação) e perder a tarefa e os comentários (cascade)
-- de vez. Arquivar é reversível; DELETE físico não era.

alter table tasks add column if not exists archived boolean not null default false;

create index if not exists tasks_archived_idx on tasks (archived);
