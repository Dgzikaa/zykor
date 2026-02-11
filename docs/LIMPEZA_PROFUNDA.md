# Limpeza Profunda do Sistema Zykor

**Data:** 2026-02-10
**Status:** ANÁLISE EM ANDAMENTO

---

## RESUMO GERAL

| Componente | Total | Vazios/Não Usados | Em Uso |
|------------|-------|-------------------|--------|
| Tabelas | 178 | ~103 vazias | ~75 |
| Database Functions | 245 | A analisar | - |
| Cron Jobs | 55 | A analisar | - |
| Edge Functions | 71 | A analisar | - |

---

## 1. TABELAS VAZIAS (0 registros)

### 1.1 SISTEMA AGENTE IA (12 tabelas) - NUNCA USADO
Essas tabelas foram criadas para um sistema de IA que nunca foi implementado:

| Tabela | Propósito Pretendido | Recomendação |
|--------|---------------------|--------------|
| `agente_alertas` | Alertas gerados pelo agente | ❌ REMOVER |
| `agente_aprendizado` | Machine learning | ❌ REMOVER |
| `agente_configuracoes` | Config do agente | ❌ REMOVER |
| `agente_conversas` | Histórico de conversas | ❌ REMOVER |
| `agente_feedbacks` | Feedback dos usuários | ❌ REMOVER |
| `agente_insights` | Insights gerados | ❌ REMOVER |
| `agente_memoria_vetorial` | Embeddings/vetores | ❌ REMOVER |
| `agente_metricas` | Métricas do agente | ❌ REMOVER |
| `agente_padroes_detectados` | Padrões identificados | ❌ REMOVER |
| `agente_regras_dinamicas` | Regras dinâmicas | ❌ REMOVER |
| `agente_scans` | Scans do agente | ❌ REMOVER |
| `agente_ia_metricas` | Métricas IA | ❌ REMOVER |

**NOTA:** `agente_uso` (251 registros) e `agente_historico` (502 registros) estão em uso - MANTER

### 1.2 SISTEMA CHECKLISTS (7 tabelas) - NUNCA USADO
Sistema de checklists que foi criado mas nunca implementado no frontend:

| Tabela | Propósito | Recomendação |
|--------|-----------|--------------|
| `checklists` | Definição de checklists | ❌ REMOVER |
| `checklist_funcionario` | Vínculo funcionário | ❌ REMOVER |
| `checklist_itens` | Itens do checklist | ❌ REMOVER |
| `checklist_secoes` | Seções | ❌ REMOVER |
| `checklist_executions` | Execuções | ❌ REMOVER |
| `checklist_schedules` | Agendamentos | ❌ REMOVER |
| `auditoria_checklists` | Auditoria | ❌ REMOVER |

**NOTA:** `checklist_agendamentos` (6101), `checklist_auto_executions` (6101), `checklist_automation_logs` (6101) estão em uso - MANTER

### 1.3 SISTEMA CRM (4 tabelas) - NUNCA USADO
CRM interno que nunca foi implementado:

| Tabela | Propósito | Recomendação |
|--------|-----------|--------------|
| `crm_campanhas` | Campanhas CRM | ❌ REMOVER |
| `crm_cupons` | Cupons | ❌ REMOVER |
| `crm_envios` | Envios | ❌ REMOVER |
| `crm_segmentacao` | Segmentação | ❌ REMOVER |

**NOTA:** `crm_templates` (8 registros) está em uso - MANTER

### 1.4 SISTEMA WHATSAPP INTERNO (5 tabelas) - REDUNDANTE COM UMBLER
Sistema WhatsApp que foi substituído pelo Umbler:

| Tabela | Propósito | Recomendação |
|--------|-----------|--------------|
| `whatsapp_configuracoes` | Configurações | ❌ REMOVER |
| `whatsapp_contatos` | Contatos | ❌ REMOVER |
| `whatsapp_mensagens` | Mensagens | ❌ REMOVER |
| `whatsapp_messages` | Duplicado | ❌ REMOVER |
| `whatsapp_templates` | Templates | ❌ REMOVER |

**NOTA:** Tabelas `umbler_*` estão em uso (13k+ conversas, 21k+ mensagens) - MANTER

### 1.5 SISTEMA FINANCEIRO PLUGGY (7 tabelas) - NUNCA USADO
Integração Pluggy que nunca foi ativada:

