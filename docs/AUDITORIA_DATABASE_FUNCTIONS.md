# Auditoria de Database Functions e Código - Zykor

**Data:** 2026-02-10

---

## 1. RESUMO EXECUTIVO

- **Total de funções no schema public:** ~150+
- **Funções chamadas pelo frontend que NÃO existem:** 10+
- **Chamadas RPC incorretas (execute_sql vs exec_sql):** 2 corrigidas
- **Tabelas removidas que ainda são referenciadas:** 2 rotas (whatsapp-config, alertas-inteligentes)

---

## 2. FUNÇÕES RPC USADAS NO FRONTEND - STATUS

### ✅ Existem e funcionam

| Função | Usado em |
|--------|----------|
| `exec_sql` | produtos-completo, cron-jobs, vendas-categorias, health |
| `execute_raw_sql` | timezone/test (corrigido de execute_sql) |
| `calcular_metricas_clientes` | visao-geral, desempenho, clientes-ativos |
| `get_count_base_ativa` | desempenho-mensal-service, planejamento-comercial |
| `calcular_visao_geral_anual` | visao-geral |
| `calcular_visao_geral_trimestral` | visao-geral |
| `calculate_evento_metrics` | planejamento-comercial, eventos |
| `recalcular_eventos_pendentes` | planejamento-comercial, recalcular-eventos-base |
| `calcular_clientes_ativos_faixa` | gestao/desempenho/recalcular |
| `verificacao_diaria_confiabilidade` | saude-dados |
| `executar_validacao_diaria` | saude-dados |
| `validar_contahub_dia` | saude-dados |
| `detectar_anomalias_dia` | saude-dados |
| `bloquear_dados_historicos` | saude-dados |
| `auditoria_semanal_retroativa` | auditoria |
| `auditoria_mensal_retroativa` | auditoria |
| `consultar_auditoria_evento` | auditoria |
| `consultar_auditoria_por_data` | auditoria |
| `limpar_auditoria_antiga` | auditoria |
| `detectar_anomalias_contagem` | ferramentas/contagem-estoque |
| `registrar_validacao_automatica` | contahub/qualidade |

### ❌ NÃO EXISTEM no banco

| Função | Usado em | Ação |
|--------|----------|------|
| `calcular_novos_clientes_por_mes` | visao-geral/novos-clientes | Corrigido: usa fallback direto |
| `execute_sql` | novos-clientes, timezone/test | Corrigido: removido/execute_raw_sql |
| `get_cliente_stats_agregado` | analitico/clientes | Tem fallback - usa query direta quando RPC falha |
| `aggregate_by_date` | estrategico/desempenho | **QUEBRA** - Endpoint vai falhar |
| `recalcular_eventos_periodo` | planejamento-comercial, recalcular-eventos-base | **QUEBRA** - Não existe |
| `calculate_evento_metrics_complete` | recalcular-eventos-base | **QUEBRA** - Existe `calculate_evento_metrics` |
| `get_umbler_getin_cruzamento` | umbler/cruzamento-reservas | **QUEBRA** - Endpoint vai falhar |
| `get_umbler_metricas` | umbler/dashboard | **QUEBRA** - Endpoint vai falhar |
| `increment_contact_stat` | configuracoes/whatsapp/webhook | **QUEBRA** - Tabela whatsapp removida |
| `buscar_comentarios_nps` | nps/agregado | Função auxiliar - nunca chamada, comentários vêm da view |

---

## 3. CORREÇÕES APLICADAS

1. **visao-geral/novos-clientes/route.ts**
   - Removida chamada à `execute_sql` (não existe)
   - Removida tentativa de `calcular_novos_clientes_por_mes` 
   - Usa diretamente fallback com query Supabase quando RPC falha

2. **configuracoes/timezone/test/route.ts**
   - Alterado `execute_sql` → `execute_raw_sql`
   - Parâmetro `sql_query` → `query_text`

