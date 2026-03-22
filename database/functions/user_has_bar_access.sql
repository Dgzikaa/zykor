-- Função: user_has_bar_access
CREATE OR REPLACE FUNCTION public.user_has_bar_access(check_bar_id integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.user_id = auth.uid() AND u.bar_id = check_bar_id AND u.ativo = true); $$;
