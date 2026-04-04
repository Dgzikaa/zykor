# 🗺️ MAPEAMENTO COMPLETO DA ARQUITETURA ATUAL

**Data**: 03/03/2026
**Status**: 🔴 PRECISA DE REFATORAÇÃO COMPLETA

---

## 📊 INVENTÁRIO ATUAL

### Edge Functions (19 ativas)

| # | Nome | Path | O que faz | Usado? |
|---|------|------|-----------|---------|
| 1 | agente-dispatcher | `backend/supabase/functions/agente-dispatcher/` | Análises IA (diária, semanal, mensal) | ✅ SIM |
| 2 | alertas-dispatcher | `backend/supabase/functions/alertas-dispatcher/` | Alertas proativos, relatórios | ✅ SIM |
| 3 | integracao-dispatcher | `backend/supabase/functions/integracao-dispatcher/` | Yuzer, Sympla, GetIn, NIBO | ✅ SIM |
| 4 | sync-dispatcher | `backend/supabase/functions/sync-dispatcher/` | Sync eventos, marketing, clientes | ✅ SIM |
| 5 | discord-dispatcher | `backend/supabase/functions/discord-dispatcher/` | Notificações Discord | ✅ SIM |
| 6 | webhook-dispatcher | `backend/supabase/functions/webhook-dispatcher/` | Webhooks externos | ⚠️ POUCO |
| 7 | contahub-sync | `backend/supabase/functions/contahub-sync/` | Sync ContaHub (7 tipos de dados) | ✅ SIM |
| 8 | contahub-stockout-sync | `backend/supabase/functions/contahub-stockout-sync/` | Sync stockout específico | ✅ SIM |
| 9 | google-sheets-sync | `backend/supabase/functions/google-sheets-sync/` | NPS, insumos, receitas | ✅ SIM |
| 10 | recalcular-desempenho-auto | `backend/supabase/functions/recalcular-desempenho-auto/` | **ATUALIZA desempenho_semanal** | ✅ SIM |
| 11 | cmv-semanal-auto | `backend/supabase/functions/cmv-semanal-auto/` | Atualiza CMV semanal | ✅ SIM |
| 12 | nibo-sync | `backend/supabase/functions/nibo-sync/` | Sync NIBO | ✅ SIM |
| 13 | getin-sync-continuous | `backend/supabase/functions/getin-sync-continuous/` | GetIn contínuo | ⚠️ POUCO |
| 14 | monitor-concorrencia | `backend/supabase/functions/monitor-concorrencia/` | Monitor competidores | ⚠️ POUCO |
| 15 | google-reviews-apify-sync | `backend/supabase/functions/google-reviews-apify-sync/` | Reviews Google/TripAdvisor | ✅ SIM |
| 16 | checklist-auto-scheduler | `backend/supabase/functions/checklist-auto-scheduler/` | Agenda checklists | ✅ SIM |
| 17 | atualizar-fichas-tecnicas | `backend/supabase/functions/atualizar-fichas-tecnicas/` | Fichas técnicas produtos | ⚠️ POUCO |
| 18 | relatorio-pdf | `backend/supabase/functions/relatorio-pdf/` | Gera PDFs (semanal, executivo, CMV) | ✅ SIM (frontend + dispatchers) |
| 19 | contahub-sync-automatico | `backend/supabase/functions/contahub-sync-automatico/` | Sync ContaHub (ativo, substitui contahub-sync) | ✅ SIM |

### Cron Jobs (27 ativos)