| Tabela | Propósito | Recomendação |
|--------|-----------|--------------|
| `fp_categorias` | Categorias FP | ❌ REMOVER |
| `fp_transacoes` | Transações | ❌ REMOVER |
| `fp_regras_categoria` | Regras | ❌ REMOVER |
| `fp_pluggy_items` | Items Pluggy | ❌ REMOVER |
| `fp_pluggy_sync_log` | Logs sync | ❌ REMOVER |
| `fp_pluggy_webhooks` | Webhooks | ❌ REMOVER |
| `fp_categoria_pluggy_mapping` | Mapeamento | ❌ REMOVER |

**NOTA:** `fp_contas` (1 registro) e `fp_categorias_template` (33 registros) estão em uso - MANTER

### 1.6 SISTEMA PRODUÇÃO/RECEITAS (9 tabelas) - NUNCA USADO
Sistema de fichas técnicas/receitas que nunca foi implementado:

| Tabela | Propósito | Recomendação |
|--------|-----------|--------------|
| `receitas` | Receitas | ❌ REMOVER |
| `receitas_insumos` | Insumos da receita | ❌ REMOVER |
| `receitas_historico` | Histórico | ❌ REMOVER |
| `insumos` | Insumos | ❌ REMOVER |
| `insumos_historico` | Histórico | ❌ REMOVER |
| `producoes` | Produções | ❌ REMOVER |
| `producoes_insumos` | Insumos usados | ❌ REMOVER |
| `producao_insumos_calculados` | Cálculos | ❌ REMOVER |
| `estoque_insumos` | Estoque | ❌ REMOVER |

### 1.7 SISTEMA ESTOQUE (4 tabelas) - NUNCA USADO

| Tabela | Propósito | Recomendação |
|--------|-----------|--------------|
| `estoque_alertas` | Alertas estoque | ❌ REMOVER |
| `estoque_movimentacoes` | Movimentações | ❌ REMOVER |
| `contagem_estoque_produtos` | Contagem produtos | ❌ REMOVER |
| `contagem_estoque_historico` | Histórico contagem | ❌ REMOVER |

**NOTA:** `contagem_estoque_insumos` (342 registros) está em uso - MANTER

### 1.8 SISTEMA BACKUP (2 tabelas) - NUNCA USADO

| Tabela | Propósito | Recomendação |
|--------|-----------|--------------|
| `backups` | Backups | ❌ REMOVER |
| `backup_configuracoes` | Config backups | ❌ REMOVER |

### 1.9 SISTEMA SEGURANÇA (4 tabelas) - PARCIALMENTE USADO

| Tabela | Registros | Recomendação |
|--------|-----------|--------------|
| `security_metrics` | 0 | ❌ REMOVER |
| `security_config_pending` | 0 | ❌ REMOVER |
| `security_audit_results` | 0 | ❌ REMOVER |
| `security_monitoring` | 0 | ❌ REMOVER |

**NOTA:** `security_events` (20 registros) está em uso - MANTER

### 1.10 SISTEMA USUÁRIOS/SESSÕES (5 tabelas) - VAZIAS

| Tabela | Propósito | Recomendação |
|--------|-----------|--------------|
| `profiles` | Perfis usuário | ⚠️ AVALIAR |
| `user_lgpd_settings` | LGPD | ❌ REMOVER |
| `user_settings` | Configurações | ❌ REMOVER |
| `user_sessions` | Sessões | ❌ REMOVER |
| `user_bars` | Vínculo user-bar | ⚠️ AVALIAR |

### 1.11 OUTRAS TABELAS VAZIAS

