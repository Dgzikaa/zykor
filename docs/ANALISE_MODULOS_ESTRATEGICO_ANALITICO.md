# Análise dos Módulos – Estratégico, Analítico, Ferramentas

**Data:** 2026-02-10

Análise módulo a módulo para identificar código duplicado, inconsistências, bugs e sujeira acumulada.

---

## 1. ESTRATÉGICO

### 1.1 Visão Geral

| Item | Status | Detalhe |
|------|--------|---------|
| **Duplicação** | ⚠️ | `getTrimestreDates()` definida em `page.tsx` (linhas 11–20) E em `indicadores-service.ts` (linhas 4–14) – idênticas. O page nem importa o service para isso. |
| **Metas hardcoded** | ⚠️ | `getMetasTrimestre()` no page – metas fixas por trimestre. Poderia ser configurável ou centralizado. |
| **getMesRetencao** | ✅ | Lógica complexa, mas isolada. |
| **RPCs** | ⚠️ | Depende de `calcular_visao_geral_anual`, `calcular_visao_geral_trimestral`, `calcular_metricas_clientes` – validar existência. |
| **CMV Limpo** | ✅ | Usa `cmv_manual` corretamente. |

**Sugestões:**
- Usar `IndicadoresService.getTrimestreDates` no page em vez de duplicar.
- Avaliar centralizar metas em config ou banco.

---

### 1.2 Desempenho

| Item | Status | Detalhe |
|------|--------|---------|
| **desempenho-service.ts** | ✅ | Usa `desempenho_semanal`, `marketing_semanal`, `cmv_semanal` corretamente. |
| **CMV** | ✅ | Usa `cmv_limpo_percentual` e `cmv_real` da tabela `cmv_semanal`. |
| **fetchAllPaginated** | ✅ | Helper reutilizável. |
| **DesempenhoClient** | ✅ | Chama Edge Function `cmv-semanal-auto` – ok. |

**Observação:** Integração com CMV Semanal (ferramentas) está correta.

---

### 1.3 Planejamento Comercial

| Item | Status | Detalhe |
|------|--------|---------|
| **Páginas extras** | ⚠️ | Existem: `page.tsx`, `page-excel.tsx`, `page-simple.tsx`, `page-simple-test.tsx`, `excel-simple/page.tsx`. Menu aponta só para `page.tsx`. |
| **page-simple-test** | ⚠️ | Página de teste com mensagem "Página de teste simplificada para verificar se o erro persiste" – provável código morto. |
| **excel-simple** | ⚠️ | Variante que chama a mesma API – pode ser versão alternativa em uso ou legado. |
| **planejamento-service** | ✅ | Lógica centralizada. |

**Sugestão:** Avaliar remover `page-simple-test.tsx` e documentar `page-excel` / `excel-simple` (manter ou consolidar).

---

### 1.4 Orçamentação

| Item | Status | Detalhe |
|------|--------|---------|
| **orcamentacao-service** | ✅ | Usa `cmv_semanal` para dados de CMV. |
| **API orcamentacao** | ✅ | Estrutura ok. |
| **Page** | ✅ | `BarSyncCheck`, `getOrcamentacaoCompleta` – fluxo claro. |

---

## 2. ANALÍTICO

### 2.1 Clientes

| Item | Status | Detalhe |
|------|--------|---------|
| **Tamanho da página** | ⚠️ | `clientes/page.tsx` ~2.800 linhas – muito grande. Sugestão: extrair componentes (Segmentação, Modal Detalhes, Tabela, etc.). |
| **Estados** | ⚠️ | Muitos `useState` – considerar reducer ou contexto para estado mais complexo. |
| **Indentação API** | ⚠️ | Em `api/analitico/clientes/route.ts` (linhas 51–52): `console.log` com indentação extra, provável resquício de refatoração. |
| **Fluxo da API** | ✅ | Usa `cliente_estatisticas` como cache; fallback para `contahub_periodo` quando cache vazio ou erro. Sync automático quando cache vazio. |
| **RPC** | ⚠️ | Fallback quando `get_cliente_stats_agregado` não existe – ok. |
| **bar_id** | ✅ | Obrigatório via header `x-user-data`. |

**Sugestões:**
- Corrigir indentação do `console.log` na API.
- Modularizar a página de clientes em subcomponentes.

---

### 2.2 Eventos

