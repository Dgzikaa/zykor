-- 2026-05-01: RPC pra drill-down dos consumos por categoria
--
-- Suporta UI de /ferramentas/consumos-classificacao - aba "Por Categoria"
-- com modal que lista mesa | motivo | qtd | valor | data, ordenado data DESC.

CREATE OR REPLACE FUNCTION public.get_consumos_detalhes_categoria(
  input_bar_id integer,
  input_data_inicio date,
  input_data_fim date,
  input_categoria text
)
RETURNS TABLE(data date, mesa text, motivo text, qtd_itens bigint, valor numeric)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH periodo_com_motivo AS (
    SELECT DISTINCT ON (vd_mesadesc) vd_mesadesc as mesa_p, vd_motivodesconto as motivo_p
    FROM bronze.bronze_contahub_avendas_vendasperiodo
    WHERE bar_id = input_bar_id
      AND vd_dtgerencial >= input_data_inicio
      AND vd_dtgerencial <= input_data_fim
      AND vd_motivodesconto IS NOT NULL AND vd_motivodesconto != ''
    ORDER BY vd_mesadesc, vd_dtgerencial DESC
  )
  SELECT
    ca.trn_dtgerencial::date AS data,
    ca.vd_mesadesc::text AS mesa,
    COALESCE(p.motivo_p, '(sem motivo)')::text AS motivo,
    COUNT(*)::bigint AS qtd_itens,
    ROUND(SUM(ca.desconto)::numeric, 2) AS valor
  FROM bronze.bronze_contahub_avendas_porproduto_analitico ca
  LEFT JOIN periodo_com_motivo p ON ca.vd_mesadesc = p.mesa_p
  WHERE ca.bar_id = input_bar_id
    AND ca.trn_dtgerencial >= input_data_inicio
    AND ca.trn_dtgerencial <= input_data_fim
    AND ca.valorfinal = 0 AND ca.desconto > 0
    AND public.classificar_consumo(ca.vd_mesadesc, p.motivo_p, input_bar_id) = input_categoria
  GROUP BY ca.trn_dtgerencial, ca.vd_mesadesc, p.motivo_p
  ORDER BY ca.trn_dtgerencial DESC, valor DESC;
END;
$$;

-- Override: Diego = funcionario de operacao (NAO socio, mesmo se garcom marcar errado)
-- Prioridade 5 garante avaliacao antes do regex \msocio\M (prioridade 20)
DELETE FROM financial.consumos_keywords WHERE pattern='diego' AND categoria='socios';
INSERT INTO financial.consumos_keywords (pattern, categoria, prioridade, descricao)
VALUES ('diego', 'funcionarios_operacao', 5,
  'Funcionario Diego (Ord). Override prio 5 garante que cai em operacao mesmo se garcom marcar como Socio.')
ON CONFLICT DO NOTHING;