| Tabela | Propósito | Recomendação |
|--------|-----------|--------------|
| `notifications` | Notificações antigas | ❌ REMOVER (usar `notificacoes`) |
| `notificacoes` | Notificações novas | ✅ MANTER (sistema chamados) |
| `chamados` | Sistema chamados | ✅ MANTER (recém criado) |
| `chamados_mensagens` | Mensagens | ✅ MANTER |
| `chamados_historico` | Histórico | ✅ MANTER |
| `uploads` | Uploads | ❌ REMOVER |
| `logs_sistema` | Logs antigos | ❌ REMOVER |
| `cmv_manual` | CMV manual | ❌ REMOVER |
| `dre_manual` | DRE manual | ❌ REMOVER |
| `template_tags` | Tags template | ❌ REMOVER |
| `calendario_historico` | Histórico calendário | ❌ REMOVER |
| `areas_contagem` | Áreas contagem | ❌ REMOVER |
| `pessoas_responsaveis` | Responsáveis | ❌ REMOVER |
| `validacoes_cruzadas` | Validações | ❌ REMOVER |
| `bars` | Bars legado | ❌ REMOVER (usar empresas) |
| `permanent_tokens` | Tokens | ❌ REMOVER |
| `processing_cache` | Cache | ❌ REMOVER |
| `custos_mensais_diluidos` | Custos diluídos | ❌ REMOVER |
| `semanas_referencia` | Semanas ref | ❌ REMOVER |
| `lgpd_audit_log` | LGPD | ❌ REMOVER |
| `bar_api_configs` | API configs | ❌ REMOVER |
| `bar_notification_configs` | Notif configs | ❌ REMOVER |
| `bar_stats` | Stats bar | ❌ REMOVER |
| `falae_respostas` | Respostas falae | ⚠️ AVALIAR |

---

## 2. TABELAS POUCO USADAS (< 10 registros)

| Tabela | Registros | Recomendação |
|--------|-----------|--------------|
| `falae_config` | 1 | ✅ MANTER |
| `google_oauth_tokens` | 1 | ✅ MANTER |
| `umbler_config` | 1 | ✅ MANTER |
| `empresas` | 1 | ✅ MANTER |
| `usuarios` | 1 | ✅ MANTER |
| `empresa_usuarios` | 1 | ✅ MANTER |
| `yuzer_eventos` | 2 | ⚠️ AVALIAR |
| `calendario_operacional` | 3 | ⚠️ AVALIAR |
| `api_credentials` | 3 | ✅ MANTER |
| `grupos` | 3 | ✅ MANTER |
| `formas_pagamento` | 4 | ✅ MANTER |
| `produtos` | 9 | ✅ MANTER |

---

## 3. CRON JOBS - ANÁLISE DETALHADA

### 3.1 CRONS QUE CHAMAM FUNCTIONS SQL DIRETAS
Estes chamam functions no banco - precisamos verificar se as functions existem:

| Job | Schedule | Function | Status |
|-----|----------|----------|--------|
| `advanced-health-check` | 8,14,20h | `advanced_system_health()` | A VERIFICAR |
| `auditoria_automatica_eventos` | 23h | `executar_auditoria_automatica()` | A VERIFICAR |
| `bloquear_dados_antigos` | 6h | `bloquear_dados_antigos()` | A VERIFICAR |
| `cleanup-cache` | 3h | `cleanup_expired_cache()` | A VERIFICAR |
| `compress-old-data` | DOM 2h | `compress_old_raw_data()` | A VERIFICAR |
| `eventos_cache_refresh_diario` | 2h | `refresh_eventos_cache()` | A VERIFICAR |
| `eventos_cache_refresh_mes_atual` | */6h | `refresh_eventos_cache_mes()` | A VERIFICAR |
| `getin-continuous-sync-corrected` | */2h | `sync_getin_continuous()` | A VERIFICAR |
| `limpeza-logs-pgcron` | 5h | `limpar_logs_antigos()` | ✅ CRIADO |
| `manutencao-semanal-banco` | DOM 4h | `manutencao_semanal_banco()` | A VERIFICAR |
| `nibo-monthly-validation` | 28-31 23h | `sync_nibo_monthly_validation_conditional()` | A VERIFICAR |
| `processar-eventos-diario` | 8h | `processar_eventos_diario_cron()` | A VERIFICAR |
| `recalculo-eventos-8h-brasilia` | 11h | `auto_recalculo_eventos_pendentes()` | A VERIFICAR |
| `recalculo-eventos-continuo` | */2h | `auto_recalculo_eventos_pendentes()` | A VERIFICAR |
| `refresh_view_visao_geral_anual_diaria` | 3h | REFRESH MATERIALIZED VIEW | ✅ OK |
| `refresh_view_visao_geral_trimestral_horaria` | */1h | REFRESH MATERIALIZED VIEW | ✅ OK |
| `sync-cliente-estatisticas-diario` | 9h | `sync_cliente_estatisticas_job()` | A VERIFICAR |
| `sync-contagem-diaria` | 21h | `trigger_sync_contagem_sheets()` | A VERIFICAR |
| `validacao_diaria_dados` | 11h | `executar_validacao_diaria()` | A VERIFICAR |
| `verificacao_diaria_confiabilidade` | 9h | `verificacao_diaria_confiabilidade()` | A VERIFICAR |

