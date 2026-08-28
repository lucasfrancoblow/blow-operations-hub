-- Cadastro de usuário ganha nome, e-mail e telefone — e-mail é o que permite
-- notificar a pessoa (ex.: quando uma tarefa é atribuída a ela) via Resend.
-- Todos nullable: contas antigas não têm esses dados até alguém preencher.

alter table app_users add column if not exists full_name text;
alter table app_users add column if not exists email text;
alter table app_users add column if not exists phone text;
