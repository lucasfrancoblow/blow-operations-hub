-- Número curto e legível pra referenciar uma tarefa (ex: "Tarefa #42") — usado no
-- e-mail de notificação e na UI, em vez do uuid interno. Auto-incrementa sozinho.

alter table tasks add column if not exists task_number serial;
