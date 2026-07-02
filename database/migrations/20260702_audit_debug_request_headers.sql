-- Diagnóstico da atribuição de auditoria: devolve os headers que o PostgREST expõe em
-- request.headers pra a requisição atual. Usado por /api/configuracoes/auditoria/diagnostico
-- pra confirmar que o x-audit-email injetado pelo getAdminClient chega ao banco. Só service_role.
create or replace function system.debug_request_headers()
returns jsonb language sql stable security definer set search_path to 'system' as $$
  select jsonb_build_object(
    'request_headers', nullif(current_setting('request.headers', true), '')::jsonb,
    'x_audit_email', (nullif(current_setting('request.headers', true), '')::json ->> 'x-audit-email'),
    'x_audit_role',  (nullif(current_setting('request.headers', true), '')::json ->> 'x-audit-role'),
    'x_audit_bar',   (nullif(current_setting('request.headers', true), '')::json ->> 'x-audit-bar')
  );
$$;
revoke all on function system.debug_request_headers() from anon, authenticated;
grant execute on function system.debug_request_headers() to service_role;
