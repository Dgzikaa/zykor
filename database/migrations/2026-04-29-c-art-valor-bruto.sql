-- 2026-04-29: c_art / c_prod usam valor_bruto, nao valor_liquido
--
-- Bug reportado pelo socio: percent_art_fat S17 Ord = 0%/1.2%/9.3%
-- quando real era >20%. Causa: calculate_evento_metrics somava
-- valor_liquido (= valor_pago) das categorias 'Atrações Programação' e
-- 'Produção Eventos' do ContaAzul. Lançamentos a pagar têm
-- valor_liquido=0, então o custo só aparece quando o pagamento é
-- efetivado — distorce muito o realtime.
--
-- Fix: usar valor_bruto (= total contratado, independente de pago) na
-- secao contaazul_custos do calculate_evento_metrics.
--
-- Validacao S17 Ord pos-fix:
--   24/04 (qui): pct_art_fat 0% -> 28.06% (R$ 22.880 atrações + R$ 6.529 prod)
--   25/04 (sex): 0% -> 19.48% (R$ 23.895 + R$ 1.480)
--   26/04 (sab): 0% -> 29.08% (R$ 500 + R$ 10.880)
--
-- Aplicado em prod via DO block + recalculo de todos eventos 2025+2026 +
-- ETLs gold (planejamento + desempenho semanal/mensal).

DO $$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p WHERE p.proname='calculate_evento_metrics';

  v_new := v_def;

  v_new := REPLACE(v_new,
    'IF evento_record.bar_id = 3 THEN
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN (''Atrações Programação'', ''Atrações/Eventos'') THEN valor_liquido ELSE 0 END), 0)::NUMERIC AS custo_artistico,
           COALESCE(SUM(CASE WHEN categoria_nome = ''Produção Eventos'' THEN valor_liquido ELSE 0 END), 0)::NUMERIC AS custo_producao',
    'IF evento_record.bar_id = 3 THEN
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN (''Atrações Programação'', ''Atrações/Eventos'') THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_artistico,
           COALESCE(SUM(CASE WHEN categoria_nome = ''Produção Eventos'' THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_producao'
  );

  v_new := REPLACE(v_new,
    'ELSIF evento_record.bar_id = 4 THEN
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN (''Atrações Programação'', ''Atrações/Eventos'') THEN valor_liquido ELSE 0 END), 0)::NUMERIC AS custo_artistico, 0::NUMERIC AS custo_producao',
    'ELSIF evento_record.bar_id = 4 THEN
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN (''Atrações Programação'', ''Atrações/Eventos'') THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_artistico, 0::NUMERIC AS custo_producao'
  );

  v_new := REPLACE(v_new,
    'ELSE
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN (''Atrações Programação'', ''Atrações/Eventos'') THEN valor_liquido ELSE 0 END), 0)::NUMERIC AS custo_artistico,
           COALESCE(SUM(CASE WHEN categoria_nome = ''Produção Eventos'' THEN valor_liquido ELSE 0 END), 0)::NUMERIC AS custo_producao',
    'ELSE
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN (''Atrações Programação'', ''Atrações/Eventos'') THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_artistico,
           COALESCE(SUM(CASE WHEN categoria_nome = ''Produção Eventos'' THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_producao'
  );

  IF v_new <> v_def THEN
    EXECUTE v_new;
    RAISE NOTICE 'calculate_evento_metrics: c_art/c_prod agora usam valor_bruto';
  ELSE
    RAISE NOTICE 'Ja aplicado (no-op)';
  END IF;
END $$;

-- Recalcular todos eventos 2025+2026 com a nova formula
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM operations.eventos_base WHERE bar_id IN (3,4) AND data_evento >= '2025-01-01' AND ativo=true LOOP
    BEGIN PERFORM public.calculate_evento_metrics(r.id); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
