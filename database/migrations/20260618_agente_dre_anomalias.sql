-- 2026-06-18 — Agente de análise da DRE (anomalias por linha).
-- public.verificar_dre_anomalias(): por bar (3 e 4), pega o ÚLTIMO MÊS FECHADO e
-- compara cada linha da DRE (get_dre_por_ano) com a média dos 3 meses anteriores.
-- Sinaliza:
--   • Variações fora da curva (|atual| vs média 3m: salto >1.5x ou queda <0.5x,
--     com piso de R$ relevante) — inclui "quase zerou" (linha que sumiu).
--   • Categorias "Não Mapeado" com valor no mês = dinheiro sem bloco na DRE
--     (categoria nova no CA que precisa entrar no de-para dre_categoria_macro).
-- Manda 1 resumo via enviar_alerta_discord_sistema_dedup (dedup por dia), mesmo
-- molde do verificar_alertas_negocio.
--
-- Agendar (mensal, dia 2 às 09:00 BRT, analisa o mês recém-fechado):
--   SELECT cron.schedule('agente-dre-anomalias-mensal','0 12 2 * *',
--     $$ SELECT public.verificar_dre_anomalias(); $$);
-- Rodar sob demanda: SELECT public.verificar_dre_anomalias();

CREATE OR REPLACE FUNCTION public.verificar_dre_anomalias()
 RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public','financial','bronze','extensions','pg_temp'
AS $function$
DECLARE
  v_bar int;
  v_msg text := '';
  v_bloco text;
  v_var text;
  v_nm text;
  v_data text := current_date::text;
  v_ref  date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_ini3 date := (date_trunc('month', current_date) - interval '4 months')::date;
  v_ref_lbl text := to_char((date_trunc('month', current_date) - interval '1 month')::date, 'TMMon/YY');
  r record;
BEGIN
  FOREACH v_bar IN ARRAY ARRAY[3,4] LOOP
    v_var := ''; v_nm := '';
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
        (categoria_macro = 'Não Mapeado' AND ABS(atual) > 1000) AS eh_nao_mapeado
      FROM agg
      WHERE (ABS(media3) > 2000 AND ABS(atual-media3) > 3000
              AND (ABS(atual) > ABS(media3)*1.5 OR ABS(atual) < ABS(media3)*0.5))
         OR (categoria_macro = 'Não Mapeado' AND ABS(atual) > 1000)
      ORDER BY ABS(atual-media3) DESC
    LOOP
      IF r.eh_nao_mapeado THEN
        IF (length(v_nm) - length(replace(v_nm, E'\n', ''))) < 6 THEN
          v_nm := v_nm || format('• **%s**: R$ %s/mês sem bloco na DRE (cai em Outras).'||E'\n',
            r.categoria, to_char(ABS(r.atual), 'FM999G999G990'));
        END IF;
      ELSE
        IF (length(v_var) - length(replace(v_var, E'\n', ''))) < 6 THEN
          IF ABS(r.atual) < ABS(r.media3)*0.5 THEN
            v_var := v_var || format('• **%s** quase zerou: R$ %s (média 3m R$ %s).'||E'\n',
              r.categoria, to_char(r.atual, 'FM999G999G990'), to_char(r.media3, 'FM999G999G990'));
          ELSE
            v_var := v_var || format('• **%s**: R$ %s (média 3m R$ %s, %s%%).'||E'\n',
              r.categoria, to_char(r.atual, 'FM999G999G990'), to_char(r.media3, 'FM999G999G990'),
              to_char((ABS(r.atual)/NULLIF(ABS(r.media3),0)-1)*100, 'SG999G990'));
          END IF;
        END IF;
      END IF;
    END LOOP;

    v_bloco := '';
    IF v_var <> '' THEN v_bloco := v_bloco || '_Variações fora da curva:_'||E'\n'||v_var; END IF;
    IF v_nm  <> '' THEN v_bloco := v_bloco || '_Sem classificação na DRE:_'||E'\n'||v_nm; END IF;
    IF v_bloco <> '' THEN
      v_msg := v_msg || E'\n__**Bar '||v_bar||'**__'||E'\n'||v_bloco;
    END IF;
  END LOOP;

  IF v_msg <> '' THEN
    v_msg := 'Referência: '||v_ref_lbl||' (vs média dos 3 meses anteriores).'||E'\n'||v_msg;
    RETURN public.enviar_alerta_discord_sistema_dedup(
      3, 'alerta', 'dre_anomalias',
      '🧾 Análise da DRE — '||v_data,
      v_msg, 3447003, 'dre_anomalias_'||v_data
    );
  END IF;
  RETURN 'OK_SEM_ALERTA';
END;
$function$;
