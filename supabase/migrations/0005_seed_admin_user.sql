-- Primeiro admin do hub — login "lucas.franco", senha inicial "Admin@blow".
-- Troque essa senha pela tela "Usuários" assim que fizer o primeiro login (o admin
-- consegue redefinir a senha de qualquer usuário, incluindo a própria).

insert into app_users (username, password_hash, role, active)
values (
  'lucas.franco',
  '8cf8ae22270dc778799b5b3d6e5d0950:24ba1d243ca030cfec79247228e5fecd3549601d1dd216f87e36472b4492016a34e8060a54cfd90e6305f3835d3ec7d19415fd3ce23843a62f4710ecd1962ef9',
  'admin',
  true
)
on conflict (username) do nothing;
