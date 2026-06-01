-- Watchdog de desempenho: de "checou se atualizou" para "checou se está CORRETO".
--
-- Contexto (2026-06-01): a semana 22 do Ord saiu com faturamento de 33k (só 2 dos
-- 7 dias) e o NPS digital ficou NULL desde a semana 20. O watchdog antigo
-- (verificar_saude_desempenho_v2_alerta_discord) só verificava se a linha existia
-- e tinha calculado_em = hoje — e nos dois casos ela tinha. Passou batido.
--
-- Nova versão reconcilia gold.desempenho contra a PRÓPRIA fonte nas últimas 2 semanas:
--   • faturamento_total  vs  SUM(gold.planejamento.faturamento_total_consolidado) na janela
--   • nps_digital        vs  existência de respostas Falaê (search_name='NPS') na janela ter-seg
-- Se divergir, RE-RODA o ETL semanal (idempotente, ON CONFLICT DO UPDATE) e:
--   • se o re-ETL resolveu  -> alerta 'aviso' (auto-corrigido), pra ficar visível que recorreu
--   • se persistiu          -> alerta 'erro'
-- Se a fonte também estiver incompleta (planejamento ainda não processado), os dois
-- concordam e NÃO há alerta — isso é problema upstream, não do agregador (evita falso+).

CREATE OR REPLACE FUNCTION public.verificar_saude_desempenho_v2_alerta_discord()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_data_ref date := current_date;
  v_data_semana_processada date := (CURRENT_DATE - INTERVAL '7 days')::date;
  v_ano int := EXTRACT(ISOYEAR FROM v_data_semana_processada)::int;
  v_semana int := EXTRACT(WEEK FROM v_data_semana_processada)::int;
  v_msg text := '';
  v_heal text := '';
  v_bar int;
  v_exists bool;
  v_updated_today bool;
  rec record;
  v_plan_fat numeric;
  v_nps_resp int;
  v_fat_diverge bool;
  v_nps_missing bool;
  v_new_fat numeric;
  v_new_nps numeric;
