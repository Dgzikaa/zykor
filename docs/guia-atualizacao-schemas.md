# Guia de Atualização para Schemas

## Status: 🟡 EM ANDAMENTO

### ✅ Arquivos Já Atualizados:

1. `backend/supabase/functions/_shared/table-refs.ts` - **CRIADO** ✅
   - Helper centralizado para acessar tabelas com schema correto
   
2. `backend/supabase/functions/contahub-processor/index.ts` - **PARCIALMENTE ATUALIZADO** 🟡
   - Imports e funções helper atualizados
   - Precisa terminar de atualizar todas as referências `insertInBatches`

3. `backend/supabase/functions/_shared/calculators/calc-faturamento.ts` - **ATUALIZADO** ✅
   - `.from('eventos_base')` → `.schema('operations').from('eventos_base')`
   - `.from('bronze_contahub_vendas_analitico')` → `.schema('bronze').from('bronze_contahub_avendas_porproduto_analitico')`

---

## 📋 Arquivos Pendentes de Atualização

### Backend - Edge Functions:

#### Alta Prioridade (usados em produção):
- [ ] `backend/supabase/functions/_shared/calculators/calc-custos.ts`
- [ ] `backend/supabase/functions/_shared/calculators/calc-operacional.ts`
- [ ] `backend/supabase/functions/contahub-sync-automatico/index.ts`
- [ ] `backend/supabase/functions/sync-faturamento-hora/index.ts`
- [ ] `backend/supabase/functions/cmv-semanal-auto/index.ts`
- [ ] `backend/supabase/functions/agente-dispatcher/index.ts`

### Frontend - API Routes:

#### Alta Prioridade:
- [ ] `frontend/src/app/api/estrategico/desempenho/mensal/route.ts`
- [ ] `frontend/src/app/api/auditoria/completa/route.ts`
- [ ] `frontend/src/app/api/analitico/semanal/route.ts`
- [ ] `frontend/src/app/api/contahub/preencher-lacunas/route.ts`
- [ ] `frontend/src/app/api/gestao/desempenho/recalcular-mix/route.ts`
- [ ] `frontend/src/app/api/gestao/desempenho/recalcular/route.ts`
- [ ] `frontend/src/app/api/analitico/stockout-historico/route.ts`
- [ ] `frontend/src/app/api/contahub/preencher-direto/route.ts`
- [ ] `frontend/src/app/api/contahub/preencher-sequencial/route.ts`
- [ ] `frontend/src/app/api/contahub/verificar-dados/route.ts`
- [ ] `frontend/src/app/api/visao-geral/indicadores-mensais/route.ts`

#### Média Prioridade:
- [ ] `frontend/src/lib/analytics-service.ts`
- [ ] `frontend/src/app/estrategico/desempenho/services/desempenho-service.ts`
- [ ] `frontend/src/app/estrategico/planejamento-comercial/services/planejamento-service.ts`

#### Componentes:
- [ ] `frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx`
- [ ] `frontend/src/components/ferramentas/HorarioPicoChart.tsx`
- [ ] `frontend/src/components/ferramentas/ProdutosDoDiaDataTable.tsx`

### Scripts (Baixa Prioridade - não afetam produção):
- [ ] `scripts/*` (vários)

---

## 🔍 Padrões de Substituição

### Para Edge Functions (Deno/TypeScript):

```typescript
// ANTES
const { data } = await supabase
  .from('contahub_analitico')
  .select('*');

// DEPOIS
const { data } = await supabase
  .schema('bronze')
  .from('bronze_contahub_avendas_porproduto_analitico')
  .select('*');
```

### Para Next.js API Routes:

```typescript
// ANTES
const { data } = await supabase
  .from("contahub_pagamentos")
  .select("*");

// DEPOIS
const { data } = await supabase
  .schema("bronze")
  .from("bronze_contahub_financeiro_pagamentosrecebidos")
  .select("*");
```

