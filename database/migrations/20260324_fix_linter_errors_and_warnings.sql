-- ============================================================
-- Migration: 20260324_fix_linter_errors_and_warnings
-- Corrige TODOS os erros e warnings do Supabase Linter
-- ============================================================

-- ============================================================
-- PARTE 1: ERROS — SECURITY DEFINER VIEW
-- ============================================================

-- 1.1 Remover SECURITY DEFINER da view contahub_stockout_filtrado
-- (recriar sem SECURITY DEFINER — por padrão views usam SECURITY INVOKER)
DROP VIEW IF EXISTS public.contahub_stockout_filtrado;

CREATE VIEW public.contahub_stockout_filtrado AS
SELECT id,
    bar_id,
    data_consulta,
    hora_consulta,
    emp,
    prd,
    loc,
    prd_desc,
    prd_venda,
    prd_ativo,
    prd_produzido,
    prd_unid,
    prd_precovenda,
    prd_estoque,
    prd_controlaestoque,
    prd_validaestoquevenda,
    prd_opcoes,
    prd_venda7,
    prd_venda30,
    prd_venda180,
    prd_nfencm,
    prd_nfeorigem,
    prd_nfecsosn,
    prd_nfecstpiscofins,
    prd_nfepis,
    prd_nfecofins,
    prd_nfeicms,
    prd_qtddouble,
    prd_disponivelonline,
    prd_cardapioonline,
    prd_semcustoestoque,
    prd_balanca,
    prd_delivery,
    prd_entregaimediata,
    prd_semrepique,
    prd_naoimprimeproducao,
    prd_agrupaimpressao,
    prd_contagemehperda,
    prd_naodesmembra,
    prd_naoimprimeficha,
    prd_servico,
    prd_zeraestoquenacompra,
    loc_desc,
    loc_inativo,
    loc_statusimpressao,
    raw_data,
    created_at,
    updated_at,
    categoria_mix,
    CASE
        WHEN categoria_mix = 'COMIDA'::text THEN 'Comidas'::text
        WHEN categoria_mix = 'DRINK'::text THEN 'Drinks'::text
        WHEN categoria_mix = 'BEBIDA'::text THEN 'Bar'::text
        ELSE COALESCE(loc_desc, 'Outro'::text)
    END AS categoria_local
FROM contahub_stockout cs
WHERE prd_ativo = 'S'::text
  AND loc_desc IS NOT NULL
  AND loc_desc <> 'Pegue e Pague'::text
  AND loc_desc <> 'Venda Volante'::text
  AND loc_desc <> 'Baldes'::text
  AND prd_desc !~~* '%[HH]%'::text
  AND prd_desc !~~* '%[PP]%'::text
  AND prd_desc !~~* '%[DD]%'::text
  AND prd_desc !~~* '%[IN]%'::text
  AND prd_desc !~~* '%Happy Hour%'::text
  AND prd_desc !~~* '%HappyHour%'::text
  AND prd_desc !~~* '%Happy-Hour%'::text
  AND prd_desc !~~* '% HH'::text
  AND prd_desc !~~* '% HH %'::text
  AND (COALESCE(raw_data ->> 'grp_desc'::text, ''::text) <> ALL (ARRAY[
    'Baldes'::text, 'Happy Hour'::text, 'Chegadeira'::text,
    'Dose dupla'::text, 'Dose Dupla'::text, 'Dose dupla!'::text, 'Dose Dupla!'::text,
    'Dose dupla sem álcool'::text, 'Dose Dupla sem álcool'::text,
    'Grupo adicional'::text, 'Grupo Adicional'::text, 'Insumos'::text,
    'Promo chivas'::text, 'Promo Chivas'::text,
    'Uso interno'::text, 'Uso Interno'::text, 'Pegue e Pague'::text
  ]))
  AND prd_desc !~~* '%Dose Dupla%'::text
  AND prd_desc !~~* '%Dose Dulpa%'::text
  AND prd_desc !~~* '%Balde%'::text
  AND prd_desc !~~* '%Garrafa%'::text;

-- ============================================================
-- PARTE 2: ERROS — RLS DISABLED IN PUBLIC (7 tabelas)
-- ============================================================

-- 2.1 crm_segmentacao
ALTER TABLE public.crm_segmentacao ENABLE ROW LEVEL SECURITY;
-- Policy: service_role full access (tabela interna/administrativa)
DROP POLICY IF EXISTS "service_role_full_crm_segmentacao" ON public.crm_segmentacao;
CREATE POLICY "service_role_full_crm_segmentacao" ON public.crm_segmentacao
  FOR ALL USING (auth.role() = 'service_role');
