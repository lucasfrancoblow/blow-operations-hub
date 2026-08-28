-- Responsável da tarefa deixa de ser texto livre e passa a ser um usuário real de
-- app_users (a tela de Tarefas já lista os usuários cadastrados pra selecionar).

alter table tasks add column if not exists assignee_id uuid references app_users(id) on delete set null;

-- Backfill best-effort do texto livre antigo pro usuário de mesmo username.
update tasks t
set assignee_id = u.id
from app_users u
where t.assignee_id is null
  and t.assignee is not null
  and length(trim(t.assignee)) > 0
  and lower(trim(t.assignee)) = lower(u.username);

alter table tasks drop column if exists assignee;
