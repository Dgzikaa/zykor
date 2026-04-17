# Organização de Schemas do Banco de Dados Zykor

**Data da Migração:** 16 de Abril de 2026

## 📊 Resumo da Estrutura

| Schema | Tabelas | Views | Total | Descrição |
|--------|---------|-------|-------|-----------|
| **bronze** | 9 | 0 | 9 | Dados brutos da camada de ingestão (ContaHub) |
| **silver** | 2 | 0 | 2 | Dados processados e limpos |
| **gold** | 1 | 6 | 7 | Dados analíticos prontos para consumo |
| **integrations** | 29 | 2 | 31 | APIs e sistemas externos |
| **operations** | 22 | 1 | 23 | Operações do bar (eventos, produtos, vendas) |
| **financial** | 14 | 2 | 16 | Gestão financeira e contábil |
| **hr** | 7 | 0 | 7 | Recursos humanos |
| **crm** | 8 | 2 | 10 | Relacionamento com clientes |
| **agent_ai** | 15 | 2 | 17 | Sistema de IA/Agente inteligente |
| **system** | 21 | 0 | 21 | Configurações, logs e controle |
| **meta** | 9 | 1 | 10 | Gestão estratégica e metas |
| **auth_custom** | 7 | 0 | 7 | Autenticação customizada |
| **public** | 0 | 6 | 6 | Views de compatibilidade |

**Total: 166 tabelas + views organizadas**

---

## 🥉 Schema: BRONZE (Dados Brutos)

Camada de ingestão - dados vindos diretamente das APIs sem transformação.

### Tabelas ContaHub:
- `bronze_contahub_avendas_porproduto_analitico` (912k registros)
- `bronze_contahub_avendas_cancelamentos` (26k registros)
- `bronze_contahub_avendas_vendasperiodo` (vazia)
- `bronze_contahub_avendas_vendasdiahoraanalitico` (11k registros)
- `bronze_contahub_financeiro_pagamentosrecebidos` (294k registros)
- `bronze_contahub_produtos_temposproducao` (490k registros)
- `bronze_contahub_operacional_stockout_raw` (24k registros)
- `bronze_contahub_raw_data` (4.8k registros)
- `bronze_processing_control`

---

## 🥈 Schema: SILVER (Dados Processados)

Dados limpos, validados e enriquecidos.

- `silver_contahub_financeiro_pagamentosrecebidos` (3.8k registros)
- `silver_contahub_operacional_stockout_processado` (11k registros)

---

## 🥇 Schema: GOLD (Dados Analíticos)

Agregações, métricas e dados prontos para dashboards.

### Views Analíticas:
- `gold_contahub_avendas_porproduto_analitico`
- `gold_contahub_avendas_vendasperiodo`
- `gold_contahub_produtos_temposproducao`
- `gold_contahub_financeiro_pagamentosrecebidos_resumo`
- `gold_contahub_operacional_stockout_filtrado`
- `gold_contahub_operacional_stockout_por_categoria`

### Tabelas:
- `gold_contahub_operacional_stockout` (55k registros)

---

## 🔌 Schema: INTEGRATIONS (Integrações Externas)

APIs e sistemas externos conectados ao Zykor.

### ContaAzul:
- `contaazul_categorias`
- `contaazul_centros_custo`
- `contaazul_contas_financeiras`
- `contaazul_lancamentos`
- `contaazul_logs_sincronizacao`
- `contaazul_pessoas`

### Sympla:
- `sympla_bilheteria`
- `sympla_eventos`
- `sympla_participantes`
- `sympla_pedidos`

### GetIn:
- `getin_reservas`
- `getin_reservations`
- `getin_sync_logs`
- `getin_units`

### Yuzer:
- `yuzer_eventos`
- `yuzer_fatporhora`
- `yuzer_pagamento`
- `yuzer_produtos`

### Umbler (WhatsApp):
- `umbler_campanha_destinatarios`
- `umbler_campanhas`
- `umbler_config`
- `umbler_conversas`
- `umbler_mensagens`
- `umbler_webhook_logs`

### Outras Integrações:
- `falae_config`, `falae_respostas`
- `google_oauth_tokens`, `google_reviews`, `google_reviews_imports`
- `api_credentials`
- `bar_api_configs`

---

## 🏪 Schema: OPERATIONS (Operações do Bar)

Gestão operacional diária dos bares.

### Configuração:
- `bares`
- `bares_config`
- `bar_artistas`
- `bar_categorias_custo`
- `bar_local_mapeamento`
- `bar_metas_periodo`
- `bar_notification_configs`
- `bar_regras_negocio`

### Eventos:
- `eventos`
- `eventos_base`
- `eventos_base_auditoria`
- `eventos_concorrencia`
- `calendario_operacional`

### Produtos e Vendas:
- `produtos`
- `insumos`
- `vendas_item`
- `faturamento_hora`
- `faturamento_pagamentos`
- `contagem_estoque_insumos`
- `tempos_producao`

### Checklists:
- `checklist_agendamentos`
- `checklist_auto_executions`
- `checklist_automation_logs`

---

## 💰 Schema: FINANCIAL (Financeiro)

Gestão financeira e contábil.

- `lancamentos_financeiros`
- `fp_contas`
- `fp_categorias_template`
- `formas_pagamento`
- `caixa_impostos_movimentos`
- `caixa_investimentos_movimentos`
- `caixa_recebimentos_futuros`
- `caixa_valores_terceiros`
- `dre_manual`
- `cmv_mensal`
- `cmv_semanal`
- `custos_mensais_diluidos`
- `orcamentacao`
- `pix_enviados`
- `simulacoes_cmo`
- `view_dre`

