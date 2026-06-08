-- 2026-06-08 — Tela de classificação de consumos: (1) acento e (2) timeout.
-- (1) classificar_consumo comparava texto unaccent() contra o pattern CRU — keywords
--     com acento ("consumação júnior") nunca casavam. Fix: unaccent dos 2 lados.
-- (2) get_consumos_*_semana chamavam classificar_consumo por LINHA (e o planner
--     reavaliava ~1600x) — O(linhas×keywords), estourava o timeout de 8s do PostgREST.
--     Fix: classificar 1x por (mesa,motivo) DISTINTO num CTE MATERIALIZED. 8,2s -> ~0,4s.
-- Aplicado em prod via MCP nesta data.

CREATE OR REPLACE FUNCTION public.classificar_consumo(p_mesa text, p_motivo text, p_bar_id integer)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
  SELECT k.categoria
  FROM financial.consumos_keywords k
  WHERE k.ativo
    AND (k.bar_id IS NULL OR k.bar_id = p_bar_id)
    AND unaccent(LOWER(p_mesa || ' ' || COALESCE(p_motivo, ''))) ~ unaccent(k.pattern)
  ORDER BY k.prioridade, k.id
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_consumos_classificados_semana(input_bar_id integer, input_data_inicio date, input_data_fim date)
 RETURNS TABLE(categoria text, total numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
  WITH periodo_com_motivo AS (
    SELECT DISTINCT ON (vd_mesadesc) vd_mesadesc AS mesa_p, vd_motivodesconto AS motivo_p
    FROM bronze.bronze_contahub_avendas_vendasperiodo
    WHERE bar_id = input_bar_id
      AND vd_dtgerencial >= input_data_inicio AND vd_dtgerencial <= input_data_fim
      AND vd_motivodesconto IS NOT NULL AND vd_motivodesconto != ''
    ORDER BY vd_mesadesc, vd_dtgerencial DESC
  ),
  linhas AS (
    SELECT ca.vd_mesadesc AS mesa, p.motivo_p AS motivo, ca.desconto
    FROM bronze.bronze_contahub_avendas_porproduto_analitico ca
    LEFT JOIN periodo_com_motivo p ON ca.vd_mesadesc = p.mesa_p
    WHERE ca.bar_id = input_bar_id
      AND ca.trn_dtgerencial >= input_data_inicio AND ca.trn_dtgerencial <= input_data_fim
      AND ca.desconto > 0
  ),
  classif AS MATERIALIZED (
    SELECT d.mesa, d.motivo, public.classificar_consumo(d.mesa, d.motivo, input_bar_id) AS cat
    FROM (SELECT DISTINCT mesa, motivo FROM linhas) d
  )
  SELECT c.cat, ROUND(SUM(l.desconto)::numeric, 2)
  FROM linhas l
  JOIN classif c ON c.mesa = l.mesa AND c.motivo IS NOT DISTINCT FROM l.motivo
  WHERE c.cat IS NOT NULL AND c.cat != '_descartado'
  GROUP BY c.cat
  ORDER BY c.cat;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_consumos_sem_categoria_semana(input_bar_id integer, input_data_inicio date, input_data_fim date)
 RETURNS TABLE(mesa text, motivo text, qtd_itens bigint, total_desconto numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
  WITH periodo_com_motivo AS (
    SELECT DISTINCT ON (vd_mesadesc) vd_mesadesc AS mesa_p, vd_motivodesconto AS motivo_p
    FROM bronze.bronze_contahub_avendas_vendasperiodo
    WHERE bar_id = input_bar_id
      AND vd_dtgerencial >= input_data_inicio AND vd_dtgerencial <= input_data_fim
      AND vd_motivodesconto IS NOT NULL AND vd_motivodesconto != ''
    ORDER BY vd_mesadesc, vd_dtgerencial DESC
  ),
  linhas AS (
    SELECT ca.vd_mesadesc AS mesa_l, p.motivo_p AS motivo_l, ca.desconto
    FROM bronze.bronze_contahub_avendas_porproduto_analitico ca
    LEFT JOIN periodo_com_motivo p ON ca.vd_mesadesc = p.mesa_p
    WHERE ca.bar_id = input_bar_id
      AND ca.trn_dtgerencial >= input_data_inicio AND ca.trn_dtgerencial <= input_data_fim
      AND ca.valorfinal = 0 AND ca.desconto > 0
  ),
  classif AS MATERIALIZED (
    SELECT d.mesa_l, d.motivo_l, public.classificar_consumo(d.mesa_l, d.motivo_l, input_bar_id) AS cat
    FROM (SELECT DISTINCT mesa_l, motivo_l FROM linhas) d
  )
  SELECT
    l.mesa_l::text,
    COALESCE(l.motivo_l, '(sem motivo)')::text,
    COUNT(*),
    ROUND(SUM(l.desconto)::numeric, 2)
  FROM linhas l
  JOIN classif c ON c.mesa_l = l.mesa_l AND c.motivo_l IS NOT DISTINCT FROM l.motivo_l
  WHERE c.cat IS NULL
  GROUP BY 1, 2
  ORDER BY 4 DESC;
END;
$function$;
