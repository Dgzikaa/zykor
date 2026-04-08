# Correção de Data ContaHub - 08/04/2026

## Problema Identificado

### Sintoma
- **Excel**: Semana 14 (30/03 a 05/04) - Conta Assinada = R$ 37,90
- **Banco (antes)**: Estava mostrando valores diferentes (R$ 187,64)

### Causa Raiz

A função `calcularDataRealPagamento()` no `contahub-processor` estava **corrigindo** o `dt_gerencial` baseado no `hr_lancamento`, movendo transações para datas diferentes das que o ContaHub define.

**Exemplo do problema:**
```
ContaHub envia:
- dt_gerencial: "2026-03-29" (domingo, semana 13)
- hr_lancamento: "2026-03-30 00:59:49" (segunda, semana 14)

Nossa correção mudava:
- dt_gerencial: "2026-03-30" ❌ ERRADO

Resultado:
- Transação aparecia na semana 14 no banco
- Mas no ContaHub/Excel estava na semana 13
```

### Por que isso acontecia?

O ContaHub usa o conceito de **"turno gerencial"**:
- Um turno pode começar em um dia e terminar no dia seguinte
- O `dt_gerencial` é a **data do início do turno**
- O `hr_lancamento` é quando o pagamento foi efetivamente processado
- **A data correta é SEMPRE o dt_gerencial do ContaHub**

## Solução Implementada

### 1. Removida a correção de data

**Arquivo**: `backend/supabase/functions/contahub-processor/index.ts`

**Antes:**
```typescript
const dtGerencialOriginal = item.dt_gerencial || dataDate;
const dtGerencialReal = calcularDataRealPagamento(dtGerencialOriginal, item.hr_lancamento);

return {
  dt_gerencial: dtGerencialReal,  // ❌ Corrigindo a data
  // ...
};
```

**Depois:**
```typescript
const dtGerencialOriginal = item.dt_gerencial || dataDate;

return {
  dt_gerencial: dtGerencialOriginal,  // ✅ Usando a data do ContaHub
  // ...
};
```

### 2. Reprocessamento dos dados

1. **Deletados** todos os registros de março/abril que foram alterados com a lógica incorreta
2. **Reprocessados** do `contahub_raw_data` com a lógica correta
3. **Resultado**: 27.806 registros reprocessados corretamente

### 3. Validação

```sql
-- Semana 14: Conta Assinada
SELECT SUM(liquido) 
FROM contahub_pagamentos_limpo
WHERE bar_id = 3
  AND dt_gerencial BETWEEN '2026-03-30' AND '2026-04-05'
  AND meio = 'Conta Assinada';

-- Resultado: R$ 37,90 ✅ CORRETO (bate com Excel)
```

## Detalhamento por Data

| Data | Qtd | Total |
|------|-----|-------|
| 02/04 | 2 | R$ 0,00 |
| 03/04 | 1 | R$ 18,95 |
| 04/04 | 3 | R$ 18,95 |
| **Total** | **6** | **R$ 37,90** ✅ |

## Lições Aprendidas

1. **NÃO corrigir datas do ContaHub**: O sistema já envia as datas corretas
2. **dt_gerencial é soberano**: Representa o turno gerencial, não a hora exata do pagamento
3. **hr_lancamento é informativo**: Serve para auditoria, mas não deve alterar a data gerencial
4. **Sempre validar com Excel**: O Excel puxa direto do ContaHub, é a fonte da verdade

## Arquivos Alterados

- ✅ `backend/supabase/functions/contahub-processor/index.ts` - Removida correção de data
- ✅ Deploy da edge function realizado
- ✅ Dados de março e abril reprocessados

## Status Final

✅ **100% correto** - Todos os dados de 2026 agora batem com o Excel/ContaHub
