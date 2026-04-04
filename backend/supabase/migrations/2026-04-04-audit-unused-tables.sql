-- =====================================================
-- AUDITORIA DE TABELAS SEM USO ATIVO
-- Data: 2026-04-04
-- 
-- Esta migration adiciona comentários SQL para marcar tabelas
-- que estão vazias e/ou sem uso ativo no código.
-- 
-- Classificação:
-- - [DEPRECATED] → Nenhum código ativo usa esta tabela
-- - [ATIVO_SEM_DADOS] → Existe código que usa, mas ainda sem dados reais
-- - [LEGACY_V1] → Versão antiga substituída por V2
-- =====================================================

-- =====================================================
-- GRUPO 1: TABELAS DE CONFIGURAÇÃO DE BARES (ABANDONADAS)
-- =====================================================
-- Análise: Existe código que faz INSERT (frontend/src/app/api/configuracoes/bars/route.ts)
-- mas a tabela 'bares' tem apenas 2 registros e a config real está em 'bares_config'.
-- As 3 tabelas relacionadas (bar_api_configs, bar_notification_configs, bar_stats) 
-- têm 0 registros e são populadas apenas quando um novo bar é criado via API.
-- Status: ATIVO_SEM_DADOS (código existe mas nunca foi usado em produção)

COMMENT ON TABLE bares IS 
'[ATIVO_SEM_DADOS] Tabela de cadastro de bares. Tem código ativo (POST /api/configuracoes/bars) mas config real está em bares_config. Apenas 2 registros de teste. Candidata para consolidação com bares_config.';

COMMENT ON TABLE bar_api_configs IS 
'[ATIVO_SEM_DADOS] Configurações de API por bar. Populada automaticamente ao criar bar via POST /api/configuracoes/bars, mas nunca usada em produção (0 registros). Candidata para remoção se bares for consolidada.';

COMMENT ON TABLE bar_notification_configs IS 
'[ATIVO_SEM_DADOS] Configurações de notificação por bar. Populada automaticamente ao criar bar via POST /api/configuracoes/bars, mas nunca usada em produção (0 registros). Candidata para remoção se bares for consolidada.';

COMMENT ON TABLE bar_stats IS 
'[ATIVO_SEM_DADOS] Estatísticas por bar. Populada automaticamente ao criar bar via POST /api/configuracoes/bars, mas nunca usada em produção (0 registros). Candidata para remoção se bares for consolidada.';

-- =====================================================
-- GRUPO 2: SEMANAS DE REFERÊNCIA (ATIVA COM DADOS)
-- =====================================================
-- Análise: Tem código ativo (GET /api/estrategico/desempenho, /api/semanas/listar)
-- e 48 registros. Esta tabela NÃO deve ser marcada como deprecated.

COMMENT ON TABLE semanas_referencia IS 
'[ATIVA] Tabela de controle de semanas para análise de desempenho. Usada ativamente por /api/estrategico/desempenho e /api/semanas/listar. 48 registros.';

-- =====================================================
-- GRUPO 3: DRE MANUAL (ATIVA COM DADOS)
-- =====================================================
-- Análise: Tem código ativo (múltiplas APIs de DRE) e 82 registros.
-- Esta tabela NÃO deve ser marcada como deprecated.

COMMENT ON TABLE dre_manual IS 
'[ATIVA] Lançamentos manuais de DRE. Usada ativamente por /api/financeiro/dre-manual e outras APIs de DRE. 82 registros.';

-- =====================================================
-- GRUPO 4: CUSTOS MENSAIS DILUÍDOS (ATIVA SEM DADOS)
-- =====================================================
-- Análise: Tem código ativo (GET/POST /api/custos-diluidos) mas 0 registros.

COMMENT ON TABLE custos_mensais_diluidos IS 
'[ATIVO_SEM_DADOS] Custos fixos diluídos por mês. Tem código ativo em /api/custos-diluidos mas nunca foi populada (0 registros). Aguardando uso em produção.';

-- =====================================================
-- GRUPO 5: MARKETING E CRM (ATIVOS SEM DADOS)
-- =====================================================
-- Análise: Ambas têm código ativo mas 0 registros.

COMMENT ON TABLE marketing_mensal IS 
'[ATIVO_SEM_DADOS] Dados de marketing por mês. Tem código ativo em /api/estrategico/marketing-mensal mas nunca foi populada (0 registros). Feature planejada não implementada.';

COMMENT ON TABLE crm_segmentacao IS 
'[ATIVO_SEM_DADOS] Segmentação de clientes para CRM. Tem código ativo em /api/crm/segmentos mas nunca foi populada (0 registros). Feature planejada não implementada.';

