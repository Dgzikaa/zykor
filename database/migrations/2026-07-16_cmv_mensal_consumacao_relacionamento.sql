-- 2026-07-16 — agregar_cmv_mensal_auto: incluir [Consumação] Relacionamento no balde "benefícios".
--
-- BUG: o balde consumo_beneficios filtrava cliente/aniversário/influencer/pontos, mas ESQUECIA
-- 'relacionamento' → a categoria [Consumação] Relacionamento era DROPADA da consumação mensal
-- (todo mês). Ex. jul/2026 bar 3: consumação vinha 12.826,25 em vez de 12.996,50 (−170,25).
-- FIX: adiciona `OR cat ILIKE '%relaciona%'` ao filtro de clientes/benefícios.
-- Resto da função idêntico ao 20260701_cmv_mensal_consumacao_do_conta_azul.sql.
-- Reprocessar após aplicar: SELECT agregar_cmv_mensal_auto(bar, ano, mes) p/ os meses afetados.

CREATE OR REPLACE FUNCTION public.agregar_cmv_mensal_auto(p_bar_id integer, p_ano integer, p_mes integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
  v_data_inicio date := make_date(p_ano, p_mes, 1);
  v_data_fim date := (make_date(p_ano, p_mes, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_compras_comida numeric := 0; v_compras_bebidas numeric := 0;
  v_compras_drinks numeric := 0; v_compras_outros numeric := 0;
  v_compras_alim numeric := 0; v_compras_total numeric := 0;
  v_faturamento numeric := 0; v_comissao numeric := 0; v_couvert numeric := 0;
  v_ingressos numeric := 0;
  v_fat_cmvivel numeric := 0;
  v_consumo_socios numeric := 0; v_consumo_clientes numeric := 0;
  v_consumo_artistas numeric := 0;
  v_consumo_op numeric := 0; v_consumo_esc numeric := 0;
  v_consumo_total numeric := 0; v_fator numeric := 1;
  v_estoque_inicial numeric := 0; v_estoque_final numeric := 0;
  v_estoque_inicial_func numeric := 0; v_estoque_final_func numeric := 0;
  v_cmv_real numeric := 0; v_cmv_pct numeric := 0; v_cma_total numeric := 0;
  v_existing_compras_alim numeric := 0;
  v_existing_bonif_contrato numeric := 0;
  v_existing_bonif_cashback numeric := 0;
  v_existing_ajuste_bonif numeric := 0;
  v_bonificacoes numeric := 0;
  v_existing_fonte text;
  v_existing_estoque_inicial numeric := 0;
  v_existing_estoque_final numeric := 0;
  v_estoque_manual boolean := false;
  v_fonte_out text;
BEGIN
  SELECT fonte, COALESCE(compras_alimentacao, 0),
         COALESCE(bonificacao_contrato_anual, 0), COALESCE(bonificacao_cashback_mensal, 0),
         COALESCE(ajuste_bonificacoes, 0),
         COALESCE(estoque_inicial, 0), COALESCE(estoque_final, 0),
         COALESCE(bonificacoes, COALESCE(bonificacao_contrato_anual, 0) + COALESCE(bonificacao_cashback_mensal, 0))
  INTO v_existing_fonte, v_existing_compras_alim,
       v_existing_bonif_contrato, v_existing_bonif_cashback, v_existing_ajuste_bonif,
       v_existing_estoque_inicial, v_existing_estoque_final, v_bonificacoes
  FROM financial.cmv_mensal WHERE bar_id = p_bar_id AND ano = p_ano AND mes = p_mes;

  v_bonificacoes := COALESCE(v_bonificacoes, 0);

  v_estoque_manual := (v_existing_fonte IN ('planilha','manual')
                       AND (v_existing_estoque_inicial > 0 OR v_existing_estoque_final > 0));

  SELECT cmv_fator_consumo::numeric INTO v_fator
  FROM operations.bar_regras_negocio WHERE bar_id = p_bar_id LIMIT 1;
  v_fator := COALESCE(v_fator, 1);

  SELECT
    COALESCE(SUM((CASE WHEN tipo='RECEITA' THEN -1 ELSE 1 END) * COALESCE(NULLIF(valor_pago,0), valor_bruto)) FILTER (WHERE categoria_nome ILIKE '%custo comida%'), 0),
    COALESCE(SUM((CASE WHEN tipo='RECEITA' THEN -1 ELSE 1 END) * COALESCE(NULLIF(valor_pago,0), valor_bruto)) FILTER (WHERE categoria_nome ILIKE '%custo bebida%'), 0),
    COALESCE(SUM((CASE WHEN tipo='RECEITA' THEN -1 ELSE 1 END) * COALESCE(NULLIF(valor_pago,0), valor_bruto)) FILTER (WHERE categoria_nome ILIKE '%custo drink%'), 0),
    COALESCE(SUM((CASE WHEN tipo='RECEITA' THEN -1 ELSE 1 END) * COALESCE(NULLIF(valor_pago,0), valor_bruto)) FILTER (WHERE categoria_nome ILIKE '%custo outros%'), 0)
  INTO v_compras_comida, v_compras_bebidas, v_compras_drinks, v_compras_outros
  FROM bronze.bronze_contaazul_lancamentos
  WHERE bar_id = p_bar_id AND data_competencia BETWEEN v_data_inicio AND v_data_fim
    AND tipo IN ('DESPESA', 'RECEITA') AND excluido_em IS NULL;

  SELECT COALESCE(SUM(valor_bruto) FILTER (WHERE categoria_nome ILIKE '%alimenta%' AND tipo='DESPESA'), 0)
  INTO v_compras_alim
  FROM silver.contaazul_lancamentos_diarios
  WHERE bar_id = p_bar_id AND data_competencia BETWEEN v_data_inicio AND v_data_fim
    AND tipo IN ('DESPESA', 'RECEITA');

  v_compras_total := v_compras_comida + v_compras_bebidas + v_compras_drinks + v_compras_outros;

  SELECT COALESCE(SUM(faturamento_total_consolidado), 0),
         COALESCE(SUM(COALESCE(sympla_liquido,0) + COALESCE(faturamento_entrada_yuzer,0)), 0)
  INTO v_faturamento, v_ingressos
  FROM gold.planejamento WHERE bar_id = p_bar_id AND data_evento BETWEEN v_data_inicio AND v_data_fim;

  SELECT comissao, couvert INTO v_comissao, v_couvert
  FROM public.get_comissao_couvert_periodo(p_bar_id, v_data_inicio, v_data_fim);

  v_fat_cmvivel := v_faturamento - COALESCE(v_comissao, 0) - COALESCE(v_couvert, 0) - COALESCE(v_ingressos, 0);

  -- Consumação = CUSTO real do Conta Azul (categorias [Consumação] X). '[CONSUMAÇÃO] AJUSTE CMV'
  -- (contra-lançamento RECEITA) excluído. Benefícios inclui cliente/aniversário/influencer/pontos
  -- E relacionamento (FIX 2026-07-16 — antes o relacionamento era dropado).
  SELECT
    COALESCE(SUM(v) FILTER (WHERE cat ILIKE '%sócios%' OR cat ILIKE '%socios%'), 0),
    COALESCE(SUM(v) FILTER (WHERE cat ILIKE '%cliente%' OR cat ILIKE '%aniversár%' OR cat ILIKE '%aniversar%' OR cat ILIKE '%influencer%' OR cat ILIKE '%pontos%' OR cat ILIKE '%relaciona%'), 0),
    COALESCE(SUM(v) FILTER (WHERE cat ILIKE '%artista%'), 0),
    COALESCE(SUM(v) FILTER (WHERE cat ILIKE '%opera%'), 0),
    COALESCE(SUM(v) FILTER (WHERE cat ILIKE '%escrit%'), 0)
  INTO v_consumo_socios, v_consumo_clientes, v_consumo_artistas, v_consumo_op, v_consumo_esc
  FROM (
    SELECT categoria_nome AS cat,
      (CASE WHEN tipo='RECEITA' THEN -1 ELSE 1 END) * COALESCE(NULLIF(valor_pago,0), valor_bruto) AS v
    FROM bronze.bronze_contaazul_lancamentos
    WHERE bar_id = p_bar_id AND data_competencia BETWEEN v_data_inicio AND v_data_fim
      AND excluido_em IS NULL
      AND categoria_nome ILIKE '[Consuma%'
      AND categoria_nome NOT ILIKE '%ajuste%'
  ) z;

  v_consumo_total := v_consumo_socios + v_consumo_clientes + v_consumo_artistas + v_consumo_op + v_consumo_esc;

  IF v_estoque_manual THEN
    v_estoque_inicial := v_existing_estoque_inicial;
    v_estoque_final := v_existing_estoque_final;
  ELSE
    SELECT estoque_inicial INTO v_estoque_inicial FROM financial.cmv_semanal
    WHERE bar_id=p_bar_id AND ano=p_ano
      AND EXTRACT(month FROM (date_trunc('week', make_date(ano,1,4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_mes
      AND EXTRACT(year FROM (date_trunc('week', make_date(ano,1,4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_ano
    ORDER BY semana ASC LIMIT 1;
    SELECT estoque_final INTO v_estoque_final FROM financial.cmv_semanal
    WHERE bar_id=p_bar_id AND ano=p_ano
      AND EXTRACT(month FROM (date_trunc('week', make_date(ano,1,4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_mes
      AND EXTRACT(year FROM (date_trunc('week', make_date(ano,1,4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_ano
      AND estoque_final > 0
    ORDER BY semana DESC LIMIT 1;
    v_estoque_inicial := COALESCE(v_estoque_inicial, 0);
    v_estoque_final := COALESCE(v_estoque_final, 0);
  END IF;

  v_estoque_inicial_func := COALESCE((SELECT estoque_inicial_funcionarios FROM financial.cmv_mensal WHERE bar_id=p_bar_id AND ano=p_ano AND mes=p_mes), 0);
  v_estoque_final_func   := COALESCE((SELECT estoque_final_funcionarios   FROM financial.cmv_mensal WHERE bar_id=p_bar_id AND ano=p_ano AND mes=p_mes), 0);

  v_cmv_real := v_estoque_inicial + v_compras_total - v_estoque_final - v_consumo_total
                + v_bonificacoes;
  v_cmv_pct := CASE WHEN v_fat_cmvivel > 0 THEN (v_cmv_real / v_fat_cmvivel * 100) ELSE 0 END;
  v_cma_total := v_compras_alim + v_estoque_inicial_func - v_estoque_final_func;

  v_fonte_out := CASE
                   WHEN v_existing_fonte = 'manual' THEN 'manual'
                   WHEN v_estoque_manual THEN 'planilha'
                   ELSE 'auto-agregado'
                 END;

  INSERT INTO financial.cmv_mensal (
    bar_id, ano, mes, data_inicio, data_fim,
    estoque_inicial, estoque_final, compras, compras_alimentacao,
    consumo_socios, consumo_beneficios, consumo_rh_operacao, consumo_rh_escritorio, consumo_artista,
    bonificacao_contrato_anual, bonificacao_cashback_mensal, ajuste_bonificacoes, bonificacoes,
    cmv_real, faturamento_cmvivel, cmv_real_percentual, cmv_limpo_percentual,
    faturamento_total, estoque_inicial_funcionarios, estoque_final_funcionarios, cma_total,
    fonte, updated_at, created_at
  ) VALUES (
    p_bar_id, p_ano, p_mes, v_data_inicio, v_data_fim,
    v_estoque_inicial, v_estoque_final, v_compras_total, v_compras_alim,
    v_consumo_socios, v_consumo_clientes, v_consumo_op, v_consumo_esc, v_consumo_artistas,
    v_existing_bonif_contrato, v_existing_bonif_cashback, v_existing_ajuste_bonif, v_bonificacoes,
    v_cmv_real, v_fat_cmvivel, v_cmv_pct, v_cmv_pct,
    v_faturamento, v_estoque_inicial_func, v_estoque_final_func, v_cma_total,
    v_fonte_out, NOW(), NOW()
  )
  ON CONFLICT (bar_id, ano, mes) DO UPDATE SET
    data_inicio=EXCLUDED.data_inicio, data_fim=EXCLUDED.data_fim,
    estoque_inicial=EXCLUDED.estoque_inicial, estoque_final=EXCLUDED.estoque_final,
    compras=EXCLUDED.compras, compras_alimentacao=EXCLUDED.compras_alimentacao,
    consumo_socios=EXCLUDED.consumo_socios, consumo_beneficios=EXCLUDED.consumo_beneficios,
    consumo_rh_operacao=EXCLUDED.consumo_rh_operacao, consumo_rh_escritorio=EXCLUDED.consumo_rh_escritorio,
    consumo_artista=EXCLUDED.consumo_artista, bonificacoes=EXCLUDED.bonificacoes,
    cmv_real=EXCLUDED.cmv_real, faturamento_cmvivel=EXCLUDED.faturamento_cmvivel,
    cmv_real_percentual=EXCLUDED.cmv_real_percentual, cmv_limpo_percentual=EXCLUDED.cmv_limpo_percentual,
    faturamento_total=EXCLUDED.faturamento_total,
    estoque_inicial_funcionarios=EXCLUDED.estoque_inicial_funcionarios,
    estoque_final_funcionarios=EXCLUDED.estoque_final_funcionarios, cma_total=EXCLUDED.cma_total,
    fonte=EXCLUDED.fonte, updated_at=NOW();
END;
$function$;
