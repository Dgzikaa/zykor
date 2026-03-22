-- Função: get_iso_weeks_in_year
CREATE OR REPLACE FUNCTION public.get_iso_weeks_in_year(p_ano integer) RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE jan1_weekday INTEGER; is_leap BOOLEAN;
BEGIN jan1_weekday := EXTRACT(DOW FROM make_date(p_ano, 1, 1))::INTEGER; is_leap := (p_ano % 4 = 0 AND p_ano % 100 != 0) OR (p_ano % 400 = 0);
IF jan1_weekday = 4 OR (is_leap AND jan1_weekday = 3) THEN RETURN 53; ELSE RETURN 52; END IF; END;
$$;
