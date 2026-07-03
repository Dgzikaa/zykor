-- Garante no BANCO que email de usuário fica sempre minúsculo+trim (independe do código),
-- matando a classe do bug "Usuário sem vínculo de autenticação" (email c/ maiúscula não
-- casava no lookup do reset de senha). Aplicada via MCP em 2026-07-03.
create or replace function public.fn_usuarios_email_lower()
returns trigger
language plpgsql
as $$
begin
  if new.email is not null then
    new.email := lower(trim(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_usuarios_email_lower on public.usuarios;
create trigger trg_usuarios_email_lower
  before insert or update on public.usuarios
  for each row
  execute function public.fn_usuarios_email_lower();

update public.usuarios set email = lower(trim(email)) where email is distinct from lower(trim(email));
