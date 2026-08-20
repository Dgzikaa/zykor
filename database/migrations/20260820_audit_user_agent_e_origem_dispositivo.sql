-- Saber se a acao veio do CELULAR ou do computador.
--
-- Motivo (David/financeiro, 20/08/2026): boletos chegando sem Fornecedor CA, com a suspeita de
-- terem sido subidos pelo celular. Nao dava pra confirmar: system.audit_trail.user_agent estava
-- VAZIO em 100% das linhas -- o trigger nunca recebia o dado.
--
-- Por que estava vazio: fn_audit le os headers da requisicao PostgREST, e quem faz essa
-- requisicao e o client Node do Next.js. O 'user-agent' cru ali e o do servidor, nao o do
-- navegador da pessoa. A solucao segue o mesmo padrao ja usado para email/role/bar: o app
-- repassa num header proprio (x-audit-ua, injetado em lib/supabase-admin.ts).
--
-- Vale para TODA tabela auditada daqui pra frente, nao so pedidos de pagamento.

create or replace function system.fn_audit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'system', 'public'
as $function$
declare
  v_headers text := current_setting('request.headers', true);
  v_email text; v_role text; v_bar_hdr text; v_req text; v_ua text;
  v_new jsonb; v_old jsonb; v_bar int; v_record text; v_sev text; v_cat text;
begin
  if v_headers is null then return coalesce(NEW, OLD); end if;
  v_email := (v_headers::json ->> 'x-audit-email');
  if v_email is null or v_email = '' then return coalesce(NEW, OLD); end if;
  v_role := (v_headers::json ->> 'x-audit-role');
  v_bar_hdr := (v_headers::json ->> 'x-audit-bar');
  v_req := (v_headers::json ->> 'x-audit-req');
  v_ua := (v_headers::json ->> 'x-audit-ua');

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
     description, old_values, new_values, category, severity, request_id, user_agent)
  values (TG_OP, TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME, v_record, v_bar, v_email, v_role,
     TG_OP||' em '||TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME||coalesce(' #'||v_record,''),
     v_old, v_new, v_cat, v_sev, nullif(v_req,''), nullif(v_ua,''));

  return coalesce(NEW, OLD);
exception when others then
  return coalesce(NEW, OLD);
end $function$;

-- Badge "de onde subiu" na lista de pedidos. Fica NA LINHA porque a lista mostra um por card --
-- cruzar system.audit_trail a cada carregamento sairia caro.
alter table financial.pedidos_pagamento add column if not exists origem_dispositivo text;
comment on column financial.pedidos_pagamento.origem_dispositivo is
'De onde o pedido foi criado: celular | tablet | computador. Derivado do user-agent no POST.';
