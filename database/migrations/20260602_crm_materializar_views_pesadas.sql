-- 20260602_crm_materializar_views_pesadas.sql
--
-- Contexto: as paginas /analitico/clientes/em-queda e /analitico/clientes/aniversariantes
-- passaram a dar 500. Causa raiz: as VIEWs crm.clientes_em_queda e crm.aniversariantes
-- recomputavam a cada request uma cadeia pesada de CTEs sobre silver.cliente_visitas
-- (window over ~144k linhas) e silver.cliente_estatisticas (~123k linhas), alem de juntar
-- a view crm.clube_ordi_membros (que tambem agrega cliente_estatisticas + fidelidade_regras).
-- O plano levava ~20s e estourava o statement_timeout do PostgREST (role authenticated),
-- retornando 500. Direto no banco (sem timeout) funcionava — por isso passava despercebido.
--
-- Fix: materializar ambas (dados sao day-granular: dias_inativo / proximo_aniver dependem
-- de CURRENT_DATE), com indice unico para REFRESH CONCURRENTLY e refresh diario via pg_cron.
-- Mesmo padrao de gold.cliente_coorte_mensal / gold.v_pipeline_health.
--
-- Ref memoria: feedback_view_pesada_postgrest_timeout

-- =====================================================================
-- 1) crm.clientes_em_queda  (view -> materialized view)
-- =====================================================================
DROP MATERIALIZED VIEW IF EXISTS crm.clientes_em_queda CASCADE;
DROP VIEW IF EXISTS crm.clientes_em_queda CASCADE;

CREATE MATERIALIZED VIEW crm.clientes_em_queda AS
 WITH visitas_ordenadas AS (
         SELECT cliente_visitas.bar_id,
            cliente_visitas.cliente_fone_norm,
            cliente_visitas.cliente_nome,
            cliente_visitas.data_visita,
            cliente_visitas.valor_pagamentos,
            row_number() OVER (PARTITION BY cliente_visitas.bar_id, cliente_visitas.cliente_fone_norm ORDER BY cliente_visitas.data_visita DESC) AS rn_desc
           FROM silver.cliente_visitas
          WHERE cliente_visitas.cliente_fone_norm IS NOT NULL AND cliente_visitas.cliente_fone_norm <> ''::text
        ), ultimas_4 AS (
         SELECT visitas_ordenadas.bar_id,
            visitas_ordenadas.cliente_fone_norm,
            avg(visitas_ordenadas.valor_pagamentos) AS ticket_ult4,
            min(visitas_ordenadas.data_visita) AS data_min_ult4,
            max(visitas_ordenadas.data_visita) AS data_max_ult4
           FROM visitas_ordenadas
          WHERE visitas_ordenadas.rn_desc <= 4
          GROUP BY visitas_ordenadas.bar_id, visitas_ordenadas.cliente_fone_norm
        ), quatro_anteriores AS (
         SELECT visitas_ordenadas.bar_id,
            visitas_ordenadas.cliente_fone_norm,
            avg(visitas_ordenadas.valor_pagamentos) AS ticket_ant4,
            min(visitas_ordenadas.data_visita) AS data_min_ant4,
            max(visitas_ordenadas.data_visita) AS data_max_ant4
           FROM visitas_ordenadas
          WHERE visitas_ordenadas.rn_desc >= 5 AND visitas_ordenadas.rn_desc <= 8
          GROUP BY visitas_ordenadas.bar_id, visitas_ordenadas.cliente_fone_norm
        ), candidatos AS (
         SELECT u.bar_id,
            u.cliente_fone_norm,
            u.ticket_ult4,
            q.ticket_ant4,
                CASE
                    WHEN q.ticket_ant4 > 0::numeric THEN round((u.ticket_ult4 - q.ticket_ant4) / q.ticket_ant4 * 100::numeric, 1)
                    ELSE NULL::numeric
                END AS variacao_ticket_pct,
            (u.data_max_ult4 - u.data_min_ult4)::numeric / 3.0 AS intervalo_ult4_dias,
            (q.data_max_ant4 - q.data_min_ant4)::numeric / 3.0 AS intervalo_ant4_dias,
            u.data_max_ult4 AS ultima_visita,
            CURRENT_DATE - u.data_max_ult4 AS dias_inativo
           FROM ultimas_4 u
             JOIN quatro_anteriores q ON q.bar_id = u.bar_id AND q.cliente_fone_norm = u.cliente_fone_norm
        )
 SELECT c.bar_id,
    c.cliente_fone_norm,
    m.cliente_nome,
    m.nivel,
    m.segmento,
    m.total_visitas,
    round(c.ticket_ult4, 0) AS ticket_ult4,
    round(c.ticket_ant4, 0) AS ticket_ant4,
    c.variacao_ticket_pct,
    round(c.intervalo_ult4_dias, 1) AS intervalo_ult4_dias,
    round(c.intervalo_ant4_dias, 1) AS intervalo_ant4_dias,
        CASE
            WHEN c.intervalo_ant4_dias > 0::numeric THEN round((c.intervalo_ult4_dias - c.intervalo_ant4_dias) / c.intervalo_ant4_dias * 100::numeric, 1)
            ELSE NULL::numeric
        END AS variacao_intervalo_pct,
    c.ultima_visita,
    c.dias_inativo,
    LEAST(100::numeric, GREATEST(0::numeric, COALESCE(
        CASE
            WHEN c.variacao_ticket_pct < 0::numeric THEN (- c.variacao_ticket_pct) * 1.5
            ELSE 0::numeric
        END, 0::numeric) + COALESCE(
        CASE
            WHEN c.intervalo_ant4_dias > 0::numeric THEN GREATEST(0::numeric, (c.intervalo_ult4_dias - c.intervalo_ant4_dias) / c.intervalo_ant4_dias * 50::numeric)
            ELSE 0::numeric
        END, 0::numeric) + c.dias_inativo::numeric * 0.5))::numeric(5,1) AS score_risco,
    m.valor_total_consumo,
    round(c.ticket_ant4 * (365.0 / NULLIF(c.intervalo_ant4_dias, 0::numeric)), 0) AS valor_anual_risco
   FROM candidatos c
     JOIN crm.clube_ordi_membros m ON m.bar_id = c.bar_id AND m.cliente_fone_norm = c.cliente_fone_norm
  WHERE m.total_visitas >= 8
    AND (m.nivel = ANY (ARRAY['ouro'::text, 'diamante'::text, 'prata'::text]))
    AND c.dias_inativo >= 1 AND c.dias_inativo <= 60
    AND (c.variacao_ticket_pct < '-20'::integer::numeric
         OR c.intervalo_ant4_dias > 0::numeric AND c.intervalo_ult4_dias > (c.intervalo_ant4_dias * 1.5));

