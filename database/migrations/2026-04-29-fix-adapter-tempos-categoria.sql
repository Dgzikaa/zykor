-- 2026-04-29: Fix categorização silver.tempos_producao usando grupo_desc.
--
-- Bug: adapter_contahub_to_tempos_producao usava CASE hardcoded de loc_desc
-- com lista feita pro Ord (Bar, Montados, Shot e Dose, Cozinha 1/2 etc).
-- Pro Deb (loc_desc = 'Salao', 'Bar', 'Cozinha', 'Combos') o ELSE caía em
-- 'outros'. Resultado: silver tinha 4.355 cervejas + 2.828 não-alcóolicas
-- + 2.070 happy hour Bar + 2.038 drinks clássicos do Deb classificados como
-- 'outros' OU 'bebida' indistintamente. Drinks Autorais/Clássicos/Mocktails/
-- Festival viravam 'bebida' (não 'drink').
--
-- Cascata: gold.desempenho.tempo_drinks = NULL pro Deb (categoria='drink' = 0
-- itens), atrasao_drinks=0, qtd_drinks_total=0, qtd_comida_total=15 (porque
-- só Cozinha clássica era classificada).
--
-- Fix: prioriza grupo_desc (mais granular) com fallback pro loc_desc. Cobre
-- 99%+ dos itens dos 2 bares. "outros" só pra Tabacaria/casos null.
--
-- Pós-deploy: rodar adapter_contahub_to_tempos_producao para todos os dias
-- afetados pra reclassificar silver.tempos_producao.

CREATE OR REPLACE FUNCTION public.adapter_contahub_to_tempos_producao(p_bar_id integer, p_data date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'operations', 'public'
AS $function$
DECLARE v_inserted INTEGER;
BEGIN
  DELETE FROM operations.tempos_producao
  WHERE bar_id = p_bar_id AND data_producao = p_data AND origem = 'contahub';

  INSERT INTO operations.tempos_producao (
    bar_id, data_producao, produto_codigo, produto_desc, grupo_desc,
    local_desc, categoria, t0_lancamento, t1_prodini, t2_prodfim, t3_entrega,
    t0_t1, t0_t2, t0_t3, t1_t2, t2_t3, quantidade, origem, origem_ref
  )
  SELECT
    bar_id, data, prd, prd_desc, grp_desc, loc_desc,
    CASE
      -- 1. Tabacaria/cigarros (qualquer local) → outros (sem tempo de prod)
      WHEN grp_desc ILIKE '%tabacaria%' THEN 'outros'

      -- 2. Cozinha: cozinha sempre é comida (loc física dominante)
      WHEN loc_desc ILIKE 'Cozinha%' THEN 'comida'

      -- 3. Drinks por grupo_desc (mais granular que loc)
      WHEN grp_desc ILIKE '%drink%'
        OR grp_desc ILIKE '%moscow mule%'
        OR grp_desc ILIKE '%festival de caipi%'
        OR grp_desc ILIKE '%shots%'
        OR grp_desc IN ('Doses','Dose Dupla')
      THEN 'drink'

      -- 4. Comidas por grupo_desc
      WHEN grp_desc ILIKE '%petisco%'
        OR grp_desc ILIKE '%pastel%'
        OR grp_desc ILIKE '%chapa%'
        OR grp_desc ILIKE '%sandub%'
        OR grp_desc ILIKE '%sanduíche%'
        OR grp_desc ILIKE '%sanduiche%'
        OR grp_desc ILIKE '%prato%'
        OR grp_desc ILIKE '%sobremesa%'
        OR grp_desc ILIKE '%feijoada%'
      THEN 'comida'

      -- 5. Bebidas por grupo_desc
      WHEN grp_desc ILIKE '%cerveja%'
        OR grp_desc ILIKE '%chopp%'
        OR grp_desc ILIKE '%bebida%'
        OR grp_desc ILIKE '%vinho%'
        OR grp_desc ILIKE '%garrafa%'
        OR grp_desc ILIKE '%combo%'
        OR grp_desc ILIKE '%balde%'
      THEN 'bebida'

      -- 6. Happy Hour em loc='Bar' (Deb): caipirinhas/spritz/moscow → drink.
      --    No Ord, drinks de HH vão pra Montados/Batidos/etc, então loc=Bar
      --    do Ord não tem HH (cervejas vão pra Chopp/Pegue e Pague).
      WHEN loc_desc='Bar' AND grp_desc ILIKE '%happy hour%' THEN 'drink'

      -- 7. Estações de drink (Ord)
      WHEN loc_desc IN ('Montados','Shot e Dose','Batidos','Mexido','Preshh') THEN 'drink'

      -- 8. Happy Hour em locais residuais (Salao, Combos, Pegue, Chopp) = bebida
      WHEN grp_desc ILIKE '%happy hour%' THEN 'bebida'

      -- 9. Fallback por loc_desc
      WHEN loc_desc IN ('Bar','Salao','Pegue e Pague','Chopp','Baldes','Combos','Venda Volante') THEN 'bebida'

      ELSE 'outros'
    END,
    t0_lancamento, t1_prodini, t2_prodfim, t3_entrega,
    COALESCE(t0_t1, 0), COALESCE(t0_t2, 0), COALESCE(t0_t3, 0),
    COALESCE(t1_t2, 0), COALESCE(t2_t3, 0), COALESCE(itm_qtd, 1),
    'contahub', id
  FROM bronze.bronze_contahub_produtos_temposproducao
  WHERE bar_id = p_bar_id AND data = p_data;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$function$;
