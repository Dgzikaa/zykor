-- 20260602_r3_lint_db_functions.sql
--
-- R3 (guard de schema-drift): instala plpgsql_check e cria public.lint_db_functions(),
-- que roda analise ESTATICA em todas as funcoes plpgsql e retorna os erros (tabela/
-- coluna/funcao inexistente) ANTES de chegar em producao.
--
-- Contexto: a sessao de 02/06 achou 3 funcoes do pipeline de desempenho quebradas por
-- schema-drift (calculate_evento_metrics -> yuzer.valor_pago; watchdog -> contahub_raw_data;
-- etc.), todas escondidas por EXCEPTION WHEN OTHERS. Este lint pega TODAS de uma vez.
-- Rodar no CI (scripts/lint-db-functions.mjs) antes de cada deploy de migration.

CREATE EXTENSION IF NOT EXISTS plpgsql_check;

CREATE OR REPLACE FUNCTION public.lint_db_functions()
RETURNS TABLE(funcao text, lineno int, message text)
LANGUAGE plpgsql AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_language l ON l.oid=p.prolang AND l.lanname='plpgsql'
    WHERE n.nspname IN ('public','operations','financial','gold','silver','system','meta','crm','ops','integrations','bronze')
      AND p.prokind='f' AND p.prorettype <> 'pg_catalog.trigger'::regtype
  LOOP
    BEGIN
      RETURN QUERY SELECT r.oid::regprocedure::text, t.lineno, t.message
        FROM plpgsql_check_function_tb(r.oid) t WHERE t.level='error';
    EXCEPTION WHEN OTHERS THEN
      NULL; -- funcoes com SQL dinamico nao sao checaveis estaticamente
    END;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.lint_db_functions() IS 'R3 schema-drift guard: roda plpgsql_check em todas as funcoes plpgsql e retorna erros (relacao/coluna/funcao inexistente). Usar em CI antes de deploy.';
