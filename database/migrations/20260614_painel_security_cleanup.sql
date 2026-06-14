-- 2026-06-14 — Limpeza de lints de segurança introduzidos junto do Painel Supabase / pg_cron.
-- Já aplicado em prod via MCP nesta data; este arquivo versiona pro repo refletir o banco.
--
-- 1) As funções wrapper do painel (cron_job_ativo / net_fila_pendente) são chamadas apenas
--    DENTRO da view v_progresso_bronze_contahub (que roda como owner). Não precisam ser
--    executáveis por anon/authenticated via PostgREST — revogar remove a exposição
--    (lints anon/authenticated_security_definer_function_executable).
REVOKE EXECUTE ON FUNCTION public.cron_job_ativo(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.net_fila_pendente() FROM anon, authenticated;

-- 2) Trigger fn do CMV semanal: fixar search_path (lint function_search_path_mutable).
--    Só usa NEW.* e aritmética, então pg_catalog basta.
ALTER FUNCTION financial.fn_cmv_semanal_recalc_real() SET search_path = pg_catalog;

-- Obs: VACUUM (FULL) net._http_response (31 MB -> 240 kB) também foi rodado em prod,
-- mas é manutenção pontual (não-transacional) e não entra como migration.
