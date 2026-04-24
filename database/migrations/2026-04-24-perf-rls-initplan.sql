-- Envelopa auth.<fn>() em (select ...) em policies RLS apontadas
-- pelo Supabase Performance Advisor (auth_rls_initplan).
-- Baseline: database/_advisor_snapshots/2026-04-24-perf.json
-- Pre-flight: database/_advisor_snapshots/2026-04-24-rls-initplan-preflight.md
--
-- Gerado por scripts/perf/generate-rls-initplan-migration.py (deterministico).
-- Transformacao: regex substitui auth.(uid|role|jwt)() top-level por
-- (select auth.X()). Mantem qual/with_check identicos exceto por isso.
-- Idempotente: ALTER POLICY com mesmo corpo = no-op.
--
-- NOTA edge cases:
--   public.api_credentials, public.usuarios_bares — tabelas/views residuais
--     da migracao public -> schemas nomeados (integrations, auth_custom), parcial.
--     ALTER POLICY aqui e semanticamente equivalente, mas indica divida tecnica.
--   ops.job_camada_mapping — schema novo criado em 13f6072e (observability).

-- agent_ai.agent_insights_v2 :: agent_insights_v2_bar_access
ALTER POLICY "agent_insights_v2_bar_access" ON "agent_ai"."agent_insights_v2"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_alertas :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_alertas"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_aprendizado :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_aprendizado"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_configuracoes :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_configuracoes"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_conversas :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_conversas"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_feedbacks :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_feedbacks"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_ia_metricas :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_ia_metricas"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_insights :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_insights"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_memoria_vetorial :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_memoria_vetorial"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_metricas :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_metricas"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_padroes_detectados :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_padroes_detectados"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_regras_dinamicas :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_regras_dinamicas"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- agent_ai.agente_scans :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_scans"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- bronze.bronze_contahub_avendas_porproduto_analitico :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "bronze"."bronze_contahub_avendas_porproduto_analitico"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- bronze.bronze_contahub_avendas_vendasdiahoraanalitico :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "bronze"."bronze_contahub_avendas_vendasdiahoraanalitico"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- bronze.bronze_contahub_avendas_vendasperiodo :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "bronze"."bronze_contahub_avendas_vendasperiodo"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- bronze.bronze_contahub_financeiro_pagamentosrecebidos :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "bronze"."bronze_contahub_financeiro_pagamentosrecebidos"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- bronze.bronze_contahub_produtos_temposproducao :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "bronze"."bronze_contahub_produtos_temposproducao"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- crm.crm_segmentacao :: service_role_full_crm_segmentacao
ALTER POLICY "service_role_full_crm_segmentacao" ON "crm"."crm_segmentacao"
  USING (((select auth.role()) = 'service_role'::text));

-- crm.crm_segmentacao :: usuarios_leem_crm_segmentacao
ALTER POLICY "usuarios_leem_crm_segmentacao" ON "crm"."crm_segmentacao"
  USING ((((select auth.role()) = 'authenticated'::text) AND user_has_bar_access(bar_id)));

-- crm.nps_falae_diario_legacy_backup :: service_role_full_nps_falae_diario
ALTER POLICY "service_role_full_nps_falae_diario" ON "crm"."nps_falae_diario_legacy_backup"
  USING (((select auth.role()) = 'service_role'::text));

-- crm.nps_falae_diario_legacy_backup :: usuarios_leem_nps_falae_diario
ALTER POLICY "usuarios_leem_nps_falae_diario" ON "crm"."nps_falae_diario_legacy_backup"
  USING ((((select auth.role()) = 'authenticated'::text) AND user_has_bar_access(bar_id)));

-- crm.nps_falae_diario_pesquisa :: service_role_full_nps_falae_diario_pesquisa
ALTER POLICY "service_role_full_nps_falae_diario_pesquisa" ON "crm"."nps_falae_diario_pesquisa"
  USING (((select auth.role()) = 'service_role'::text));

-- crm.nps_falae_diario_pesquisa :: usuarios_leem_nps_falae_diario_pesquisa
ALTER POLICY "usuarios_leem_nps_falae_diario_pesquisa" ON "crm"."nps_falae_diario_pesquisa"
  USING ((((select auth.role()) = 'authenticated'::text) AND user_has_bar_access(bar_id)));

-- financial.cmv_mensal :: service_role_full_cmv_mensal
ALTER POLICY "service_role_full_cmv_mensal" ON "financial"."cmv_mensal"
  USING (((select auth.role()) = 'service_role'::text));

-- financial.cmv_mensal :: usuarios_leem_cmv_mensal
ALTER POLICY "usuarios_leem_cmv_mensal" ON "financial"."cmv_mensal"
  USING ((((select auth.role()) = 'authenticated'::text) AND user_has_bar_access(bar_id)));

-- financial.cmv_semanal :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "financial"."cmv_semanal"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- financial.pix_enviados :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "financial"."pix_enviados"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- integrations.bar_api_configs :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "integrations"."bar_api_configs"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- integrations.contaazul_categorias :: authenticated_select_bar_access
ALTER POLICY "authenticated_select_bar_access" ON "integrations"."contaazul_categorias"
  USING ((((select auth.role()) = 'authenticated'::text) AND (bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid()))))));

