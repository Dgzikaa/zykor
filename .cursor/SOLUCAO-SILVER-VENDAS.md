# Solução: Camada Silver - Tabela de Vendas

## 🚨 PROBLEMA IDENTIFICADO

### Campo VD (Identificador da Venda) NÃO existe em `contahub_periodo`

**Campos disponíveis no raw_data de periodo:**
- ✅ `dt_gerencial` - Data gerencial
- ✅ `vd_mesadesc` - Descrição da mesa
- ✅ `vd_hrabertura` - Hora abertura
- ✅ `vd_hrfechamento` - Hora fechamento
- ✅ `vd_hrultimo` - Hora último pedido
- ✅ `cli_nome` - Nome do cliente
- ✅ `cli_fone` - Telefone
- ✅ `$vr_pagamentos` - Valor total
- ❌ **VD** - NÃO EXISTE

**Impacto:**
- Não podemos fazer JOIN direto entre `pagamentos` (que tem VD) e `periodo` (que não tem)
- O modelo Silver precisa ser baseado primariamente em `pagamentos`

---

## ✅ SOLUÇÃO PROPOSTA

### Estratégia: Silver baseado em PAGAMENTOS (fonte primária)

#### Por que Pagamentos é a melhor fonte?

1. ✅ **Tem VD** (identificador único da venda)
2. ✅ **Tem dados de cliente** (cli, cliente, cli_fone, cli_cpf)
3. ✅ **Tem todos os pagamentos** (suporta rateio)
4. ✅ **Tem valores financeiros** (valor, taxa, líquido)
5. ✅ **Tem mesa e timestamps**

#### Complementar com Analítico:

- ✅ **Itens consumidos** (produtos, quantidades, valores)
- ⚠️ **Não tem VD**, mas tem **TRN + MESA** (chave alternativa)

---

## 🏗️ MODELO SILVER FINAL

### Tabela 1: `silver_vendas` (Fato Principal)

```sql
CREATE TABLE silver_vendas (
  -- IDENTIFICADORES (Chave Primária)
  bar_id integer NOT NULL,
  venda_id text NOT NULL,  -- VD
  transacao_id text NOT NULL,  -- TRN
  dt_gerencial date NOT NULL,
  
  -- COMANDA
  mesa text,
  tipo_venda text,
  
  -- VALORES CONSOLIDADOS (agregados de pagamentos)
  vr_total numeric NOT NULL,  -- Soma de todos os pagamentos
  vr_liquido numeric,  -- Soma de líquidos (após taxas)
  vr_taxa numeric,  -- Soma de taxas
  
  -- CLIENTE PRINCIPAL (primeiro pagador)
  cliente_id integer,
  cliente_nome text,
  cliente_fone text,
  cliente_cpf text,
  
  -- MÉTRICAS
  qtd_pagamentos integer,  -- Quantos pagamentos foram feitos (rateio)
  qtd_itens integer,  -- Calculado do analítico
  
  -- OPERACIONAL
  usr_abriu text,  -- Quem abriu a comanda
  hr_abertura timestamp,  -- Primeiro lançamento
  hr_fechamento timestamp,  -- Último pagamento
  
  -- AUDITORIA
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  
  PRIMARY KEY (bar_id, venda_id, dt_gerencial)
);

-- Índices para performance
CREATE INDEX idx_silver_vendas_dt ON silver_vendas(dt_gerencial);
CREATE INDEX idx_silver_vendas_mesa ON silver_vendas(mesa);
CREATE INDEX idx_silver_vendas_cliente ON silver_vendas(cliente_id) WHERE cliente_id IS NOT NULL;
```

### Tabela 2: `silver_vendas_pagamentos` (Detalhamento dos Pagamentos)

```sql
CREATE TABLE silver_vendas_pagamentos (
  pagamento_id serial PRIMARY KEY,
  
  -- FOREIGN KEY para silver_vendas
  bar_id integer NOT NULL,
  venda_id text NOT NULL,
  dt_gerencial date NOT NULL,
  
  -- IDENTIFICAÇÃO DO PAGAMENTO
  pag_seq integer NOT NULL,  -- Sequência (1, 2, 3...)
  transacao_id text,  -- TRN
  
  -- VALORES
  valor numeric NOT NULL,
  taxa numeric DEFAULT 0,
  liquido numeric NOT NULL,
  
  -- FORMA DE PAGAMENTO
  tipo text,  -- Cred, Deb, Pix, Outro
  meio text,  -- Credito Auto, Pix Auto, etc
  bandeira text,  -- Visa, Master, etc
  cartao_ultimos_digitos text,
  codigo_autorizacao text,
  
  -- CLIENTE QUE PAGOU (pode ser diferente em cada pag)
  cliente_id integer,
  cliente_nome text,
  cliente_fone text,
  cliente_cpf text,
  
  -- TIMESTAMPS
  hr_lancamento timestamp,
  hr_transacao timestamp,
  dt_transacao date,
  dt_credito date,
  
  -- USUÁRIOS
  usr_lancou text,
  usr_aceitou text,
  
  -- DESCONTO
  motivo_desconto text,
  
  FOREIGN KEY (bar_id, venda_id, dt_gerencial) 
    REFERENCES silver_vendas(bar_id, venda_id, dt_gerencial)
    ON DELETE CASCADE
);

CREATE INDEX idx_silver_pagamentos_venda ON silver_vendas_pagamentos(bar_id, venda_id, dt_gerencial);
CREATE INDEX idx_silver_pagamentos_tipo ON silver_vendas_pagamentos(tipo, meio);
```

