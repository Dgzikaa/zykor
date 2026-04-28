-- B.1 — RLS helpers consolidation (#42 follow-up)
--
-- Estado atual: dois helpers semanticamente equivalentes coexistem.
--
--   public.user_has_bar_access(check_bar_id integer)    [49 policies]
--     → SELECT EXISTS (SELECT 1 FROM public.usuarios_bares
--                      WHERE usuario_id = auth.uid() AND bar_id = check_bar_id)
--
--   public.user_has_access_to_bar(p_bar_id integer)     [71 policies]
--     → SELECT EXISTS (SELECT 1 FROM public.usuarios_bares ub
--                      JOIN public.usuarios u ON u.auth_id = auth.uid()
--                      WHERE ub.usuario_id = u.auth_id AND ub.bar_id = p_bar_id)
--
-- Equivalência semântica confirmada via:
--   - FK: usuarios_bares.usuario_id → usuarios.auth_id ON DELETE CASCADE
--   - Zero órfãs em SELECT … LEFT JOIN usuarios … WHERE u.auth_id IS NULL
--
-- Performance: user_has_bar_access faz 1 index lookup; user_has_access_to_bar
-- faz 2 (JOIN extra). Versão canônica é user_has_bar_access.
--
-- Estratégia (Fase 1): substituir corpo de user_has_access_to_bar para
-- DELEGAR pra user_has_bar_access. Marcar como deprecated. Zero policies
-- precisam ser reescritas — o alias preserva 100% do contrato. As 71 policies
-- que usam user_has_access_to_bar ganham 1 index lookup a menos automaticamente.
--
-- Fase 2 (futuro PR): reescrever 71 policies para chamar user_has_bar_access
-- diretamente, depois Fase 3 droparia user_has_access_to_bar.

CREATE OR REPLACE FUNCTION public.user_has_access_to_bar(p_bar_id integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- DEPRECATED: use public.user_has_bar_access(check_bar_id) directly em novo código.
  -- Mantido como alias para preservar contrato com 71 policies existentes.
  -- Plano de remoção: ver task #42 (Fase 2 reescreve policies, Fase 3 dropa).
  SELECT public.user_has_bar_access(p_bar_id);
$function$;

COMMENT ON FUNCTION public.user_has_access_to_bar(integer) IS
  'DEPRECATED 2026-04-26: alias para public.user_has_bar_access. Não usar em código novo.';
