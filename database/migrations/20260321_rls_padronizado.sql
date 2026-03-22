-- ====================================================
-- RLS PADRONIZADO: Todas as tabelas core do Zykor
-- Padrão: service_role full access + authenticated filtra por bar_id
-- Data: 2026-03-21
-- ====================================================

-- Helper function para check de acesso por bar
CREATE OR REPLACE FUNCTION public.user_has_bar_access(check_bar_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_bares
    WHERE usuario_id = auth.uid() AND bar_id = check_bar_id
  );
$$;

-- EVENTOS_BASE
DROP POLICY IF EXISTS "eventos_base_policy" ON eventos_base;
CREATE POLICY "service_role_full_access" ON eventos_base FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_bar_access" ON eventos_base FOR ALL TO authenticated
  USING (public.user_has_bar_access(bar_id)) WITH CHECK (public.user_has_bar_access(bar_id));

-- VENDAS_ITEM
CREATE POLICY "authenticated_bar_access" ON vendas_item FOR ALL TO authenticated
  USING (public.user_has_bar_access(bar_id)) WITH CHECK (public.user_has_bar_access(bar_id));

-- VISITAS
CREATE POLICY "authenticated_bar_access" ON visitas FOR ALL TO authenticated
  USING (public.user_has_bar_access(bar_id)) WITH CHECK (public.user_has_bar_access(bar_id));

-- TEMPOS_PRODUCAO
CREATE POLICY "authenticated_bar_access" ON tempos_producao FOR ALL TO authenticated
  USING (public.user_has_bar_access(bar_id)) WITH CHECK (public.user_has_bar_access(bar_id));

-- FATURAMENTO_HORA
CREATE POLICY "authenticated_bar_access" ON faturamento_hora FOR ALL TO authenticated
  USING (public.user_has_bar_access(bar_id)) WITH CHECK (public.user_has_bar_access(bar_id));

-- FATURAMENTO_PAGAMENTOS
CREATE POLICY "authenticated_bar_access" ON faturamento_pagamentos FOR ALL TO authenticated
  USING (public.user_has_bar_access(bar_id)) WITH CHECK (public.user_has_bar_access(bar_id));

-- AGENTE_USO
CREATE POLICY "authenticated_bar_access" ON agente_uso FOR ALL TO authenticated
  USING (public.user_has_bar_access(bar_id)) WITH CHECK (public.user_has_bar_access(bar_id));

-- BAR_ARTISTAS
DROP POLICY IF EXISTS "bar_artistas_select" ON bar_artistas;
CREATE POLICY "service_role_full_access" ON bar_artistas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_bar_access" ON bar_artistas FOR SELECT TO authenticated
  USING (public.user_has_bar_access(bar_id));

-- CONFIG TABLES (read-only para authenticated)
ALTER TABLE bar_categorias_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON bar_categorias_custo FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_bar_access" ON bar_categorias_custo FOR SELECT TO authenticated
  USING (public.user_has_bar_access(bar_id));

ALTER TABLE bar_local_mapeamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON bar_local_mapeamento FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_bar_access" ON bar_local_mapeamento FOR SELECT TO authenticated
  USING (public.user_has_bar_access(bar_id));

ALTER TABLE bar_metas_periodo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON bar_metas_periodo FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_bar_access" ON bar_metas_periodo FOR SELECT TO authenticated
  USING (public.user_has_bar_access(bar_id));

ALTER TABLE bar_regras_negocio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON bar_regras_negocio FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_bar_access" ON bar_regras_negocio FOR SELECT TO authenticated
  USING (public.user_has_bar_access(bar_id));

ALTER TABLE bares_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON bares_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_bar_access" ON bares_config FOR SELECT TO authenticated
  USING (public.user_has_bar_access(bar_id));
