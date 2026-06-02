-- 20260602_fix_faturamento_pagamentos_adapter_silver.sql
--
-- BUG (regressao silenciosa ~6 semanas): silver.faturamento_pagamentos parou de ser
-- populada em 16/04. O adapter_contahub_to_faturamento_pagamentos tinha search_path
-- 'public' mas a tabela mudou pra silver (medallion v4.0) -> DELETE/INSERT em
-- faturamento_pagamentos (public, inexistente) -> erro engolido pelo EXCEPTION do
-- rodar_adapters_diarios -> tabela congelada. Alem disso a fonte bronze mudou colunas
-- (sem 'taxa'). Impacto: etl_gold_desempenho_mensal + visao geral com pagamentos parados.
--
-- FIX: qualificar silver.faturamento_pagamentos + mapear colunas atuais do bronze
-- (taxa = valor - liquido). E remover do rodar_adapters_diarios a chamada obsoleta a
-- adapter_contahub_to_visitas (visitas virou view). Backfill 16/04->01/06 + re-ETL mensal
-- rodados manualmente apos esta migration.

CREATE OR REPLACE FUNCTION public.adapter_contahub_to_faturamento_pagamentos(p_bar_id integer, p_data date)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_inserted INTEGER;
BEGIN
  DELETE FROM silver.faturamento_pagamentos WHERE bar_id = p_bar_id AND data_pagamento = p_data AND origem = 'contahub';
  INSERT INTO silver.faturamento_pagamentos (
    bar_id, data_pagamento, meio, tipo, valor_bruto, taxa, valor_liquido,
    cliente_nome, mesa_desc, origem, origem_ref
  )
  SELECT bar_id, dt_gerencial, meio, tipo,
    COALESCE(valor, 0), (COALESCE(valor, 0) - COALESCE(liquido, 0)), COALESCE(liquido, 0),
    cliente, mesa, 'contahub', id
  FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos
  WHERE bar_id = p_bar_id AND dt_gerencial = p_data;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$function$;

-- rodar_adapters_diarios: remove a chamada obsoleta a adapter_contahub_to_visitas
CREATE OR REPLACE FUNCTION public.rodar_adapters_diarios(p_data date DEFAULT ((CURRENT_DATE - '1 day'::interval))::date)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE v_bar_id INTEGER; v_result TEXT := '';
BEGIN
  FOR v_bar_id IN SELECT bar_id FROM operations.bares_config ORDER BY bar_id LOOP
    BEGIN PERFORM adapter_contahub_to_vendas_item(v_bar_id, p_data); v_result := v_result || format('vendas_item bar %s OK | ', v_bar_id);
    EXCEPTION WHEN OTHERS THEN v_result := v_result || format('vendas_item bar %s ERRO: %s | ', v_bar_id, SQLERRM); END;
    -- (removido) adapter_contahub_to_visitas: obsoleto, 'visitas' virou view
    BEGIN PERFORM adapter_contahub_to_tempos_producao(v_bar_id, p_data); v_result := v_result || format('tempos bar %s OK | ', v_bar_id);
    EXCEPTION WHEN OTHERS THEN v_result := v_result || format('tempos bar %s ERRO: %s | ', v_bar_id, SQLERRM); END;
    BEGIN PERFORM adapter_contahub_to_faturamento_hora(v_bar_id, p_data); v_result := v_result || format('fat_hora bar %s OK | ', v_bar_id);
    EXCEPTION WHEN OTHERS THEN v_result := v_result || format('fat_hora bar %s ERRO: %s | ', v_bar_id, SQLERRM); END;
    BEGIN PERFORM adapter_contahub_to_faturamento_pagamentos(v_bar_id, p_data); v_result := v_result || format('fat_pag bar %s OK | ', v_bar_id);
    EXCEPTION WHEN OTHERS THEN v_result := v_result || format('fat_pag bar %s ERRO: %s | ', v_bar_id, SQLERRM); END;
  END LOOP;
  RETURN v_result;
END;
$function$;

-- Backfill aplicado manualmente:
--   SELECT public.adapter_contahub_to_faturamento_pagamentos(b, d) para b in (3,4), d in 2026-04-16..2026-06-01;
--   SELECT public.etl_gold_desempenho_mensal(b, 2026, m) para b in (3,4), m in (4,5,6);
