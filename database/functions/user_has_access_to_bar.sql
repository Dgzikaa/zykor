-- Função: user_has_access_to_bar
CREATE OR REPLACE FUNCTION public.user_has_access_to_bar(p_bar_id integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$ SELECT EXISTS (SELECT 1 FROM user_bars WHERE user_id = auth.uid() AND bar_id = p_bar_id); $$;
