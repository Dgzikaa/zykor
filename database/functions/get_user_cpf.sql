-- Função: get_user_cpf
CREATE OR REPLACE FUNCTION public.get_user_cpf() RETURNS character varying LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT cpf FROM public.usuarios WHERE user_id = auth.uid() AND ativo = true LIMIT 1; $$;
