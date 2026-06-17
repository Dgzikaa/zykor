-- ============================================================================
-- Historico diario de custo/preco de produto do cardapio
-- ----------------------------------------------------------------------------
-- Snapshot diario de operations.produto_custo_manual. Permite ver o custo/preco
-- de cada produto em cada dia e o que mudou (planilha re-sync OU edicao manual).
-- Cron: 'cardapio-custo-snapshot-diario' (pg_cron, SQL puro) + tambem chamado no
-- fim do edge function sync-cardapio-custo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS operations.produto_custo_historico (
  id                   bigserial PRIMARY KEY,
  bar_id               integer       NOT NULL,
  produto_codigo       text          NOT NULL,
  codigo_planilha      text,
  produto_desc         text,
  custo_manual         numeric(12,4),
  preco_venda_planilha numeric(12,2),
  fonte                text,
  snapshot_date        date          NOT NULL,
  captured_at          timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (bar_id, produto_codigo, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_pch_bar_produto_data
  ON operations.produto_custo_historico (bar_id, produto_codigo, snapshot_date);

COMMENT ON TABLE operations.produto_custo_historico IS
  'Snapshot diario de operations.produto_custo_manual. Custo/preco de cada produto por dia.';

CREATE OR REPLACE FUNCTION operations.snapshot_produto_custo(p_date date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'operations'
AS $function$
DECLARE v_n integer;
BEGIN
  INSERT INTO operations.produto_custo_historico
    (bar_id, produto_codigo, codigo_planilha, produto_desc, custo_manual, preco_venda_planilha, fonte, snapshot_date)
  SELECT bar_id, produto_codigo, codigo_planilha, produto_desc, custo_manual, preco_venda_planilha, fonte, p_date
  FROM operations.produto_custo_manual
  ON CONFLICT (bar_id, produto_codigo, snapshot_date) DO UPDATE SET
    codigo_planilha      = EXCLUDED.codigo_planilha,
    produto_desc         = EXCLUDED.produto_desc,
    custo_manual         = EXCLUDED.custo_manual,
    preco_venda_planilha = EXCLUDED.preco_venda_planilha,
    fonte                = EXCLUDED.fonte,
    captured_at          = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

-- Mostra so quando custo OU preco mudou em relacao ao snapshot anterior.
CREATE OR REPLACE VIEW operations.produto_custo_mudancas AS
WITH h AS (
  SELECT bar_id, produto_codigo, produto_desc, snapshot_date, custo_manual, preco_venda_planilha, fonte,
         lag(custo_manual)         OVER w AS custo_anterior,
         lag(preco_venda_planilha) OVER w AS preco_anterior,
         lag(snapshot_date)        OVER w AS data_anterior
  FROM operations.produto_custo_historico
  WINDOW w AS (PARTITION BY bar_id, produto_codigo ORDER BY snapshot_date)
)
SELECT bar_id, produto_codigo, produto_desc, snapshot_date AS data_mudanca, data_anterior,
       custo_anterior, custo_manual AS custo_novo,
       preco_anterior, preco_venda_planilha AS preco_novo, fonte
FROM h
WHERE custo_manual IS DISTINCT FROM custo_anterior
   OR preco_venda_planilha IS DISTINCT FROM preco_anterior;

GRANT SELECT ON operations.produto_custo_historico TO authenticated, anon, service_role;
GRANT SELECT ON operations.produto_custo_mudancas   TO authenticated, anon, service_role;

-- Snapshot diario (SQL puro, nao precisa de HTTP).
-- SELECT cron.schedule('cardapio-custo-snapshot-diario', '30 11 * * *',
--   $$ SELECT operations.snapshot_produto_custo(); $$);