3. **configuracoes/whatsapp/webhook/route.ts** (2026-02-10)
   - `processReceivedMessages`: adaptado para usar `umbler_conversas` e `umbler_mensagens` em vez de `whatsapp_contatos`/`whatsapp_mensagens`
   - Try/catch para evitar falha quando tabelas/formato diferem

4. **eventos/recalcular-eventos-base/route.ts** (2026-02-10)
   - `calculate_evento_metrics_complete` → `calculate_evento_metrics` com `evento_id`

5. **estrategico/desempenho/route.ts** (2026-02-10)
   - Removida chamada a `aggregate_by_date` (não existe)
   - Usa diretamente `fetchAllDataFallback`

6. **alertas-inteligentes Edge Function** (2026-02-10)
   - `checklist_execucoes`/`checklist_execucao_itens` → `checklist_agendamentos` e `checklist_automation_logs`

---

## 4. PENDÊNCIAS CRÍTICAS (requerem ação)

### 4.1 Rotas que vão quebrar

| Rota | Problema | Solução sugerida |
|------|----------|------------------|
| `/api/analitico/clientes` | `get_cliente_stats_agregado` não existe | Criar função ou mudar lógica |
| `/api/estrategico/desempenho` | `aggregate_by_date` não existe | Criar função ou usar query direta |
| `/api/estrategico/planejamento-comercial` | `recalcular_eventos_periodo` não existe | Verificar se é `recalcular_eventos_pendentes` |
| `/api/eventos/recalcular-eventos-base` | `calculate_evento_metrics_complete` não existe | Usar `calculate_evento_metrics` |
| `/api/umbler/cruzamento-reservas` | `get_umbler_getin_cruzamento` não existe | Criar função |
| `/api/umbler/dashboard` | `get_umbler_metricas` não existe | Criar função |
| `/api/nps/agregado` | `buscar_comentarios_nps` não existe | Criar função ou query direta |
| `/api/crm/whatsapp-config` | Tabela `whatsapp_configuracoes` foi removida | Desativar rota ou recriar tabela |

### 4.2 Edge Function alertas-inteligentes ✅ CORRIGIDO

- ~~Referencia `checklist_execucoes` e `checklist_execucao_itens`~~
- **Correção aplicada:** Usa `checklist_agendamentos` e `checklist_automation_logs`

---

## 5. CRONS - STATUS

Os crons que usam `google-sheets-sync` foram atualizados na migração, porém:
- **google-sheets-sync, contahub-sync, alertas-unified** NÃO estão deployados no Supabase
- Os crons vão falhar até fazer deploy: `supabase functions deploy google-sheets-sync`

Os crons de ContaHub ainda chamam `contahub-sync-automatico` diretamente (não passaram pelo dispatcher).

---

## 6. FUNÇÕES POSSIVELMENTE ÓRFÃS (nunca chamadas)

Candidatas a análise para remoção (verificar antes):
- `executar_coleta_contaazul_v3_com_discord`
- `executar_coleta_contaazul_v4_com_discord`
- `executar_importacao_retroativa`
- `contahub_weekly_correction`
- `contahub_weekly_correction_with_api`
- `sync_contahub_prodporhora_daily`
- `executar_sync_prodporhora_diario`
- `fix_cron_jobs_admin`
- Múltiplas overloads de `admin_get_api_credentials`
- `importar_proximo_dia_novembro`
- `importar_contagem_direto`
- `importar_lote_historico`
- `importar_mes_retroativo`

---

## 7. RECOMENDAÇÕES

1. **Antes de deploy:** Fazer deploy das novas Edge Functions (google-sheets-sync, contahub-sync, alertas-unified)
2. **Prioridade alta:** Criar ou corrigir as 8 rotas que quebram por funções inexistentes
3. **Prioridade média:** Revisar alertas-inteligentes (referências a tabelas removidas)
4. **Prioridade baixa:** Auditoria das funções órfãs para possível remoção
