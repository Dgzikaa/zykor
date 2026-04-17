# Modelo Silver - ContaHub (Camada de Negócio)

## 📊 Contexto

**Bronze** → Dados brutos do ContaHub (`contahub_raw_data`)
**Silver** → Dados consolidados e limpos por entidade de negócio
**Gold** → Agregações e métricas prontas para análise

---

## 🎯 Caso de Uso: VD 195146 (Mesa 011 - 15/04/2026)

### Realidade do Negócio

**Uma comanda (mesa) pode ter:**
- ✅ Múltiplos itens consumidos (analítico)
- ✅ Múltiplos pagamentos (rateio entre pessoas)
- ✅ Múltiplos clientes pagando a mesma conta

**Exemplo VD 195146:**
- **Mesa**: 011
- **TRN**: 385
- **Valor Total**: R$ 704,26
- **5 pagamentos** (rateio):
  - Pag 1: R$ 141,00 (Pix)
  - Pag 2: R$ 141,00 (Débito)
  - Pag 3: R$ 141,00 (Débito)
  - Pag 4: R$ 141,00 (Crédito)
  - Pag 5: R$ 140,26 (Crédito)
- **9 itens consumidos**:
  - 5x Baldinho Corona (R$ 91,80 cada)
  - 2x Pastéis Happy Hour (R$ 39,95 cada)
  - 1x Isca de Frango (R$ 54,95)
  - 1x Batata Frita (R$ 34,95)

---

## 📋 Mapeamento de Campos

### BRONZE → Tabelas Atuais

#### 1. `contahub_pagamentos` (Transações Financeiras)
**Grão**: 1 registro = 1 pagamento individual
**Chave**: `(bar_id, vd, trn, pag)`

| Campo Bronze | Tipo | Descrição | Origem |
|--------------|------|-----------|--------|
| `vd` | text | **Identificador da venda/comanda** (CHAVE) | ✅ ContaHub |
| `trn` | text | Número da transação | ✅ ContaHub |
| `pag` | text | Número sequencial do pagamento (1, 2, 3...) | ✅ ContaHub |
| `dt_gerencial` | date | Data gerencial da venda | ✅ ContaHub |
| `hr_lancamento` | text | Hora que o pagamento foi lançado | ✅ ContaHub |
| `hr_transacao` | text | Hora da transação bancária | ✅ ContaHub |
| `dt_transacao` | date | Data da transação bancária | ✅ ContaHub |
| `mesa` | text | Identificador da mesa | ✅ ContaHub |
| `cli` | integer | ID do cliente no sistema | ✅ ContaHub |
| `cliente` | text | Nome do cliente | ✅ ContaHub |
| `cli_fone` | text | **Telefone do cliente** (NOVO) | ✅ ContaHub |
| `cli_cpf` | text | **CPF do cliente** (NOVO) | ✅ ContaHub |
| `vr_pagamentos` | numeric | Valor total dos pagamentos da comanda | ✅ ContaHub |
| `valor` | numeric | Valor deste pagamento específico | ✅ ContaHub |
| `taxa` | numeric | Taxa cobrada neste pagamento | ✅ ContaHub |
| `perc` | numeric | Percentual da taxa | ✅ ContaHub |
| `liquido` | numeric | Valor líquido deste pagamento | ✅ ContaHub |
| `tipo` | text | Tipo pagamento (Cred, Deb, Outro) | ✅ ContaHub |
| `meio` | text | Meio de pagamento (Pix Auto, Crédito Auto) | ✅ ContaHub |
| `cartao` | text | Últimos dígitos do cartão | ✅ ContaHub |
| `autorizacao` | text | Código de autorização | ✅ ContaHub |
| `dt_credito` | date | Data prevista do crédito | ✅ ContaHub |
| `usr_abriu` | text | Usuário que abriu a comanda | ✅ ContaHub |
| `usr_lancou` | text | Usuário que lançou o pagamento | ✅ ContaHub |
| `usr_aceitou` | text | Usuário que aceitou o pagamento | ✅ ContaHub |
| `motivodesconto` | text | Motivo do desconto (se houver) | ✅ ContaHub |
| `bandeira` | text | Bandeira do cartão | ✅ ContaHub |

