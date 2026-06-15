-- 2026-06-15 — Consumação por 9 categorias padronizadas do ContaHub
--
-- Contexto: a partir de 12/06 o ContaHub padronizou o vd_motivodesconto em 9
-- categorias fixas (Funcionário Operação, Funcionário Escritório, Aniversário,
-- Programa de Pontos, Benefício Cliente, Influencer, Artistas, Sócios,
-- Relacionamento). Antes disso os motivos eram livres/sujos.
--
-- Modelo: futuro (>= corte 12/06) classifica nos 9 (ou "outros"); passado cai
-- TODO em "outros" p/ NAO zerar/defasar o historico. O total da consumacao NAO
-- muda — a tela CMV (semanal e mensal) so ganha o detalhamento. Validado:
-- soma dos 9+outros == total do modelo antigo de 5 buckets (15.050,24, sem3 24).
--
-- Helpers (ja aplicados antes):
--   public.classificar_consumo_padrao(text)  -> mapeia os 9 motivos exatos / 'outros'
--   public.consumo_padrao_cutoff()           -> DATE '2026-06-12'
--
-- RPC nova (NAO substitui get_consumos_classificados_semana, que continua
-- alimentando os 5 buckets e o total do CMV via edge cmv-semanal-auto):
CREATE OR REPLACE FUNCTION public.get_consumos_9_semana(input_bar_id integer, input_data_inicio date, input_data_fim date)
 RETURNS TABLE(categoria text, total numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE v_cut date := public.consumo_padrao_cutoff();
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
    SELECT ca.vd_mesadesc AS mesa, p.motivo_p AS motivo, ca.desconto, ca.trn_dtgerencial AS data
    FROM bronze.bronze_contahub_avendas_porproduto_analitico ca
    LEFT JOIN periodo_com_motivo p ON ca.vd_mesadesc = p.mesa_p
    WHERE ca.bar_id = input_bar_id
      AND ca.trn_dtgerencial >= input_data_inicio AND ca.trn_dtgerencial <= input_data_fim
      AND ca.desconto > 0
  ),
  classif AS MATERIALIZED (
    SELECT d.mesa, d.motivo, d.data,
      CASE WHEN d.data >= v_cut THEN public.classificar_consumo_padrao(d.motivo)
           ELSE 'outros' END AS cat
    FROM (SELECT DISTINCT mesa, motivo, data FROM linhas) d
  )
  SELECT c.cat, ROUND(SUM(l.desconto)::numeric, 2)
  FROM linhas l
  JOIN classif c ON c.mesa = l.mesa AND c.motivo IS NOT DISTINCT FROM l.motivo AND c.data = l.data
  GROUP BY c.cat
  ORDER BY c.cat;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_consumos_9_semana(integer,date,date) TO authenticated, service_role, anon;

-- Breakdown dos 9 (×fator) guardado por semana p/ a tela exibir (mensal calcula live).
ALTER TABLE financial.cmv_semanal ADD COLUMN IF NOT EXISTS consumacoes_9 jsonb;