### Tabela 3: `silver_vendas_itens` (Produtos Consumidos)

```sql
CREATE TABLE silver_vendas_itens (
  item_id serial PRIMARY KEY,
  
  -- FOREIGN KEY para silver_vendas
  bar_id integer NOT NULL,
  venda_id text NOT NULL,
  dt_gerencial date NOT NULL,
  
  -- IDENTIFICAÇÃO DO ITEM
  transacao_id text NOT NULL,  -- TRN
  item_seq integer NOT NULL,  -- ITM
  
  -- PRODUTO
  produto_codigo text,
  produto_nome text NOT NULL,
  produto_grupo text,
  categoria_mix text,  -- Bebida, Comida, etc
  
  -- VALORES
  quantidade numeric NOT NULL,
  valor_unitario numeric,
  valor_final numeric NOT NULL,
  desconto numeric DEFAULT 0,
  custo numeric,
  
  -- OPERACIONAL
  usr_lancou text,
  hr_lancamento timestamp,
  
  -- OBSERVAÇÕES
  observacao text,
  comanda_origem text,
  item_origem text,
  
  FOREIGN KEY (bar_id, venda_id, dt_gerencial) 
    REFERENCES silver_vendas(bar_id, venda_id, dt_gerencial)
    ON DELETE CASCADE
);

CREATE INDEX idx_silver_itens_venda ON silver_vendas_itens(bar_id, venda_id, dt_gerencial);
CREATE INDEX idx_silver_itens_produto ON silver_vendas_itens(produto_codigo);
CREATE INDEX idx_silver_itens_grupo ON silver_vendas_itens(produto_grupo);
```

---

## 📊 SCRIPT DE CARGA: Bronze → Silver

### 1. Carregar `silver_vendas` (Fato Principal)

```sql
INSERT INTO silver_vendas (
  bar_id, venda_id, transacao_id, dt_gerencial,
  mesa, vr_total, vr_liquido, vr_taxa,
  cliente_id, cliente_nome, cliente_fone, cliente_cpf,
  qtd_pagamentos, usr_abriu,
  hr_abertura, hr_fechamento
)
SELECT 
  pag.bar_id,
  pag.vd as venda_id,
  pag.trn as transacao_id,
  pag.dt_gerencial,
  pag.mesa,
  
  -- Valores agregados
  SUM(pag.valor) as vr_total,
  SUM(pag.liquido) as vr_liquido,
  SUM(pag.taxa) as vr_taxa,
  
  -- Cliente principal (primeiro pagamento)
  (ARRAY_AGG(pag.cli ORDER BY pag.pag::integer))[1] as cliente_id,
  (ARRAY_AGG(pag.cliente ORDER BY pag.pag::integer))[1] as cliente_nome,
  (ARRAY_AGG(pag.cli_fone ORDER BY pag.pag::integer))[1] as cliente_fone,
  (ARRAY_AGG(pag.cli_cpf ORDER BY pag.pag::integer))[1] as cliente_cpf,
  
  -- Métricas
  COUNT(DISTINCT pag.pag) as qtd_pagamentos,
  (ARRAY_AGG(pag.usr_abriu ORDER BY pag.pag::integer))[1] as usr_abriu,
  
  -- Timestamps
  MIN(pag.hr_lancamento::timestamp) as hr_abertura,
  MAX(pag.hr_lancamento::timestamp) as hr_fechamento

FROM contahub_pagamentos pag
WHERE pag.dt_gerencial >= '2026-04-01'
  AND pag.dt_gerencial <= '2026-04-15'
GROUP BY 
  pag.bar_id, 
  pag.vd, 
  pag.trn, 
  pag.dt_gerencial, 
  pag.mesa

ON CONFLICT (bar_id, venda_id, dt_gerencial) 
DO UPDATE SET
  vr_total = EXCLUDED.vr_total,
  vr_liquido = EXCLUDED.vr_liquido,
  vr_taxa = EXCLUDED.vr_taxa,
  qtd_pagamentos = EXCLUDED.qtd_pagamentos,
  updated_at = now();
```

