-- 2026-04-30: ETL planejamento — usar eventos_base pra res_tot/res_p/num_mesas
--
-- Bug reportado pelo socio: /estrategico/planejamento-comercial Ord 01/04
-- mostrava 'Reservas Total = 542' mas Getin so tem 197 sentados.
--
-- Causa: etl_gold_planejamento_full populava res_tot com
-- COUNT(DISTINCT cv.vd) de silver.cliente_visitas — isso eh
-- "vendas/mesas abertas no bar", nao "reservas Getin". 542 vendas
-- unicas eh o numero de mesas atendidas no dia, nao reservas.
--
-- Fonte correta: operations.eventos_base (populado pelo
-- calculate_evento_metrics, que ja le bronze.bronze_getin_reservations
-- direto). 01/04 Ord eventos_base.res_tot=197, res_p=197 (10 mesas).
--
-- Fix em 6 patches REPLACE no DO block (idempotente):
--   1. fase_eb le 4 cols novas: res_tot, res_p, num_mesas_tot, num_mesas_presentes
--   2. Coluna res_p (era m.res_p, meta) -> COALESCE(eb_res_p, m.res_p, 0)
--   3. Coluna res_tot (era c.res, vendas) -> COALESCE(eb_res_tot, 0)
--   4. INSERT cols incluem num_mesas_tot/num_mesas_presentes (antes ficavam null)
--   5. SELECT VALUES bind eb_num_mesas_tot/presentes
--   6. ON CONFLICT atualiza essas 2 colunas tambem
--
-- Validacao Ord 01-04/04:
--   01/04: 542/197 -> 197/197, mesas null/null -> 10/10
--   02/04: ?/? -> 274/211, mesas -> 21/14
--   04/04: ?/? -> 362/276, mesas -> 24/17
--
-- Re-roda Ord+Deb pros ultimos 60 dias automaticamente.

DO $$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.proname='etl_gold_planejamento_full' AND n.nspname='public';

  v_new := v_def;

  v_new := REPLACE(v_new,
    E'      eb.cl_real AS eb_cl_real,\n      eb.real_r AS eb_real_r,',
    E'      eb.cl_real AS eb_cl_real,\n      eb.real_r AS eb_real_r,\n      COALESCE(eb.res_tot, 0)::integer AS eb_res_tot,\n      COALESCE(eb.res_p, 0)::integer AS eb_res_p,\n      COALESCE(eb.num_mesas_tot, 0)::integer AS eb_num_mesas_tot,\n      COALESCE(eb.num_mesas_presentes, 0)::integer AS eb_num_mesas_presentes,'
  );

  v_new := REPLACE(v_new,
    E'    m.m1_r, m.cl_plan, m.res_p, m.lot_max, m.te_plan, m.tb_plan, m.c_artistico_plan,',
    E'    m.m1_r, m.cl_plan, COALESCE(eb.eb_res_p, m.res_p, 0), m.lot_max, m.te_plan, m.tb_plan, m.c_artistico_plan,'
  );

  v_new := REPLACE(v_new,
    E'    COALESCE(c.res,0), v.pub,',
    E'    COALESCE(eb.eb_res_tot, 0), v.pub,'
  );

  v_new := REPLACE(v_new,
    E'    res_tot, publico_real,\n    descontos, conta_assinada,',
    E'    res_tot, publico_real,\n    num_mesas_tot, num_mesas_presentes,\n    descontos, conta_assinada,'
  );

  v_new := REPLACE(v_new,
    E'    COALESCE(eb.eb_res_tot, 0), v.pub,\n    v.desc, v.assn,',
    E'    COALESCE(eb.eb_res_tot, 0), v.pub,\n    eb.eb_num_mesas_tot, eb.eb_num_mesas_presentes,\n    v.desc, v.assn,'
  );

  v_new := REPLACE(v_new,
    E'    publico_real=EXCLUDED.publico_real,\n    descontos=EXCLUDED.descontos,',
    E'    publico_real=EXCLUDED.publico_real,\n    num_mesas_tot=EXCLUDED.num_mesas_tot,\n    num_mesas_presentes=EXCLUDED.num_mesas_presentes,\n    descontos=EXCLUDED.descontos,'
  );

  IF v_new <> v_def THEN
    EXECUTE v_new;
    RAISE NOTICE 'etl_gold_planejamento_full atualizado: usa eventos_base (Getin)';
  ELSE
    RAISE NOTICE 'ja esta atualizado (no-op)';
  END IF;
END $$;

-- Re-rodar Ord+Deb 60 dias
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM operations.bares WHERE ativo=true ORDER BY id LOOP
    BEGIN PERFORM public.etl_gold_planejamento_full(r.id, (CURRENT_DATE - INTERVAL '60 days')::date, CURRENT_DATE);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'bar=%: %', r.id, SQLERRM; END;
  END LOOP;
END $$;
