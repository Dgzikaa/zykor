# Correção de Duplicados no ContaHub - 08/04/2026

## 🔍 Problema Identificado

Durante investigação da métrica "Conta Assinada" na semana 14, foi descoberto que a tabela `contahub_pagamentos` continha **registros duplicados** em março e abril de 2026.

### Exemplo de Duplicação

**Registro vd=185972, trn=370** (Ordinário - 31/03):
- ID 920909: +R$ 149,74 ✅ (válido)
- ID 920910: -R$ 149,74 (estorno - válido)
- ID 920911: +R$ 149,74 ❌ **DUPLICADO**

### Impacto

- **236 registros duplicados** identificados (111 no Bar 3, 125 no Bar 4)
- **Valores inflados** em relatórios e métricas
- **Divergência** entre Excel e Zykor

#### Exemplo de Impacto - Semana 14

**Conta Assinada (meio de pagamento):**
- **Com duplicados**: R$ 187,64 ❌
- **Sem duplicados**: R$ 37,90 ✅ (valor correto que bate com o Excel)

## ✅ Solução Implementada

### 1. Proteção Contra DELETE

A tabela `contahub_pagamentos` possui uma trigger `proteger_delete` que impede exclusão de dados históricos:

```sql
ERROR: DELETE bloqueado em contahub_pagamentos. 
Dados historicos do ContaHub nao podem ser excluidos.
```

### 2. Criação de View Sem Duplicados

Foi criada a view `contahub_pagamentos_unicos` que filtra automaticamente os registros duplicados:

```sql
CREATE OR REPLACE VIEW contahub_pagamentos_unicos AS
SELECT DISTINCT ON (bar_id, vd, COALESCE(trn, ''), dt_gerencial, valor, liquido, meio)
  id, vd, trn, dt_gerencial, hr_lancamento, hr_transacao, dt_transacao,
  mesa, cli, cliente, vr_pagamentos, pag, valor, taxa, perc, liquido,
  tipo, meio, cartao, autorizacao, dt_credito, usr_abriu, usr_lancou,
  usr_aceitou, motivodesconto, bar_id, created_at, updated_at,
  idempotency_key, bandeira
FROM contahub_pagamentos
ORDER BY bar_id, vd, COALESCE(trn, ''), dt_gerencial, valor, liquido, meio, id;
```

**Critério de deduplicação**: Mantém o registro com menor `id` (primeiro inserido) para cada combinação única de:
- `bar_id`
- `vd` (número da venda)
- `trn` (transação)
- `dt_gerencial`
- `valor`
- `liquido`
- `meio` (forma de pagamento)

### 3. Resultados da Correção

#### Semana 14 (30/03 a 05/04/2026)

**Ordinário (Bar 3):**
- Transações originais: 3.283
- Transações únicas: 3.268 (-15 duplicados)
- Conta Assinada: **R$ 37,90** ✅

**Zona Sul (Bar 4):**
- Transações originais: 1.048
- Transações únicas: 1.019 (-29 duplicados)
- Conta Assinada: **R$ 271,67** (sem alteração)

#### Março e Abril 2026 (Completo)

**Ordinário:**
- 18.984 transações únicas
- R$ 2.028.547,28 total líquido
- 38 dias com dados

**Zona Sul:**
- 4.801 transações únicas
- R$ 335.399,02 total líquido
- 32 dias com dados

## 📋 Ações Necessárias

### 1. Atualizar Consultas SQL

Todas as consultas que usam `contahub_pagamentos` devem ser atualizadas para usar `contahub_pagamentos_unicos`:

```sql
-- ❌ ANTES
SELECT * FROM contahub_pagamentos WHERE ...

-- ✅ DEPOIS
SELECT * FROM contahub_pagamentos_unicos WHERE ...
```

### 2. Investigar Causa da Duplicação

**Possíveis causas:**
- Processo de sync do ContaHub executando múltiplas vezes
- Falta de `idempotency_key` em alguns registros (muitos estão NULL)
- Race condition no processo de importação

**Ação**: Revisar o código de sync do ContaHub para garantir idempotência.

### 3. Adicionar Constraint de Unicidade

Considerar adicionar uma constraint única na tabela para prevenir futuras duplicações:

```sql
-- Sugestão (requer análise mais profunda)
CREATE UNIQUE INDEX idx_contahub_pagamentos_unique 
ON contahub_pagamentos (bar_id, vd, COALESCE(trn, ''), dt_gerencial, valor, liquido, meio)
WHERE liquido > 0;
```

### 4. Preencher idempotency_key

Garantir que todos os novos registros tenham `idempotency_key` preenchido para evitar duplicações futuras.

## 🔧 Arquivos que Precisam Ser Atualizados

Buscar por `FROM contahub_pagamentos` e substituir por `FROM contahub_pagamentos_unicos`:

```bash
# Buscar arquivos que usam contahub_pagamentos
rg "FROM contahub_pagamentos" --type ts --type tsx
```

**Prioridade**: Atualizar especialmente:
- APIs de relatórios financeiros
- Dashboards de métricas
- Cálculos de desempenho semanal
- Exportações para Excel

## ✅ Status Final

- ✅ View `contahub_pagamentos_unicos` criada
- ✅ Duplicações identificadas e documentadas
- ✅ Valores corretos validados (batem com Excel)
- ⚠️ **Pendente**: Atualizar consultas para usar a view
- ⚠️ **Pendente**: Investigar e corrigir causa raiz da duplicação
- ⚠️ **Pendente**: Adicionar constraint de unicidade

## 📊 Validação

Para validar que uma consulta está usando dados corretos:

```sql
-- Verificar se há duplicados em um período
SELECT 
  bar_id,
  COUNT(*) as original,
  COUNT(DISTINCT (bar_id, vd, trn, dt_gerencial, valor, liquido, meio)) as unicos,
  COUNT(*) - COUNT(DISTINCT (bar_id, vd, trn, dt_gerencial, valor, liquido, meio)) as duplicados
FROM contahub_pagamentos
WHERE dt_gerencial BETWEEN 'data_inicio' AND 'data_fim'
GROUP BY bar_id;
```

## 🎯 Impacto nas Métricas

Todas as métricas que dependem de `contahub_pagamentos` podem estar **infladas** até que sejam atualizadas para usar `contahub_pagamentos_unicos`:

- ✅ Conta Assinada (corrigido)
- ⚠️ Outras formas de pagamento (verificar)
- ⚠️ Faturamento por meio de pagamento (verificar)
- ⚠️ Relatórios financeiros (verificar)