#### 2. `contahub_periodo` (Resumo da Comanda)
**Grão**: 1 registro = 1 comanda fechada
**Chave**: ❌ **NÃO TEM VD!** (problema)

| Campo Bronze | Tipo | Descrição | Origem |
|--------------|------|-----------|--------|
| ❌ **VD AUSENTE** | - | **Campo identificador não existe** | ⚠️ Problema |
| `dt_gerencial` | date | Data gerencial | ✅ ContaHub |
| `tipovenda` | text | Tipo de venda | ✅ ContaHub |
| `vd_mesadesc` | text | Descrição da mesa (pode ser mesa ou nome) | ✅ ContaHub |
| `vd_localizacao` | text | Localização da mesa | ✅ ContaHub |
| `cht_nome` | text | Nome do chat/comanda | ✅ ContaHub |
| `cli_nome` | text | Nome do cliente principal | ✅ ContaHub |
| `cli_dtnasc` | date | Data nascimento do cliente | ✅ ContaHub |
| `cli_email` | text | Email do cliente | ✅ ContaHub |
| `cli_fone` | text | Telefone do cliente | ✅ ContaHub |
| `usr_abriu` | text | Usuário que abriu a comanda | ✅ ContaHub |
| `pessoas` | numeric | Número de pessoas na mesa | ✅ ContaHub |
| `qtd_itens` | numeric | Quantidade de itens consumidos | ✅ ContaHub |
| `vr_pagamentos` | numeric | **Valor total dos pagamentos** | ✅ ContaHub |
| `vr_produtos` | numeric | Valor dos produtos | ✅ ContaHub |
| `vr_repique` | numeric | Valor de repique | ✅ ContaHub |
| `vr_couvert` | numeric | Valor do couvert | ✅ ContaHub |
| `vr_desconto` | numeric | Valor de desconto | ✅ ContaHub |
| `motivo` | text | Motivo do desconto | ✅ ContaHub |
| `ultimo_pedido` | text | Hora do último pedido | ✅ ContaHub |

#### 3. `contahub_analitico` (Itens da Comanda)
**Grão**: 1 registro = 1 item consumido
**Chave**: `(bar_id, trn, itm)`

| Campo Bronze | Tipo | Descrição | Origem |
|--------------|------|-----------|--------|
| ❌ **VD AUSENTE** | - | **Campo identificador não existe** | ⚠️ Problema |
| `trn` | integer | Número da transação | ✅ ContaHub |
| `itm` | integer | Número sequencial do item | ✅ ContaHub |
| `trn_dtgerencial` | date | Data gerencial | ✅ ContaHub |
| `vd_mesadesc` | text | Descrição da mesa | ✅ ContaHub |
| `vd_localizacao` | text | Localização | ✅ ContaHub |
| `prd` | text | Código do produto | ✅ ContaHub |
| `prd_desc` | text | Descrição do produto | ✅ ContaHub |
| `grp_desc` | text | Grupo do produto | ✅ ContaHub |
| `qtd` | numeric | Quantidade | ✅ ContaHub |
| `valorfinal` | numeric | Valor final do item | ✅ ContaHub |
| `desconto` | numeric | Desconto no item | ✅ ContaHub |
| `custo` | numeric | Custo do item | ✅ ContaHub |
| `usr_lancou` | text | Usuário que lançou o item | ✅ ContaHub |
| `tipo` | text | Tipo do item | ✅ ContaHub |
| `tipovenda` | text | Tipo de venda | ✅ ContaHub |

---

## 🏗️ MODELO SILVER PROPOSTO

### Opção 1: Tabela Única Desnormalizada (Recomendada para Analytics)