-- Policy: usuários autenticados leem dados do seu bar
DROP POLICY IF EXISTS "usuarios_leem_crm_segmentacao" ON public.crm_segmentacao;
CREATE POLICY "usuarios_leem_crm_segmentacao" ON public.crm_segmentacao
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND public.user_has_bar_access(bar_id)
  );

-- 2.2 sync_metadata
ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_sync_metadata" ON public.sync_metadata;
CREATE POLICY "service_role_full_sync_metadata" ON public.sync_metadata
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "usuarios_leem_sync_metadata" ON public.sync_metadata;
CREATE POLICY "usuarios_leem_sync_metadata" ON public.sync_metadata
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND public.user_has_bar_access(bar_id)
  );

-- 2.3 nps_falae_diario_pesquisa
ALTER TABLE public.nps_falae_diario_pesquisa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_nps_falae_diario_pesquisa" ON public.nps_falae_diario_pesquisa;
CREATE POLICY "service_role_full_nps_falae_diario_pesquisa" ON public.nps_falae_diario_pesquisa
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "usuarios_leem_nps_falae_diario_pesquisa" ON public.nps_falae_diario_pesquisa;
CREATE POLICY "usuarios_leem_nps_falae_diario_pesquisa" ON public.nps_falae_diario_pesquisa
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND public.user_has_bar_access(bar_id)
  );

-- 2.4 metas_desempenho_historico
ALTER TABLE public.metas_desempenho_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_metas_desempenho_historico" ON public.metas_desempenho_historico;
CREATE POLICY "service_role_full_metas_desempenho_historico" ON public.metas_desempenho_historico
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "usuarios_leem_metas_desempenho_historico" ON public.metas_desempenho_historico;
CREATE POLICY "usuarios_leem_metas_desempenho_historico" ON public.metas_desempenho_historico
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND public.user_has_bar_access(bar_id)
  );

-- 2.5 nps_falae_diario
ALTER TABLE public.nps_falae_diario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_nps_falae_diario" ON public.nps_falae_diario;
CREATE POLICY "service_role_full_nps_falae_diario" ON public.nps_falae_diario
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "usuarios_leem_nps_falae_diario" ON public.nps_falae_diario;
CREATE POLICY "usuarios_leem_nps_falae_diario" ON public.nps_falae_diario
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND public.user_has_bar_access(bar_id)
  );

-- 2.6 sync_contagem_historico
ALTER TABLE public.sync_contagem_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_sync_contagem_historico" ON public.sync_contagem_historico;
CREATE POLICY "service_role_full_sync_contagem_historico" ON public.sync_contagem_historico
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "usuarios_leem_sync_contagem_historico" ON public.sync_contagem_historico;
CREATE POLICY "usuarios_leem_sync_contagem_historico" ON public.sync_contagem_historico
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND public.user_has_bar_access(bar_id)
  );

-- 2.7 cmv_mensal
ALTER TABLE public.cmv_mensal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_cmv_mensal" ON public.cmv_mensal;
CREATE POLICY "service_role_full_cmv_mensal" ON public.cmv_mensal
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "usuarios_leem_cmv_mensal" ON public.cmv_mensal;
CREATE POLICY "usuarios_leem_cmv_mensal" ON public.cmv_mensal
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND public.user_has_bar_access(bar_id)
  );

-- ============================================================
-- PARTE 3: WARNINGS — FUNCTION SEARCH PATH MUTABLE (35 funções)
-- Adiciona SET search_path = 'public' em todas
-- ============================================================

-- NOTA: Para cada função, usamos ALTER FUNCTION ... SET search_path
-- Isso é idempotente e não altera a lógica da função

-- 3.1 get_google_reviews_by_date
ALTER FUNCTION public.get_google_reviews_by_date(integer, date, date) SET search_path = 'public';

-- 3.2 get_google_reviews_stars_by_date
ALTER FUNCTION public.get_google_reviews_stars_by_date(integer, date, date) SET search_path = 'public';

-- 3.3 refresh_cliente_estatisticas (pode não existir mais — IF EXISTS via DO block)
DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.refresh_cliente_estatisticas() SET search_path = ''public''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 3.4 executar_nibo_sync_ambos_bares
ALTER FUNCTION public.executar_nibo_sync_ambos_bares() SET search_path = 'public';

-- 3.5 set_categoria_mix_contahub_analitico
ALTER FUNCTION public.set_categoria_mix_contahub_analitico() SET search_path = 'public';