### 3.2 CRONS QUE CHAMAM EDGE FUNCTIONS
Estes chamam Edge Functions via HTTP:

| Job | Schedule | Edge Function | Bar ID |
|-----|----------|---------------|--------|
| `agente-analise-diaria` | 13h | `agente-analise-diaria` | 3 |
| `agente-analise-mensal` | 2º dia 11h | `agente-analise-mensal` | 3 |
| `agente-analise-semanal` | SEG 11h | `agente-analise-semanal` | 3 |
| `alertas-proativos-manha` | 11h | `alertas-proativos` | 3 |
| `alertas-proativos-tarde` | 21h | `alertas-proativos` | 3 |
| `checklist-auto-scheduler` | */15min | `checklist-auto-scheduler` | - |
| `cmv-semanal-automatico` | 10h | `cmv-semanal-auto` | 3 |
| `cmv-semanal-automatico-deboche` | 11h | `cmv-semanal-auto` | 4 |
| `contahub-sync-diario-7h-brasilia` | 10h | `contahub-sync-automatico` | 3 |
| `contahub-sync-diario-deboche` | 10h15 | `contahub-sync-automatico` | 4 |
| `contahub-weekly-resync` | SEG 9h | `contahub-sync-retroativo` | 3 |
| `contahub-weekly-resync-deboche` | SEG 9h30 | `contahub-sync-retroativo` | 4 |
| `desempenho-semanal-automatico` | 12h | `desempenho-semanal-auto` | 3 |
| `desempenho-semanal-automatico-deboche` | 12h30 | `desempenho-semanal-auto` | 4 |
| `google-reviews-daily-sync` | 9h | `google-reviews-apify-sync` | 3 |
| `monitor-concorrencia-diario` | 9h | `monitor-concorrencia` | - |
| `nibo-sync-diario-10h` | 13h | `nibo-sync` | 3 |
| `nibo-sync-diario-deboche` | 13h15 | `nibo-sync` | 4 |
| `nibo-sync-evening` | 22h | `nibo-sync-cron` | - |
| `nibo-sync-morning` | 10h | `nibo-sync-cron` | - |
| `processar_alertas_discord` | */15min | `alertas-discord` | 3 |
| `recalcular-desempenho-semanal` | SEG 11h | `desempenho-semanal-auto` | 3 |
| `relatorio_matinal_discord` | 10h | `alertas-discord` | 3 |
| `relatorio-metas-semanal` | SEG 12h | `agente-metas` | 3 |
| `stockout-sync-diario-correto` | 23h | `contahub-stockout-sync` | 3 |
| `stockout-sync-diario-deboche` | 23h15 | `contahub-stockout-sync` | 4 |
| `sympla-sync-semanal` | SEG 9h | `sympla-sync` | 3 |
| `sync-conhecimento-diario` | 9h | `sync-conhecimento` | 3 |
| `sync-contagem-diaria-deboche` | 21h15 | `sync-contagem-sheets` | 4 |
| `sync-eventos-7h30-brasilia` | 10h30 | `sync-eventos-automatico` | - |
| `sync-fichas-tecnicas-diario` | 19h30 | `sync-fichas-tecnicas` | - |
| `sync-insumos-receitas-diario` | 6h | `sync-insumos-receitas` | - |
| `sync-marketing-meta-diario` | 10h | `sync-marketing-meta` | 3 |
| `sync-nps-diario` | 8h | `sync-nps` | - |
| `sync-nps-reservas-diario` | 8h05 | `sync-nps-reservas` | - |
| `sync-orcamentacao-diario` | 9h | `sync-orcamentacao-sheets` | - |
| `sync-pesquisa-felicidade-semanal` | TER 13h | `sync-pesquisa-felicidade` | - |
| `sync-voz-cliente-diario` | 5h30 | `sync-voz-cliente` | - |
| `umbler-sync-diario` | 9h | `umbler-sync-incremental` | 3 |
| `yuzer-sync-semanal` | SEG 9h30 | `yuzer-sync` | 3 |

