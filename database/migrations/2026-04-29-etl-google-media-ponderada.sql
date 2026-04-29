-- 2026-04-29: ETL semanal+mensal — media Google ponderada por reviews
--
-- Bug reportado pelo socio: media Google na tabela /estrategico/desempenho
-- diferia do modal de detalhes:
--   Mar/2026 Ord: tabela 4,90 vs modal 4,92
--   Jan/2026 Ord: tabela 4,77 vs modal 4,83
--
-- Causa: ETL usava AVG(stars_medio) FILTER (WHERE total_reviews > 0).
-- Modal usa SUM(stars_medio * total_reviews) / SUM(total_reviews).
-- Para reviews, a media correta eh ponderada — um dia com 50 reviews
-- pesa mais que um dia com 5.
--
-- Fix: alinhar ETL semanal e mensal pra usar a media ponderada (= modal).
--
-- Validacao: Mar/2026 4,90 -> 4,92, Jan/2026 4,77 -> 4,83 (bate modal).

DO $$
DECLARE v_def text; v_new text; v_func text;
BEGIN
  FOREACH v_func IN ARRAY ARRAY['etl_gold_desempenho_semanal','etl_gold_desempenho_mensal']
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.proname=v_func AND n.nspname='public';

    v_new := REPLACE(v_def,
      E'AVG(stars_medio) FILTER (WHERE total_reviews > 0)::numeric(4,2) as media_avaliacoes_google',
      E'(SUM(stars_medio * total_reviews)::numeric / NULLIF(SUM(total_reviews), 0))::numeric(4,2) as media_avaliacoes_google'
    );

    IF v_new <> v_def THEN
      EXECUTE v_new;
      RAISE NOTICE '% atualizado: media google ponderada', v_func;
    ELSE
      RAISE NOTICE '% ja esta atualizado (no-op)', v_func;
    END IF;
  END LOOP;
END $$;

-- Re-rodar todos os meses 2025+2026
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT b, a, m FROM (VALUES (3),(4)) AS bb(b)
    CROSS JOIN (VALUES (2025),(2026)) AS aa(a)
    CROSS JOIN generate_series(1,12) AS m
    WHERE NOT (a = 2026 AND m > EXTRACT(month FROM CURRENT_DATE))
  LOOP
    BEGIN PERFORM public.etl_gold_desempenho_mensal(r.b, r.a, r.m);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- Re-rodar semanal ultimos 60 dias
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT b.id as bar_id, EXTRACT(isoyear FROM d.dia)::integer as ano, EXTRACT(week FROM d.dia)::integer as semana
    FROM operations.bares b CROSS JOIN generate_series(CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE, '1 day') d(dia)
    WHERE b.ativo=true
  LOOP
    BEGIN PERFORM public.etl_gold_desempenho_semanal(r.bar_id, r.ano, r.semana);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
