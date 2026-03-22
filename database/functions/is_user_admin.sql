-- Função: is_user_admin
CREATE OR REPLACE FUNCTION public.is_user_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.usuarios WHERE user_id = auth.uid() AND role = 'admin' AND ativo = true); $$;
