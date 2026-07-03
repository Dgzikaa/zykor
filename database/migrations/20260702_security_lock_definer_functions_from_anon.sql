-- #2 (parte segura): fecha o vetor EXTERNO (anon/public) nas 5 funções SECURITY DEFINER que o
-- anon podia executar. App chama tudo via service_role (confirmado no código), então revoga public
-- e re-concede aos roles do app. As 3 de análise mantêm authenticated (baixo risco) pra zero
-- chance de quebrar o CMV (roda a cada save). system.fn_audit é trigger (não chamável direto → ok).
--
-- NÃO incluído aqui: revogar anon nas ~26 VIEWS definer legíveis. Isso precisa de passada cuidadosa
-- porque alguns services leem views direto no navegador com a chave anon (ex.: orcamentacao-service
-- lê silver.consumacao_artistas) — revogar quebraria Orçamentação/Planejamento. Tem que mover essas
-- leituras pra rotas de API (service_role) ANTES de trancar. Ver [[project_seguranca_anon_grants_hardening_2026_06]].
revoke execute on function gold.fn_cmv_teorico(integer) from public;
grant execute on function gold.fn_cmv_teorico(integer) to service_role, authenticated;

revoke execute on function silver.fn_estoque_contagem_buckets(integer, date) from public;
grant execute on function silver.fn_estoque_contagem_buckets(integer, date) to service_role, authenticated;

revoke execute on function silver.fn_estoque_contagem_final_semana(integer, date) from public;
grant execute on function silver.fn_estoque_contagem_final_semana(integer, date) to service_role, authenticated;

revoke execute on function system.debug_request_headers() from public;
grant execute on function system.debug_request_headers() to service_role;
