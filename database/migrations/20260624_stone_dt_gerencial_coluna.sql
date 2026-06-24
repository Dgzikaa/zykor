-- Coluna GERADA dt_gerencial na camada silver da Stone (medallion), em vez do corte 6h inline.
-- Regra: venda 00h–06h conta no dia operacional anterior. Postgres calcula em toda linha
-- (inclusive existentes) → nunca desatualiza, sem mexer no ETL parse_stone_conciliacao.
-- Fica com as duas datas: capture_date (contábil) + dt_gerencial (gerencial). Reutilizável
-- na conciliação fiscal E no lançamento de receita Stone na DRE (evita ajuste manual). [Gonza]
ALTER TABLE silver.stone_transacoes
  ADD COLUMN IF NOT EXISTS dt_gerencial date
  GENERATED ALWAYS AS ((capture_local_dt - interval '6 hours')::date) STORED;

CREATE INDEX IF NOT EXISTS ix_stone_transacoes_bar_dtger
  ON silver.stone_transacoes (bar_id, dt_gerencial);

-- gold.fn_refresh_conciliacao_fiscal item 2 (NF × Stone) passou a usar t.dt_gerencial
-- (não mais o cálculo inline). Corpo completo aplicado em prod na mesma migration.
