-- Função: user_has_access_to_empresa
CREATE OR REPLACE FUNCTION public.user_has_access_to_empresa(p_empresa_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$ SELECT EXISTS (SELECT 1 FROM empresa_usuarios WHERE usuario_id = auth.uid() AND empresa_id = p_empresa_id AND ativo = true); $$;
