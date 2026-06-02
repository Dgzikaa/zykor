-- 20260602_burndown_lint_drift_lote1.sql
-- Burn-down do lint R3 (lote 1) — 13 -> 5 funcoes quebradas.
-- Uso verificado (cron + funcoes + frontend/edge) antes de cada acao.

-- VIVAS — corrigidas qualificando o schema atual da tabela:
--   limpar_auditoria_antiga (usada por /api/auditoria/eventos): eventos_base_auditoria -> operations
--   calcular_mix_vendas (usada pelo agent _shared/agent-tools): vendas_item -> silver
CREATE OR REPLACE FUNCTION public.limpar_auditoria_antiga(dias_manter integer DEFAULT 90)
 RETURNS text LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE registros_deletados INTEGER;
BEGIN
  DELETE FROM operations.eventos_base_auditoria
  WHERE data_alteracao < NOW() - (dias_manter || ' days')::INTERVAL;
  GET DIAGNOSTICS registros_deletados = ROW_COUNT;
  RETURN format('🗑️ %s registros de auditoria deletados (mais de %s dias)', registros_deletados, dias_manter);
END;
$function$;

CREATE OR REPLACE FUNCTION public.calcular_mix_vendas(p_bar_id integer, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(total_vendas numeric, perc_bebidas numeric, perc_drinks numeric, perc_comidas numeric, perc_happy_hour numeric)
 LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH dados AS (
    SELECT valor::numeric as valor, categoria_mix, grupo_desc
    FROM silver.vendas_item
    WHERE bar_id = p_bar_id AND data_venda >= p_data_inicio AND data_venda <= p_data_fim
      AND tipo_transacao IN ('venda integral', 'com desconto', '100% desconto')
      AND categoria_mix IS NOT NULL
  )
  SELECT SUM(valor),
    CASE WHEN SUM(valor) > 0 THEN ROUND(SUM(CASE WHEN categoria_mix = 'BEBIDA' THEN valor ELSE 0 END) / SUM(valor) * 100, 2) ELSE 0 END,
    CASE WHEN SUM(valor) > 0 THEN ROUND(SUM(CASE WHEN categoria_mix = 'DRINK' THEN valor ELSE 0 END) / SUM(valor) * 100, 2) ELSE 0 END,
    CASE WHEN SUM(valor) > 0 THEN ROUND(SUM(CASE WHEN categoria_mix = 'COMIDA' THEN valor ELSE 0 END) / SUM(valor) * 100, 2) ELSE 0 END,
    CASE WHEN SUM(valor) > 0 THEN ROUND(SUM(CASE WHEN grupo_desc = 'Happy Hour' THEN valor ELSE 0 END) / SUM(valor) * 100, 2) ELSE 0 END
  FROM dados;
END;
$function$;

-- MORTAS — sem cron, sem chamador (funcao/frontend/edge). Removidas:
DROP FUNCTION IF EXISTS public.get_clientes_fieis_ano(integer,integer,integer);
DROP FUNCTION IF EXISTS public.get_locais_por_categoria(integer,character varying);
DROP FUNCTION IF EXISTS public.update_eventos_base_with_sympla_yuzer(integer,date,date); -- redundante: sympla/yuzer ja e feito em calculate_evento_metrics
-- Cadeia antiga de perfil-consumo (superada por etl_silver_cliente_estatisticas):
DROP FUNCTION IF EXISTS public.daily_perfil_consumo_worker() CASCADE;
DROP FUNCTION IF EXISTS public._ensure_daily_perfil_batch() CASCADE;
DROP FUNCTION IF EXISTS public._process_next_perfil_chunk() CASCADE;
DROP FUNCTION IF EXISTS public.sync_cliente_perfil_consumo(integer,integer,integer) CASCADE;

-- Restantes (5) sao de RISCO/cron e serao tratados a parte com validacao:
--   adapter_contahub_to_faturamento_pagamentos, rodar_adapters_diarios (cron adapters-diarios),
--   orcamento_planilha_roll_forward (cron), admin_upsert_api_credentials, insert_raw_data_without_trigger
