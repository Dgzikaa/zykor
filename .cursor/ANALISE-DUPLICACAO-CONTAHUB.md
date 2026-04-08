# Análise de Duplicação - Tabelas ContaHub

## 📊 Situação Atual (Março e Abril 2026)

### Resumo de Duplicações

| Tabela | Total Registros | Duplicados | % Duplicação | Status |
|--------|----------------|------------|--------------|---------|
| `contahub_pagamentos` | 24.021 | 236 | 0,98% | ⚠️ **Falso positivo** |
| `contahub_periodo` | 24.668 | 7 | 0,03% | ✅ Duplicação real (mínima) |
| `contahub_analitico` | 99.609 | 36.732 | 36,87% | 🚨 **Duplicação MASSIVA** |

### Problema com idempotency_key

**100% dos registros** em todas as tabelas estão com `idempotency_key = NULL`

---

## 🔍 Análise Detalhada por Tabela

### 1. `contahub_pagamentos` - NÃO É DUPLICAÇÃO REAL

#### Situação
- **236 "duplicados"** identificados inicialmente
- Após análise: **NÃO são duplicados**, são transações legítimas

#### Exemplo Real (vd=185972, trn=370):

```
ID      | pag | valor    | liquido  | hr_lancamento       | Descrição
--------|-----|----------|----------|---------------------|------------------
920909  | 1   | +149,74  | +149,74  | 2026-04-01 00:52:40 | Pagamento original
920910  | 2   | -149,74  | -149,74  | 2026-04-01 00:53:28 | Estorno
920911  | 3   | +149,74  | +149,74  | 2026-04-01 00:53:48 | Novo pagamento
```

**Conclusão**: São 3 transações DIFERENTES da mesma venda. O campo `pag` é o número sequencial do pagamento.

#### Chave Natural Correta

```sql
-- ✅ CHAVE ÚNICA CORRETA
(bar_id, vd, trn, pag)

-- Ou, se pag não for confiável:
(bar_id, vd, trn, hr_lancamento, valor, meio)
```

#### Problema no Código Atual

```typescript
// ❌ ERRADO - Falta incluir 'pag' ou 'hr_lancamento'
onConflict: 'bar_id,dt_gerencial,trn,vd,pag'  // Atual

// ✅ CORRETO
onConflict: 'bar_id,vd,trn,pag'  // Simples e eficaz
```

#### Ação Recomendada

**NÃO FAZER NADA** - Os dados estão corretos! A view `contahub_pagamentos_unicos` criada está REMOVENDO dados legítimos.

**⚠️ URGENTE**: Precisamos **DROPAR** a view `contahub_pagamentos_unicos` e usar a tabela original.

---

### 2. `contahub_periodo` - DUPLICAÇÃO REAL MÍNIMA

#### Situação
- **7 duplicados** encontrados
- Todos são registros de "Insumo" (movimentação interna) com valores zerados
- Mesmo `created_at` = inseridos no mesmo batch

#### Exemplo (IDs 2418075 e 2418697):

```
id       | vd_mesadesc | dt_gerencial | tipovenda | vr_produtos | created_at
---------|-------------|--------------|-----------|-------------|---------------------------
2418075  | Insumo      | 2026-04-02   | Interna   | 0.00        | 2026-04-08 08:17:45.057372
2418697  | Insumo      | 2026-04-02   | Interna   | 0.00        | 2026-04-08 08:17:45.057372
```

**Conclusão**: Duplicação real, mas impacto mínimo (apenas movimentações internas zeradas).

#### Chave Natural Correta

```sql
-- ✅ CHAVE ÚNICA CORRETA
(bar_id, dt_gerencial, vd_mesadesc, tipovenda)

-- Atual no código está CORRETO!
```

#### Ação Recomendada

1. **Manter** a chave atual (está correta)
2. **Deletar** os 7 duplicados manualmente (são poucos)
3. **Adicionar constraint** para prevenir futuras duplicações

---

### 3. `contahub_analitico` - DUPLICAÇÃO MASSIVA

#### Situação
- **36.732 duplicados** (36,87% dos dados!)
- Problema GRAVE que afeta cálculos de CMV, vendas, etc.

#### Chave Natural Correta

```sql
-- ✅ CHAVE ÚNICA CORRETA
(bar_id, trn, itm, trn_dtgerencial)

-- Onde:
-- trn = número da transação
-- itm = número sequencial do item na transação
```

#### Problema no Código Atual

```typescript
// ❌ ERRADO - Falta incluir trn_dtgerencial ou outros campos
onConflict: 'bar_id,trn_dtgerencial,trn,itm'  // Atual

// ✅ CORRETO (já está correto!)
onConflict: 'bar_id,trn,itm,trn_dtgerencial'  // Mesma coisa, ordem diferente
```

**Espera... a chave está correta!** 🤔

Vou investigar mais...

#### Ação Recomendada

1. **Investigar** por que há 36k duplicados se a chave está correta
2. **Criar view** `contahub_analitico_unicos` (similar ao que fizemos)
3. **Adicionar constraint** após limpeza

---

## 🎯 Plano de Ação Definitivo

### Fase 1: Correções Urgentes (Hoje)

#### 1.1. Reverter View de Pagamentos (URGENTE!)

```sql
-- ⚠️ DROPAR view que está removendo dados legítimos
DROP VIEW IF EXISTS contahub_pagamentos_unicos;
```

