-- Auditoria › aba Análise enriquecida.
-- (1) tempo-por-tela (dwell) via heartbeat; (2) RPC system.acessos_analytics com big numbers,
-- gráficos (online por hora, concorrência, ações/hora, logins/dia, duração), top telas e resumo por usuário.

-- 1) Tempo por tela: acumulado por (sessão, rota, dia) — alimentado pelo heartbeat quando ativo.
create table if not exists system.session_page_time (
  session_id     uuid not null,
  user_email     text,
  path           text not null,
  dia            date not null default current_date,
  active_seconds integer not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (session_id, path, dia)
);
create index if not exists idx_spt_email_dia on system.session_page_time(user_email, dia);
create index if not exists idx_spt_path on system.session_page_time(path);

-- 2) heartbeat: passa a receber o pathname e acumula tempo ativo por tela (mesmo delta do active_seconds).
drop function if exists system.session_heartbeat(uuid, boolean);
create or replace function system.session_heartbeat(p_sid uuid, p_active boolean, p_path text default null)
returns void language plpgsql security definer set search_path to 'system' as $$
declare v_delta int; v_email text;
begin
  select user_email,
         case when p_active then least(greatest(extract(epoch from (now()-last_seen_at))::int,0),120) else 0 end
    into v_email, v_delta
    from system.user_sessions where id=p_sid and ended_at is null;
  if not found then return; end if;
  update system.user_sessions
    set active_seconds = active_seconds + coalesce(v_delta,0),
        last_active_at = case when p_active then now() else last_active_at end,
        last_seen_at = now()
    where id=p_sid;
  if p_active and p_path is not null and coalesce(v_delta,0) > 0 then
    insert into system.session_page_time(session_id, user_email, path, dia, active_seconds, updated_at)
    values (p_sid, v_email, left(p_path,200), current_date, v_delta, now())
    on conflict (session_id, path, dia)
      do update set active_seconds = system.session_page_time.active_seconds + excluded.active_seconds,
                    updated_at = now();
  end if;
exception when others then null;
end $$;

