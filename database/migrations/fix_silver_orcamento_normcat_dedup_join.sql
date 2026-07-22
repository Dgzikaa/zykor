-- FIX Orçamentação: o de-para (meta.categoria_zykor_map) tem várias grafias por categoria
-- (ex.: "Utensílios" e "UTENSÍLIOS") e o bronze traz variações de acento vindas do Conta Azul
-- (ex.: "Utensilios" SEM acento). O join antigo era por TEXTO EXATO (m.categoria_ca =
-- b.categoria_nome) → grafias sem acento não casavam e caíam no fallback cru (categoria_zykor
-- = categoria_nome), ficando fora do drill-down por categoria da tela de Orçamentação (o total
-- da linha batia por acaso porque o front reagrupa por chave normalizada).
-- Agora casa por public.normcat() (tira acento/caixa), igual à DRE. Como o de-para tem grafias
-- que colidem no mesmo normcat, deduplicamos o mapa por normcat (DISTINCT ON) ANTES do join,
-- senão o LEFT JOIN faria fan-out (duplicaria cada lançamento). As colisões concordam no
-- categoria_zykor, então a escolha determinística (ORDER BY categoria_ca) é segura.
-- Aplicada em produção via Supabase migration de mesmo nome. Após aplicar, reprocessar:
--   select silver.fn_refresh_silver_orcamento(<bar>, <ini>, <fim>);
--   e gold.fn_refresh_gold_orcamento(<bar>, <ano>, <mes>) por mês do período.
CREATE OR REPLACE FUNCTION silver.fn_refresh_silver_orcamento(p_bar_id integer, p_data_inicio date, p_data_fim date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_rows INTEGER;
BEGIN
  DELETE FROM silver.lancamento_classificado
  WHERE bar_id = p_bar_id
    AND data_competencia BETWEEN p_data_inicio AND p_data_fim;

  WITH map_norm AS (
    SELECT DISTINCT ON (public.normcat(categoria_ca))
      public.normcat(categoria_ca) AS nc,
      categoria_zykor, bloco_dre, tipo_zykor, ignorar
    FROM meta.categoria_zykor_map
    ORDER BY public.normcat(categoria_ca), categoria_ca
  )
  INSERT INTO silver.lancamento_classificado (
    contaazul_id, bar_id, data_competencia, data_pagamento,
    tipo_ca, status, categoria_ca, categoria_zykor, bloco_dre, tipo_zykor,
    valor_bruto, descricao, pessoa_nome,
    is_antecipacao_stone, is_ignorado
  )
  SELECT
    b.contaazul_id::uuid,
    b.bar_id,
    b.data_competencia,
    b.data_pagamento,
    b.tipo,
    COALESCE(b.status, 'UNKNOWN'),
    b.categoria_nome,
    COALESCE(m.categoria_zykor, b.categoria_nome),
    m.bloco_dre,
    m.tipo_zykor,
    -- valor EFETIVO: pago se >0 (saiu de fato), senao bruto (planejado)
    ABS(COALESCE(NULLIF(b.valor_pago, 0), b.valor_bruto)::numeric),
    b.descricao,
    b.pessoa_nome,
    (b.descricao ~* 'STONE\s+PAGAMENTO\s+ANTECIPAC'),
    COALESCE(m.ignorar, FALSE)
  FROM bronze.bronze_contaazul_lancamentos b
  LEFT JOIN map_norm m ON m.nc = public.normcat(b.categoria_nome)
  WHERE b.bar_id = p_bar_id
    AND b.data_competencia BETWEEN p_data_inicio AND p_data_fim
    AND b.excluido_em IS NULL
  ON CONFLICT (contaazul_id) DO UPDATE SET
    bar_id = EXCLUDED.bar_id,
    data_competencia = EXCLUDED.data_competencia,
    data_pagamento = EXCLUDED.data_pagamento,
    tipo_ca = EXCLUDED.tipo_ca,
    status = EXCLUDED.status,
    categoria_ca = EXCLUDED.categoria_ca,
    categoria_zykor = EXCLUDED.categoria_zykor,
    bloco_dre = EXCLUDED.bloco_dre,
    tipo_zykor = EXCLUDED.tipo_zykor,
    valor_bruto = EXCLUDED.valor_bruto,
    descricao = EXCLUDED.descricao,
    pessoa_nome = EXCLUDED.pessoa_nome,
    is_antecipacao_stone = EXCLUDED.is_antecipacao_stone,
    is_ignorado = EXCLUDED.is_ignorado,
    sync_at = NOW();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$function$;