-- 3.6 revalidar_contahub_semana_anterior_ambos_bares
ALTER FUNCTION public.revalidar_contahub_semana_anterior_ambos_bares() SET search_path = 'public';

-- 3.7 refresh_cliente_estatisticas_incremental (pode não existir)
DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.refresh_cliente_estatisticas_incremental() SET search_path = ''public''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 3.8 calcular_nps_por_pesquisa
ALTER FUNCTION public.calcular_nps_por_pesquisa(integer, date, date) SET search_path = 'public';

-- 3.9 revalidar_stockout_dia_anterior_ambos_bares
ALTER FUNCTION public.revalidar_stockout_dia_anterior_ambos_bares() SET search_path = 'public';

-- 3.10 sync_contahub_periodo_to_visitas (pode não existir)
DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.sync_contahub_periodo_to_visitas() SET search_path = ''public''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 3.11 recalcular_nps_diario_pesquisa
ALTER FUNCTION public.recalcular_nps_diario_pesquisa(integer, date, date) SET search_path = 'public';

-- 3.12 calcular_stockout_semanal
ALTER FUNCTION public.calcular_stockout_semanal(integer, date, date) SET search_path = 'public';

-- 3.13 processar_raw_data_backfill (pode não existir)
DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.processar_raw_data_backfill() SET search_path = ''public''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 3.14 update_eventos_ambos_bares
ALTER FUNCTION public.update_eventos_ambos_bares() SET search_path = 'public';

-- 3.15 calcular_nps_semanal_por_pesquisa
ALTER FUNCTION public.calcular_nps_semanal_por_pesquisa(integer, date, date) SET search_path = 'public';

-- 3.16 proteger_contahub_delete
ALTER FUNCTION public.proteger_contahub_delete() SET search_path = 'public';

-- 3.17 limpar_heartbeats_antigos
ALTER FUNCTION public.limpar_heartbeats_antigos(integer) SET search_path = 'public';

-- 3.18 verificar_saude_crons
ALTER FUNCTION public.verificar_saude_crons(integer, integer, integer) SET search_path = 'public';

-- 3.19 get_locais_por_categoria
ALTER FUNCTION public.get_locais_por_categoria(integer, character varying) SET search_path = 'public';

-- 3.20 update_sync_metadata_timestamp
ALTER FUNCTION public.update_sync_metadata_timestamp() SET search_path = 'public';

-- 3.21 executar_recalculo_desempenho_v2
ALTER FUNCTION public.executar_recalculo_desempenho_v2() SET search_path = 'public';

-- 3.22 set_categoria_mix_contahub_stockout
ALTER FUNCTION public.set_categoria_mix_contahub_stockout() SET search_path = 'public';

-- 3.23 sync_contahub_ambos_bares
ALTER FUNCTION public.sync_contahub_ambos_bares() SET search_path = 'public';

-- 3.24 get_cmv_fator_consumo
ALTER FUNCTION public.get_cmv_fator_consumo(integer) SET search_path = 'public';

-- 3.25 get_ano_inicio_operacao
ALTER FUNCTION public.get_ano_inicio_operacao(integer) SET search_path = 'public';

-- 3.26 get_categorias_custo
ALTER FUNCTION public.get_categorias_custo(integer, character varying) SET search_path = 'public';

-- 3.27 get_metas_dia
ALTER FUNCTION public.get_metas_dia(integer, integer) SET search_path = 'public';

-- 3.28 adapter_contahub_to_vendas_item
ALTER FUNCTION public.adapter_contahub_to_vendas_item(integer, date) SET search_path = 'public';

-- 3.29 calcular_mix_vendas
ALTER FUNCTION public.calcular_mix_vendas(integer, date, date) SET search_path = 'public';

-- 3.30 adapter_contahub_to_visitas
ALTER FUNCTION public.adapter_contahub_to_visitas(integer, date) SET search_path = 'public';

-- 3.31 purgar_staging_antigo
ALTER FUNCTION public.purgar_staging_antigo() SET search_path = 'public';

-- 3.32 rodar_adapters_diarios (pode não existir)
DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.rodar_adapters_diarios() SET search_path = ''public''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 3.33 processar_raw_data_pendente (pode não existir)
DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.processar_raw_data_pendente() SET search_path = ''public''';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 3.34 process_fatporhora_data
ALTER FUNCTION public.process_fatporhora_data(integer, jsonb, date) SET search_path = 'public';

-- 3.35 process_tempo_data
ALTER FUNCTION public.process_tempo_data(integer, jsonb, date) SET search_path = 'public';

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
