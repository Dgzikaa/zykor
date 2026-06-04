-- 20260604: c_art / c_prod = COALESCE(NULLIF(valor_pago,0), valor_bruto)
--
-- Pedido do socio: Atracao+Producao do Desempenho Semanal Ord nao batia "na virgula"
-- com o ContaAzul (Sem19 dif R$9,00; Sem20 dif R$43,61).
-- Causa: calculate_evento_metrics somava valor_bruto (valor contratado), enquanto o
-- ContaAzul exibe valor_pago (efetivamente pago, com juros/arredondamento).
--   Sem19: "Pagode Vira-Lata Banda Benzadeus" bruto 19423,03 -> pago 19432,03 (+9,00 juros)
--   Sem20: "Roadie Paulo Victor" bruto 3056,39 -> pago 3100,00 (+43,61 arredondamento)
-- Fix: COALESCE(NULLIF(valor_pago,0), valor_bruto)
--   - lancamento PAGO -> valor_pago (bate com CA na virgula em semanas fechadas)
--   - lancamento A PAGAR (valor_pago=0) -> valor_bruto (preserva realtime; era o motivo
--     da migration 2026-04-29-c-art-valor-bruto que tirou valor_liquido cru).
-- Escopo do replace: apenas as expressoes "... AS custo_artistico/custo_producao" da
-- secao bronze_contaazul_lancamentos. NAO toca a linha de Conta Assinada (faturamento_pagamentos)
-- que tambem usa "THEN valor_bruto ELSE 0 END".
--
-- Pos-aplicacao (feito em prod via MCP):
--   1) redefinicao da funcao (5 ancoras: bar3 art+prod, bar4 art, ELSE art+prod)
--   2) recalculo de todos eventos 2026 (bares 3,4)
--   3) re-run etl_gold_desempenho_semanal p/ todas as semanas 2026 (bares 3,4)
-- Validacao Ord 2026: Sem19 65974,59 e Sem20 81306,80 (== ContaAzul).

DO $do$
DECLARE
  v_def text;
  v_new text;
  v_old_art text := 'THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_artistico';
  v_new_art text := 'THEN COALESCE(NULLIF(valor_pago,0), valor_bruto) ELSE 0 END), 0)::NUMERIC AS custo_artistico';
  v_old_prod text := 'THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_producao';
  v_new_prod text := 'THEN COALESCE(NULLIF(valor_pago,0), valor_bruto) ELSE 0 END), 0)::NUMERIC AS custo_producao';
  n_art int; n_prod int;
BEGIN
  SELECT pg_get_functiondef('public.calculate_evento_metrics(integer)'::regprocedure) INTO v_def;

  n_art  := (length(v_def) - length(replace(v_def, v_old_art,  ''))) / length(v_old_art);
  n_prod := (length(v_def) - length(replace(v_def, v_old_prod, ''))) / length(v_old_prod);

  IF n_art = 0 AND n_prod = 0 THEN
    RAISE NOTICE 'Ancoras nao encontradas (ja aplicado?). Nenhuma alteracao.';
    RETURN;
  END IF;

  v_new := replace(v_def, v_old_art,  v_new_art);
  v_new := replace(v_new, v_old_prod, v_new_prod);

  EXECUTE v_new;
  RAISE NOTICE 'calculate_evento_metrics atualizado: % custo_artistico, % custo_producao -> COALESCE(NULLIF(valor_pago,0), valor_bruto)', n_art, n_prod;
END $do$;

-- Recalcular eventos 2026 (bares 3,4)
DO $rc$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM operations.eventos_base
           WHERE bar_id IN (3,4) AND data_evento >= '2026-01-01' AND ativo = true LOOP
    BEGIN PERFORM public.calculate_evento_metrics(r.id); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $rc$;

-- Re-run ETL gold desempenho semanal (bares 3,4, todas as semanas 2026 com eventos)
DO $etl$ DECLARE r record; BEGIN
  FOR r IN SELECT DISTINCT bar_id,
                  extract(isoyear from data_evento)::int AS ano,
                  extract(week    from data_evento)::int AS semana
           FROM operations.eventos_base
           WHERE bar_id IN (3,4) AND data_evento >= '2026-01-01' AND ativo = true LOOP
    BEGIN PERFORM public.etl_gold_desempenho_semanal(r.bar_id, r.ano, r.semana); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $etl$;
