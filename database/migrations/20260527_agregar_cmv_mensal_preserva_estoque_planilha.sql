-- Aplicada via MCP em 2026-05-27.
-- Reverte parcialmente o fix de 2026-05-26: agora a funcao PRESERVA estoque
-- inicial/final quando fonte='planilha' (igual ja faz com bonificacoes/CMA).
--
-- Motivo: o fix anterior unificou estoque vindo de cmv_semanal pra resolver
-- a visao SEMANAL (snapshot da virada de semana ISO). Mas o socio quer a
-- visao MENSAL bate com o inventario do bloco mensal da planilha (linhas 1
-- e 3 da aba "CMV Mensal"), que tem datas proprias e diverge consistente-
-- mente da virada de semana (ex: Mai/26 planilha=234.243,38 vs cmv_semanal
-- S19=207.372,88).
--
-- Nova regra:
--   1) sync-cmv-mensal le estoque_inicial/final da planilha e grava com
--      fonte='planilha' (ja ajustado no edge function nesta mesma data).
--   2) agregar_cmv_mensal_auto:
--      - Se ja existe row com fonte='planilha' E estoque > 0 -> PRESERVA
--      - Caso contrario -> deriva de cmv_semanal (comportamento anterior)
--
-- Casos:
--   - Mes que sync rodou apos planilha atualizada: estoque vem da planilha
--   - Mes sem dados na planilha: cai pro fallback semanal (comportamento ok)
--   - cmv_semanal continua a ser fonte unica do estoque semanal (nao muda)

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
  v_existing_fonte text;
  v_existing_estoque_inicial numeric := 0;
  v_existing_estoque_final numeric := 0;
  v_usar_estoque_planilha boolean := false;
