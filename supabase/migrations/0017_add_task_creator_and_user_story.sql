-- Rastreia quem abriu a tarefa (pra notificar quando ela muda de status/recebe
-- comentário). created_by nunca vem do client — é preenchido pelo servidor a
-- partir da sessão. (Campo de "User Story" como texto acabou não sendo usado:
-- "User Story" virou o nome do que hoje é "Projeto" — mesmo mecanismo, só
-- renomeado na interface, ver ProjectSwitcher.tsx.)

alter table tasks add column if not exists created_by uuid references app_users(id) on delete set null;
