-- ============================================================
-- 2026-06-02 — gold.cliente_coorte_mensal: view -> materialized view
-- Causa: a view recalculava self-join sobre silver.cliente_visitas (176k linhas,
-- sort externo em disco) a cada request (~3.7s quente; a frio estourava o
-- statement_timeout do PostgREST -> 500 intermitente em /api/analitico/clientes/retencao).
-- Fix: materializar. Leitura via índice = ~0.1ms. Refresh diário por pg_cron.
-- Aplicado via Supabase MCP (apply_migration + cron.schedule).
-- ============================================================
DROP VIEW IF EXISTS gold.cliente_coorte_mensal CASCADE;

CREATE MATERIALIZED VIEW gold.cliente_coorte_mensal AS
WITH primeira AS (
  SELECT bar_id, cliente_fone_norm,
         date_trunc('month', min(data_visita)::timestamptz)::date AS coorte
    FROM silver.cliente_visitas
   WHERE cliente_fone_norm IS NOT NULL AND cliente_fone_norm <> ''
   GROUP BY bar_id, cliente_fone_norm
), atividade AS (
  SELECT DISTINCT bar_id, cliente_fone_norm,
         date_trunc('month', data_visita::timestamptz)::date AS mes
    FROM silver.cliente_visitas
   WHERE cliente_fone_norm IS NOT NULL AND cliente_fone_norm <> ''
)
SELECT p.bar_id,
       p.coorte,
       a.mes AS mes_atividade,
       (EXTRACT(year FROM a.mes)::int * 12 + EXTRACT(month FROM a.mes)::int)
         - (EXTRACT(year FROM p.coorte)::int * 12 + EXTRACT(month FROM p.coorte)::int) AS mes_offset,
       count(DISTINCT a.cliente_fone_norm) AS clientes
  FROM primeira p
  JOIN atividade a
    ON a.bar_id = p.bar_id AND a.cliente_fone_norm = p.cliente_fone_norm AND a.mes >= p.coorte
 GROUP BY p.bar_id, p.coorte, a.mes;

-- índice único (bar_id, coorte, mes_offset): serve o filtro da rota E habilita REFRESH CONCURRENTLY.
CREATE UNIQUE INDEX ux_cliente_coorte_mensal
  ON gold.cliente_coorte_mensal (bar_id, coorte, mes_offset);

GRANT SELECT ON gold.cliente_coorte_mensal TO anon, authenticated, service_role;

-- Refresh diário (08:30 BRT / 11:30 UTC), concorrente p/ não travar leitura.
SELECT cron.schedule(
  'refresh-cliente-coorte-mensal',
  '30 11 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY gold.cliente_coorte_mensal;$$
);
