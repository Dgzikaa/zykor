-- 2026-04-30: Gerar financial.cmv_mensal automaticamente do banco
--
-- Bugs reportados pelo socio:
--   * Mar/2026 Deb cmv_mensal todo zerado (planilha vazia)
--   * Abr/2026 Ord+Deb sem linha (planilha sem mes)
--   * Compras jan/fev Deb muito altas (150k/145k vs ~78k/96k real)
--   * Linha fantasma mai/2026 Deb (duplicacao da fev)
--
-- Causa: financial.cmv_mensal era populado via sync-cmv-mensal a partir
-- de uma planilha mensal Google Sheets. Quando socio nao preenchia (ou
-- havia bug no sync), os dados ficavam zerados/missing/duplicados.
--
-- Fix: criar funcao agregar_cmv_mensal_auto(bar_id, ano, mes) que monta
-- o cmv_mensal direto do banco com data EXATA por dia:
--   * Compras: silver.contaazul_lancamentos_diarios (data_competencia)
--   * Comissao+Couvert: get_comissao_couvert_periodo (bronze ContaHub)
--   * Faturamento: gold.planejamento.faturamento_total_consolidado
--   * Consumos: get_consumos_classificados_semana (bronze ContaHub)
--   * Fator consumo: operations.bar_regras_negocio.cmv_fator_consumo
--   * Estoques: cmv_semanal das semanas cuja quinta-feira ISO cai no mes
--     (primeira semana do mes pra inicial, ultima pra final)
--
-- Cron diario 12:30 BRT (jobid 467) recalcula mes corrente +
-- mes anterior (primeiros 7 dias do mes).
--
-- Validacao Deb 2026:
--   Jan: 150k (planilha) -> 78,8k (auto, real)
--   Fev: 145k -> 96,8k
--   Mar: 0 (zerado) -> 72,3k (compras corretas, CMV 32,98%)
--   Abr: nao existia -> 73,8k, CMV 25,37%

