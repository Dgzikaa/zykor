-- 2026-05-04: fix 401 em revalidar_contahub_semana_anterior_ambos_bares
-- e revalidar_stockout_dia_anterior_ambos_bares
--
-- Problema: ambas funcoes usavam current_setting('app.settings.service_role_key', true)
-- pra montar header Authorization, mas esse setting esta NULL/vazio no banco.
-- Resultado: header `Bearer ` (vazio) -> 401 Unauthorized em todas as chamadas.
--
-- Sintoma observado: rajadas de ~30 401 em contahub-processor + contahub-sync-automatico
-- nos logs edge function. Cron `gold-desempenho` e demais ETLs principais NAO eram
-- afetados — apenas o re-validate semanal/diario que usava esse setting.
--
-- Outras funcoes do projeto usam get_service_role_key() (que retorna JWT hardcoded
-- e funciona). Padronizar pra usar a mesma funcao.
--
-- Aplicado direto no banco via patch search-and-replace em 2026-05-04.
-- Esta migration formaliza pra reprodutibilidade.

DO $$
DECLARE
  v_def text;
BEGIN
  -- 1. revalidar_contahub_semana_anterior_ambos_bares
  v_def := pg_get_functiondef('public.revalidar_contahub_semana_anterior_ambos_bares'::regproc);
  IF position('current_setting(''app.settings.service_role_key''' IN v_def) > 0 THEN
    v_def := replace(v_def, 'current_setting(''app.settings.service_role_key'', true)', 'get_service_role_key()');
    EXECUTE v_def;
  END IF;

  -- 2. revalidar_stockout_dia_anterior_ambos_bares
  v_def := pg_get_functiondef('public.revalidar_stockout_dia_anterior_ambos_bares'::regproc);
  IF position('current_setting(''app.settings.service_role_key''' IN v_def) > 0 THEN
    v_def := replace(v_def, 'current_setting(''app.settings.service_role_key'', true)', 'get_service_role_key()');
    EXECUTE v_def;
  END IF;
END $$;