### 3.3 ANÁLISE DE REDUNDÂNCIAS

**NIBO SYNC - 4 jobs diferentes!**
- `nibo-sync-diario-10h` (13h) - bar 3
- `nibo-sync-diario-deboche` (13h15) - bar 4
- `nibo-sync-evening` (22h) - todos?
- `nibo-sync-morning` (10h) - todos?

**SUGESTÃO:** Consolidar em 2 jobs (um por bar)

**CONTAHUB - Muita redundância**
- `contahub-sync-diario-*` - 2 bars
- `contahub-weekly-resync-*` - 2 bars
- `stockout-sync-diario-*` - 2 bars

**AGENTE - Sistema não usado mas crons ativos!**
- `agente-analise-diaria`
- `agente-analise-semanal`
- `agente-analise-mensal`

**SUGESTÃO:** Se sistema agente não está em uso, desativar esses crons

---

## 4. DATABASE FUNCTIONS

Total: **245 functions**

### 4.1 Functions Chamadas pelos Crons (TODAS EXISTEM ✅)

| Function | Propósito |
|----------|-----------|
| `advanced_system_health` | Health check do sistema |
| `auto_recalculo_eventos_pendentes` | Recalcula eventos pendentes |
| `bloquear_dados_antigos` | Bloqueia dados para edição |
| `cleanup_expired_cache` | Limpa cache expirado |
| `compress_old_raw_data` | Comprime dados antigos |
| `executar_auditoria_automatica` | Auditoria de eventos |
| `executar_validacao_diaria` | Validação de dados |
| `limpar_logs_antigos` | Limpa logs (CRIADO NESTA SESSÃO) |
| `manutencao_semanal_banco` | Manutenção do banco |
| `processar_eventos_diario_cron` | Processa eventos |
| `refresh_eventos_cache` | Atualiza cache de eventos |
| `refresh_eventos_cache_mes` | Atualiza cache do mês |
| `sync_cliente_estatisticas_job` | Sincroniza estatísticas |
| `sync_getin_continuous` | Sync GetIn contínuo |
| `sync_nibo_monthly_validation_conditional` | Validação NIBO mensal |
| `trigger_sync_contagem_sheets` | Trigger sync contagem |
| `verificacao_diaria_confiabilidade` | Verifica confiabilidade |

### 4.2 Functions que Podem ser Removidas

Precisamos analisar as 245 functions para identificar:
- Triggers sem tabelas (tabelas foram removidas)
- Functions de sistemas não usados (agente IA, checklists, etc)
- Functions duplicadas

---

## 5. EDGE FUNCTIONS

Total: **71 Edge Functions** (todas ativas)

### 5.1 Edge Functions Chamadas pelos Crons (TODAS EXISTEM ✅)

| Function | Chamada Por | Status |
|----------|-------------|--------|
| `agente-analise-diaria` | cron | ⚠️ SISTEMA NÃO USADO |
| `agente-analise-mensal` | cron | ⚠️ SISTEMA NÃO USADO |
| `agente-analise-semanal` | cron | ⚠️ SISTEMA NÃO USADO |
| `agente-metas` | cron | ⚠️ SISTEMA NÃO USADO |
| `alertas-discord` | cron | ✅ EM USO |
| `alertas-proativos` | cron | ⚠️ VERIFICAR |
| `checklist-auto-scheduler` | cron | ⚠️ TABELAS VAZIAS |
| `cmv-semanal-auto` | cron | ✅ EM USO |
| `contahub-stockout-sync` | cron | ✅ EM USO |
| `contahub-sync-automatico` | cron | ✅ EM USO |
| `contahub-sync-retroativo` | cron | ✅ EM USO |
| `desempenho-semanal-auto` | cron | ✅ EM USO |
| `google-reviews-apify-sync` | cron | ✅ EM USO |
| `monitor-concorrencia` | cron | ✅ EM USO |
| `nibo-sync` | cron | ✅ EM USO |
| `nibo-sync-cron` | cron | ✅ EM USO |
| `sympla-sync` | cron | ✅ EM USO |
| `sync-conhecimento` | cron | ⚠️ SISTEMA NÃO USADO |
| `sync-contagem-sheets` | cron | ✅ EM USO |
| `sync-eventos-automatico` | cron | ✅ EM USO |
| `sync-fichas-tecnicas` | cron | ⚠️ TABELAS VAZIAS |
| `sync-insumos-receitas` | cron | ⚠️ TABELAS VAZIAS |
| `sync-marketing-meta` | cron | ✅ EM USO |
| `sync-nps` | cron | ✅ EM USO |
| `sync-nps-reservas` | cron | ✅ EM USO |
| `sync-orcamentacao-sheets` | cron | ✅ EM USO |
| `sync-pesquisa-felicidade` | cron | ✅ EM USO |
| `sync-voz-cliente` | cron | ✅ EM USO |
| `umbler-sync-incremental` | cron | ✅ EM USO |
| `yuzer-sync` | cron | ✅ EM USO |

