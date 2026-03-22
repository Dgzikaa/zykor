-- Function: get_google_reviews_stars_by_date
-- Exportado de produção em: 2026-03-19
-- Descrição: Retorna avaliações do Google por período (estrelas e data)
-- Usado por: recalcular-desempenho-auto

CREATE OR REPLACE FUNCTION public.get_google_reviews_stars_by_date(p_bar_id integer, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(stars integer, published_at_date timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 
    stars,
    published_at_date
  FROM google_reviews
  WHERE bar_id = p_bar_id
    AND (published_at_date AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio
    AND (published_at_date AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim;
$function$;
