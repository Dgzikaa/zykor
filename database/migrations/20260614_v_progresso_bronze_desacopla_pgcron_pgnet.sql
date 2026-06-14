-- 2026-06-14 — Desacoplar public.v_progresso_bronze_contahub de pg_cron e pg_net.
-- A view referenciava cron.job e net.http_request_queue direto, criando dependência
-- nas extensões — o que bloqueia operações da plataforma ("Remove objects that depend
-- on pg_cron"). Solução padrão: envolver os acessos em funções SECURITY DEFINER; a view
-- passa a depender das FUNÇÕES (não das tabelas das extensões), preservando a info.

CREATE OR REPLACE FUNCTION public.cron_job_ativo(p_jobname text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$ SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = p_jobname AND active) $$;

CREATE OR REPLACE FUNCTION public.net_fila_pendente()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$ SELECT count(*)::bigint FROM net.http_request_queue $$;

GRANT EXECUTE ON FUNCTION public.cron_job_ativo(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.net_fila_pendente() TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.v_progresso_bronze_contahub AS
 WITH ref3 AS (
         SELECT DISTINCT bronze_contahub_raw_data.data_date
           FROM bronze.bronze_contahub_raw_data
          WHERE bronze_contahub_raw_data.data_type = 'fatporhora'::text AND bronze_contahub_raw_data.bar_id = 3
        ), ref4 AS (
         SELECT DISTINCT bronze_contahub_raw_data.data_date
           FROM bronze.bronze_contahub_raw_data
          WHERE bronze_contahub_raw_data.data_type = 'fatporhora'::text AND bronze_contahub_raw_data.bar_id = 4
        ), inc3_total AS (
         SELECT DISTINCT r.data_date
           FROM ref3 r
             CROSS JOIN ( VALUES ('analitico'::text), ('cancelamentos'::text), ('pagamentos'::text), ('periodo'::text), ('tempo'::text), ('vendas'::text)) dt(tipo)
          WHERE NOT (EXISTS ( SELECT 1
                   FROM bronze.bronze_contahub_raw_data b
                  WHERE b.bar_id = 3 AND b.data_date = r.data_date AND b.data_type = dt.tipo))
        ), inc4_total AS (
         SELECT DISTINCT r.data_date
           FROM ref4 r
             CROSS JOIN ( VALUES ('analitico'::text), ('cancelamentos'::text), ('pagamentos'::text), ('periodo'::text), ('tempo'::text), ('vendas'::text)) dt(tipo)
          WHERE NOT (EXISTS ( SELECT 1
                   FROM bronze.bronze_contahub_raw_data b
                  WHERE b.bar_id = 4 AND b.data_date = r.data_date AND b.data_type = dt.tipo))
        ), inc3_pendente AS (
         SELECT i.data_date
           FROM inc3_total i
          WHERE NOT (EXISTS ( SELECT 1
                   FROM bronze.bronze_contahub_tentativas t
                  WHERE t.bar_id = 3 AND t.data_date = i.data_date))
        ), inc4_pendente AS (
         SELECT i.data_date
           FROM inc4_total i
          WHERE NOT (EXISTS ( SELECT 1
                   FROM bronze.bronze_contahub_tentativas t
                  WHERE t.bar_id = 4 AND t.data_date = i.data_date))
        )
 SELECT ( SELECT count(*) AS count FROM ref3) AS bar3_total_dias,
    ( SELECT count(*) AS count FROM inc3_total) AS bar3_dias_incompletos,
    ( SELECT count(*) AS count FROM inc3_pendente) AS bar3_a_processar,
    ( SELECT count(*) AS count FROM ref4) AS bar4_total_dias,
    ( SELECT count(*) AS count FROM inc4_total) AS bar4_dias_incompletos,
    ( SELECT count(*) AS count FROM inc4_pendente) AS bar4_a_processar,
    ( SELECT count(*) AS count FROM bronze.bronze_contahub_tentativas WHERE bronze_contahub_tentativas.bar_id = 3) AS tentativas_bar3,
    ( SELECT count(*) AS count FROM bronze.bronze_contahub_tentativas WHERE bronze_contahub_tentativas.bar_id = 4) AS tentativas_bar4,
    public.net_fila_pendente() AS fila_pendente,
    public.cron_job_ativo('completar-bronze-contahub'::text) AS job_ativo;
