-- Função: recalcular_nps_diario_pesquisa
-- Atualizado em: 2026-04-08
-- Descrição: Recalcula NPS diário por pesquisa usando created_at (data da resposta)
-- Alteração: Usa apenas created_at para alinhar 100% com o Falae

CREATE OR REPLACE FUNCTION public.recalcular_nps_diario_pesquisa(
  p_bar_id integer,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_affected INTEGER := 0;
BEGIN
  IF p_data_inicio IS NULL THEN
    p_data_inicio := CURRENT_DATE - INTERVAL '90 days';
  END IF;
  IF p_data_fim IS NULL THEN
    p_data_fim := CURRENT_DATE;
  END IF;

  INSERT INTO nps_falae_diario_pesquisa (
    bar_id,
    data_referencia,
    search_name,
    respostas_total,
    promotores,
    neutros,
    detratores,
    nps_score,
    nps_media,
    atualizado_em
  )
  SELECT
    bar_id,
    (created_at AT TIME ZONE 'America/Sao_Paulo')::date as data_ref,
    COALESCE(search_name, 'Geral'),
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE nps >= 9)::INTEGER,
    COUNT(*) FILTER (WHERE nps >= 7 AND nps <= 8)::INTEGER,
    COUNT(*) FILTER (WHERE nps <= 6)::INTEGER,
    CASE WHEN COUNT(*) > 0 THEN
      ROUND((
        (COUNT(*) FILTER (WHERE nps >= 9)::NUMERIC / COUNT(*) * 100) -
        (COUNT(*) FILTER (WHERE nps <= 6)::NUMERIC / COUNT(*) * 100)
      ))::INTEGER
    ELSE 0 END,
    CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(nps)::NUMERIC, 2) ELSE NULL END,
    NOW()
  FROM falae_respostas
  WHERE bar_id = p_bar_id
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim
  GROUP BY bar_id, data_ref, COALESCE(search_name, 'Geral')
  ON CONFLICT (bar_id, data_referencia, search_name) DO UPDATE SET
    respostas_total = EXCLUDED.respostas_total,
    promotores = EXCLUDED.promotores,
    neutros = EXCLUDED.neutros,
    detratores = EXCLUDED.detratores,
    nps_score = EXCLUDED.nps_score,
    nps_media = EXCLUDED.nps_media,
    atualizado_em = EXCLUDED.atualizado_em;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected;
END;
$$;
