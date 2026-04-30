-- 2026-04-30: RPC consolidada pro Health Check
--
-- Tela /configuracoes/monitoramento → tab "Pipeline" consome essa RPC.
-- Retorna em uma chamada:
--   * Por bar: última atualização de gold.desempenho (semanal+mensal),
--     gold.planejamento, gold.cmv, financial.cmv_semanal, financial.cmv_mensal
--   * Stockout: gap bronze vs silver últimos 7 dias por bar
--   * Alertas: pendentes 24h, disparados hoje, erros/avisos abertos

CREATE OR REPLACE FUNCTION public.get_health_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  WITH bares AS (
    SELECT id, nome FROM operations.bares WHERE ativo=true ORDER BY id
  ),
  stockout_dia AS (
    SELECT bar_id, data_consulta, 'bronze'::text as origem
    FROM bronze.bronze_contahub_operacional_stockout_raw
    WHERE data_consulta >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY bar_id, data_consulta
    UNION ALL
    SELECT bar_id, data_consulta, 'silver'::text
    FROM silver.silver_contahub_operacional_stockout_processado
    WHERE data_consulta >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY bar_id, data_consulta
  ),
  stockout_gap AS (
    SELECT
      b.id as bar_id,
      COUNT(*) FILTER (WHERE sd.origem='bronze') as bronze_dias,
      COUNT(*) FILTER (WHERE sd.origem='silver') as silver_dias,
      ARRAY(
        SELECT data_consulta FROM stockout_dia sd2
        WHERE sd2.bar_id=b.id AND sd2.origem='bronze'
        EXCEPT
        SELECT data_consulta FROM stockout_dia sd3
        WHERE sd3.bar_id=b.id AND sd3.origem='silver'
        ORDER BY 1
      ) as gap_datas
    FROM bares b
    LEFT JOIN stockout_dia sd ON sd.bar_id=b.id
    GROUP BY b.id
  ),
  gold_status AS (
    SELECT
      b.id as bar_id, b.nome as bar_nome,
      (SELECT MAX(calculado_em) FROM gold.desempenho WHERE bar_id=b.id AND granularidade='semanal') as desempenho_semanal_calc,
      (SELECT MAX(calculado_em) FROM gold.desempenho WHERE bar_id=b.id AND granularidade='mensal') as desempenho_mensal_calc,
      (SELECT MAX(calculado_em) FROM gold.planejamento WHERE bar_id=b.id) as planejamento_calc,
      (SELECT MAX(calculado_em) FROM gold.cmv WHERE bar_id=b.id) as cmv_calc,
      (SELECT MAX(updated_at) FROM financial.cmv_semanal WHERE bar_id=b.id) as cmv_semanal_upd,
      (SELECT MAX(updated_at) FROM financial.cmv_mensal WHERE bar_id=b.id) as cmv_mensal_upd,
      (SELECT MAX(data_evento) FROM gold.planejamento WHERE bar_id=b.id) as planejamento_ultima_data,
      (SELECT MAX(data_inicio) FROM gold.desempenho WHERE bar_id=b.id AND granularidade='semanal') as desempenho_ultima_semana
    FROM bares b
  ),
  alertas_resumo AS (
    SELECT
      COUNT(*) FILTER (WHERE NOT resolvido AND criado_em >= NOW() - INTERVAL '24 hours') as pendentes_24h,
      COUNT(*) FILTER (WHERE criado_em >= CURRENT_DATE) as disparados_hoje,
      COUNT(*) FILTER (WHERE tipo='erro' AND NOT resolvido) as erros_abertos,
      COUNT(*) FILTER (WHERE tipo='aviso' AND NOT resolvido) as avisos_abertos
    FROM system.alertas_enviados
    WHERE criado_em >= CURRENT_DATE - INTERVAL '7 days'
  )
  SELECT jsonb_build_object(
    'gold_status', (SELECT jsonb_agg(to_jsonb(g)) FROM gold_status g),
    'stockout_gap', (SELECT jsonb_agg(to_jsonb(s)) FROM stockout_gap s),
    'alertas', (SELECT to_jsonb(a) FROM alertas_resumo a),
    'gerado_em', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_health_dashboard() TO anon, authenticated, service_role;