**Motivo**: A view está tratando transações legítimas (pagamento + estorno + novo pagamento) como duplicados.

#### 1.2. Corrigir Chave do UPSERT em `contahub_pagamentos`

```typescript
// Arquivo: contahub-processor/index.ts
// Linha: ~318

// ✅ CORRETO
onConflict: 'bar_id,vd,trn,pag'  // Incluir 'pag'
```

#### 1.3. Criar View para `contahub_analitico`

```sql
CREATE OR REPLACE VIEW contahub_analitico_unicos AS
SELECT DISTINCT ON (bar_id, trn, itm, trn_dtgerencial)
  *
FROM contahub_analitico
ORDER BY bar_id, trn, itm, trn_dtgerencial, id;
```

#### 1.4. Limpar Duplicados de `contahub_periodo`

```sql
-- São apenas 7 registros, deletar manualmente
-- (após desabilitar trigger de proteção temporariamente)
```

---

### Fase 2: Prevenção (Esta Semana)

#### 2.1. Adicionar Constraints de Unicidade

```sql
-- contahub_pagamentos
CREATE UNIQUE INDEX idx_contahub_pagamentos_unique 
ON contahub_pagamentos (bar_id, vd, trn, pag);

-- contahub_periodo (já tem chave correta no UPSERT)
CREATE UNIQUE INDEX idx_contahub_periodo_unique 
ON contahub_periodo (bar_id, dt_gerencial, vd_mesadesc, tipovenda);

-- contahub_analitico
CREATE UNIQUE INDEX idx_contahub_analitico_unique 
ON contahub_analitico (bar_id, trn, itm, trn_dtgerencial);
```

#### 2.2. Implementar idempotency_key

```typescript
// Gerar chave única para cada registro
const idempotencyKey = `${barId}_${dataType}_${vd}_${trn}_${pag}_${timestamp}`;

// Adicionar ao registro
{
  ...registro,
  idempotency_key: idempotencyKey
}
```

#### 2.3. Adicionar Validação no Sync

```typescript
// Antes de inserir, verificar se já existe
const { data: existing } = await supabase
  .from('contahub_pagamentos')
  .select('id')
  .eq('idempotency_key', idempotencyKey)
  .single();

if (existing) {
  console.log('⏭️ Registro já existe, pulando...');
  continue;
}
```

---

### Fase 3: Monitoramento (Contínuo)

#### 3.1. Query de Monitoramento

```sql
-- Executar diariamente para detectar novas duplicações
WITH duplicados AS (
  SELECT 
    'contahub_pagamentos' as tabela,
    COUNT(*) - COUNT(DISTINCT (bar_id, vd, trn, pag)) as duplicados
  FROM contahub_pagamentos
  WHERE dt_gerencial >= CURRENT_DATE - INTERVAL '7 days'
  
  UNION ALL
  
  SELECT 
    'contahub_periodo' as tabela,
    COUNT(*) - COUNT(DISTINCT (bar_id, dt_gerencial, vd_mesadesc, tipovenda)) as duplicados
  FROM contahub_periodo
  WHERE dt_gerencial >= CURRENT_DATE - INTERVAL '7 days'
  
  UNION ALL
  
  SELECT 
    'contahub_analitico' as tabela,
    COUNT(*) - COUNT(DISTINCT (bar_id, trn, itm, trn_dtgerencial)) as duplicados
  FROM contahub_analitico
  WHERE trn_dtgerencial >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT * FROM duplicados WHERE duplicados > 0;
```

---

## ⚠️ Descoberta Importante

### O Problema Real NÃO é Duplicação!

Após análise detalhada:

1. **contahub_pagamentos**: Os "duplicados" são transações legítimas (pagamento + estorno + repagamento)
2. **contahub_periodo**: Apenas 7 duplicados reais (0,03%)
3. **contahub_analitico**: 36k duplicados (precisa investigação mais profunda)

### Hipótese para contahub_analitico

Possíveis causas dos 36k "duplicados":

1. **Itens modificados**: Cliente pediu item, modificou, cancelou, pediu novamente
2. **Transferências de mesa**: Mesmo item aparece em múltiplas mesas
3. **Correções de preço**: Mesmo item com preços diferentes (desconto aplicado depois)
4. **Bug no sync**: Dados sendo inseridos múltiplas vezes (menos provável se UPSERT está correto)

**Ação**: Analisar 5-10 casos específicos para entender o padrão.

---

## 📝 Resumo Executivo

### O Que Descobrimos

1. ✅ **contahub_pagamentos**: Dados estão CORRETOS, não há duplicação real
2. ⚠️ **contahub_periodo**: 7 duplicados (impacto mínimo)
3. 🚨 **contahub_analitico**: 36k duplicados (requer investigação)
4. ❌ **100% sem idempotency_key** em todas as tabelas

### Ações Imediatas

1. **DROPAR** `contahub_pagamentos_unicos` (está removendo dados legítimos!)
2. **Corrigir** chave de UPSERT em `contahub_pagamentos` (adicionar `pag`)
3. **Investigar** `contahub_analitico` (36k duplicados)
4. **Implementar** `idempotency_key` em todos os syncs

### Impacto no Negócio

- ✅ Conta Assinada: R$ 37,90 está CORRETO (não era duplicação)
- ⚠️ CMV e vendas: Podem estar inflados devido aos duplicados no analítico
- ✅ Faturamento: Correto (pagamentos não têm duplicação real)