-- 3) Analytics de acessos (tudo num JSON só).
create or replace function system.acessos_analytics(p_dias int default 30)
returns jsonb language sql security definer set search_path to 'system','pg_catalog' as $$
with
sess as (
  select s.*,
    coalesce(s.ended_at, s.last_seen_at) as fim,
    greatest(extract(epoch from (coalesce(s.ended_at,s.last_seen_at) - s.login_at))::int,0) as dur_seg,
    (s.ended_at is null and s.last_seen_at > now() - interval '2 minutes') as online,
    (coalesce(s.user_agent,'') ~* 'mobile|android|iphone|ipad|ipod') as mobile
  from system.user_sessions s
  where s.login_at >= now() - (p_dias||' days')::interval
),
att as (select * from system.login_attempts where at >= now() - (p_dias||' days')::interval),
aud as (select * from system.audit_trail where "timestamp" >= now() - (p_dias||' days')::interval),
ev as (
  select login_at t, 1 d from sess
  union all select fim, -1 from sess
),
run as (select t, sum(d) over (order by t asc, d desc) c from ev),
pico as (select c, t from run order by c desc, t asc limit 1)
select jsonb_build_object(
  'big', (select jsonb_build_object(
     'sessoes_total', count(*),
     'usuarios_unicos', count(distinct user_email),
     'online_agora', count(*) filter (where online),
     'tempo_logado_seg', coalesce(sum(dur_seg),0),
     'tempo_ativo_seg', coalesce(sum(active_seconds),0),
     'engajamento_pct', case when sum(dur_seg)>0 then round(100.0*sum(active_seconds)/sum(dur_seg),1) else 0 end,
     'sessao_media_seg', coalesce(round(avg(dur_seg)),0),
     'sessao_max_seg', coalesce(max(dur_seg),0),
     'pct_mobile', case when count(*)>0 then round(100.0*count(*) filter(where mobile)/count(*),0) else 0 end,
     'pico_simultaneo', coalesce((select c from pico),0),
     'pico_quando', (select to_char(t,'YYYY-MM-DD"T"HH24:MI:SS') from pico),
     'logins_ok', (select count(*) from att where sucesso),
     'logins_falho', (select count(*) from att where not sucesso),
     'login_fail_pct', (select case when count(*)>0 then round(100.0*count(*) filter(where not sucesso)/count(*),0) else 0 end from att),
     'total_acoes', (select count(*) from aud),
     'acoes_por_sessao', case when count(*)>0 then round((select count(*) from aud)::numeric/count(*),1) else 0 end
   ) from sess),
  'online_por_hora', (select coalesce(jsonb_agg(x order by (x->>'hora')::int),'[]'::jsonb) from (
     select jsonb_build_object('hora', extract(hour from gs)::int, 'n', count(*)) x
     from sess s, generate_series(date_trunc('hour',s.login_at), date_trunc('hour', s.fim), interval '1 hour') gs
     group by extract(hour from gs)::int) q),
  'concorrencia', (select coalesce(jsonb_agg(x order by (x->>'ts')),'[]'::jsonb) from (
     select jsonb_build_object('ts', to_char(gs,'YYYY-MM-DD HH24:00'), 'n', count(*)) x
     from sess s, generate_series(date_trunc('hour',s.login_at), date_trunc('hour', s.fim), interval '1 hour') gs
     group by to_char(gs,'YYYY-MM-DD HH24:00')) q),
  'acoes_por_hora', (select coalesce(jsonb_agg(x order by (x->>'hora')::int),'[]'::jsonb) from (
     select jsonb_build_object(
       'hora', extract(hour from "timestamp")::int,
       'inseriu', count(*) filter (where operation='INSERT'),
       'editou', count(*) filter (where operation='UPDATE'),
       'excluiu', count(*) filter (where operation='DELETE')) x
     from aud group by extract(hour from "timestamp")::int) q),
  'logins_por_dia', (select coalesce(jsonb_agg(x order by (x->>'dia')),'[]'::jsonb) from (
     select jsonb_build_object('dia', to_char(date_trunc('day',at),'YYYY-MM-DD'),
       'ok', count(*) filter(where sucesso), 'falho', count(*) filter(where not sucesso)) x
     from att group by date_trunc('day',at)) q),
  'hist_duracao', (select coalesce(jsonb_agg(x order by (x->>'ord')::int),'[]'::jsonb) from (
     select jsonb_build_object('faixa', faixa, 'ord', ord, 'n', count(*)) x from (
       select case
         when dur_seg < 60 then '<1min' when dur_seg < 300 then '1-5min'
         when dur_seg < 900 then '5-15min' when dur_seg < 1800 then '15-30min'
         when dur_seg < 3600 then '30-60min' else '60min+' end faixa,
         case when dur_seg<60 then 1 when dur_seg<300 then 2 when dur_seg<900 then 3 when dur_seg<1800 then 4 when dur_seg<3600 then 5 else 6 end ord
       from sess) y group by faixa, ord) q),
  'top_endpoints', (select coalesce(jsonb_agg(x order by (x->>'n')::int desc),'[]'::jsonb) from (
     select jsonb_build_object('endpoint', endpoint, 'n', count(*)) x
     from aud where endpoint is not null group by endpoint order by count(*) desc limit 12) q),
  'top_telas', (select coalesce(jsonb_agg(x order by (x->>'seg')::int desc),'[]'::jsonb) from (
     select jsonb_build_object('path', path, 'seg', sum(active_seconds)) x
     from system.session_page_time where dia >= (now() - (p_dias||' days')::interval)::date
     group by path order by sum(active_seconds) desc limit 12) q),
  'por_usuario', (select coalesce(jsonb_agg(obj order by (obj->>'ativo_seg')::int desc),'[]'::jsonb) from (
     select jsonb_build_object(
       'email', u.email, 'sessoes', u.sessoes, 'logado_seg', u.logado, 'ativo_seg', u.ativo,
       'engajamento_pct', case when u.logado>0 then round(100.0*u.ativo/u.logado,0) else 0 end,
       'ultima', to_char(u.ultima,'YYYY-MM-DD"T"HH24:MI:SS'), 'mobile_pct', u.mobile_pct,
       'criou', coalesce(a.criou,0), 'editou', coalesce(a.editou,0), 'excluiu', coalesce(a.excluiu,0),
       'acoes', coalesce(a.total,0), 'top_area', a.top_area, 'logins_falho', coalesce(f.falhos,0),
       'tela_top', t.path, 'tela_top_seg', t.seg
     ) obj
     from (
       select user_email email, count(*) sessoes, sum(dur_seg) logado, sum(active_seconds) ativo,
              max(fim) ultima, round(100.0*count(*) filter(where mobile)/count(*),0) mobile_pct
       from sess where user_email is not null group by user_email
     ) u
     left join (
       select user_email,
              count(*) filter(where operation='INSERT') criou,
              count(*) filter(where operation='UPDATE') editou,
              count(*) filter(where operation='DELETE') excluiu,
              count(*) total, mode() within group (order by table_name) top_area
       from aud where user_email is not null group by user_email
     ) a on a.user_email=u.email
     left join (select email, count(*) falhos from att where not sucesso and email is not null group by email) f on f.email=u.email
     left join lateral (
       select path, sum(active_seconds) seg from system.session_page_time p
       where p.user_email=u.email and p.dia >= (now()-(p_dias||' days')::interval)::date
       group by path order by sum(active_seconds) desc limit 1
     ) t on true
   ) q)
);
$$;