-- =====================================================
-- GRUPO 6: NOTIFICAÇÕES (ATIVA SEM DADOS)
-- =====================================================
-- Análise: Tem código ativo (GET/POST/PUT/DELETE /api/configuracoes/notifications) mas 0 registros.

COMMENT ON TABLE notificacoes IS 
'[ATIVO_SEM_DADOS] Sistema de notificações. Tem código ativo em /api/configuracoes/notifications mas nunca foi populada (0 registros). Sistema de notificações não está em uso.';

-- =====================================================
-- GRUPO 7: GETIN UNITS (ATIVA COM DADOS)
-- =====================================================
-- Análise: Tem código ativo (GET /api/configuracoes/integracoes/status) e 1 registro.

COMMENT ON TABLE getin_units IS 
'[ATIVA] Unidades da integração GetIn. Usada ativamente por /api/configuracoes/integracoes/status. 1 registro.';

-- =====================================================
-- GRUPO 8: UPLOADS (DEPRECATED)
-- =====================================================
-- Análise: Tem código ativo completo (GET/POST/DELETE /api/configuracoes/uploads) mas 0 registros.
-- Nota: A tabela real usada é 'checklist_anexos', não 'uploads'.

COMMENT ON TABLE uploads IS 
'[DEPRECATED] Tabela de uploads. O código em /api/configuracoes/uploads usa checklist_anexos, não esta tabela. 0 registros. Candidata para remoção.';

-- =====================================================
-- GRUPO 9: PESSOAS RESPONSÁVEIS (ATIVA COM DADOS)
-- =====================================================
-- Análise: Tem código ativo (GET/POST/PUT/DELETE /api/operacional/pessoas-responsaveis) e 5 registros.

COMMENT ON TABLE pessoas_responsaveis IS 
'[ATIVA] Cadastro de pessoas responsáveis por áreas. Usada ativamente por /api/operacional/pessoas-responsaveis. 5 registros.';

-- =====================================================
-- GRUPO 10: CONTRATOS DE FUNCIONÁRIO (ATIVO SEM DADOS)
-- =====================================================
-- Análise: Tem código ativo (GET /api/rh/funcionarios/[id]/contratos) mas 0 registros.

COMMENT ON TABLE contratos_funcionario IS 
'[ATIVO_SEM_DADOS] Contratos de funcionários. Tem código ativo em /api/rh/funcionarios mas nunca foi populada (0 registros). Feature de RH não implementada completamente.';

-- =====================================================
-- GRUPO 11: AGENTE V1 (LEGACY - SUBSTITUÍDO POR V2)
-- =====================================================
-- Análise: Todas as tabelas agente_* V1 têm 0 registros.
-- O código usa agent_insights_v2 e insight_events (V2).
-- agente_insights ainda tem código ativo mas é legacy.

COMMENT ON TABLE agente_scans IS 
'[LEGACY_V1] Histórico de scans do agente V1. Tem código ativo em /api/agente/scan mas nunca foi usado (0 registros). Substituído pelo sistema V2 (agent_insights_v2). Candidata para remoção.';

COMMENT ON TABLE agente_insights IS 
'[LEGACY_V1] Insights do agente V1. Ainda tem código ativo em /api/agente/insights e agente-dispatcher (linha 292) mas é sistema legacy. 0 registros. Substituído por agent_insights_v2. Candidata para migração completa para V2 e posterior remoção.';

COMMENT ON TABLE agente_metricas IS 
'[DEPRECATED] Métricas do agente V1. Nenhum código ativo encontrado. 0 registros. Candidata para remoção.';

COMMENT ON TABLE agente_memoria_vetorial IS 
'[DEPRECATED] Memória vetorial do agente V1. Tem código em /api/agente/evolucao mas nunca foi usado (0 registros). Feature não implementada. Candidata para remoção.';

COMMENT ON TABLE agente_conversas IS 
'[DEPRECATED] Conversas do agente V1. Tem código em /api/agente/chat e /api/agente/evolucao mas nunca foi usado (0 registros). Substituído pelo sistema V2. Candidata para remoção.';

COMMENT ON TABLE agente_feedbacks IS 
'[DEPRECATED] Feedbacks do agente V1. Tem código em /api/agente/feedback e /api/agente/evolucao mas nunca foi usado (0 registros). Feature não implementada. Candidata para remoção.';

COMMENT ON TABLE agente_regras_dinamicas IS 
'[DEPRECATED] Regras dinâmicas do agente V1. Tem código em /api/agente/evolucao mas nunca foi usado (0 registros). Feature não implementada. Candidata para remoção.';

COMMENT ON TABLE agente_padroes_detectados IS 
'[DEPRECATED] Padrões detectados do agente V1. Tem código em /api/agente/insights e /api/agente/evolucao mas nunca foi usado (0 registros). Substituído pelo sistema V2. Candidata para remoção.';

