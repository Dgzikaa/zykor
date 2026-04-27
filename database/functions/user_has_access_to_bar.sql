-- Função: user_has_access_to_bar
-- DEPRECATED 2026-04-26 (#42 Fase 1): alias delega para public.user_has_bar_access.
-- Não usar em código novo. Plano de remoção em #42 Fases 2-3.
CREATE OR REPLACE FUNCTION public.user_has_access_to_bar(p_bar_id integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.user_has_bar_access(p_bar_id);
$$;

COMMENT ON FUNCTION public.user_has_access_to_bar(integer) IS
  'DEPRECATED 2026-04-26: alias para public.user_has_bar_access. Não usar em código novo.';