### 2. Carregar `silver_vendas_pagamentos` (Detalhes)

```sql
INSERT INTO silver_vendas_pagamentos (
  bar_id, venda_id, dt_gerencial,
  pag_seq, transacao_id,
  valor, taxa, liquido,
  tipo, meio, bandeira, cartao_ultimos_digitos, codigo_autorizacao,
  cliente_id, cliente_nome, cliente_fone, cliente_cpf,
  hr_lancamento, hr_transacao, dt_transacao, dt_credito,
  usr_lancou, usr_aceitou, motivo_desconto
)
SELECT 
  bar_id,
  vd as venda_id,
  dt_gerencial,
  pag::integer as pag_seq,
  trn as transacao_id,
  valor,
  taxa,
  liquido,
  tipo,
  meio,
  bandeira,
  cartao,
  autorizacao,
  cli as cliente_id,
  cliente as cliente_nome,
  cli_fone,
  cli_cpf,
  hr_lancamento::timestamp,
  hr_transacao::timestamp,
  dt_transacao,
  dt_credito,
  usr_lancou,
  usr_aceitou,
  motivodesconto

FROM contahub_pagamentos
WHERE dt_gerencial >= '2026-04-01'
  AND dt_gerencial <= '2026-04-15'
  AND EXISTS (
    SELECT 1 FROM silver_vendas sv
    WHERE sv.bar_id = contahub_pagamentos.bar_id
      AND sv.venda_id = contahub_pagamentos.vd
      AND sv.dt_gerencial = contahub_pagamentos.dt_gerencial
  );
```

### 3. Carregar `silver_vendas_itens` (Produtos)

```sql
INSERT INTO silver_vendas_itens (
  bar_id, venda_id, dt_gerencial,
  transacao_id, item_seq,
  produto_codigo, produto_nome, produto_grupo, categoria_mix,
  quantidade, valor_unitario, valor_final, desconto, custo,
  usr_lancou, observacao
)
SELECT 
  a.bar_id,
  pag.vd as venda_id,  -- VD vem de pagamentos (JOIN via TRN+MESA+DATA)
  a.trn_dtgerencial as dt_gerencial,
  a.trn::text as transacao_id,
  a.itm as item_seq,
  a.prd as produto_codigo,
  a.prd_desc as produto_nome,
  a.grp_desc as produto_grupo,
  a.categoria_mix,
  a.qtd as quantidade,
  (a.valorfinal / NULLIF(a.qtd, 0)) as valor_unitario,
  a.valorfinal as valor_final,
  a.desconto,
  a.custo,
  a.usr_lancou,
  a.itm_obs as observacao

FROM contahub_analitico a
INNER JOIN contahub_pagamentos pag
  ON pag.bar_id = a.bar_id
  AND pag.trn::integer = a.trn
  AND pag.dt_gerencial = a.trn_dtgerencial
  AND (
    pag.mesa = a.vd_mesadesc 
    OR pag.mesa LIKE '%' || a.vd_mesadesc || '%'
  )
WHERE a.trn_dtgerencial >= '2026-04-01'
  AND a.trn_dtgerencial <= '2026-04-15'
  AND EXISTS (
    SELECT 1 FROM silver_vendas sv
    WHERE sv.bar_id = pag.bar_id
      AND sv.venda_id = pag.vd
      AND sv.dt_gerencial = pag.dt_gerencial
  );

-- Atualizar qtd_itens em silver_vendas
UPDATE silver_vendas sv
SET qtd_itens = (
  SELECT COUNT(*)
  FROM silver_vendas_itens svi
  WHERE svi.bar_id = sv.bar_id
    AND svi.venda_id = sv.venda_id
    AND svi.dt_gerencial = sv.dt_gerencial
);
```

---

## 🎯 QUERY DE EXEMPLO: Visão Completa de uma Venda