BEGIN
  -- ===== Check 1 (original): existência + atualização da semana processada =====
  FOR v_bar IN SELECT unnest(ARRAY[3,4]) LOOP
    SELECT EXISTS (SELECT 1 FROM gold.desempenho ds
      WHERE ds.bar_id=v_bar AND ds.ano=v_ano AND ds.numero_semana=v_semana AND ds.granularidade='semanal')
      INTO v_exists;
    IF NOT v_exists THEN
      v_msg := v_msg || format('• Bar %s: semana %s/%s não existe em gold.desempenho.\n', v_bar, v_semana, v_ano);
      CONTINUE;
    END IF;
    SELECT EXISTS (SELECT 1 FROM gold.desempenho ds
      WHERE ds.bar_id=v_bar AND ds.ano=v_ano AND ds.numero_semana=v_semana AND ds.granularidade='semanal'
        AND ds.calculado_em::date = v_data_ref)
      INTO v_updated_today;
    IF NOT v_updated_today THEN
      v_msg := v_msg || format('• Bar %s: semana %s/%s não foi atualizada hoje (%s).\n', v_bar, v_semana, v_ano, v_data_ref);
    END IF;
  END LOOP;

  -- ===== Check 2 (novo): reconciliação faturamento + NPS digital nas últimas 2 semanas =====
  FOR rec IN
    SELECT bar_id, ano, numero_semana, data_inicio, data_fim, faturamento_total, nps_digital
    FROM gold.desempenho
    WHERE granularidade='semanal' AND bar_id IN (3,4) AND data_fim >= (CURRENT_DATE - 14)
  LOOP
    SELECT COALESCE(SUM(faturamento_total_consolidado),0) FROM gold.planejamento
      WHERE bar_id=rec.bar_id AND data_evento BETWEEN rec.data_inicio AND rec.data_fim
      INTO v_plan_fat;

    SELECT COUNT(*) FROM bronze.bronze_falae_respostas
      WHERE bar_id=rec.bar_id AND search_name='NPS'
        AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN (rec.data_inicio+1) AND (rec.data_fim+1)
      INTO v_nps_resp;

    v_fat_diverge := abs(COALESCE(rec.faturamento_total,0) - v_plan_fat) > GREATEST(v_plan_fat*0.01, 1);
    v_nps_missing := (v_nps_resp > 0 AND rec.nps_digital IS NULL);

    IF v_fat_diverge OR v_nps_missing THEN
      -- auto-heal: re-roda o ETL semanal e re-valida
      PERFORM public.etl_gold_desempenho_semanal(rec.bar_id, rec.ano, rec.numero_semana);
      SELECT faturamento_total, nps_digital FROM gold.desempenho
        WHERE granularidade='semanal' AND bar_id=rec.bar_id AND ano=rec.ano AND numero_semana=rec.numero_semana
        INTO v_new_fat, v_new_nps;

      IF abs(COALESCE(v_new_fat,0) - v_plan_fat) > GREATEST(v_plan_fat*0.01,1) THEN
        v_msg := v_msg || format('• Bar %s S%s/%s: faturamento %s ≠ fonte %s mesmo após re-ETL.\n',
                   rec.bar_id, rec.numero_semana, rec.ano, round(COALESCE(v_new_fat,0)), round(v_plan_fat));
      ELSIF v_fat_diverge THEN
        v_heal := v_heal || format('• Bar %s S%s/%s: faturamento %s → %s.\n',
                   rec.bar_id, rec.numero_semana, rec.ano, round(COALESCE(rec.faturamento_total,0)), round(v_new_fat));
      END IF;

      IF (v_nps_resp > 0 AND v_new_nps IS NULL) THEN
        v_msg := v_msg || format('• Bar %s S%s/%s: nps_digital NULL com %s respostas Falaê mesmo após re-ETL.\n',
                   rec.bar_id, rec.numero_semana, rec.ano, v_nps_resp);
      ELSIF v_nps_missing THEN
        v_heal := v_heal || format('• Bar %s S%s/%s: nps_digital corrigido (%s respostas).\n',
                   rec.bar_id, rec.numero_semana, rec.ano, v_nps_resp);
      END IF;
    END IF;
  END LOOP;

  -- ===== Envio =====
  IF v_msg <> '' THEN
    PERFORM public.enviar_alerta_discord_sistema_dedup(
      3, 'erro', 'desempenho_v2',
      '🚨 Desempenho V2: inconsistência NÃO resolvida',
      format('Semana ref %s/%s:\n\n', v_semana, v_ano) || v_msg ||
      CASE WHEN v_heal <> '' THEN E'\nAuto-corrigidos no mesmo run:\n' || v_heal ELSE '' END,
      15158332, 'desempenho_v2_err_' || v_data_ref::text);
    RETURN 'ALERTA_ERRO';
  ELSIF v_heal <> '' THEN
    PERFORM public.enviar_alerta_discord_sistema_dedup(
      3, 'aviso', 'desempenho_v2',
      '⚠️ Desempenho V2: divergência auto-corrigida',
      E'Divergências entre gold.desempenho e a fonte foram detectadas e corrigidas via re-ETL:\n\n' || v_heal ||
      E'\nSe isso recorrer, investigar a ordem/atraso dos crons gold-planejamento → gold-desempenho.',
      16776960, 'desempenho_v2_heal_' || v_data_ref::text);
    RETURN 'AUTO_CORRIGIDO';
  END IF;

  RETURN 'OK_SEM_ALERTA';
END;
$function$;

-- Segunda passada à noite (19h BRT / 22h UTC) pra reconciliar backfills que chegam
-- à tarde no mesmo dia, sem esperar o run das 9h30 do dia seguinte.
SELECT cron.schedule(
  'alerta-desempenho-v2-reconcilia-noite',
  '0 22 * * *',
  'SELECT public.verificar_saude_desempenho_v2_alerta_discord();'
);
