-- Função: get_user_bar_id
CREATE OR REPLACE FUNCTION public.get_user_bar_id() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT bar_id FROM public.usuarios WHERE user_id = auth.uid() AND ativo = true LIMIT 1; $$;
