-- Novo papel "super_admin": só quem tem esse papel acessa a tela "Usuários" (gestão
-- de contas). "admin" continua existindo pros outros privilégios que já tinha (ex.:
-- ver a aba Tarefas mesmo sem tasks_access), mas deixa de gerenciar usuários.
-- role já é texto livre (sem CHECK constraint), então só promove lucas.franco.

update app_users set role = 'super_admin' where username = 'lucas.franco';