---

## 📊 Mapeamento de Tabelas

### BRONZE (schema: 'bronze'):
| Nome Antigo | Nome Novo |
|-------------|-----------|
| `contahub_analitico` | `bronze_contahub_avendas_porproduto_analitico` |
| `contahub_pagamentos` | `bronze_contahub_financeiro_pagamentosrecebidos` |
| `contahub_periodo` | `bronze_contahub_avendas_vendasperiodo` |
| `contahub_tempo` | `bronze_contahub_produtos_temposproducao` |
| `contahub_cancelamentos` | `bronze_contahub_avendas_cancelamentos` |
| `contahub_fatporhora` | `bronze_contahub_avendas_vendasdiahoraanalitico` |
| `bronze_contahub_vendas_analitico` | `bronze_contahub_avendas_porproduto_analitico` |
| `bronze_contahub_vendas_periodo` | `bronze_contahub_avendas_vendasperiodo` |
| `bronze_contahub_operacional_fatporhora` | `bronze_contahub_avendas_vendasdiahoraanalitico` |
| `bronze_contahub_financeiro_pagamentos` | `bronze_contahub_financeiro_pagamentosrecebidos` |
| `bronze_contahub_producao_tempo` | `bronze_contahub_produtos_temposproducao` |
| `bronze_contahub_vendas_cancelamentos` | `bronze_contahub_avendas_cancelamentos` |
| `contahub_raw_data` | `bronze_contahub_raw_data` |

### SILVER (schema: 'silver'):
| Nome Antigo | Nome Novo |
|-------------|-----------|
| `silver_contahub_financeiro_pagamentos` | `silver_contahub_financeiro_pagamentosrecebidos` |

### GOLD (schema: 'gold'):
- Views analíticas já foram movidas para o schema `gold`

### OPERATIONS (schema: 'operations'):
| Tabela | Schema |
|--------|--------|
| `eventos_base` | `operations` |
| `eventos_base_auditoria` | `operations` |
| `bares` | `operations` |
| `produtos` | `operations` |
| `vendas_item` | `operations` |

---

## ⚠️ Pontos de Atenção

1. **Não esquecer o `.schema()`** antes do `.from()`
2. **Usar o nome completo** da tabela (com prefixo bronze/silver/gold)
3. **Aspas duplas** em API Routes do Next.js: `.schema("bronze").from("nome")`
4. **Aspas simples** em Edge Functions Deno: `.schema('bronze').from('nome')`

---

## 🎯 Próximos Passos

1. ✅ Criar helper centralizado (`table-refs.ts`)
2. 🟡 Atualizar todos os arquivos backend (Edge Functions)
3. ⏳ Atualizar todos os arquivos frontend (API Routes)
4. ⏳ Testar localmente
5. ⏳ Dropar views de compatibilidade no Supabase:
   ```sql
   DROP VIEW IF EXISTS public.contahub_analitico CASCADE;
   DROP VIEW IF EXISTS public.contahub_cancelamentos CASCADE;
   DROP VIEW IF EXISTS public.contahub_fatporhora CASCADE;
   DROP VIEW IF EXISTS public.contahub_pagamentos CASCADE;
   DROP VIEW IF EXISTS public.contahub_periodo CASCADE;
   DROP VIEW IF EXISTS public.contahub_tempo CASCADE;
   ```
6. ⏳ Deploy em produção

---

## 📖 Comando para Buscar Referências

```powershell
# Buscar todos os .from( que precisam atualizar
rg "\.from\(['\"]contahub_" --glob "*.{ts,tsx}" frontend/src backend/supabase

# Buscar bronze_ antigos
rg "\.from\(['\"]bronze_contahub_(vendas|operacional|financeiro|producao)_" --glob "*.{ts,tsx}" frontend/src backend/supabase
```

---

**Última Atualização:** 16/04/2026 às 21:30
