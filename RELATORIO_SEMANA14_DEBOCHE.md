# Relatório de Correção - Semana 14 Deboche (bar_id 4)

**Data**: 09/04/2026  
**Semana**: 14/2026 (31/03 a 06/04)  
**Bar**: Deboche (bar_id 4)

## 📊 Problemas Identificados e Status

### ✅ 1. MIX DE PRODUTOS (CORRIGIDO)

**Problema**: Valores absurdos nos percentuais de mix
- Bebidas: 3438% → **34.39%** ✅
- Drinks: 3865% → **38.66%** ✅  
- Comida: 2695% → **26.96%** ✅
- Happy Hour: 2199% → **21.99%** ✅

**Causa**: Percentuais armazenados incorretamente em `eventos_base` (multiplicados por 100)

**Solução Aplicada**:
- Corrigidos 6 eventos na tabela `eventos_base`
- Divididos os valores por 100
- Recalculado desempenho semanal

**Resultado**: ✅ **RESOLVIDO**

---

### ⚠️ 2. CONTA ASSINADA (NORMAL - SEM DADOS)

**Problema**: Zerada nas semanas 10+

**Investigação**:
- Verificado `contahub_pagamentos_limpo`
- **0 registros** de "Conta Assinada" no período
- Outros meios de pagamento presentes:
  - Pix: R$ 8.547,72 (131 registros)
  - Débito: R$ 15.641,02 (256 registros)
  - Crédito: R$ 26.892,33 (372 registros)

**Conclusão**: ⚠️ **NÃO É ERRO** - Realmente não houve pagamentos via Conta Assinada neste período

---

### ❌ 3. TEMPOS DE PRODUÇÃO E ATRASOS (SEM DADOS)

**Problema**: Todos os valores zerados
- Atrasinhos Bar: 0
- Atrasos Bar: 0
- Tempo Saída Bar: 0 min
- Atrasinhos Cozinha: 0
- Atrasos Cozinha: 0
- Tempo Saída Cozinha: 0 min

**Causa**: Não há dados na tabela `contahub_tempo` para o período 31/03 a 06/04/2026

**Ação Necessária**: 
- ❌ **Sincronizar dados do ContaHub** para este período
- Executar processamento de dados de tempo via `contahub-processor`

**Status**: ❌ **PENDENTE** - Requer sincronização de dados

---

### ❌ 4. DISTRIBUIÇÃO HORÁRIA (DADOS INCORRETOS)

**Problema**: Percentuais absurdos
- Faturamento até 19h: **9143%** ❌
- Faturamento após 22h: **9351%** ❌

**Causa Raiz**: 91% do faturamento registrado na hora "00h" em `faturamento_hora`
- 00h: R$ 54.924,34 (91.3% do total)
- 18h-24h: R$ 5.202,29 (8.7% do total)

**Distribuição Real Encontrada**:
```
00h: R$ 54.924,34 (91.3%) ← PROBLEMA AQUI
18h: R$ 49,59 (0.1%)
19h: R$ 903,43 (1.5%)
20h: R$ 893,60 (1.5%)
21h: R$ 2.054,46 (3.4%)
22h: R$ 807,73 (1.3%)
23h: R$ 417,68 (0.7%)
```

**Ação Necessária**:
- ❌ **Recalcular/Reprocessar** a tabela `faturamento_hora` para este período
- Verificar sincronização de `contahub_periodo` (fonte dos dados de hora)
- Corrigir registros com hora NULL/0

**Status**: ❌ **PENDENTE** - Requer reprocessamento de dados

---

## 🔧 Scripts Criados

1. `scripts/recalcular-desempenho-deboche.js` - Recalcula semana via Edge Function
2. `scripts/verificar-atrasos-deboche.js` - Verifica dados de atrasos e tempos
3. `scripts/diagnostico-completo-semana14.js` - Diagnóstico completo da semana
4. `scripts/corrigir-mix-eventos.js` - Corrige percentuais de MIX (✅ executado)
5. `scripts/investigar-conta-assinada.js` - Investiga Conta Assinada
6. `scripts/investigar-distribuicao-horaria.js` - Investiga distribuição horária

---

## 📝 Próximos Passos

### Imediato:
1. ✅ MIX corrigido - Nenhuma ação necessária
2. ⚠️ Conta Assinada - Confirmar se é esperado não ter dados

### Pendente:
3. ❌ **Sincronizar dados de tempo do ContaHub** para semana 14
4. ❌ **Recalcular faturamento_hora** para corrigir distribuição horária
5. ✅ Executar recálculo final após correções

---

## 🎯 Comandos para Recálculo

```bash
# Recalcular semana 14 após correções
node scripts/recalcular-desempenho-deboche.js

# Verificar resultado
node scripts/diagnostico-completo-semana14.js
```

---

**Atualizado em**: 09/04/2026 12:50  
**Por**: Sistema Automático de Diagnóstico
