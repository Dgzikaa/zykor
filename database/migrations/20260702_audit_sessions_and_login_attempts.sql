-- #6 Auditoria de acessos: sessões de usuário (tempo logado, ativo vs ocioso, online, IP) +
-- tentativas de login (sucesso/falha). As rotas de login/logout e o heartbeat chamam as funções
-- via RPC (SECURITY DEFINER); nunca quebram o fluxo de auth.
create table if not exists system.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  user_id bigint,
  bar_id integer,
  ip text,
  user_agent text,
  login_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_active_at timestamptz,
  active_seconds integer not null default 0,
  ended_at timestamptz,
  end_reason text
);
create index if not exists idx_user_sessions_email_login on system.user_sessions (user_email, login_at desc);
create index if not exists idx_user_sessions_last_seen on system.user_sessions (last_seen_at desc);

create table if not exists system.login_attempts (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  email text, ip text, user_agent text,
  sucesso boolean not null, motivo text
);
create index if not exists idx_login_attempts_at on system.login_attempts (at desc);

revoke all on system.user_sessions from anon, authenticated;
revoke all on system.login_attempts from anon, authenticated;
grant select, insert, update on system.user_sessions to service_role;
grant select, insert on system.login_attempts to service_role;

create or replace function system.session_start(p_email text, p_user_id bigint, p_bar_id integer, p_ip text, p_ua text)
returns uuid language plpgsql security definer set search_path to 'system' as $$
declare v_id uuid;
begin
  insert into system.user_sessions(user_email, user_id, bar_id, ip, user_agent, last_active_at)
  values (p_email, p_user_id, p_bar_id, nullif(p_ip,''), p_ua, now()) returning id into v_id;
  return v_id;
exception when others then return null;
end $$;

create or replace function system.session_heartbeat(p_sid uuid, p_active boolean)
returns void language plpgsql security definer set search_path to 'system' as $$
begin
  update system.user_sessions
    set active_seconds = active_seconds + case when p_active then least(greatest(extract(epoch from (now()-last_seen_at))::int,0),120) else 0 end,
        last_active_at = case when p_active then now() else last_active_at end,
        last_seen_at = now()
  where id = p_sid and ended_at is null;
exception when others then null;
end $$;

create or replace function system.session_end(p_sid uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'system' as $$
begin
  update system.user_sessions set ended_at = now(), end_reason = coalesce(p_reason,'logout')
  where id = p_sid and ended_at is null;
exception when others then null;
end $$;

create or replace function system.login_attempt(p_email text, p_ip text, p_ua text, p_sucesso boolean, p_motivo text)
returns void language plpgsql security definer set search_path to 'system' as $$
begin
  insert into system.login_attempts(email, ip, user_agent, sucesso, motivo)
  values (p_email, nullif(p_ip,''), p_ua, p_sucesso, p_motivo);
exception when others then null;
end $$;

revoke all on function system.session_start(text,bigint,integer,text,text) from public, anon, authenticated;
revoke all on function system.session_heartbeat(uuid,boolean) from public, anon, authenticated;
revoke all on function system.session_end(uuid,text) from public, anon, authenticated;
revoke all on function system.login_attempt(text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function system.session_start(text,bigint,integer,text,text) to service_role;
grant execute on function system.session_heartbeat(uuid,boolean) to service_role;
grant execute on function system.session_end(uuid,text) to service_role;
grant execute on function system.login_attempt(text,text,text,boolean,text) to service_role;
