# Progresso da Atualização de Schemas

**Data:** 16/04/2026 - 23:00  
**Status:** 🟡 30% CONCLUÍDO (Backend ✅ | Frontend 🟡)

---

## ✅ CONCLUÍDO (Backend - Crítico)

### Edge Functions Atualizadas:
1. ✅ `_shared/calculators/calc-faturamento.ts`
2. ✅ `_shared/calculators/calc-custos.ts`
3. ✅ `_shared/calculators/calc-operacional.ts`
4. ✅ `contahub-processor/index.ts` (parcial - principais inserções)
5. ✅ `contahub-sync-automatico/index.ts`
6. ✅ `sync-faturamento-hora/index.ts`
7. ✅ `cmv-semanal-auto/index.ts` (parcial - principais queries)

### Helper Criado:
- ✅ `_shared/table-refs.ts` - Referências centralizadas

---

## ⏳ PENDENTE

### Backend (Baixa Prioridade):
- [ ] `cmv-semanal-auto/index.ts` - Completar todas as referências (11 tabelas operations/financial)
- [ ] `_shared/agent-tools.ts` - 1 referência
- [ ] Arquivos `_archived/*` - Não crítico

### Frontend API Routes (CRÍTICO):
1. [ ] `frontend/src/app/api/estrategico/desempenho/mensal/route.ts`
2. [ ] `frontend/src/app/api/auditoria/completa/route.ts`
3. [ ] `frontend/src/app/api/analitico/semanal/route.ts`
4. [ ] `frontend/src/app/api/contahub/preencher-lacunas/route.ts`
5. [ ] `frontend/src/app/api/gestao/desempenho/recalcular-mix/route.ts`
6. [ ] `frontend/src/app/api/gestao/desempenho/recalcular/route.ts`
7. [ ] `frontend/src/app/api/analitico/stockout-historico/route.ts`
8. [ ] `frontend/src/app/api/contahub/preencher-direto/route.ts`
9. [ ] `frontend/src/app/api/contahub/preencher-sequencial/route.ts`
10. [ ] `frontend/src/app/api/contahub/verificar-dados/route.ts`
11. [ ] `frontend/src/app/api/visao-geral/indicadores-mensais/route.ts`

### Services (Médio):
- [ ] `frontend/src/lib/analytics-service.ts`
- [ ] `frontend/src/app/estrategico/desempenho/services/desempenho-service.ts`
- [ ] `frontend/src/app/estrategico/planejamento-comercial/services/planejamento-service.ts`

### Componentes (Baixo):
- [ ] `frontend/src/components/ferramentas/HorarioPicoChart.tsx`
- [ ] `frontend/src/components/ferramentas/ProdutosDoDiaDataTable.tsx`
- [ ] `frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx`

---

## 🎯 PRÓXIMOS PASSOS

### Amanhã (17/04):
1. Atualizar os 11 arquivos de API Routes do frontend
2. Atualizar os 3 services
3. Testar localmente se está tudo funcionando

### Sexta (18/04):
1. Atualizar componentes
2. Dropar views de compatibilidade
3. Fazer testes completos
4. Deploy em staging

### Segunda (21/04):
1. Validação final
2. Deploy em produção

---

## 📝 PADRÃO DE ATUALIZAÇÃO

### Para Next.js API Routes:

```typescript
// ANTES
const { data } = await supabase
  .from("contahub_analitico")
  .select("*");

// DEPOIS
const { data } = await supabase
  .schema("bronze")
  .from("bronze_contahub_avendas_porproduto_analitico")
  .select("*");
```

### Principais Substituições:

```typescript
// Bronze
.from("contahub_analitico") → .schema("bronze").from("bronze_contahub_avendas_porproduto_analitico")
.from("contahub_pagamentos") → .schema("bronze").from("bronze_contahub_financeiro_pagamentosrecebidos")
.from("contahub_periodo") → .schema("bronze").from("bronze_contahub_avendas_vendasperiodo")
.from("contahub_tempo") → .schema("bronze").from("bronze_contahub_produtos_temposproducao")
.from("contahub_cancelamentos") → .schema("bronze").from("bronze_contahub_avendas_cancelamentos")
.from("contahub_fatporhora") → .schema("bronze").from("bronze_contahub_avendas_vendasdiahoraanalitico")

// Operations
.from("eventos_base") → .schema("operations").from("eventos_base")
.from("bares") → .schema("operations").from("bares")
.from("produtos") → .schema("operations").from("produtos")

// Integrations
.from("contaazul_lancamentos") → .schema("integrations").from("contaazul_lancamentos")

// Financial
.from("cmv_semanal") → .schema("financial").from("cmv_semanal")
.from("desempenho_semanal") → .schema("meta").from("desempenho_semanal")
```

---

## 🔥 COMANDO PARA CONTINUAR

Para buscar referências pendentes:

```powershell
# Frontend API Routes
rg "\.from\(['\"]contahub_" frontend/src/app/api --glob "*.ts"

# Services
rg "\.from\(['\"]contahub_" frontend/src/lib frontend/src/app/estrategico --glob "*.ts"

# Componentes
rg "\.from\(['\"]contahub_" frontend/src/components --glob "*.tsx"
```

---

## ⚠️ IMPORTANTE

- Backend Edge Functions JÁ ESTÃO FUNCIONAIS ✅
- Views de compatibilidade AINDA ESTÃO ATIVAS
- Código frontend AINDA USA views antigas
- **Não dropar views até frontend estar 100% atualizado**

---

**Última Atualização:** 16/04/2026 22:00  
**Próxima Sessão:** Continuar com Frontend API Routes
