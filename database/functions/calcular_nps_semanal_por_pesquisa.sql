-- Function: calcular_nps_semanal_por_pesquisa
-- Exportado de produção em: 2026-03-19
-- Descrição: Calcula NPS semanal agregado por tipo de pesquisa (FalaE)
-- Usado por: recalcular-desempenho-auto

CREATE OR REPLACE FUNCTION public.calcular_nps_semanal_por_pesquisa(p_bar_id integer, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(search_name text, total_respostas integer, promotores integer, neutros integer, detratores integer, nps_score integer, nps_media numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 
    search_name,
    SUM(respostas_total)::INTEGER as total_respostas,
    SUM(promotores)::INTEGER as promotores,
    SUM(neutros)::INTEGER as neutros,
    SUM(detratores)::INTEGER as detratores,
    CASE 
      WHEN SUM(respostas_total) > 0 THEN 
        ROUND((
          (SUM(promotores)::NUMERIC / SUM(respostas_total) * 100) -
          (SUM(detratores)::NUMERIC / SUM(respostas_total) * 100)
        ))::INTEGER
      ELSE 0
    END as nps_score,
    ROUND(AVG(nps_media)::NUMERIC, 2) as nps_media
  FROM nps_falae_diario_pesquisa
  WHERE bar_id = p_bar_id
    AND data_referencia >= p_data_inicio
    AND data_referencia <= p_data_fim
  GROUP BY search_name;
$function$;
