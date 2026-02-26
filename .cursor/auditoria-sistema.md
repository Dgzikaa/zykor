# 🧹 Auditoria Completa do Sistema Zykor

**Data:** 25/02/2026  
**Status:** Em revisão

---

## 📋 Resumo Executivo

- **Total de Cron Jobs**: 31
- **Total de Edge Functions**: 68
- **Problemas identificados**: 5
- **Jobs duplicados**: 3-4 possíveis

---

## ⚠️ PROBLEMAS CRÍTICOS

### 1. Jobs com URL/Token Errado (CORRIGIDOS ✅)
- **Job 197**: `sympla-sync-semanal` - URL e token corrigidos
- **Job 198**: `yuzer-sync-semanal` - URL e token corrigidos

### 2. Token Incorreto
- **Job 217**: `sync-marketing-meta-diario` - Usando ANON key em vez de SERVICE_ROLE

---

## 📊 CRON JOBS ORGANIZADOS POR CATEGORIA

### 🔄 Sincronizações Diárias

#### ContaHub (PDV)
- **Job 157** (10h): `contahub-sync-diario-7h-brasilia` - Ordinário (bar_id: 3)
- **Job 188** (10h15): `contahub-sync-diario-deboche` - Deboche (bar_id: 4)
- **Job 160** (23h): `stockout-sync-diario-correto` - Ordinário
- **Job 191** (23h15): `stockout-sync-diario-deboche` - Deboche

#### Nibo (Contabilidade)
- **Job 156** (13h): `nibo-sync-diario-10h` - Ordinário
- **Job 192** (13h15): `nibo-sync-diario-deboche` - Deboche
- **Job 219** (10h): `nibo-sync-morning` ⚠️ DUPLICADO?
- **Job 220** (22h): `nibo-sync-evening` ⚠️ DUPLICADO?
- **Job 145** (23h): `nibo-monthly-validation` - Validação mensal

#### Sympla/Yuzer (Eventos)
- **Job 197** (9h seg): `sympla-sync-semanal` - Semanal ✅ CORRIGIDO
- **Job 198** (9h30 seg): `yuzer-sync-semanal` - Semanal ✅ CORRIGIDO
- **Job 234** (10h seg): `atualizar-sympla-yuzer-diario` - Atualizar eventos_base

#### Google Sheets
- **Job 229** (8h): `google-sheets-nps-diario`
- **Job 230** (8h05): `google-sheets-nps-reservas-diario`
- **Job 231** (5h30): `google-sheets-voz-cliente-diario`
- **Job 232** (13h ter): `google-sheets-pesquisa-felicidade-semanal`

#### Outros Syncs
- **Job 146** (a cada 2h): `getin-continuous-sync-corrected`
- **Job 171** (6h): `sync-insumos-receitas-diario`
- **Job 172** (19h30): `sync-fichas-tecnicas-diario`
- **Job 165** (21h): `sync-contagem-diaria`
- **Job 193** (21h15): `sync-contagem-diaria-deboche`
- **Job 217** (10h): `sync-marketing-meta-diario` ⚠️ Token ANON
- **Job 218** (9h): `umbler-sync-diario`
- **Job 226** (9h): `sync-orcamentacao-diario`
- **Job 228** (9h): `google-reviews-daily-sync`

### 📊 Processamento e Cálculos

- **Job 132** (8h): `processar-eventos-diario`
- **Job 148** (a cada 2h): `recalculo-eventos-continuo`
- **Job 159** (11h): `recalculo-eventos-8h-brasilia`
- **Job 186** (10h): `cmv-semanal-automatico` - Ordinário
- **Job 189** (11h): `cmv-semanal-automatico-deboche` - Deboche
- **Job 187** (12h): `desempenho-semanal-automatico` - Ordinário
- **Job 190** (12h30): `desempenho-semanal-automatico-deboche` - Deboche
- **Job 225** (11h seg): `recalcular-desempenho-semanal`
- **Job 158** (10h30): `sync-eventos-7h30-brasilia`

### 🔍 Monitoramento e Alertas

- **Job 96** (8h, 14h, 20h): `advanced-health-check`
- **Job 199** (23h): `auditoria_automatica_eventos`
- **Job 200** (9h): `verificacao_diaria_confiabilidade`
- **Job 202** (11h): `validacao_diaria_dados`
- **Job 204** (10h): `relatorio_matinal_discord`
- **Job 206** (a cada 15 min): `processar_alertas_discord`
- **Job 209** (11h): `alertas-proativos-manha`
- **Job 210** (21h): `alertas-proativos-tarde`
- **Job 212** (9h): `monitor-concorrencia-diario`

### 🧹 Manutenção

- **Job 94** (2h dom): `compress-old-data`
- **Job 95** (3h): `cleanup-cache`
- **Job 125** (2h): `eventos_cache_refresh_diario`
- **Job 126** (a cada 6h): `eventos_cache_refresh_mes_atual`
- **Job 117** (3h): `refresh_view_visao_geral_anual_diaria`
- **Job 118** (a cada hora): `refresh_view_visao_geral_trimestral_horaria`
- **Job 195** (4h dom): `manutencao-semanal-banco`
- **Job 196** (5h): `limpeza-logs-pgcron`
- **Job 203** (6h): `bloquear_dados_antigos`

### 📅 Ressincronização Semanal

- **Job 223** (9h seg): `contahub-weekly-resync` - Ordinário
- **Job 224** (9h30 seg): `contahub-weekly-resync-deboche` - Deboche

---

## 🎯 RECOMENDAÇÕES DE LIMPEZA

### ❌ Deletar (Duplicados ou Desnecessários)

1. **Jobs de Nibo duplicados**:
   - Manter: Jobs 156 e 192 (específicos por bar)
   - Deletar: Jobs 219 e 220 (genéricos, podem conflitar)

2. **Jobs de alerta duplicados**:
   - Revisar se Jobs 204, 206, 209, 210 não estão fazendo a mesma coisa

### ⚠️ Revisar

1. **Job 217** - Trocar token ANON por SERVICE_ROLE
2. **Jobs de agente** (13 funções) - Verificar se todos estão sendo usados
3. **Jobs de sync** - Muitos syncs diferentes, verificar se não há overlap

### ✅ Manter

- Jobs de sincronização diária (ContaHub, Nibo, Sympla, Yuzer)
- Jobs de manutenção (cache, logs, compress)
- Jobs de monitoramento (health-check, auditoria)

---

## 📝 PRÓXIMOS PASSOS

1. ✅ Corrigir URLs e tokens dos jobs 197 e 198 (FEITO)
2. ⏳ Corrigir token do job 217
3. ⏳ Desativar/deletar jobs duplicados de Nibo (219, 220)
4. ⏳ Revisar Edge Functions não utilizadas
5. ⏳ Documentar cada job com descrição clara

---

**Quer que eu continue com a limpeza?**
