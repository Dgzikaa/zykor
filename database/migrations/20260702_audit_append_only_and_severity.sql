-- Auditoria: (#3) append-only + severidade das ações sensíveis (base da aba "Ações sensíveis").
-- Append-only: nem o service_role pode UPDATE/DELETE na trilha. Só o trigger (SECURITY DEFINER)
-- insere; a retenção passa por system.audit_purge() (definer, chamada pelo cron).
revoke update, delete, truncate on system.audit_trail from service_role;

create or replace function system.audit_purge() returns integer
language plpgsql security definer set search_path to 'system' as $$
declare n integer;
begin
  delete from system.audit_trail where timestamp < now() - interval '12 months';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function system.audit_purge() from public, anon, authenticated;
select cron.schedule('audit_trail_retention', '0 4 1 * *', $$select system.audit_purge()$$);

-- severidade por sensibilidade: permissão de usuário / credencial = critical (categoria security);
-- exclusão = warning; resto = info.
create or replace function system.fn_audit() returns trigger
language plpgsql security definer set search_path to 'system','public' as $fn$
declare
  v_headers text := current_setting('request.headers', true);
  v_email text; v_role text; v_bar_hdr text;
  v_new jsonb; v_old jsonb; v_bar int; v_record text; v_sev text; v_cat text;
begin
  if v_headers is null then return coalesce(NEW, OLD); end if;
  v_email := (v_headers::json ->> 'x-audit-email');
  if v_email is null or v_email = '' then return coalesce(NEW, OLD); end if;
  v_role := (v_headers::json ->> 'x-audit-role');
  v_bar_hdr := (v_headers::json ->> 'x-audit-bar');

  if TG_OP <> 'DELETE' then v_new := to_jsonb(NEW); end if;
  if TG_OP <> 'INSERT' then v_old := to_jsonb(OLD); end if;
  if TG_OP = 'UPDATE' and v_new = v_old then return NEW; end if;

  v_record := coalesce(v_new->>'id', v_old->>'id', v_new->>'codigo', v_old->>'codigo',
                       v_new->>'insumo_codigo', v_old->>'insumo_codigo',
                       v_new->>'id_prod', v_old->>'id_prod', v_new->>'uuid', v_old->>'uuid');
  begin v_bar := coalesce((v_new->>'bar_id')::int, (v_old->>'bar_id')::int, nullif(v_bar_hdr,'')::int); exception when others then v_bar := nullif(v_bar_hdr,'')::int; end;

  if (TG_TABLE_SCHEMA='auth_custom' and TG_TABLE_NAME in ('usuarios','usuarios_bares'))
     or TG_TABLE_NAME ~* 'credenc' then
    v_sev := 'critical'; v_cat := 'security';
  elsif TG_OP='DELETE' then v_sev := 'warning'; v_cat := 'data';
  else v_sev := 'info'; v_cat := 'data';
  end if;

  insert into system.audit_trail(operation, table_name, record_id, bar_id, user_email, user_role,
     description, old_values, new_values, category, severity)
  values (TG_OP, TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME, v_record, v_bar, v_email, v_role,
     TG_OP||' em '||TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME||coalesce(' #'||v_record,''),
     v_old, v_new, v_cat, v_sev);

  return coalesce(NEW, OLD);
exception when others then
  return coalesce(NEW, OLD);
end $fn$;