---

## 👥 Schema: HR (Recursos Humanos)

Gestão de pessoas e RH.

- `funcionarios`
- `cargos`
- `areas`
- `contratos_funcionario`
- `folha_pagamento`
- `provisoes_trabalhistas`
- `pesquisa_felicidade`

---

## 🤝 Schema: CRM (Customer Relationship)

Relacionamento com clientes.

- `crm_segmentacao`
- `crm_templates`
- `cliente_estatisticas`
- `cliente_perfil_consumo`
- `nps`
- `nps_agregado_semanal`
- `nps_falae_diario`
- `nps_falae_diario_pesquisa`
- `nps_reservas`
- `voz_cliente`

---

## 🤖 Schema: AGENT_AI (Sistema de IA)

Todas as tabelas do agente inteligente.

- `agent_insights_v2`
- `agente_alertas`
- `agente_aprendizado`
- `agente_configuracoes`
- `agente_conversas`
- `agente_feedbacks`
- `agente_historico`
- `agente_ia_metricas`
- `agente_insights`
- `agente_memoria_vetorial`
- `agente_metricas`
- `agente_padroes_detectados`
- `agente_regras_dinamicas`
- `agente_scans`
- `agente_uso`
- `agente_uso_dashboard`
- `agente_uso_por_hora`

---

## ⚙️ Schema: SYSTEM (Sistema/Infraestrutura)

Configurações, logs e controle do sistema.

- `system_config`
- `system_logs`
- `sync_metadata`
- `sync_contagem_historico`
- `audit_trail`
- `security_events`
- `automation_logs`
- `cron_heartbeats`
- `execucoes_automaticas`
- `dados_bloqueados`
- `discord_webhooks`
- `notificacoes`
- `uploads`
- `alertas_enviados`
- `sistema_alertas`
- `validacao_dados`
- `validacao_dados_diaria`
- `validacoes_cruzadas`
- `recalculo_eventos_log`
- `insight_events`
- `_sync_chunk_progress`

---

## 🎯 Schema: META (Gestão Estratégica)

Metas, planejamento e estratégia.

- `metas_anuais`
- `metas_desempenho`
- `metas_desempenho_historico`
- `organizador_okrs`
- `organizador_visao`
- `desempenho_semanal`
- `marketing_mensal`
- `marketing_semanal`
- `semanas_referencia`
- `periodo`

---

## 🔐 Schema: AUTH_CUSTOM (Autenticação Customizada)

Gestão de usuários e permissões customizada.

- `usuarios`
- `usuarios_bares`
- `empresas`
- `empresa_usuarios`
- `pessoas_responsaveis`
- `grupos`
- `template_tags`

---

## 🔄 Schema: PUBLIC (Views de Compatibilidade)

Views para manter compatibilidade com código legado.

- `contahub_analitico` → `bronze.bronze_contahub_avendas_porproduto_analitico`
- `contahub_cancelamentos` → `bronze.bronze_contahub_avendas_cancelamentos`
- `contahub_fatporhora` → `bronze.bronze_contahub_avendas_vendasdiahoraanalitico`
- `contahub_pagamentos` → `bronze.bronze_contahub_financeiro_pagamentosrecebidos`
- `contahub_periodo` → `bronze.bronze_contahub_avendas_vendasperiodo`
- `contahub_tempo` → `bronze.bronze_contahub_produtos_temposproducao`

---

## 📝 Convenções de Nomenclatura

### Padrão Bronze/Silver/Gold:
- **Bronze**: `bronze_contahub_[dominio]_[entidade]`
  - Exemplo: `bronze_contahub_avendas_porproduto_analitico`
  
### Padrão de Domínios:
- `avendas_*` - Análise de vendas
- `financeiro_*` - Dados financeiros
- `produtos_*` - Produtos e produção
- `operacional_*` - Operações diárias

### CamelCase para Caminhos:
Nomes de tabelas preservam a hierarquia do ContaHub usando CamelCase:
- `AVendas` = A.Vendas
- `PorProduto` = por Produto
- `TemposProducao` = Tempos de Produção

---

## 🔧 Como Acessar as Tabelas

### No Código (Supabase Client):
```typescript
// Acessar tabela no schema bronze
const { data } = await supabase
  .from('bronze_contahub_avendas_porproduto_analitico')
  .select('*');

// Views de compatibilidade (ainda funcionam)
const { data } = await supabase
  .from('contahub_analitico')
  .select('*');
```

### No SQL Editor:
```sql
-- Acessar tabela com schema explícito
SELECT * FROM bronze.bronze_contahub_avendas_porproduto_analitico;

-- Ou usar view de compatibilidade
SELECT * FROM public.contahub_analitico;
```

### No Table Editor:
Agora as tabelas aparecem agrupadas por schema! 🎉

---

## ✅ Benefícios da Nova Organização

1. **Navegação Mais Fácil**: Tabelas agrupadas por domínio de negócio
2. **Arquitetura Clara**: Separação bronze/silver/gold visível
3. **Manutenção Simplificada**: Schemas isolados facilitam backup/restore
4. **Segurança**: Permissões granulares por schema
5. **Compatibilidade**: Views mantêm código legado funcionando
6. **Escalabilidade**: Fácil adicionar novos domínios

---

## 🚀 Próximos Passos

1. ✅ Schemas criados e organizados
2. ✅ Tabelas migradas
3. ✅ Views de compatibilidade criadas
4. ✅ Permissões configuradas
5. ⏳ Atualizar código do frontend para usar novos nomes (opcional)
6. ⏳ Criar migrations versionadas
7. ⏳ Documentar regras de negócio por schema
