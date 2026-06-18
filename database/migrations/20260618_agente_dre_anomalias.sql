-- 2026-06-18 — Agente de análise da DRE (anomalias por linha). FOCO: bar 3 (Ordinário).
-- public.verificar_dre_anomalias(p_modo) compara cada linha da DRE (get_dre_por_ano)
-- com a média dos 3 meses anteriores e manda 1 resumo no Discord
-- (enviar_alerta_discord_sistema_dedup, dedup por modo+dia). Modos:
--   'mensal'  -> último mês FECHADO vs média 3m: variações fora da curva
--                (salto >1.5x / queda <0.5x) + "quase zerou" + Não Mapeado.
--   'diario'/'semanal' -> MÊS CORRENTE (parcial): linhas que já passaram a média
--                do mês inteiro (estouro) + Não Mapeado. Alerta precoce.
-- Crons (BRT = UTC-3):
--   diário  09:00 -> '0 12 * * *'
--   semanal seg 09:30 -> '30 12 * * 1'
--   mensal  dia 2 10:00 -> '0 13 2 * *'

CREATE OR REPLACE FUNCTION public.verificar_dre_anomalias(p_modo text DEFAULT 'mensal')
 RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public','financial','bronze','extensions','pg_temp'
AS $function$
DECLARE
  v_bar int := 3;  -- foco 100% no Ordinário
  v_msg text := '';
  v_var text := '';
  v_nm text := '';
  v_data text := current_date::text;
  v_corrente boolean := (p_modo IN ('diario','semanal'));
  v_ref  date := CASE WHEN p_modo='mensal' THEN (date_trunc('month', current_date) - interval '1 month')::date
                      ELSE date_trunc('month', current_date)::date END;
  v_ini3 date;
  v_lbl text;
  v_titulo text;
  r record;
BEGIN
  v_ini3 := (v_ref - interval '3 months')::date;
  v_lbl  := CASE WHEN v_corrente THEN to_char(v_ref,'TMMon/YY')||' (parcial, mês corrente)'
                 ELSE to_char(v_ref,'TMMon/YY')||' (fechado)' END;
  v_titulo := CASE p_modo WHEN 'diario' THEN '🧾 DRE — Diário'
                          WHEN 'semanal' THEN '🧾 DRE — Semanal'
                          ELSE '🧾 DRE — Mensal' END;

  FOR r IN
    WITH dre AS (
      SELECT * FROM public.get_dre_por_ano(v_bar, EXTRACT(year FROM v_ref)::int)
      UNION
      SELECT * FROM public.get_dre_por_ano(v_bar, EXTRACT(year FROM v_ini3)::int)
    ),
    agg AS (
      SELECT categoria_macro, categoria,
        COALESCE(SUM(valor_com_sinal) FILTER (WHERE mes = v_ref), 0) AS atual,
        COALESCE(SUM(valor_com_sinal) FILTER (WHERE mes >= v_ini3 AND mes < v_ref), 0) / 3.0 AS media3
      FROM dre GROUP BY categoria_macro, categoria
    )
    SELECT categoria_macro, categoria, atual, media3,
      (categoria_macro = 'Não Mapeado' AND ABS(atual) > 1000) AS eh_nm,
      (v_corrente AND ABS(media3) > 2000 AND ABS(atual) > ABS(media3) AND ABS(atual-media3) > 1500) AS eh_estouro
    FROM agg
    WHERE
      CASE WHEN v_corrente
        THEN (ABS(media3) > 2000 AND ABS(atual) > ABS(media3) AND ABS(atual-media3) > 1500)
              OR (categoria_macro='Não Mapeado' AND ABS(atual) > 1000)
        ELSE (ABS(media3) > 2000 AND ABS(atual-media3) > 3000
               AND (ABS(atual) > ABS(media3)*1.5 OR ABS(atual) < ABS(media3)*0.5))
              OR (categoria_macro='Não Mapeado' AND ABS(atual) > 1000)
      END
    ORDER BY ABS(atual-media3) DESC
  LOOP
    IF r.eh_nm THEN
      IF (length(v_nm) - length(replace(v_nm, E'\n', ''))) < 6 THEN
        v_nm := v_nm || format('• **%s**: R$ %s sem bloco na DRE (cai em Outras).'||E'\n',
          r.categoria, to_char(ABS(r.atual), 'FM999G999G990'));
      END IF;
    ELSE
      IF (length(v_var) - length(replace(v_var, E'\n', ''))) < 6 THEN
        IF r.eh_estouro THEN
          v_var := v_var || format('• **%s**: R$ %s já passou a média do mês inteiro (R$ %s).'||E'\n',
            r.categoria, to_char(ABS(r.atual),'FM999G999G990'), to_char(ABS(r.media3),'FM999G999G990'));
        ELSIF ABS(r.atual) < ABS(r.media3)*0.5 THEN
          v_var := v_var || format('• **%s** quase zerou: R$ %s (média 3m R$ %s).'||E'\n',
            r.categoria, to_char(r.atual,'FM999G999G990'), to_char(r.media3,'FM999G999G990'));
        ELSE
          v_var := v_var || format('• **%s**: R$ %s (média 3m R$ %s, %s%%).'||E'\n',
            r.categoria, to_char(r.atual,'FM999G999G990'), to_char(r.media3,'FM999G999G990'),
            to_char((ABS(r.atual)/NULLIF(ABS(r.media3),0)-1)*100,'SG999G990'));
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF v_var <> '' THEN v_msg := v_msg || (CASE WHEN v_corrente THEN '_Estouros do mês corrente:_' ELSE '_Variações fora da curva:_' END)||E'\n'||v_var; END IF;
  IF v_nm  <> '' THEN v_msg := v_msg || '_Sem classificação na DRE:_'||E'\n'||v_nm; END IF;

  IF v_msg <> '' THEN
    v_msg := 'Ordinário · ref '||v_lbl||' (vs média dos 3 meses anteriores).'||E'\n'||v_msg;
    RETURN public.enviar_alerta_discord_sistema_dedup(
      v_bar, 'alerta', 'dre_anomalias',
      v_titulo||' — '||v_data, v_msg, 3447003, 'dre_anom_'||p_modo||'_'||v_data
    );
  END IF;
  RETURN 'OK_SEM_ALERTA';
END;
$function$;

-- Agendamento (já aplicado em prod):
-- SELECT cron.schedule('agente-dre-diario',  '0 12 * * *',  $$ SELECT public.verificar_dre_anomalias('diario'); $$);
-- SELECT cron.schedule('agente-dre-semanal', '30 12 * * 1', $$ SELECT public.verificar_dre_anomalias('semanal'); $$);
-- SELECT cron.schedule('agente-dre-mensal',  '0 13 2 * *',  $$ SELECT public.verificar_dre_anomalias('mensal'); $$);