```sql
CREATE TABLE silver_vendas (
  -- IDENTIFICADORES
  venda_id text NOT NULL,  -- VD (ex: '195146')
  transacao_id text NOT NULL,  -- TRN (ex: '385')
  bar_id integer NOT NULL,
  dt_gerencial date NOT NULL,
  
  -- COMANDA (Nível Agregado)
  mesa text,
  tipo_venda text,
  localizacao text,
  
  -- VALORES DA COMANDA (Totais)
  vr_total_comanda numeric,  -- Soma de todos os pagamentos
  vr_produtos numeric,
  vr_couvert numeric,
  vr_repique numeric,
  vr_desconto numeric,
  qtd_itens integer,
  qtd_pessoas integer,
  
  -- PAGAMENTOS (Array/JSONB com múltiplos pagamentos)
  pagamentos jsonb,  -- [{pag: 1, valor: 141.00, tipo: "Pix", ...}, ...]
  qtd_pagamentos integer,
  
  -- CLIENTE PRINCIPAL (da comanda)
  cliente_principal_id integer,
  cliente_principal_nome text,
  cliente_principal_fone text,
  cliente_principal_cpf text,
  cliente_principal_email text,
  
  -- ITENS (Array/JSONB com todos os itens)
  itens jsonb,  -- [{item: 1, produto: "Baldinho Corona", qtd: 1, valor: 91.80, ...}, ...]
  
  -- OPERACIONAL
  usr_abriu text,
  hr_abertura timestamp,
  hr_ultimo_pedido timestamp,
  hr_fechamento timestamp,
  
  -- AUDITORIA
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  
  -- CHAVE PRIMÁRIA
  PRIMARY KEY (bar_id, venda_id, transacao_id, dt_gerencial)
);
```

**Vantagens:**
- ✅ Fácil para analytics (tudo em uma tabela)
- ✅ Performance em agregações
- ✅ Mantém histórico completo de pagamentos/itens
- ✅ Suporta rateio de comandas

**Desvantagens:**
- ⚠️ Campos JSONB requerem parsing em algumas queries
- ⚠️ Pode ficar grande com muitos itens

---

### Opção 2: Modelo Normalizado (Star Schema)

#### Tabela Fato: `silver_vendas_fato`
```sql
CREATE TABLE silver_vendas_fato (
  venda_id text NOT NULL,
  transacao_id text NOT NULL,
  bar_id integer NOT NULL,
  dt_gerencial date NOT NULL,
  
  -- Métricas da comanda
  vr_total numeric,
  vr_produtos numeric,
  vr_couvert numeric,
  vr_desconto numeric,
  qtd_itens integer,
  qtd_pessoas integer,
  qtd_pagamentos integer,
  
  -- Foreign Keys
  cliente_principal_id integer,
  mesa text,
  
  -- Timestamps
  hr_abertura timestamp,
  hr_fechamento timestamp,
  
  PRIMARY KEY (bar_id, venda_id, dt_gerencial)
);
```

#### Dimensão: `silver_vendas_pagamentos`
```sql
CREATE TABLE silver_vendas_pagamentos (
  pagamento_id serial PRIMARY KEY,
  venda_id text NOT NULL,
  bar_id integer NOT NULL,
  pag_seq integer NOT NULL,  -- Sequencial (1, 2, 3...)
  
  -- Dados do pagamento
  valor numeric,
  taxa numeric,
  liquido numeric,
  tipo text,  -- Cred, Deb, Pix
  meio text,  -- Credito Auto, Pix Auto
  hr_lancamento timestamp,
  
  -- Cliente que pagou (pode ser diferente do principal)
  cliente_id integer,
  cliente_nome text,
  cliente_fone text,
  cliente_cpf text,
  
  FOREIGN KEY (bar_id, venda_id) REFERENCES silver_vendas_fato(bar_id, venda_id)
);
```

#### Dimensão: `silver_vendas_itens`
```sql
CREATE TABLE silver_vendas_itens (
  item_id serial PRIMARY KEY,
  venda_id text NOT NULL,
  bar_id integer NOT NULL,
  item_seq integer NOT NULL,
  
  -- Dados do item
  produto_codigo text,
  produto_nome text,
  produto_grupo text,
  quantidade numeric,
  valor_unitario numeric,
  valor_total numeric,
  desconto numeric,
  custo numeric,
  
  usr_lancou text,
  hr_lancamento timestamp,
  
  FOREIGN KEY (bar_id, venda_id) REFERENCES silver_vendas_fato(bar_id, venda_id)
);
```

**Vantagens:**
- ✅ Mais eficiente para queries analíticas complexas
- ✅ Fácil JOIN com dimensões
- ✅ Melhor performance em agregações
- ✅ Normalizado (menos redundância)

**Desvantagens:**
- ⚠️ Requer JOINs para ter visão completa
- ⚠️ Mais tabelas para manter

---

