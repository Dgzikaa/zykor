-- ROLLBACK B.1 — restaurar corpo original de user_has_access_to_bar (com JOIN)

CREATE OR REPLACE FUNCTION public.user_has_access_to_bar(p_bar_id integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_bares ub
    JOIN public.usuarios u ON u.auth_id = auth.uid()
    WHERE ub.usuario_id = u.auth_id
      AND ub.bar_id = p_bar_id
  );
$function$;

COMMENT ON FUNCTION public.user_has_access_to_bar(integer) IS NULL;
