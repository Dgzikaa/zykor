-- 20260602_fix_orcamento_roll_forward.sql
-- BUG: faltava RETURN QUERY antes do SELECT final -> o statement (com o INSERT no CTE)
-- era rejeitado em tempo de plano -> o roll-forward de orcamento NUNCA inseriu nada.
-- FIX: RETURN QUERY. Idempotente (NOT EXISTS). cron 485 (mensal, dia 1).
CREATE OR REPLACE FUNCTION public.orcamento_planilha_roll_forward()
 RETURNS TABLE(bar_id_out integer, categoria_out text, copiados integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'meta', 'pg_catalog'
AS $function$
DECLARE
  v_data date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ano_atual integer := EXTRACT(YEAR FROM v_data)::integer;
  v_mes_atual integer := EXTRACT(MONTH FROM v_data)::integer;
  v_ano_ant integer; v_mes_ant integer;
BEGIN
  IF v_mes_atual = 1 THEN v_ano_ant := v_ano_atual - 1; v_mes_ant := 12;
  ELSE v_ano_ant := v_ano_atual; v_mes_ant := v_mes_atual - 1; END IF;

  RETURN QUERY
  WITH inseridos AS (
    INSERT INTO meta.orcamento_planilha (
      bar_id, ano, mes, categoria_nome, valor_planejado, valor_projetado,
      fonte_planejado, fonte_projetado, fonte_realizado, observacao, atualizado_em, atualizado_por
    )
    SELECT p.bar_id, v_ano_atual, v_mes_atual, p.categoria_nome, p.valor_planejado, p.valor_projetado,
      'roll-forward', 'roll-forward', 'manual',
      'Roll-forward automatico do mes anterior (' || v_mes_ant::text || '/' || v_ano_ant::text || '). Edite com a estimativa real do mes.',
      NOW(), 'cron-roll-forward'
    FROM meta.orcamento_planilha p
    WHERE p.ano = v_ano_ant AND p.mes = v_mes_ant
      AND NOT EXISTS (SELECT 1 FROM meta.orcamento_planilha q WHERE q.bar_id = p.bar_id AND q.ano = v_ano_atual AND q.mes = v_mes_atual AND q.categoria_nome = p.categoria_nome)
    RETURNING bar_id, categoria_nome
  )
  SELECT bar_id, categoria_nome, COUNT(*)::integer FROM inseridos GROUP BY bar_id, categoria_nome;
END;
$function$;
