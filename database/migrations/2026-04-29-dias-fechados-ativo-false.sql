-- 2026-04-29: Marcar ativo=false dias fechados + fix etl_gold_planejamento_full
--
-- Bug reportado: percent_art_fat distorcido em algumas semanas (S1/2026,
-- S14/2025 = 652%, S20/2025 = 793%) porque dias com real_r=0 cl_real=0
-- entravam no cálculo. Casos:
--   Ord: 30 dias seguidos jan/2025 (pré-operação) + ~10 dias avulsos
--   Deb: ~5 feriados + virada de ano
--
-- Fix em 2 partes:
--   1. UPDATE em massa: marcar ativo=false dias passados com
--      real_r=0 AND cl_real=0 (definitivamente fechados).
--   2. Fix etl_gold_planejamento_full: COALESCE(m.ativo, true) ->
--      COALESCE(m.ativo, false). Antes, dias sem evento_base correspondente
--      apareciam ativos por default (errado). Agora, ausência de
--      evento_base = não ativo.
--
-- Validação S1/2026 Ord (29/12-04/01) pos-fix:
--   29/12: R$ 26.749 ativo=true ✓
--   30/12: R$ 64.665 ativo=true ✓
--   31/12: R$ 0 ativo=false (era true por default) ✓
--   01/01: R$ 0 ativo=false ✓
--   02-03/01: ativos ✓
--   04/01: ativo=false ✓

-- 1. Marcar como ativo=false dias inegavelmente fechados
UPDATE operations.eventos_base
SET ativo=false, atualizado_em=NOW()
WHERE bar_id IN (3,4) AND ativo=true
  AND real_r::numeric=0 AND cl_real=0
  AND data_evento <= CURRENT_DATE - 1;

-- 2. Fix etl_gold_planejamento_full: COALESCE ativo default false
DO $$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p WHERE p.proname='etl_gold_planejamento_full';

  v_new := REPLACE(v_def, 'COALESCE(m.ativo, true)', 'COALESCE(m.ativo, false)');

  IF v_new <> v_def THEN
    EXECUTE v_new;
    RAISE NOTICE 'etl_gold_planejamento_full atualizado';
  ELSE
    RAISE NOTICE 'Ja aplicado (no-op)';
  END IF;
END $$;

-- 3. Recalcular ETLs gold mes a mes
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT b, a, m FROM (VALUES (3),(4)) bb(b) CROSS JOIN (VALUES (2025),(2026)) aa(a) CROSS JOIN generate_series(1,12) m WHERE NOT (a=2026 AND m>4) LOOP
    BEGIN PERFORM public.etl_gold_planejamento_full(r.b, make_date(r.a,r.m,1), (make_date(r.a,r.m,1) + INTERVAL '1 month - 1 day')::date); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  FOR r IN SELECT b, a, s FROM (VALUES (3),(4)) bb(b) CROSS JOIN (VALUES (2025),(2026)) aa(a) CROSS JOIN generate_series(1,52) s WHERE NOT (a=2026 AND s>18) LOOP
    BEGIN PERFORM public.etl_gold_desempenho_semanal(r.b, r.a, r.s); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  FOR r IN SELECT b, a, m FROM (VALUES (3),(4)) bb(b) CROSS JOIN (VALUES (2025),(2026)) aa(a) CROSS JOIN generate_series(1,12) m WHERE NOT (a=2026 AND m>4) LOOP
    BEGIN PERFORM public.etl_gold_desempenho_mensal(r.b, r.a, r.m); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
