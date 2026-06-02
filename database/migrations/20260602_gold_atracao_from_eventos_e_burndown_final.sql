-- 20260602_gold_atracao_from_eventos_e_burndown_final.sql
--
-- 1) DIVERGENCIA atracao/fat (tabela vs modal): a celula da tabela (gold.atracoes_eventos)
--    vinha de silver.contaazul_lancamentos_diarios (agregado paralelo do CA que diverge
--    do bronze ~11k), enquanto o modal soma c_art+c_prod por evento (do bronze do CA,
--    sempre fresco). Decisao do dono: o correto e o mais atualizado do CA = o do modal.
--    FIX: gold.atracoes_eventos passa a somar c_art+c_prod do eventos_base (mesma fonte
--    do modal). eventos_base e atualizado do bronze via calculate_evento_metrics -> fresco.
--    (O escritor v2 — edge recalcular-desempenho-v2/_shared/calc-custos.ts — foi alinhado
--     na mesma fonte e redeployado, pra os 2 escritores concordarem.)
--    Apos: reprocessar todas as semanas de 2026 (etl_gold_desempenho_semanal) — feito manual.

DO $do$
DECLARE
  src text;
  old text := 'COALESCE(SUM(COALESCE(NULLIF(valor_pago,0), valor_bruto)) FILTER (WHERE categoria_nome ILIKE ''%atra%'' OR categoria_nome ILIKE ''%produ%evento%''), 0)::numeric(14,2) as atracoes_eventos';
  new text := '(SELECT COALESCE(SUM(eb.c_art + eb.c_prod),0) FROM operations.eventos_base eb WHERE eb.bar_id = p_bar_id AND eb.ativo = true AND eb.data_evento BETWEEN v_data_inicio AND v_data_fim)::numeric(14,2) as atracoes_eventos';
BEGIN
  SELECT pg_get_functiondef('public.etl_gold_desempenho_semanal(integer,integer,integer)'::regprocedure) INTO src;
  IF position(old IN src) = 0 THEN RAISE NOTICE 'anchor atracao nao encontrado (ja aplicado?)'; RETURN; END IF;
  src := replace(src, old, new);
  EXECUTE src;
END $do$;

-- 2) orcamento_planilha_roll_forward: faltava RETURN QUERY -> statement (com o INSERT)
--    era rejeitado -> roll-forward de orcamento nunca rodava. (corpo completo na migration
--    20260602_fix_orcamento_roll_forward.sql)

-- 3) Burn-down final do lint (R3): drop das ultimas 2 funcoes mortas (sem chamador).
DROP FUNCTION IF EXISTS public.admin_upsert_api_credentials(integer,character varying,character varying,character varying,character varying,character varying,text,character varying,boolean,character varying);
DROP FUNCTION IF EXISTS public.insert_raw_data_without_trigger(integer,date,text,boolean,jsonb);

-- Resultado: public.lint_db_functions() = 0 (banco sem funcao plpgsql quebrada).
