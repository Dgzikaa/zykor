-- Fix do #6: auth_custom.usuarios.id é UUID, mas system.session_start esperava bigint em p_user_id.
-- A coerção do argumento falhava na chamada (silenciosa → retornava null), então NENHUMA sessão era
-- criada nos logins. Passa user_id (coluna + param) para text, aceitando o UUID.
alter table system.user_sessions alter column user_id type text using user_id::text;

drop function if exists system.session_start(text, bigint, integer, text, text);

create or replace function system.session_start(p_email text, p_user_id text, p_bar_id integer, p_ip text, p_ua text)
returns uuid language plpgsql security definer set search_path to 'system' as $$
declare v_id uuid;
begin
  insert into system.user_sessions(user_email, user_id, bar_id, ip, user_agent, last_active_at)
  values (p_email, nullif(p_user_id,''), p_bar_id, nullif(p_ip,''), p_ua, now()) returning id into v_id;
  return v_id;
exception when others then return null;
end $$;
revoke all on function system.session_start(text,text,integer,text,text) from public, anon, authenticated;
grant execute on function system.session_start(text,text,integer,text,text) to service_role;