| Item | Status | Detalhe |
|------|--------|---------|
| **Console.log em produção** | ⚠️ | `handleDataChange` em `eventos/page.tsx` (linhas 29–47) com vários `console.log` – remover ou usar logger condicional. |
| **Comparativo** | ✅ | Link para `/analitico/eventos/comparativo` – ok. |
| **HorarioPicoChart** | ✅ | Componente reutilizado. |
| **ProdutosDoDiaDataTable** | ✅ | Componente reutilizado. |
| **API comparativo** | ✅ | `eventos/comparativo/route.ts` – lógica de períodos (dia/semana/mês) clara. |

**Sugestão:** Remover ou condicionar `console.log` em `handleDataChange`.

---

## 3. FERRAMENTAS – CMV Semanal

| Item | Status | Detalhe |
|------|--------|---------|
| **Inconsistência de coluna** | ⚠️ | API `cmv-semanal/route.ts` (linha 59) usa `cmv_percentual` para meta; desempenho e orçamentação usam `cmv_limpo_percentual`. A tabela tem ambas. Padronizar uso. |
| **Interface duplicada** | ⚠️ | `CMVSemanal` definida em `page.tsx`, `tabela/page.tsx` e `visualizar/page.tsx` – extrair para `types.ts` compartilhado. |
| **getWeekNumber duplicado** | ⚠️ | Presente em `cmv-semanal/page.tsx` e `desempenho-service.ts` – extrair para util compartilhada. |
| **Fatores fixos** | ⚠️ | Cálculos com 0.35, 0.33 etc. – legado; considerar parametrizar se fizer sentido. |
| **API route** | ✅ | GET/POST/PUT/DELETE implementados; `cmv_percentual` vs `cmv_limpo_percentual` – ver item acima. |
| **Edge Function** | ✅ | `cmv-semanal-auto` usa `cmv_semanal` corretamente. |

**Sugestões:**
- Padronizar uso de `cmv_limpo_percentual` (principal) ou `cmv_percentual` no cálculo de meta da API.
- Criar `types/cmv-semanal.ts` e `utils/semana.ts` (getWeekNumber).

---

## 4. BUGS IDENTIFICADOS

### 4.1 indicadores-mensais (visão geral)

**Arquivo:** `api/visao-geral/indicadores-mensais/route.ts` linha 48

**Problema:**
```javascript
new Date(2025, 8, 1); // Setembro = mês 8 (base 0)
```
Quando `mesReferencia` não é informado, usa Setembro/2025 fixo. Deveria usar mês atual.

**Correção sugerida:**
```javascript
new Date(); // mês atual
```
Ou, se quiser manter "4 meses atrás":
```javascript
const now = new Date();
new Date(now.getFullYear(), now.getMonth(), 1);
```

---

### 4.2 google-reviews – bar_id hardcoded

**Arquivo:** `api/google-reviews/route.ts` linha 15

```javascript
const barId = parseInt(searchParams.get('bar_id') || '3');
```
`bar_id` default = 3 (Ordinário). Deve vir do contexto do usuário ou ser obrigatório, não hardcoded.

---

## 5. RESUMO DE AÇÕES RECOMENDADAS

| Prioridade | Ação |
|------------|------|
| **Alta** | Corrigir `indicadores-mensais`: trocar `new Date(2025, 8, 1)` por data atual. |
| **Alta** | Padronizar CMV: `cmv_limpo_percentual` vs `cmv_percentual` na API cmv-semanal. |
| **Média** | Remover `console.log` de `eventos/page.tsx` `handleDataChange`. |
| **Média** | Corrigir indentação em `api/analitico/clientes/route.ts` (linhas 51–52). |
| **Média** | Remover duplicação `getTrimestreDates` (visão geral). |
| **Média** | Avaliar remoção de `page-simple-test.tsx` (planejamento). |
| **Baixa** | Extrair `CMVSemanal` e `getWeekNumber` para módulos compartilhados. |
| **Baixa** | Modularizar `clientes/page.tsx`. |
| **Baixa** | Revisar `google-reviews` – bar_id não hardcoded. |

---

## 6. RPCs E TABELAS CONSULTADAS

**Validar existência:**
- `calcular_visao_geral_anual`
- `calcular_visao_geral_trimestral`
- `calcular_metricas_clientes`
- `get_cliente_stats_agregado`
- `cliente_estatisticas` (view/tabela)
- `cmv_semanal`, `cmv_manual`
- `desempenho_semanal`, `marketing_semanal`
- `contahub_periodo`, `contahub_pagamentos`
