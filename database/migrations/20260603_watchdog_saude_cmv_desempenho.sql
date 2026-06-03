-- 2026-06-03 — D1: Watchdog de saúde CMV/Desempenho (3 checks), alerta via Discord.
-- Pega os modos de falha "silenciosos" que apareceram nas correções do sócio (jun/2026):
--   1. Atração (c_art+c_prod do eventos_base) divergir do ContaAzul nas datas de evento (C1).
--   2. CMV compras_alimentacao do mês fechado anterior divergir do ContaAzul (B2).
--   3. Recálculo de eventos parado (liveness do cron recalculo-eventos-recentes).
-- Roda 16:00 UTC (13:00 BRT), depois de todos os pipelines diários (desempenho ~12:00,
-- CMV mensal ~15:30). Usa enviar_alerta_discord_sistema_dedup (dedup por dia).

CREATE OR REPLACE FUNCTION public.verificar_saude_cmv_desempenho_alerta_discord()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'operations', 'financial', 'bronze', 'silver', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_bar int;
  v_msg text := '';
  v_data text := current_date::text;
  v_eb numeric; v_ca numeric; v_diff numeric;
  v_cmv_alim numeric; v_ca_alim numeric;
  v_ult_calc timestamptz; v_calc_idade_h numeric;
  v_pm_ano int; v_pm_mes int;
  v_pm_ini date; v_pm_fim date;
BEGIN
  -- mês anterior (fechado)
  v_pm_ini := date_trunc('month', current_date - interval '1 month')::date;
  v_pm_fim := (date_trunc('month', current_date) - interval '1 day')::date;
  v_pm_ano := EXTRACT(year FROM v_pm_ini)::int;
  v_pm_mes := EXTRACT(month FROM v_pm_ini)::int;

  FOREACH v_bar IN ARRAY ARRAY[3,4] LOOP
    -- CHECK 1: Atração (eventos_base) vs ContaAzul nas datas de evento, últimos 21 dias.
    SELECT COALESCE(SUM(COALESCE(c_art,0)+COALESCE(c_prod,0)),0) INTO v_eb
    FROM operations.eventos_base
    WHERE bar_id=v_bar AND ativo=true
      AND data_evento >= current_date-21 AND data_evento <= current_date;

    SELECT COALESCE(SUM(valor_bruto),0) INTO v_ca
    FROM bronze.bronze_contaazul_lancamentos
    WHERE bar_id=v_bar AND tipo='DESPESA' AND excluido_em IS NULL
      AND categoria_nome IN ('Atrações Programação','Atrações/Eventos','Produção Eventos')
      AND data_competencia IN (
        SELECT DISTINCT data_evento FROM operations.eventos_base
        WHERE bar_id=v_bar AND ativo=true
          AND data_evento >= current_date-21 AND data_evento <= current_date
      );

    v_diff := abs(v_ca - v_eb);
    IF v_diff > 500 AND v_diff > 0.03 * GREATEST(v_ca, v_eb, 1) THEN
      v_msg := v_msg || format(
        '• **Bar %s — Atração ≠ ContaAzul** (últ. 21d): desempenho R$ %s vs ContaAzul R$ %s (dif R$ %s).' || E'\n',
        v_bar, to_char(v_eb,'FM999G999G990D00'), to_char(v_ca,'FM999G999G990D00'), to_char(v_diff,'FM999G999G990D00'));
    END IF;

    -- CHECK 2: CMV compras_alimentacao do mês fechado anterior vs ContaAzul (bruto).
    SELECT COALESCE(compras_alimentacao,0) INTO v_cmv_alim
    FROM financial.cmv_mensal
    WHERE bar_id=v_bar AND ano=v_pm_ano AND mes=v_pm_mes;

    SELECT COALESCE(SUM(valor_bruto),0) INTO v_ca_alim
    FROM bronze.bronze_contaazul_lancamentos
    WHERE bar_id=v_bar AND tipo='DESPESA' AND excluido_em IS NULL
      AND categoria_nome ILIKE '%alimenta%'
      AND data_competencia BETWEEN v_pm_ini AND v_pm_fim;

    IF abs(COALESCE(v_ca_alim,0) - COALESCE(v_cmv_alim,0)) > 200 THEN
      v_msg := v_msg || format(
        '• **Bar %s — CMV compras alim ≠ ContaAzul** (%s/%s): CMV R$ %s vs ContaAzul R$ %s — rode "Atualizar dados".' || E'\n',
        v_bar, v_pm_mes, v_pm_ano,
        to_char(COALESCE(v_cmv_alim,0),'FM999G999G990D00'), to_char(v_ca_alim,'FM999G999G990D00'));
    END IF;

    -- CHECK 3: recálculo de eventos parado (último calculado_em > 26h em eventos recentes).
    SELECT MAX(calculado_em) INTO v_ult_calc
    FROM operations.eventos_base
    WHERE bar_id=v_bar AND ativo=true
      AND data_evento >= current_date-21 AND data_evento <= current_date;

    v_calc_idade_h := EXTRACT(EPOCH FROM (now() - v_ult_calc))/3600;
    IF v_ult_calc IS NULL OR v_calc_idade_h > 26 THEN
      v_msg := v_msg || format(
        '• **Bar %s — recálculo de eventos parado**: último há %sh (cron recalculo-eventos-recentes).' || E'\n',
        v_bar, COALESCE(ROUND(v_calc_idade_h::numeric,1)::text,'∞'));
    END IF;
  END LOOP;

  IF v_msg <> '' THEN
    RETURN public.enviar_alerta_discord_sistema_dedup(
      3, 'alerta', 'saude_cmv_desempenho',
      '⚠️ Saúde CMV / Desempenho',
      'Divergências/defasagens detectadas em ' || v_data || ':' || E'\n\n' || v_msg,
      16753920,
      'saude_cmv_desempenho_' || v_data
    );
  END IF;

  RETURN 'OK_SEM_ALERTA';
END;
$function$;

-- Agendamento (idempotente): 16:00 UTC = 13:00 BRT, após os pipelines diários.
SELECT cron.schedule('watchdog-saude-cmv-desempenho', '0 16 * * *',
  $$ SELECT public.verificar_saude_cmv_desempenho_alerta_discord(); $$);
