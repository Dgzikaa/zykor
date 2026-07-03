-- Auditoria: (#8) hardening de segurança de baixo risco + (#9) RPC de saúde/retenção.

-- ===== #8 Hardening (só o que é comprovadamente seguro) =====
-- session_page_time (minha tabela): só acessada via funções SECURITY DEFINER (service_role).
-- NÃO deve estar exposta na API. Tranca (RLS on sem policy) + revoga anon/authenticated.
alter table system.session_page_time enable row level security;
revoke all on system.session_page_time from anon, authenticated;

-- Funções SECURITY DEFINER executáveis por ANON (público não-autenticado). A app chama tudo
-- via service_role (admin client) ou authenticated — nunca anon. ACL confirmou grant explícito
-- de authenticated+service_role, então remover anon+public é seguro (esses dois sobrevivem).
revoke execute on function gold.fn_cmv_teorico(integer) from anon, public;
revoke execute on function silver.fn_estoque_contagem_buckets(integer, date) from anon, public;
revoke execute on function silver.fn_estoque_contagem_final_semana(integer, date) from anon, public;
revoke execute on function system.acessos_analytics(integer) from anon, public;
revoke execute on function system.audit_stats(integer) from anon, public;
revoke execute on function system.audit_tabelas_catalogo() from anon, public;
revoke execute on function system.cron_status() from anon, public;
revoke execute on function system.fn_token_cutoff_on_perm_change() from anon, public;
revoke execute on function system.session_heartbeat(uuid, boolean, text, integer) from anon, public;
-- fn_audit é função de trigger; nunca deve ser RPC. Trigger não checa EXECUTE, então revogar geral é seguro.
revoke execute on function system.fn_audit() from anon, public, authenticated;

-- Matviews financeiras não devem ser lidas por anon (dado sensível). Revoga anon (targeted, seguro).
revoke select on gold.cmv_teorico_dia from anon;
revoke select on gold.mv_dre_ano from anon;
revoke select on gold.mv_dfc_ano from anon;

-- ===== #9 Saúde/retenção da auditoria =====
create or replace function system.audit_saude()
returns jsonb language sql security definer set search_path to 'system','pg_catalog' as $$
  select jsonb_build_object(
    'linhas', (select count(*) from system.audit_trail),
    'tamanho', pg_size_pretty(pg_total_relation_size('system.audit_trail')),
    'tamanho_bytes', pg_total_relation_size('system.audit_trail'),
    'mais_antigo', (select to_char(min("timestamp"),'YYYY-MM-DD') from system.audit_trail),
    'mais_novo', (select to_char(max("timestamp"),'YYYY-MM-DD') from system.audit_trail),
    'sessoes', (select count(*) from system.user_sessions),
    'page_time_linhas', (select count(*) from system.session_page_time),
    'retencao_meses', 12,
    'tabelas_auditadas', (select count(*) from pg_trigger t join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and p.proname='fn_audit')
  );
$$;
revoke execute on function system.audit_saude() from anon, public;
grant execute on function system.audit_saude() to service_role;
