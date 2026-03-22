-- Função: get_google_reviews_by_date
CREATE OR REPLACE FUNCTION public.get_google_reviews_by_date(p_bar_id integer, p_data_inicio date, p_data_fim date) RETURNS TABLE(reviewer_name text, stars integer, text text, published_at_date timestamp with time zone) LANGUAGE sql STABLE
AS $$ SELECT reviewer_name, stars, text, published_at_date FROM google_reviews WHERE bar_id = p_bar_id AND (published_at_date AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio AND (published_at_date AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim ORDER BY published_at_date DESC; $$;
