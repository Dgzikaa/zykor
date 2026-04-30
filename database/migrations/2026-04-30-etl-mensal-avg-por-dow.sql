-- 2026-04-30: ETL mensal — ter_qua_qui, sex_sab, qui_sab_dom usar AVG por DOW
--
-- Bug reportado pelo socio: Deb Mar/2026 sex+sab = R$ 181.869,20 mostrava
-- 'impossivel'. Esperava ~R$ 45k.
--
-- Causa: ETL mensal somava TODOS os dias daquele DOW no mes
-- (4 sextas + 4 sabados = 8 dias × ~22k/dia = ~181k).
--
-- Correto: media de cada DOW + soma das medias.
--   Antes: SUM(fat) FILTER (WHERE dow IN (5,6))
--   Agora: AVG(fat) FILTER dow=5 + AVG(fat) FILTER dow=6
--
-- Resultado mais util pra comparar com semanal (que tem 1 dia de cada DOW).
--
-- Validacao Deb Mar/2026:
--   sex+sab: 181.869 -> 45.467 (= soma_sex/4 + soma_sab/4)
--   ter+qua+qui: 48.834 -> 11.804
--   qui+sab+dom: 164.463 -> 39.039 (oculto na UI Ord)

DO $$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.proname='etl_gold_desempenho_mensal' AND n.nspname='public';

  v_new := v_def;

  v_new := REPLACE(v_new,
    E'COALESCE(SUM(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento) IN (4, 6, 0)), 0) as qui_sab_dom,',
    E'(COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=4), 0) + COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=6), 0) + COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=0), 0))::numeric(14,2) as qui_sab_dom,'
  );

  v_new := REPLACE(v_new,
    E'COALESCE(SUM(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento) IN (2, 3, 4)), 0) as ter_qua_qui,',
    E'(COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=2), 0) + COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=3), 0) + COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=4), 0))::numeric(14,2) as ter_qua_qui,'
  );

  v_new := REPLACE(v_new,
    E'COALESCE(SUM(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento) IN (5, 6)), 0) as sex_sab',
    E'(COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=5), 0) + COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=6), 0))::numeric(14,2) as sex_sab'
  );

  IF v_new <> v_def THEN
    EXECUTE v_new;
    RAISE NOTICE 'etl_gold_desempenho_mensal: AVG por DOW aplicado';
  ELSE
    RAISE NOTICE 'ja esta atualizado (no-op)';
  END IF;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT b, a, m FROM (VALUES (3),(4)) AS bb(b)
    CROSS JOIN (VALUES (2025),(2026)) AS aa(a)
    CROSS JOIN generate_series(1,12) AS m
    WHERE NOT (a = 2026 AND m > EXTRACT(month FROM CURRENT_DATE)::integer)
      AND NOT (a = 2025 AND m < 3 AND b = 3)
  LOOP
    BEGIN PERFORM public.etl_gold_desempenho_mensal(r.b, r.a, r.m);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