## 🚨 PROBLEMA CRÍTICO IDENTIFICADO

### ❌ `contahub_periodo` NÃO tem campo VD

**Impacto:**
- Não conseguimos fazer JOIN direto entre `pagamentos` e `periodo`
- A chave natural seria `(bar_id, vd, dt_gerencial)` mas VD não existe em periodo

**Possíveis soluções:**

#### Solução 1: Usar combinação de campos
```sql
-- JOIN por mesa + data + valor aproximado
JOIN contahub_periodo p 
  ON p.dt_gerencial = pag.dt_gerencial
  AND p.vd_mesadesc = pag.mesa
  AND ABS(p.vr_pagamentos - pag.vr_pagamentos) < 0.01
  AND p.bar_id = pag.bar_id
```

**Problemas:**
- ⚠️ Mesa pode ter múltiplas comandas no mesmo dia
- ⚠️ Não é 100% confiável

#### Solução 2: Adicionar campo VD em periodo (RECOMENDADO)
```sql
-- Adicionar VD no raw_data de periodo
ALTER TABLE contahub_periodo ADD COLUMN vd text;

-- Atualizar processador para pegar VD do raw_json
-- (se existir no ContaHub)
```

#### Solução 3: Ignorar periodo na Silver (Usar só pagamentos + analitico)
```sql
-- Silver baseada em:
-- - contahub_pagamentos (tem VD) ✅
-- - contahub_analitico (tem TRN, mas não VD) ⚠️
-- - contahub_periodo (não tem VD) ❌
```

---

## 💡 RECOMENDAÇÃO FINAL

### 1️⃣ **Verificar se VD existe no raw_data de periodo**
```sql
SELECT raw_json->'list'->0 
FROM contahub_raw_data 
WHERE data_type = 'periodo' 
LIMIT 1;
```

### 2️⃣ **Se VD existe**: Adicionar no processador
```typescript
// Em contahub-processor/index.ts, caso 'periodo'
vd: String(item.vd || ''),  // ADICIONAR ESTA LINHA
```

### 3️⃣ **Criar Silver com modelo híbrido**
- **Fato principal**: `silver_vendas` (baseado em pagamentos)
- **Dimensão itens**: `silver_vendas_itens` (baseado em analítico)
- **Agregações**: Calcular valores de periodo dinamicamente

### 4️⃣ **Query exemplo para Silver**
```sql
INSERT INTO silver_vendas
SELECT 
  pag.vd as venda_id,
  pag.trn as transacao_id,
  pag.bar_id,
  pag.dt_gerencial,
  pag.mesa,
  
  -- Agregar pagamentos
  SUM(pag.valor) as vr_total_comanda,
  COUNT(DISTINCT pag.pag) as qtd_pagamentos,
  jsonb_agg(
    jsonb_build_object(
      'pag', pag.pag,
      'valor', pag.valor,
      'tipo', pag.tipo,
      'meio', pag.meio,
      'cliente', pag.cliente,
      'cli_fone', pag.cli_fone
    )
  ) as pagamentos,
  
  -- Cliente principal (primeiro pagamento)
  (ARRAY_AGG(pag.cliente ORDER BY pag.pag::integer))[1] as cliente_principal_nome,
  (ARRAY_AGG(pag.cli_fone ORDER BY pag.pag::integer))[1] as cliente_principal_fone
  
FROM contahub_pagamentos pag
WHERE pag.dt_gerencial >= '2026-04-01'
GROUP BY pag.vd, pag.trn, pag.bar_id, pag.dt_gerencial, pag.mesa;
```

---

## 📊 Resumo: Bronze → Silver → Gold

```
BRONZE (Raw)
├── contahub_pagamentos (VD ✅, múltiplos registros por venda)
├── contahub_periodo (VD ❌, 1 registro por comanda)
└── contahub_analitico (VD ❌, múltiplos registros por item)

SILVER (Consolidado)
├── silver_vendas (VD ✅, 1 registro por venda)
├── silver_vendas_pagamentos (VD ✅, múltiplos registros)
└── silver_vendas_itens (VD ✅, múltiplos registros)

GOLD (Agregado)
├── gold_vendas_diarias (métricas por dia)
├── gold_mix_produtos (ranking produtos)
└── gold_clientes_frequentes (análise clientes)
```