BEGIN
  -- Preservar campos manuais (bonificacoes, ajuste_bonif, CMA func) E estoque
  -- quando ja veio da planilha (fonte='planilha').
  SELECT fonte,
         COALESCE(compras_alimentacao, 0),
         COALESCE(bonificacao_contrato_anual, 0),
         COALESCE(bonificacao_cashback_mensal, 0),
         COALESCE(ajuste_bonificacoes, 0),
         COALESCE(estoque_inicial, 0),
         COALESCE(estoque_final, 0)
  INTO v_existing_fonte,
       v_existing_compras_alim,
       v_existing_bonif_contrato, v_existing_bonif_cashback, v_existing_ajuste_bonif,
       v_existing_estoque_inicial, v_existing_estoque_final
  FROM financial.cmv_mensal
  WHERE bar_id = p_bar_id AND ano = p_ano AND mes = p_mes;

  -- Regra de preservacao: se ja tem row com fonte='planilha' e estoque > 0,
  -- preservamos. Caso contrario derivamos de cmv_semanal.
  v_usar_estoque_planilha := (v_existing_fonte = 'planilha'
                              AND (v_existing_estoque_inicial > 0 OR v_existing_estoque_final > 0));

  SELECT cmv_fator_consumo::numeric INTO v_fator
  FROM operations.bar_regras_negocio WHERE bar_id = p_bar_id LIMIT 1;
  v_fator := COALESCE(v_fator, 1);

  -- Compras CMV (DESPESA - RECEITA, e alimentacao separado)
  SELECT
    COALESCE(SUM(CASE WHEN tipo='DESPESA' THEN valor_bruto ELSE -valor_bruto END) FILTER (WHERE categoria_nome ILIKE '%custo comida%'), 0),
    COALESCE(SUM(CASE WHEN tipo='DESPESA' THEN valor_bruto ELSE -valor_bruto END) FILTER (WHERE categoria_nome ILIKE '%custo bebida%'), 0),
    COALESCE(SUM(CASE WHEN tipo='DESPESA' THEN valor_bruto ELSE -valor_bruto END) FILTER (WHERE categoria_nome ILIKE '%custo drink%'), 0),
    COALESCE(SUM(CASE WHEN tipo='DESPESA' THEN valor_bruto ELSE -valor_bruto END) FILTER (WHERE categoria_nome ILIKE '%custo outros%'), 0),
    COALESCE(SUM(CASE WHEN tipo='DESPESA' THEN valor_bruto ELSE -valor_bruto END) FILTER (WHERE categoria_nome ILIKE '%alimenta%'), 0)
  INTO v_compras_comida, v_compras_bebidas, v_compras_drinks, v_compras_outros, v_compras_alim
  FROM silver.contaazul_lancamentos_diarios
  WHERE bar_id = p_bar_id
    AND data_competencia BETWEEN v_data_inicio AND v_data_fim
    AND tipo IN ('DESPESA', 'RECEITA');

  v_compras_total := v_compras_comida + v_compras_bebidas + v_compras_drinks + v_compras_outros;

  -- Faturamento
  SELECT COALESCE(SUM(faturamento_total_consolidado), 0) INTO v_faturamento
  FROM gold.planejamento WHERE bar_id = p_bar_id AND data_evento BETWEEN v_data_inicio AND v_data_fim;

  SELECT comissao, couvert INTO v_comissao, v_couvert
  FROM public.get_comissao_couvert_periodo(p_bar_id, v_data_inicio, v_data_fim);

  v_fat_cmvivel := v_faturamento - COALESCE(v_comissao, 0) - COALESCE(v_couvert, 0);

  -- Consumos
  SELECT
    COALESCE(SUM(total) FILTER (WHERE categoria='socios'), 0) * v_fator,
    COALESCE(SUM(total) FILTER (WHERE categoria='clientes'), 0) * v_fator,
    COALESCE(SUM(total) FILTER (WHERE categoria='artistas'), 0) * v_fator,
    COALESCE(SUM(total) FILTER (WHERE categoria='funcionarios_operacao'), 0) * v_fator,
    COALESCE(SUM(total) FILTER (WHERE categoria='funcionarios_escritorio'), 0) * v_fator
  INTO v_consumo_socios, v_consumo_clientes, v_consumo_artistas, v_consumo_op, v_consumo_esc
  FROM public.get_consumos_classificados_semana(p_bar_id, v_data_inicio, v_data_fim);

  v_consumo_total := v_consumo_socios + v_consumo_clientes + v_consumo_artistas + v_consumo_op + v_consumo_esc;

  -- Estoques: regra dupla
  IF v_usar_estoque_planilha THEN
    -- Preservar valores da planilha (lidos por sync-cmv-mensal)
    v_estoque_inicial := v_existing_estoque_inicial;
    v_estoque_final := v_existing_estoque_final;
  ELSE
    -- Fallback: derivar de cmv_semanal (comportamento de 2026-05-26)
    SELECT estoque_inicial INTO v_estoque_inicial
    FROM financial.cmv_semanal
    WHERE bar_id = p_bar_id AND ano = p_ano
      AND EXTRACT(month FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_mes
      AND EXTRACT(year FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_ano
    ORDER BY semana ASC LIMIT 1;

    SELECT estoque_final INTO v_estoque_final
    FROM financial.cmv_semanal
    WHERE bar_id = p_bar_id AND ano = p_ano
      AND EXTRACT(month FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_mes
      AND EXTRACT(year FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_ano
      AND estoque_final > 0
    ORDER BY semana DESC LIMIT 1;

    v_estoque_inicial := COALESCE(v_estoque_inicial, 0);
    v_estoque_final := COALESCE(v_estoque_final, 0);
  END IF;

  -- Estoques Alimentacao (CMA): preserva planilha se ja preenchido
  IF v_existing_compras_alim > 0 THEN
    v_estoque_inicial_func := COALESCE((SELECT estoque_inicial_funcionarios FROM financial.cmv_mensal WHERE bar_id=p_bar_id AND ano=p_ano AND mes=p_mes), 0);
    v_estoque_final_func := COALESCE((SELECT estoque_final_funcionarios FROM financial.cmv_mensal WHERE bar_id=p_bar_id AND ano=p_ano AND mes=p_mes), 0);
    v_compras_alim := v_existing_compras_alim;
  END IF;

  -- CMV real (bonificacoes reduzem)
  v_cmv_real := v_estoque_inicial + v_compras_total - v_estoque_final - v_consumo_total
                - v_existing_bonif_contrato - v_existing_bonif_cashback - v_existing_ajuste_bonif;
  v_cmv_pct := CASE WHEN v_fat_cmvivel > 0 THEN (v_cmv_real / v_fat_cmvivel * 100) ELSE 0 END;
  v_cma_total := v_compras_alim + v_estoque_inicial_func - v_estoque_final_func;

  INSERT INTO financial.cmv_mensal (
    bar_id, ano, mes, data_inicio, data_fim,
    estoque_inicial, estoque_final,
    compras, compras_alimentacao,
    consumo_socios, consumo_beneficios, consumo_rh_operacao, consumo_rh_escritorio, consumo_artista,
    bonificacao_contrato_anual, bonificacao_cashback_mensal, ajuste_bonificacoes,
    cmv_real, faturamento_cmvivel, cmv_real_percentual, cmv_limpo_percentual,
    faturamento_total,
    estoque_inicial_funcionarios, estoque_final_funcionarios, cma_total,
    fonte, updated_at, created_at
  ) VALUES (
    p_bar_id, p_ano, p_mes, v_data_inicio, v_data_fim,
    v_estoque_inicial, v_estoque_final,
    v_compras_total, v_compras_alim,
    v_consumo_socios, v_consumo_clientes, v_consumo_op, v_consumo_esc, v_consumo_artistas,
    v_existing_bonif_contrato, v_existing_bonif_cashback, v_existing_ajuste_bonif,
    v_cmv_real, v_fat_cmvivel, v_cmv_pct, v_cmv_pct,
    v_faturamento,
    v_estoque_inicial_func, v_estoque_final_func, v_cma_total,
    -- Preserva 'planilha' se estoque veio dela; senao marca como 'auto-agregado'
    CASE WHEN v_usar_estoque_planilha THEN 'planilha' ELSE 'auto-agregado' END,
    NOW(), NOW()
  )
  ON CONFLICT (bar_id, ano, mes) DO UPDATE SET
    data_inicio = EXCLUDED.data_inicio,
    data_fim = EXCLUDED.data_fim,
    estoque_inicial = EXCLUDED.estoque_inicial,
    estoque_final = EXCLUDED.estoque_final,
    compras = EXCLUDED.compras,
    compras_alimentacao = EXCLUDED.compras_alimentacao,
    consumo_socios = EXCLUDED.consumo_socios,
    consumo_beneficios = EXCLUDED.consumo_beneficios,
    consumo_rh_operacao = EXCLUDED.consumo_rh_operacao,
    consumo_rh_escritorio = EXCLUDED.consumo_rh_escritorio,
    consumo_artista = EXCLUDED.consumo_artista,
    cmv_real = EXCLUDED.cmv_real,
    faturamento_cmvivel = EXCLUDED.faturamento_cmvivel,
    cmv_real_percentual = EXCLUDED.cmv_real_percentual,
    cmv_limpo_percentual = EXCLUDED.cmv_limpo_percentual,
    faturamento_total = EXCLUDED.faturamento_total,
    estoque_inicial_funcionarios = EXCLUDED.estoque_inicial_funcionarios,
    estoque_final_funcionarios = EXCLUDED.estoque_final_funcionarios,
    cma_total = EXCLUDED.cma_total,
    fonte = EXCLUDED.fonte,
    updated_at = NOW();
END;
$function$;