```sql
-- Ver venda completa (VD 195146)
WITH venda_completa AS (
  SELECT 
    v.*,
    
    -- Pagamentos
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'pag', p.pag_seq,
          'valor', p.valor,
          'tipo', p.tipo,
          'meio', p.meio,
          'cliente', p.cliente_nome,
          'fone', p.cliente_fone
        ) ORDER BY p.pag_seq
      )
      FROM silver_vendas_pagamentos p
      WHERE p.venda_id = v.venda_id
        AND p.bar_id = v.bar_id
        AND p.dt_gerencial = v.dt_gerencial
    ) as pagamentos,
    
    -- Itens
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'item', i.item_seq,
          'produto', i.produto_nome,
          'grupo', i.produto_grupo,
          'qtd', i.quantidade,
          'valor', i.valor_final
        ) ORDER BY i.item_seq
      )
      FROM silver_vendas_itens i
      WHERE i.venda_id = v.venda_id
        AND i.bar_id = v.bar_id
        AND i.dt_gerencial = v.dt_gerencial
    ) as itens
    
  FROM silver_vendas v
  WHERE v.venda_id = '195146'
)
SELECT 
  venda_id,
  mesa,
  dt_gerencial,
  vr_total,
  qtd_pagamentos,
  qtd_itens,
  cliente_nome,
  cliente_fone,
  jsonb_pretty(pagamentos) as detalhes_pagamentos,
  jsonb_pretty(itens) as detalhes_itens
FROM venda_completa;
```

---

## 📈 QUERIES ANALÍTICAS (GOLD)

### 1. Vendas por Dia

```sql
SELECT 
  dt_gerencial,
  COUNT(*) as qtd_vendas,
  SUM(vr_total) as faturamento_bruto,
  SUM(vr_liquido) as faturamento_liquido,
  AVG(vr_total) as ticket_medio,
  SUM(qtd_pagamentos) as total_pagamentos,
  COUNT(CASE WHEN qtd_pagamentos > 1 THEN 1 END) as vendas_rateadas
FROM silver_vendas
WHERE dt_gerencial >= '2026-04-01'
GROUP BY dt_gerencial
ORDER BY dt_gerencial;
```

### 2. Mix de Produtos

```sql
SELECT 
  produto_nome,
  produto_grupo,
  COUNT(*) as qtd_pedidos,
  SUM(quantidade) as qtd_total,
  SUM(valor_final) as receita_total,
  AVG(valor_final / quantidade) as preco_medio
FROM silver_vendas_itens
WHERE dt_gerencial >= '2026-04-01'
GROUP BY produto_nome, produto_grupo
ORDER BY receita_total DESC
LIMIT 20;
```

### 3. Formas de Pagamento

```sql
SELECT 
  tipo,
  meio,
  COUNT(*) as qtd_transacoes,
  SUM(valor) as valor_total,
  SUM(taxa) as taxa_total,
  SUM(liquido) as liquido_total,
  AVG(valor) as ticket_medio
FROM silver_vendas_pagamentos
WHERE dt_gerencial >= '2026-04-01'
GROUP BY tipo, meio
ORDER BY valor_total DESC;
```

### 4. Clientes Frequentes

```sql
SELECT 
  cliente_nome,
  cliente_fone,
  COUNT(DISTINCT venda_id) as qtd_visitas,
  SUM(vr_total) as gasto_total,
  AVG(vr_total) as ticket_medio,
  MAX(dt_gerencial) as ultima_visita
FROM silver_vendas
WHERE cliente_id IS NOT NULL
  AND dt_gerencial >= '2026-04-01'
GROUP BY cliente_nome, cliente_fone
HAVING COUNT(DISTINCT venda_id) >= 2
ORDER BY gasto_total DESC
LIMIT 50;
```

---

## ✅ PRÓXIMOS PASSOS

1. **Criar as 3 tabelas Silver**
2. **Rodar script de carga inicial** (abril/2026)
3. **Criar função de atualização incremental** (rodar diariamente)
4. **Validar dados**: comparar totais Silver vs Bronze
5. **Criar views Gold** (agregações prontas)
6. **Documentar dicionário de dados**

---

## 📝 RESUMO

### ✅ Vantagens do Modelo Proposto:

1. **Baseado em Pagamentos** → Tem VD (identificador confiável)
2. **Suporta rateio** → Múltiplos pagamentos por venda
3. **Dados de cliente** → Nome, telefone, CPF
4. **Complementado com Analítico** → Itens consumidos
5. **Normalizado mas flexível** → Fato + Dimensões
6. **Pronto para Analytics** → Queries simples e rápidas

### ⚠️ Limitações:

1. **Periodo não pode ser usado diretamente** (não tem VD)
2. **JOIN Analítico → Pagamentos** via TRN+MESA (não é 100% preciso em edge cases)
3. **Dados de periodo** (pessoas, couvert, desconto) precisariam vir de outras fontes

### 🎯 Resultado:

**Silver consegue responder:**
- ✅ Quanto foi vendido por dia/semana/mês?
- ✅ Qual o ticket médio?
- ✅ Quais produtos mais vendidos?
- ✅ Quais formas de pagamento preferidas?
- ✅ Quantas vendas tiveram rateio?
- ✅ Quem são os clientes frequentes?
- ✅ Qual o mix de produtos por grupo?
