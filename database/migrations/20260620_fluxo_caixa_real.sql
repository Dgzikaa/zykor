-- 2026-06-20 — Fluxo de caixa REAL (aterrado na realidade).
-- A projeção antiga (fluxo_caixa_previsto) é só modelo (receita − CMV/CMO/fixos). Esta versão
-- combina: saldo atual (input) + entradas projetadas (receita do modelo) − contas a pagar
-- COMPROMETIDAS no CA (em aberto, por vencimento) = saldo acumulado por dia → mostra quando
-- o caixa aperta/fica negativo.
CREATE OR REPLACE FUNCTION financial.fluxo_caixa_real(p_bar_id integer, p_saldo_inicial numeric DEFAULT 0, p_dias integer DEFAULT 60)
RETURNS TABLE(dia date, entradas numeric, saidas numeric, saldo numeric)
LANGUAGE sql STABLE SET search_path TO 'financial','bronze','public','pg_catalog' AS $$
  WITH dias AS (
    SELECT generate_series(current_date, current_date + (p_dias-1), interval '1 day')::date AS dia
  ),
  ent AS (
    SELECT data_referencia::date dia, SUM(receita_prevista) receita
    FROM financial.fluxo_caixa_previsto WHERE bar_id=p_bar_id AND cenario='base' GROUP BY data_referencia
  ),
  sai AS (
    SELECT data_vencimento dia, SUM(GREATEST(COALESCE(valor_bruto,0)-COALESCE(valor_pago,0),0)) valor
    FROM bronze.bronze_contaazul_lancamentos
    WHERE bar_id=p_bar_id AND excluido_em IS NULL AND tipo='DESPESA'
      AND status <> 'ACQUITTED' AND data_vencimento >= current_date
    GROUP BY data_vencimento
  ),
  base AS (
    SELECT d.dia, COALESCE(e.receita,0) entradas, COALESCE(s.valor,0) saidas
    FROM dias d LEFT JOIN ent e ON e.dia=d.dia LEFT JOIN sai s ON s.dia=d.dia
  )
  SELECT dia, ROUND(entradas,2), ROUND(saidas,2),
    ROUND(p_saldo_inicial + SUM(entradas - saidas) OVER (ORDER BY dia), 2) AS saldo
  FROM base ORDER BY dia;
$$;