### 5.2 Edge Functions do Sistema Agente (13 functions) - NÃO USADO

| Function | Recomendação |
|----------|--------------|
| `agente-analise-diaria` | ❌ REMOVER |
| `agente-analise-mensal` | ❌ REMOVER |
| `agente-analise-semanal` | ❌ REMOVER |
| `agente-analise-periodos` | ❌ REMOVER |
| `agente-auditor` | ❌ REMOVER |
| `agente-chat` | ❌ REMOVER |
| `agente-comparacao` | ❌ REMOVER |
| `agente-custos` | ❌ REMOVER |
| `agente-feedback` | ❌ REMOVER |
| `agente-ia-analyzer` | ❌ REMOVER |
| `agente-mapeador-tabelas` | ❌ REMOVER |
| `agente-metas` | ❌ REMOVER |
| `agente-planejamento` | ❌ REMOVER |
| `agente-sql-expert` | ⚠️ MANTER (útil para consultas) |
| `agente-supervisor` | ❌ REMOVER |
| `agente-treinamento` | ❌ REMOVER |
| `alertas-inteligentes` | ❌ REMOVER |
| `sync-conhecimento` | ❌ REMOVER |

### 5.3 Edge Functions de Sistemas Nunca Usados

| Function | Sistema | Recomendação |
|----------|---------|--------------|
| `sync-fichas-tecnicas` | Receitas | ❌ REMOVER |
| `sync-insumos-receitas` | Receitas | ❌ REMOVER |
| `atualizar-fichas-tecnicas` | Receitas | ❌ REMOVER |
| `detectar-anomalias-preco` | Análise | ❌ REMOVER |
| `sync-contagem-retroativo` | Contagem | ⚠️ AVALIAR |

---

## RESUMO PARA DECISÃO

### REMOVER IMEDIATAMENTE (sem impacto):

**Tabelas Vazias (65+ tabelas):**
- Todas as tabelas do sistema Agente IA (12)
- Todas as tabelas de Checklists internos (7)
- Todas as tabelas CRM interno (4)
- Todas as tabelas WhatsApp interno (5)
- Todas as tabelas Pluggy (7)
- Todas as tabelas Produção/Receitas (9)
- Todas as tabelas Estoque não usadas (4)
- Todas as tabelas Backup (2)
- Todas as tabelas Segurança não usadas (4)
- Outras tabelas vazias (10+)

**Cron Jobs (8 jobs):**
- `agente-analise-diaria`
- `agente-analise-mensal`
- `agente-analise-semanal`
- `checklist-auto-scheduler`
- `sync-fichas-tecnicas-diario`
- `sync-insumos-receitas-diario`
- `sync-conhecimento-diario`
- `relatorio-metas-semanal` (usa agente-metas)

**Edge Functions (18+ functions):**
- Todas as 16 functions do sistema Agente
- Functions de Receitas/Fichas (3)

### CONSOLIDAR:

**Cron Jobs NIBO:**
- Manter: `nibo-sync-diario-10h` e `nibo-sync-diario-deboche`
- Remover: `nibo-sync-evening` e `nibo-sync-morning` (redundantes)

---

## PRÓXIMOS PASSOS

1. **AGUARDANDO APROVAÇÃO:** Remover 65+ tabelas vazias?
2. **AGUARDANDO APROVAÇÃO:** Desativar 8 cron jobs de sistemas não usados?
3. **AGUARDANDO APROVAÇÃO:** Remover 18+ Edge Functions não usadas?
4. **AGUARDANDO APROVAÇÃO:** Consolidar crons NIBO?

---

*Documento atualizado - 2026-02-10*