COMMENT ON TABLE agente_ia_metricas IS 
'[DEPRECATED] Métricas de IA do agente V1. Tem código em /api/agente/previsao e /api/agente/evolucao mas nunca foi usado (0 registros). Feature não implementada. Candidata para remoção.';

-- =====================================================
-- GRUPO 12: AGENTE V2 (ATIVO SEM DADOS)
-- =====================================================
-- Análise: Sistema V2 ativo com código completo mas ainda sem dados em produção.

COMMENT ON TABLE insight_events IS 
'[ATIVO_SEM_DADOS] Eventos de insights do agente V2. Tem código ativo em /api/agente/insights-v2/events e agente-narrator mas nunca foi populada (0 registros). Sistema V2 aguardando ativação em produção.';

COMMENT ON TABLE agent_insights_v2 IS 
'[ATIVO_SEM_DADOS] Insights do agente V2. Tem código ativo em /api/agente/insights-v2 e agente-narrator (INSERT linha 217) mas nunca foi populada (0 registros). Sistema V2 aguardando ativação em produção.';

-- =====================================================
-- GRUPO 13: VALIDAÇÕES CRUZADAS (ATIVA SEM DADOS)
-- =====================================================
-- Análise: Tem código ativo (GET /api/saude-dados/validacoes) mas 0 registros.

COMMENT ON TABLE validacoes_cruzadas IS 
'[ATIVO_SEM_DADOS] Validações cruzadas de dados. Tem código ativo em /api/saude-dados/validacoes mas nunca foi populada (0 registros). Feature de auditoria de dados não implementada completamente.';

-- =====================================================
-- GRUPO 14: UMBLER CAMPANHAS (ATIVAS SEM DADOS)
-- =====================================================
-- Análise: Ambas têm código ativo mas 0 registros.

COMMENT ON TABLE umbler_campanhas IS 
'[ATIVO_SEM_DADOS] Campanhas de email via Umbler. Tem código ativo em /api/umbler/campanhas mas nunca foi populada (0 registros). Feature de email marketing não implementada completamente.';

COMMENT ON TABLE umbler_campanha_destinatarios IS 
'[ATIVO_SEM_DADOS] Destinatários de campanhas Umbler. Tem código ativo em /api/umbler/campanhas mas nunca foi populada (0 registros). Feature de email marketing não implementada completamente.';

-- =====================================================
-- GRUPO 15: INTEGRAÇÕES EXTERNAS (ATIVAS SEM DADOS)
-- =====================================================
-- Análise: Ambas têm código ativo mas 0 registros.

COMMENT ON TABLE nibo_stakeholders IS 
'[ATIVO_SEM_DADOS] Stakeholders da integração Nibo. Tem código ativo em /api/financeiro/nibo/stakeholders mas nunca foi populada (0 registros). Integração Nibo não está sincronizando stakeholders.';

COMMENT ON TABLE contaazul_pessoas IS 
'[ATIVO_SEM_DADOS] Pessoas da integração ContaAzul. Tem código ativo em contaazul-sync Edge Function mas nunca foi populada (0 registros). Integração ContaAzul não está sincronizando pessoas.';

-- =====================================================
-- RESUMO DA AUDITORIA
-- =====================================================
-- Total de tabelas auditadas: 30
-- 
-- Classificação:
-- - ATIVAS COM DADOS: 5 tabelas
--   * semanas_referencia (48 registros)
--   * dre_manual (82 registros)
--   * getin_units (1 registro)
--   * pessoas_responsaveis (5 registros)
--   * bares (2 registros - mas config real em bares_config)
-- 
-- - ATIVO_SEM_DADOS: 13 tabelas
--   * bar_api_configs, bar_notification_configs, bar_stats
--   * custos_mensais_diluidos
--   * marketing_mensal, crm_segmentacao
--   * notificacoes
--   * contratos_funcionario
--   * agent_insights_v2, insight_events
--   * validacoes_cruzadas
--   * umbler_campanhas, umbler_campanha_destinatarios
--   * nibo_stakeholders, contaazul_pessoas
-- 
-- - DEPRECATED/LEGACY_V1: 11 tabelas
--   * uploads (usa checklist_anexos)
--   * agente_scans, agente_insights (legacy V1)
--   * agente_metricas, agente_memoria_vetorial
--   * agente_conversas, agente_feedbacks
--   * agente_regras_dinamicas, agente_padroes_detectados
--   * agente_ia_metricas
-- 
-- Recomendações:
-- 1. Consolidar 'bares' com 'bares_config' e remover tabelas relacionadas
-- 2. Remover todas as tabelas agente_* V1 após confirmar que V2 está estável
-- 3. Remover 'uploads' (usa checklist_anexos)
-- 4. Avaliar se features ATIVO_SEM_DADOS serão implementadas ou removidas
-- =====================================================