-- integrations.contaazul_centros_custo :: authenticated_select_bar_access
ALTER POLICY "authenticated_select_bar_access" ON "integrations"."contaazul_centros_custo"
  USING ((((select auth.role()) = 'authenticated'::text) AND (bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid()))))));

-- integrations.contaazul_contas_financeiras :: authenticated_select_bar_access
ALTER POLICY "authenticated_select_bar_access" ON "integrations"."contaazul_contas_financeiras"
  USING ((((select auth.role()) = 'authenticated'::text) AND user_has_bar_access(bar_id)));

-- integrations.contaazul_lancamentos :: authenticated_select_bar_access
ALTER POLICY "authenticated_select_bar_access" ON "integrations"."contaazul_lancamentos"
  USING ((((select auth.role()) = 'authenticated'::text) AND user_has_bar_access(bar_id)));

-- integrations.contaazul_logs_sincronizacao :: authenticated_select_bar_access
ALTER POLICY "authenticated_select_bar_access" ON "integrations"."contaazul_logs_sincronizacao"
  USING ((((select auth.role()) = 'authenticated'::text) AND user_has_bar_access(bar_id)));

-- integrations.contaazul_pessoas :: authenticated_select_bar_access
ALTER POLICY "authenticated_select_bar_access" ON "integrations"."contaazul_pessoas"
  USING ((((select auth.role()) = 'authenticated'::text) AND user_has_bar_access(bar_id)));

-- integrations.sympla_eventos :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "integrations"."sympla_eventos"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- integrations.sympla_participantes :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "integrations"."sympla_participantes"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- integrations.sympla_pedidos :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "integrations"."sympla_pedidos"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- integrations.yuzer_eventos :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "integrations"."yuzer_eventos"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- integrations.yuzer_fatporhora :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "integrations"."yuzer_fatporhora"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- integrations.yuzer_pagamento :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "integrations"."yuzer_pagamento"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- integrations.yuzer_produtos :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "integrations"."yuzer_produtos"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- meta.desempenho_manual :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "meta"."desempenho_manual"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- meta.marketing_mensal :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "meta"."marketing_mensal"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- meta.metas_desempenho :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "meta"."metas_desempenho"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- meta.metas_desempenho_historico :: service_role_full_metas_desempenho_historico
ALTER POLICY "service_role_full_metas_desempenho_historico" ON "meta"."metas_desempenho_historico"
  USING (((select auth.role()) = 'service_role'::text));

-- meta.metas_desempenho_historico :: usuarios_leem_metas_desempenho_historico
ALTER POLICY "usuarios_leem_metas_desempenho_historico" ON "meta"."metas_desempenho_historico"
  USING ((((select auth.role()) = 'authenticated'::text) AND user_has_bar_access(bar_id)));

-- operations.bar_notification_configs :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "operations"."bar_notification_configs"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- operations.checklist_agendamentos :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "operations"."checklist_agendamentos"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- ops.job_camada_mapping :: job_camada_read_auth
ALTER POLICY "job_camada_read_auth" ON "ops"."job_camada_mapping"
  USING (((select auth.role()) = 'authenticated'::text));

-- public.api_credentials :: Users can access their bar data
ALTER POLICY "Users can access their bar data" ON "public"."api_credentials"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- public.usuarios_bares :: Users can access their own associations
ALTER POLICY "Users can access their own associations" ON "public"."usuarios_bares"
  USING ((usuario_id = (select auth.uid())))
  WITH CHECK ((usuario_id = (select auth.uid())));

-- system.insight_events :: insight_events_bar_access
ALTER POLICY "insight_events_bar_access" ON "system"."insight_events"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));

-- system.notificacoes :: Users can access their notifications
ALTER POLICY "Users can access their notifications" ON "system"."notificacoes"
  USING ((usuario_id = (select auth.uid())))
  WITH CHECK ((usuario_id = (select auth.uid())));

-- system.sync_contagem_historico :: service_role_full_sync_contagem_historico
ALTER POLICY "service_role_full_sync_contagem_historico" ON "system"."sync_contagem_historico"
  USING (((select auth.role()) = 'service_role'::text));

-- system.sync_contagem_historico :: usuarios_leem_sync_contagem_historico
ALTER POLICY "usuarios_leem_sync_contagem_historico" ON "system"."sync_contagem_historico"
  USING ((((select auth.role()) = 'authenticated'::text) AND user_has_bar_access(bar_id)));

-- system.sync_metadata :: service_role_full_sync_metadata
ALTER POLICY "service_role_full_sync_metadata" ON "system"."sync_metadata"
  USING (((select auth.role()) = 'service_role'::text));

-- system.sync_metadata :: usuarios_leem_sync_metadata
ALTER POLICY "usuarios_leem_sync_metadata" ON "system"."sync_metadata"
  USING ((((select auth.role()) = 'authenticated'::text) AND user_has_bar_access(bar_id)));