CREATE UNIQUE INDEX clientes_em_queda_uk ON crm.clientes_em_queda (bar_id, cliente_fone_norm);
CREATE INDEX clientes_em_queda_bar_score ON crm.clientes_em_queda (bar_id, score_risco DESC);
GRANT SELECT ON crm.clientes_em_queda TO anon, authenticated, service_role;

-- =====================================================================
-- 2) crm.aniversariantes  (view -> materialized view)
-- =====================================================================
DROP MATERIALIZED VIEW IF EXISTS crm.aniversariantes CASCADE;
DROP VIEW IF EXISTS crm.aniversariantes CASCADE;

CREATE MATERIALIZED VIEW crm.aniversariantes AS
 WITH base AS (
         SELECT c.bar_id,
            c.cliente_fone_norm,
            c.cliente_nome,
            c.cliente_dtnasc,
            EXTRACT(month FROM c.cliente_dtnasc)::integer AS mes_aniver,
            EXTRACT(day FROM c.cliente_dtnasc)::integer AS dia_aniver,
            c.total_visitas,
            c.valor_total_consumo,
            c.ticket_medio_consumo,
            c.ultima_visita,
            CURRENT_DATE - c.ultima_visita AS dias_inativo,
            EXTRACT(year FROM age(c.cliente_dtnasc::timestamp with time zone))::integer AS idade
           FROM silver.cliente_estatisticas c
          WHERE c.cliente_dtnasc IS NOT NULL AND c.cliente_fone_norm IS NOT NULL AND c.cliente_fone_norm <> ''::text AND c.total_visitas >= 2 AND (CURRENT_DATE - c.ultima_visita) <= 365
        ), ano_corrente AS (
         SELECT base_1.bar_id,
            base_1.cliente_fone_norm,
            base_1.cliente_nome,
            base_1.cliente_dtnasc,
            base_1.mes_aniver,
            base_1.dia_aniver,
            base_1.total_visitas,
            base_1.valor_total_consumo,
            base_1.ticket_medio_consumo,
            base_1.ultima_visita,
            base_1.dias_inativo,
            base_1.idade,
                CASE
                    WHEN base_1.mes_aniver = 2 AND base_1.dia_aniver = 29 AND NOT ((EXTRACT(year FROM CURRENT_DATE)::integer % 4) = 0 AND (EXTRACT(year FROM CURRENT_DATE)::integer % 100) <> 0 OR (EXTRACT(year FROM CURRENT_DATE)::integer % 400) = 0) THEN make_date(EXTRACT(year FROM CURRENT_DATE)::integer, 2, 28)
                    ELSE make_date(EXTRACT(year FROM CURRENT_DATE)::integer, base_1.mes_aniver, base_1.dia_aniver)
                END AS aniver_ano_corrente
           FROM base base_1
        )
 SELECT base.bar_id,
    base.cliente_fone_norm,
    base.cliente_nome,
    base.cliente_dtnasc,
    base.mes_aniver,
    base.dia_aniver,
        CASE
            WHEN base.aniver_ano_corrente >= CURRENT_DATE THEN base.aniver_ano_corrente
            ELSE make_date(EXTRACT(year FROM CURRENT_DATE)::integer + 1,
            CASE
                WHEN base.mes_aniver = 2 AND base.dia_aniver = 29 THEN 2
                ELSE base.mes_aniver
            END,
            CASE
                WHEN base.mes_aniver = 2 AND base.dia_aniver = 29 THEN 28
                ELSE base.dia_aniver
            END)
        END AS proximo_aniver,
    base.total_visitas,
    base.valor_total_consumo,
    base.ticket_medio_consumo,
    base.ultima_visita,
    base.dias_inativo,
    base.idade,
    m.nivel,
    m.segmento
   FROM ano_corrente base
     LEFT JOIN crm.clube_ordi_membros m ON m.bar_id = base.bar_id AND m.cliente_fone_norm = base.cliente_fone_norm;

CREATE UNIQUE INDEX aniversariantes_uk ON crm.aniversariantes (bar_id, cliente_fone_norm);
CREATE INDEX aniversariantes_bar_prox ON crm.aniversariantes (bar_id, proximo_aniver);
GRANT SELECT ON crm.aniversariantes TO anon, authenticated, service_role;

-- =====================================================================
-- 3) Refresh diario via pg_cron (REFRESH CONCURRENTLY exige indice unico)
-- =====================================================================
SELECT cron.schedule('refresh-clientes-em-queda', '0 9 * * *',  'REFRESH MATERIALIZED VIEW CONCURRENTLY crm.clientes_em_queda;');
SELECT cron.schedule('refresh-aniversariantes',   '10 9 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY crm.aniversariantes;');

NOTIFY pgrst, 'reload schema';