| # | Nome | Schedule | Chama | Obs |
|---|------|----------|-------|-----|
| 1 | agente-analise-diaria | `0 9 * * *` (9h) | agente-dispatcher | ✅ |
| 2 | agente-analise-semanal | `0 10 * * 1` (2ª 10h) | agente-dispatcher | ✅ |
| 3 | agente-analise-mensal | `0 10 1 * *` (dia 1, 10h) | agente-dispatcher | ✅ |
| 4 | agente-exploracao-diario | `0 9 * * *` (9h) | API exploracao/agente-diario | ✅ |
| 5 | agente-exploracao-semanal | `0 10 * * 1` (2ª 10h) | API exploracao/agente-diario | ✅ |
| 6 | agente-exploracao-mensal | `0 11 1 * *` (dia 1, 11h) | API exploracao/agente-diario | ✅ |
| 7 | alertas-proativos-manha | `0 9 * * *` (9h) | alertas-dispatcher | ✅ |
| 8 | alertas-proativos-tarde | `0 15 * * *` (15h) | alertas-dispatcher | ✅ |
| 9 | relatorio_matinal_discord | `0 8 * * *` (8h) | alertas-dispatcher | ✅ |
| 10 | processar_alertas_discord | `*/30 * * * *` (30/30min) | alertas-dispatcher | ⚠️ MUITO |
| 11 | contahub-sync-7h-ambos | `0 10 * * *` (10h) | Função SQL sync_contahub_ambos_bares | ✅ |
| 12 | contahub-processor-diario-ordinario | `30 10 * * *` (10h30) | Edge contahub-processor | ❌ NÃO EXISTE |
| 13 | contahub-processor-diario-deboche | `45 10 * * *` (10h45) | Edge contahub-processor | ❌ NÃO EXISTE |
| 14 | contahub-weekly-resync | `0 9 * * 1` (2ª 9h) | contahub-sync retroativo | ✅ |
| 15 | contahub-weekly-resync-deboche | `30 9 * * 1` (2ª 9h30) | contahub-sync retroativo | ✅ |
| 16 | contahub-update-eventos-ambos | `0 11 * * *` (11h) | Função SQL update_eventos_ambos_bares | ✅ |
| 17 | auto-recalculo-eventos-pos-contahub | `30 11 * * *` (11h30) | Função SQL auto_recalculo_eventos_pendentes | ✅ |
| 18 | **desempenho-auto-diario** | `0 11 * * *` (11h) | **executar_recalculo_desempenho_auto** | ✅ |
| 19 | **desempenho-auto-segunda** | `0 12 * * 1` (2ª 12h) | **executar_recalculo_desempenho_auto** | ✅ |
| 20 | cmv-semanal-auto-ambos | `0 11 * * *` (11h) | Função SQL executar_cmv_ambos_bares | ✅ |
| 21 | nibo-sync-10h-ambos | `0 13 * * *` (13h) | Função SQL executar_nibo_sync_ambos_bares | ✅ |
| 22 | nibo-sync-19h-ambos | `0 22 * * *` (22h) | Função SQL executar_nibo_sync_ambos_bares | ✅ |
| 23 | stockout-sync-diario-correto | `0 22 * * *` (22h) | contahub-stockout-sync | ✅ |
| 24 | stockout-sync-diario-deboche | `5 22 * * *` (22h05) | contahub-stockout-sync | ✅ |
| 25 | google-sheets-sync-diario | `0 8 * * *` (8h) | google-sheets-sync | ✅ |
| 26 | google-reviews-daily-sync | `0 12 * * *` (12h) | google-reviews-apify-sync | ✅ |
| 27 | getin-sync-continuo | `0 */2 * * *` (2/2h) | integracao-dispatcher | ⚠️ MUITO |
| 28 | sync-eventos-diario | `30 10 * * *` (10h30) | sync-dispatcher | ✅ |
| 29 | sync-marketing-meta-diario | `0 12 * * *` (12h) | sync-dispatcher | ✅ |
| 30 | sync-cliente-estatisticas-diario | `0 9 * * *` (9h) | sync-dispatcher | ✅ |
| 31 | sympla-sync-semanal | `0 8 * * 1` (2ª 8h) | integracao-dispatcher | ✅ |
| 32 | yuzer-sync-semanal | `0 8 * * 1` (2ª 8h) | integracao-dispatcher | ✅ |
| 33 | atualizar-sympla-yuzer-diario | `0 10 * * 1` (2ª 10h) | Função SQL update_eventos_base_with_sympla_yuzer | ✅ |
| 34 | eventos_cache_refresh_diario | `30 8 * * *` (8h30) | Função SQL refresh_eventos_cache | ✅ |
| 35 | eventos_cache_refresh_mes_atual | `0 11,17,23 * * *` (3x/dia) | Função SQL refresh_eventos_cache_mes | ✅ |
| 36 | refresh_view_visao_geral_trimestral | `0 3 * * *` (3h) | REFRESH MATERIALIZED VIEW | ✅ |
| 37 | refresh_view_visao_geral_anual | `0 3 * * *` (3h) | REFRESH MATERIALIZED VIEW | ✅ |
| 38 | limpeza-logs-pgcron | `0 5 * * *` (5h) | Função SQL limpar_logs_antigos | ✅ |

---

## 🚨 PROBLEMAS IDENTIFICADOS

### 1. Edge Functions Duplicadas
- ✅ **RESOLVIDO**: `contahub-sync` arquivado em `_archived/`, `contahub-sync-automatico` é o ativo

### 2. Edge Functions que não existem mas são chamadas
- ❌ `contahub-processor` (chamado por crons 12 e 13) - **NÃO EXISTE!**

### 3. Cron Jobs com frequência excessiva
- `processar_alertas_discord` (30/30 min) - **MUITO FREQUENTE**
- `getin-sync-continuo` (2/2h) - **PODE SER MENOS**

### 4. Sobreposição de horários (11h)
Às 11h executam SIMULTANEAMENTE:
- desempenho-auto-diario
- cmv-semanal-auto-ambos
- contahub-update-eventos-ambos
- eventos_cache_refresh_mes_atual

**RISCO**: Conflitos de dados, race conditions

### 5. Função de Desempenho INCOMPLETA
`recalcular-desempenho-auto/index.ts`:
- ✅ Calcula: faturamento, clientes, ticket, metas, stockout, mix %
- ❌ **NÃO calcula**: tempos, atrasos, quantidade de itens
- ❌ **NÃO calcula**: 30+ outros campos (CMV, CMO, retenção, etc)

---

## 🎯 O QUE ESTÁ FALTANDO NO zykor-context.md

### ❌ Falta Documentar:

1. **Regras de Negócio de Atrasos**
   - Definição: atrasinho vs atraso vs atrasão
   - Limites em segundos/minutos
   - Como agregar semanalmente

2. **Regras de % Mix**
   - Como calcular % bebidas/drinks/comida
   - Média ponderada pelo faturamento
   - Tratamento de dias atípicos (Carnaval)

3. **Regras de Happy Hour**
   - O que conta como happy hour
   - Como é calculado o %
   - Horários de happy hour

4. **Regras de Stockout**
   - Produtos excluídos ([HH], [DD], [IN])
   - Como calcular %
   - Categorias (drinks, comidas, bar)

5. **Estrutura Completa de Tabelas**
   - `eventos_base`: TODAS as 50+ colunas explicadas
   - `desempenho_semanal`: TODAS as 70+ colunas explicadas
   - `planejamento_comercial`: TODAS as colunas
   - Relacionamentos entre tabelas

6. **Fórmulas de Cálculo**
   - Como cada métrica é calculada
   - De onde vem cada dado
   - Agregações semanais vs mensais

---

Agora vou criar o documento completo com TODAS as regras de negócio...
