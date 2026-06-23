-- Matching de categoria UNIFORME (case + acento) nos 3 relatórios + override por bar.
-- Antes: Orçamentação (normKey no frontend) já era; DFC/DRE eram só case-insensitive
-- (upper/btrim) → nomes acentuados do Deboche não casavam sem cadastro manual.
-- Aplicado em produção 2026-06-23 via MCP (migrations normcat_helper + dfc_dre_accent_normcat).

-- Normalizador único: MAIÚSCULA + sem acento + trim. IMMUTABLE (usa unaccent 2-arg).
create or replace function public.normcat(p text)
returns text language sql immutable
as $$ select upper(btrim(public.unaccent('public.unaccent'::regdictionary, coalesce(p,'')))) $$;

-- get_dfc_por_ano e get_dre_por_ano foram recriados pra casar com public.normcat(...)
-- nas joins do de-para (em vez de upper(btrim(...))) + LATERAL com override por bar
-- (prefere a linha bar_id = p_bar_id; cai na global bar_id IS NULL). Corpo completo
-- no histórico de migrations do Supabase (dfc_dre_accent_normcat).
-- Exemplo: normcat('Locações Operação') = normcat('LOCACOES OPERACAO') = 'LOCACOES OPERACAO'.
