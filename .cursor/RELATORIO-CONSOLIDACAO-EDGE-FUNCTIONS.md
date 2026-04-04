# 📊 RELATÓRIO: Consolidação de Edge Functions

**Data**: 04/04/2026  
**Objetivo**: Identificar e consolidar Edge Functions duplicadas ou obsoletas

---

## ✅ RESUMO EXECUTIVO

**Resultado**: Sistema já está bem organizado. Apenas 2 funções foram arquivadas previamente e estão corretas.

- ✅ **0 funções precisam ser arquivadas** (já foram arquivadas corretamente)
- ✅ **0 referências precisam ser atualizadas**
- ⚠️ **1 função marcada como "NÃO USADA" está ATIVA** (`relatorio-pdf`)

---

## 🔍 ANÁLISE DETALHADA

### 1. contahub-sync vs contahub-sync-automatico

**Status**: ✅ JÁ RESOLVIDO

- **`contahub-sync`**: Arquivado em `backend/supabase/_archived/functions/contahub-sync/`
  - É apenas um DISPATCHER que redireciona para `contahub-sync-automatico`
  - Não é mais usado diretamente
  
- **`contahub-sync-automatico`**: ✅ ATIVO
  - Função principal de sincronização ContaHub
  - Chamada por `contahub-resync-semanal` (linha 105)
  - Registra heartbeat como `contahub-sync-automatico`

**Ação**: ✅ Nenhuma necessária

---

### 2. recalcular-desempenho-auto vs recalcular-desempenho-v2

**Status**: ✅ JÁ RESOLVIDO

- **`recalcular-desempenho-auto`**: Arquivado em `backend/supabase/_archived/functions/recalcular-desempenho-auto/`
  - Versão antiga do recálculo de desempenho
  - Não é mais usado
  
- **`recalcular-desempenho-v2`**: ✅ ATIVO
  - Versão atual com calculators modulares
  - **Feature Flag**: `ENABLE_V2_WRITE=true` (kill switch)
  - **Modos**: `shadow` (default, apenas compara) e `write` (escreve no banco)
  - Documentação clara no topo do arquivo (linhas 1-27)
  - Chamado por `_shared/agent-tools.ts` (linha 521)

**Ação**: ✅ Nenhuma necessária (já tem comentário explicativo no topo)

---

### 3. relatorio-pdf

**Status**: ⚠️ MARCADO INCORRETAMENTE COMO "NÃO USADO"

**Uso CONFIRMADO**:
1. **Frontend**: `frontend/src/app/api/relatorio/route.ts`
   - Linha 12: POST endpoint
   - Linha 48: GET endpoint
   
2. **Dispatchers**:
   - `unified-dispatcher` (linha 39): action `pdf`
   - `discord-dispatcher` (linha 24): action `pdf`

**Tipos de relatório suportados**:
- `semanal`: Relatório completo da semana
- `executivo`: KPIs resumidos
- `cmv`: Análise de CMV
- `eventos`: Dados de eventos

**Ação**: ⚠️ ATUALIZAR DOCUMENTAÇÃO - Função está ATIVA e em uso

---

### 4. Outras Funções Analisadas

#### 4.1 Funções ContaHub (todas ativas, sem duplicatas)
- ✅ `contahub-sync-automatico` - Sync principal
- ✅ `contahub-processor` - Processa dados raw salvos
- ✅ `contahub-resync-semanal` - Re-sync semanal para capturar lançamentos tardios
- ✅ `contahub-stockout-sync` - Sync de rupturas

#### 4.2 Funções de Sync (todas ativas, sem duplicatas)
- ✅ `sync-dispatcher` - Dispatcher de syncs
- ✅ `sync-cliente-estatisticas` - Cache de clientes
- ✅ `sync-cmo-planilha` - CMO do Google Sheets
- ✅ `sync-cmv-mensal` - CMV mensal
- ✅ `sync-cmv-sheets` - CMV do Google Sheets
- ✅ `sync-contagem-sheets` - Contagem de estoque

#### 4.3 Funções Google Reviews (todas ativas, sem duplicatas)
- ✅ `google-reviews-apify-sync` - Sync diário via Apify
- ✅ `google-reviews-retroativo` - Backfill histórico (usado por script)
- ✅ `google-reviews-callback` - Webhook callback do Apify
- ✅ `google-sheets-sync` - Sync de planilhas Google

#### 4.4 Funções de Agente IA (todas ativas, arquitetura modular)
- ✅ `agente-dispatcher` - Dispatcher principal (análises diária/semanal/mensal)
- ✅ `agente-detector` - Detecta eventos usando regras determinísticas
- ✅ `agente-narrator` - Gera insights usando LLM (Gemini)
- ✅ `agente-pipeline-v2` - Orchestrator (Detector → Narrator → Notificações)

**Arquitetura V2**: Sistema modular bem desenhado, sem duplicatas

---

## 📋 CHECKLIST DE VALIDAÇÃO

- [x] Verificar crons que chamam funções obsoletas
- [x] Verificar referências no código frontend
- [x] Verificar referências em dispatchers
- [x] Verificar funções SQL que chamam edge functions
- [x] Verificar scripts externos
- [x] Validar feature flags documentadas
- [x] Confirmar funções já arquivadas

---

## 🎯 RECOMENDAÇÕES

### Imediatas
1. ✅ **Nenhuma ação necessária** - Sistema já está bem organizado

### Documentação
1. ⚠️ Atualizar `MAPEAMENTO-COMPLETO-ARQUITETURA-ATUAL.md`:
   - Linha 31: Mudar status de `relatorio-pdf` de "❌ NÃO" para "✅ SIM"
   - Adicionar nota: "Usado por frontend (API /relatorio) e dispatchers"

### Manutenção Futura
1. ✅ Manter padrão de arquivamento em `_archived/functions/`
2. ✅ Documentar feature flags no topo dos arquivos (como em `recalcular-desempenho-v2`)
3. ✅ Usar dispatchers para consolidar funções relacionadas (padrão já aplicado)

---

## 📊 ESTATÍSTICAS

- **Total de Edge Functions**: 39
- **Funções Ativas**: 37
- **Funções Arquivadas**: 5 (em `_archived/`)
  - `contahub-sync` (dispatcher obsoleto)
  - `recalcular-desempenho-auto` (versão antiga)
  - `inspect-cmv-headers` (debug)
  - `inspect-cmv-values` (debug)
  - `inspect-sheet` (debug)
- **Funções Duplicadas Encontradas**: 0
- **Funções Marcadas Incorretamente**: 1 (`relatorio-pdf`)

---

## ✅ CONCLUSÃO

O sistema de Edge Functions está **bem organizado e sem duplicatas reais**. As funções que pareciam duplicadas já foram corretamente arquivadas em momento anterior. A única correção necessária é atualizar a documentação para refletir que `relatorio-pdf` está ativa e em uso.

**Nenhuma mudança de código é necessária.**
