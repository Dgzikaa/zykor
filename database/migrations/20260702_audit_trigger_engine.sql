-- MOTOR DE AUDITORIA POR TRIGGER — captura todo INSERT/UPDATE/DELETE das tabelas de usuário
-- em system.audit_trail (quem/quando/o quê, com old_values/new_values).
--
-- Gate por header: o trigger só registra quando a escrita vem de uma request autenticada do app,
-- que injeta o header x-audit-email (o PostgREST expõe os headers em current_setting('request.headers')).
-- Escritas de ETL/cron/edge/psql não mandam esse header → não são auditadas (evita poluir a trilha
-- com escrita de máquina e mantém o volume sob controle). A identidade vem do getAdminClient/
-- createServiceRoleClient, que lê o usuário do AsyncLocalStorage publicado por authenticateUser.
--
-- DEFENSIVO: qualquer falha na auditoria NUNCA derruba a operação de negócio (exception handler).
--
-- Produções (operations.producao_execucao / _insumo) NÃO recebem o trigger: já têm auditoria
-- app-level dedicada (route execucao) — evita duplo log. Migrar pra trigger quando o caminho do
-- header estiver confirmado em produção.

create or replace function system.fn_audit() returns trigger
language plpgsql security definer set search_path to 'system','public' as $fn$
declare
  v_headers text := current_setting('request.headers', true);
  v_email text; v_role text; v_bar_hdr text;
  v_new jsonb; v_old jsonb; v_bar int; v_record text;
begin
  if v_headers is null then return coalesce(NEW, OLD); end if;
  v_email := (v_headers::json ->> 'x-audit-email');
  if v_email is null or v_email = '' then return coalesce(NEW, OLD); end if;
  v_role := (v_headers::json ->> 'x-audit-role');
  v_bar_hdr := (v_headers::json ->> 'x-audit-bar');

  if TG_OP <> 'DELETE' then v_new := to_jsonb(NEW); end if;
  if TG_OP <> 'INSERT' then v_old := to_jsonb(OLD); end if;
  if TG_OP = 'UPDATE' and v_new = v_old then return NEW; end if;  -- no-op, ignora

  v_record := coalesce(v_new->>'id', v_old->>'id');
  begin v_bar := coalesce((v_new->>'bar_id')::int, (v_old->>'bar_id')::int, nullif(v_bar_hdr,'')::int); exception when others then v_bar := nullif(v_bar_hdr,'')::int; end;

  insert into system.audit_trail(operation, table_name, record_id, bar_id, user_email, user_role,
     description, old_values, new_values, category, severity)
  values (TG_OP, TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME, v_record, v_bar, v_email, v_role,
     TG_OP||' em '||TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME||coalesce(' #'||v_record,''),
     v_old, v_new, 'data', case when TG_OP='DELETE' then 'warning' else 'info' end);

  return coalesce(NEW, OLD);
exception when others then
  return coalesce(NEW, OLD);  -- auditoria nunca quebra a operação
end $fn$;

-- Anexa em todas as tabelas base dos schemas de usuário, exceto ETL/logs/histórico/cache/etc.
do $do$
declare r record;
begin
  for r in
    select schemaname, tablename from pg_tables
    where schemaname in ('operations','financial','meta','hr','crm','integridade','public','auth_custom')
      and tablename !~* '(_log$|_logs$|_historico$|_hist$|_cache$|_raw$|_raw_data$|_staging$|_stage$|_sync$|_sync_|^sync_|_snapshot$|_backup$|_bkp$|_tmp$|_temp$|^bronze_|^silver_|^gold_|_seq$|_audit$|_auditoria$)'
  loop
    execute format('drop trigger if exists trg_audit on %I.%I', r.schemaname, r.tablename);
    execute format('create trigger trg_audit after insert or update or delete on %I.%I for each row execute function system.fn_audit()', r.schemaname, r.tablename);
  end loop;
end $do$;

-- Produções já têm auditoria app-level → sem trigger (evita duplo log)
drop trigger if exists trg_audit on operations.producao_execucao;
drop trigger if exists trg_audit on operations.producao_execucao_insumo;