CREATE OR REPLACE FUNCTION public.agregar_cmv_mensal_auto(
  p_bar_id integer, p_ano integer, p_mes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_consumo_artistas numeric := 0; v_consumo_funcionarios numeric := 0;
  v_consumo_total numeric := 0; v_fator numeric := 1;
  v_estoque_inicial numeric := 0; v_estoque_final numeric := 0;
  v_estoque_inicial_func numeric := 0; v_estoque_final_func numeric := 0;
  v_cmv_real numeric := 0; v_cmv_pct numeric := 0; v_cma_total numeric := 0;
BEGIN
  SELECT cmv_fator_consumo::numeric INTO v_fator
  FROM operations.bar_regras_negocio WHERE bar_id = p_bar_id LIMIT 1;
  v_fator := COALESCE(v_fator, 1);

  SELECT
    COALESCE(SUM(valor_bruto) FILTER (WHERE categoria_nome ILIKE '%custo comida%'), 0),
    COALESCE(SUM(valor_bruto) FILTER (WHERE categoria_nome ILIKE '%custo bebida%'), 0),
    COALESCE(SUM(valor_bruto) FILTER (WHERE categoria_nome ILIKE '%custo drink%'), 0),
    COALESCE(SUM(valor_bruto) FILTER (WHERE categoria_nome ILIKE '%custo outros%'), 0),
    COALESCE(SUM(valor_bruto) FILTER (WHERE categoria_nome ILIKE '%alimenta%'), 0)
  INTO v_compras_comida, v_compras_bebidas, v_compras_drinks, v_compras_outros, v_compras_alim
  FROM silver.contaazul_lancamentos_diarios
  WHERE bar_id = p_bar_id
    AND data_competencia BETWEEN v_data_inicio AND v_data_fim
    AND tipo = 'DESPESA';

  v_compras_total := v_compras_comida + v_compras_bebidas + v_compras_drinks + v_compras_outros;

  SELECT COALESCE(SUM(faturamento_total_consolidado), 0) INTO v_faturamento
  FROM gold.planejamento WHERE bar_id = p_bar_id AND data_evento BETWEEN v_data_inicio AND v_data_fim;

  SELECT comissao, couvert INTO v_comissao, v_couvert
  FROM public.get_comissao_couvert_periodo(p_bar_id, v_data_inicio, v_data_fim);

  v_fat_cmvivel := v_faturamento - COALESCE(v_comissao, 0) - COALESCE(v_couvert, 0);

  SELECT
    COALESCE(SUM(total) FILTER (WHERE categoria='socios'), 0) * v_fator,
    COALESCE(SUM(total) FILTER (WHERE categoria='clientes'), 0) * v_fator,
    COALESCE(SUM(total) FILTER (WHERE categoria='artistas'), 0) * v_fator,
    COALESCE(SUM(total) FILTER (WHERE categoria='funcionarios'), 0) * v_fator
  INTO v_consumo_socios, v_consumo_clientes, v_consumo_artistas, v_consumo_funcionarios
  FROM public.get_consumos_classificados_semana(p_bar_id, v_data_inicio, v_data_fim);

  v_consumo_total := v_consumo_socios + v_consumo_clientes + v_consumo_artistas + v_consumo_funcionarios;

  SELECT estoque_inicial, estoque_inicial_funcionarios
  INTO v_estoque_inicial, v_estoque_inicial_func
  FROM financial.cmv_semanal
  WHERE bar_id = p_bar_id
    AND EXTRACT(month FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_mes
    AND EXTRACT(year FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_ano
  ORDER BY ano ASC, semana ASC LIMIT 1;

  SELECT estoque_final, estoque_final_funcionarios
  INTO v_estoque_final, v_estoque_final_func
  FROM financial.cmv_semanal
  WHERE bar_id = p_bar_id
    AND EXTRACT(month FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_mes
    AND EXTRACT(year FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_ano
    AND estoque_final > 0
  ORDER BY ano DESC, semana DESC LIMIT 1;

  v_estoque_inicial := COALESCE(v_estoque_inicial, 0);
  v_estoque_final := COALESCE(v_estoque_final, 0);
  v_estoque_inicial_func := COALESCE(v_estoque_inicial_func, 0);
  v_estoque_final_func := COALESCE(v_estoque_final_func, 0);

  v_cmv_real := v_estoque_inicial + v_compras_total - v_estoque_final - v_consumo_total;
  v_cmv_pct := CASE WHEN v_fat_cmvivel > 0 THEN (v_cmv_real / v_fat_cmvivel * 100) ELSE 0 END;
  v_cma_total := v_compras_alim + v_estoque_inicial_func - v_estoque_final_func;

  INSERT INTO financial.cmv_mensal (
    bar_id, ano, mes, data_inicio, data_fim,
    estoque_inicial, estoque_final,
    compras, compras_alimentacao,
    consumo_socios, consumo_beneficios, consumo_rh_operacao, consumo_rh_escritorio, consumo_artista,
    cmv_real, faturamento_cmvivel, cmv_real_percentual, cmv_limpo_percentual,
    faturamento_total,
    estoque_inicial_funcionarios, estoque_final_funcionarios, cma_total,
    fonte, updated_at, created_at
  ) VALUES (
    p_bar_id, p_ano, p_mes, v_data_inicio, v_data_fim,
    v_estoque_inicial, v_estoque_final,
    v_compras_total, v_compras_alim,
    v_consumo_socios, v_consumo_clientes, v_consumo_funcionarios, 0, v_consumo_artistas,
    v_cmv_real, v_fat_cmvivel, v_cmv_pct, v_cmv_pct,
    v_faturamento,
    v_estoque_inicial_func, v_estoque_final_func, v_cma_total,
    'auto-agregado', NOW(), NOW()
  )
  ON CONFLICT (bar_id, ano, mes) DO UPDATE SET
    data_inicio = EXCLUDED.data_inicio, data_fim = EXCLUDED.data_fim,
    estoque_inicial = EXCLUDED.estoque_inicial, estoque_final = EXCLUDED.estoque_final,
    compras = EXCLUDED.compras, compras_alimentacao = EXCLUDED.compras_alimentacao,
    consumo_socios = EXCLUDED.consumo_socios,
    consumo_beneficios = EXCLUDED.consumo_beneficios,
    consumo_rh_operacao = EXCLUDED.consumo_rh_operacao,
    consumo_rh_escritorio = EXCLUDED.consumo_rh_escritorio,
    consumo_artista = EXCLUDED.consumo_artista,
    cmv_real = EXCLUDED.cmv_real, faturamento_cmvivel = EXCLUDED.faturamento_cmvivel,
    cmv_real_percentual = EXCLUDED.cmv_real_percentual,
    cmv_limpo_percentual = EXCLUDED.cmv_limpo_percentual,
    faturamento_total = EXCLUDED.faturamento_total,
    estoque_inicial_funcionarios = EXCLUDED.estoque_inicial_funcionarios,
    estoque_final_funcionarios = EXCLUDED.estoque_final_funcionarios,
    cma_total = EXCLUDED.cma_total, fonte = EXCLUDED.fonte, updated_at = NOW();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.agregar_cmv_mensal_auto(integer, integer, integer) TO anon, authenticated, service_role;

-- Cleanup: deletar linhas antigas zeradas/duplicadas
DELETE FROM financial.cmv_mensal WHERE bar_id=4 AND ano=2026 AND mes IN (3,5);

-- Re-rodar 2025+2026 todos meses Ord+Deb
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT b, a, m FROM (VALUES (3),(4)) AS bb(b)
    CROSS JOIN (VALUES (2025),(2026)) AS aa(a)
    CROSS JOIN generate_series(1,12) AS m
    WHERE NOT (a = 2026 AND m > EXTRACT(month FROM CURRENT_DATE)::integer)
      AND NOT (a = 2025 AND m < 3 AND b = 3)
  LOOP
    BEGIN PERFORM public.agregar_cmv_mensal_auto(r.b, r.a, r.m);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'bar=% a=% m=%: %', r.b, r.a, r.m, SQLERRM; END;
  END LOOP;
END $$;

-- Cron diário 12:30 BRT (15:30 UTC) — recalcula mes corrente, e mes anterior nos primeiros 7 dias
SELECT cron.unschedule('cmv-mensal-auto-diario') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cmv-mensal-auto-diario');

SELECT cron.schedule(
  'cmv-mensal-auto-diario',
  '30 15 * * *',
  $cron$
  DO $do$
  DECLARE r record;
  BEGIN
    FOR r IN SELECT id FROM operations.bares WHERE ativo=true ORDER BY id LOOP
      BEGIN
        PERFORM public.agregar_cmv_mensal_auto(r.id, EXTRACT(year FROM CURRENT_DATE)::integer, EXTRACT(month FROM CURRENT_DATE)::integer);
        IF EXTRACT(day FROM CURRENT_DATE) <= 7 THEN
          PERFORM public.agregar_cmv_mensal_auto(r.id,
            EXTRACT(year FROM (CURRENT_DATE - INTERVAL '1 month'))::integer,
            EXTRACT(month FROM (CURRENT_DATE - INTERVAL '1 month'))::integer);
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
  END $do$;
  $cron$
);
