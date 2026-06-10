-- 2026-06-10 | Hardening de segurança (Supabase DB linter: SECURITY DEFINER views + RLS off)
--
-- Contexto: anon/authenticated têm SELECT amplo em quase todos os schemas (a anon key é
-- pública no bundle), e o frontend lê algumas tabelas/views DIRETO via anon (dashboards de
-- Desempenho/Planejamento/Orçamentação/BP/Visão Geral). As rotas de /api usam service-role
-- (ignora RLS). Por isso a remediação foi feita SEM quebrar leitura:
--   (1) 18 views -> security_invoker=on (passam a usar permissão de quem consulta).
--   (2) ~20 tabelas sensíveis e SÓ-API (pagamentos, DMs/comentários IG, whatsapp,
--       concorrentes, campanhas) -> RLS habilitado SEM policy: anon bloqueado, service-role ok.
--   (3) 6 tabelas que alimentam view/página anon (dre_categoria_macro, fluxo_caixa_previsto,
--       produto_custo_*, bronze_stone_conciliacao, instagram_data_deletion_requests) ->
--       RLS + policy SELECT permissiva: satisfaz o linter e bloqueia ESCRITA anon sem quebrar leitura.
--
-- PENDENTE (lockdown real de leitura): rotear as leituras anon dos dashboards p/ rotas de API
-- (service-role) e REVOGAR os grants SELECT do anon nesses schemas. Aí dá pra trocar as 6 policies
-- permissivas por RLS fechado. Verificado: advisor de segurança ficou com 0 erros após esta migration.

-- (1) Views: security_invoker
ALTER VIEW financial.dre_mensal_contaazul SET (security_invoker = on);
ALTER VIEW financial.contas_a_vencer SET (security_invoker = on);
ALTER VIEW financial.contaazul_mes_categoria SET (security_invoker = on);
ALTER VIEW financial.dre_excel SET (security_invoker = on);
ALTER VIEW gold.heatmap_vendas_dow_hora SET (security_invoker = on);
ALTER VIEW gold.cmo_produtividade_mensal SET (security_invoker = on);
ALTER VIEW gold.ig_roi_posts SET (security_invoker = on);
ALTER VIEW gold.noshow_resumo SET (security_invoker = on);
ALTER VIEW gold.noshow_reincidentes SET (security_invoker = on);
ALTER VIEW gold.gold_contahub_operacional_stockout_por_categoria SET (security_invoker = on);
ALTER VIEW gold.quality_scorecard SET (security_invoker = on);
ALTER VIEW gold.mix_produtos_diario SET (security_invoker = on);
ALTER VIEW gold.conciliacao_pagamentos_diaria SET (security_invoker = on);
ALTER VIEW gold.cancelamentos_diario SET (security_invoker = on);
ALTER VIEW gold.cma_alimentacao_mensal SET (security_invoker = on);
ALTER VIEW operations.produto_custo_mudancas SET (security_invoker = on);
ALTER VIEW crm.clube_ordi_membros SET (security_invoker = on);
ALTER VIEW auth_custom.usuarios SET (security_invoker = on);

-- (2) RLS hard (sem policy)
ALTER TABLE financial.pedidos_pagamento              ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.pedidos_pagamento_comentarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.pedidos_pagamento_anexos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.pedidos_pagamento_historico    ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_alertas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_comentarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_mencoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_conversas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_mensagens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_webhook_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_relatorios_ai     ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_concorrentes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_concorrentes_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.whatsapp_assistente_socios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.whatsapp_assistente_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.cardapio_planilha_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.feriados_eventos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.fidelidade_regras                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.campanhas                            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.campanhas_execucoes                  ENABLE ROW LEVEL SECURITY;

-- (3) RLS + SELECT permissivo p/ anon (dependências de view/página anon)
ALTER TABLE financial.dre_categoria_macro            ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.fluxo_caixa_previsto           ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.produto_custo_historico       ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.produto_custo_manual          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bronze.bronze_stone_conciliacao          ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_data_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_select ON financial.dre_categoria_macro;
CREATE POLICY anon_select ON financial.dre_categoria_macro FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anon_select ON financial.fluxo_caixa_previsto;
CREATE POLICY anon_select ON financial.fluxo_caixa_previsto FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anon_select ON operations.produto_custo_historico;
CREATE POLICY anon_select ON operations.produto_custo_historico FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anon_select ON operations.produto_custo_manual;
CREATE POLICY anon_select ON operations.produto_custo_manual FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anon_select ON bronze.bronze_stone_conciliacao;
CREATE POLICY anon_select ON bronze.bronze_stone_conciliacao FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anon_select ON integrations.instagram_data_deletion_requests;
CREATE POLICY anon_select ON integrations.instagram_data_deletion_requests FOR SELECT TO anon, authenticated USING (true);
