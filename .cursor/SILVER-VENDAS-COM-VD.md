# ✅ Modelo Silver - Com Campo VD em Periodo (qryId 51)

## 🎉 PROBLEMA RESOLVIDO!

### Campo VD agora EXISTE em periodo (qryId correto: 51)

Antes estava usando `qryId 5` → Não tinha VD
Agora usando `qryId 51` → **TEM VD** ✅

**Estrutura do código atual:**
```typescript
// linha 290 de contahub-sync-automatico/index.ts
async function fetchPeriodoComDivisao(...): Promise<any> {
  return fetchComDivisaoPorLocal(
    baseUrl, dataDate, empId, sessionToken, generateTimestamp,
    51, 'periodo', ''  // ✅ qryId correto
  );
}
```

---

## 🏗️ MODELO SILVER SIMPLIFICADO

Com VD em todas as 3 tabelas bronze, o modelo fica MUITO mais simples e confiável!

### Relacionamento Bronze (Bronze → Silver)

```
contahub_periodo (1 registro por VD)
    ↓ vd (chave)
    ├─→ contahub_pagamentos (N registros por VD - rateio)
    └─→ contahub_analitico (N registros por VD - itens)
```

**Chave de relacionamento**: `(bar_id, vd, dt_gerencial)`

---

## 📋 Mapeamento Completo de Campos

### BRONZE: `contahub_periodo` (Resumo da Comanda)

| Campo Bronze | Tipo | Descrição | Usar na Silver? |
|--------------|------|-----------|-----------------|
| ✅ **vd** | text | **ID da venda** (CHAVE) | ✅ SIM |
| `dt_gerencial` | date | Data gerencial | ✅ SIM |
| `tipovenda` | text | Tipo de venda | ✅ SIM |
| `vd_mesadesc` | text | Mesa/comanda | ✅ SIM |
| `vd_localizacao` | text | Localização | ✅ SIM |
| `cht_nome` | text | Nome do chat | ⚠️ Opcional |
| `cli_nome` | text | Nome cliente principal | ✅ SIM |
| `cli_dtnasc` | date | Data nascimento | ✅ SIM |
| `cli_email` | text | Email cliente | ✅ SIM |
| `cli_fone` | text | Telefone cliente | ✅ SIM |
| `usr_abriu` | text | Usuário que abriu | ✅ SIM |
| `pessoas` | numeric | Número de pessoas | ✅ SIM |
| `qtd_itens` | numeric | Quantidade de itens | ✅ SIM |
| `vr_pagamentos` | numeric | Valor total | ✅ SIM (validação) |
| `vr_produtos` | numeric | Valor produtos | ✅ SIM |
| `vr_repique` | numeric | Valor repique | ✅ SIM |
| `vr_couvert` | numeric | Valor couvert | ✅ SIM |
| `vr_desconto` | numeric | Valor desconto | ✅ SIM |
| `motivo` | text | Motivo desconto | ✅ SIM |
| `ultimo_pedido` | text | Hora último pedido | ✅ SIM |
| `vd_dtcontabil` | date | Data contábil | ⚠️ Opcional |

### BRONZE: `contahub_pagamentos` (Transações)

| Campo Bronze | Tipo | Descrição | Usar na Silver? |
|--------------|------|-----------|-----------------|
| ✅ **vd** | text | **ID da venda** (CHAVE) | ✅ SIM |
| `trn` | text | ID transação | ✅ SIM |
| `pag` | text | Sequencial pagamento (1, 2, 3...) | ✅ SIM |
| `dt_gerencial` | date | Data gerencial | ✅ SIM |
| `hr_lancamento` | text | Hora lançamento | ✅ SIM |
| `hr_transacao` | text | Hora transação bancária | ✅ SIM |
| `dt_transacao` | date | Data transação | ✅ SIM |
| `mesa` | text | Mesa | ✅ SIM (redundante com periodo) |
| `cli` | integer | ID cliente que pagou | ✅ SIM |
| `cliente` | text | Nome cliente que pagou | ✅ SIM |
| `cli_fone` | text | Telefone cliente | ✅ SIM |
| `cli_cpf` | text | CPF cliente | ✅ SIM |
| `vr_pagamentos` | numeric | Valor total comanda | ⚠️ Redundante |
| `valor` | numeric | Valor DESTE pagamento | ✅ SIM |
| `taxa` | numeric | Taxa | ✅ SIM |
| `perc` | numeric | Percentual taxa | ✅ SIM |
| `liquido` | numeric | Valor líquido | ✅ SIM |
| `tipo` | text | Tipo (Cred, Deb, Pix) | ✅ SIM |
| `meio` | text | Meio pagamento | ✅ SIM |
| `cartao` | text | Últimos dígitos | ✅ SIM |
| `autorizacao` | text | Código autorização | ✅ SIM |
| `bandeira` | text | Bandeira cartão | ✅ SIM |
| `dt_credito` | date | Data crédito | ✅ SIM |
| `usr_abriu` | text | Usuário abertura | ✅ SIM (redundante) |
| `usr_lancou` | text | Usuário lançamento | ✅ SIM |
| `usr_aceitou` | text | Usuário aceitação | ✅ SIM |
| `motivodesconto` | text | Motivo desconto | ✅ SIM |

### BRONZE: `contahub_analitico` (Itens)

| Campo Bronze | Tipo | Descrição | Usar na Silver? |
|--------------|------|-----------|-----------------|
| ✅ **vd** | text (via JOIN) | **ID venda** (vem de periodo/pagamentos) | ✅ SIM |
| `trn` | integer | ID transação | ✅ SIM |
| `itm` | integer | Sequencial item | ✅ SIM |
| `trn_dtgerencial` | date | Data gerencial | ✅ SIM |
| `vd_mesadesc` | text | Mesa | ✅ SIM |
| `vd_localizacao` | text | Localização | ⚠️ Opcional |
| `prd` | text | Código produto | ✅ SIM |
| `prd_desc` | text | Nome produto | ✅ SIM |
| `grp_desc` | text | Grupo produto | ✅ SIM |
| `categoria_mix` | text | Categoria mix | ✅ SIM |
| `qtd` | numeric | Quantidade | ✅ SIM |
| `valorfinal` | numeric | Valor final | ✅ SIM |
| `desconto` | numeric | Desconto | ✅ SIM |
| `custo` | numeric | Custo | ✅ SIM |
| `usr_lancou` | text | Usuário lançamento | ✅ SIM |
| `tipo` | text | Tipo item | ⚠️ Opcional |
| `tipovenda` | text | Tipo venda | ⚠️ Opcional |
| `itm_obs` | text | Observação | ✅ SIM |
| `comandaorigem` | text | Comanda origem | ⚠️ Opcional |
| `itemorigem` | text | Item origem | ⚠️ Opcional |

---

## 🏗️ MODELO SILVER (Star Schema)

### Tabela Fato: `silver_vendas`

```sql
CREATE TABLE silver_vendas (
  -- IDENTIFICADORES (Chave Primária)
  bar_id integer NOT NULL,
  venda_id text NOT NULL,  -- VD
  dt_gerencial date NOT NULL,
  
  -- COMANDA (de periodo)
  mesa text,
  tipo_venda text,
  localizacao text,
  
  -- VALORES DA COMANDA (de periodo)
  vr_total numeric NOT NULL,
  vr_produtos numeric,
  vr_couvert numeric,
  vr_repique numeric,
  vr_desconto numeric,
  vr_taxa_total numeric,  -- Soma das taxas (de pagamentos)
  vr_liquido_total numeric,  -- Soma dos líquidos (de pagamentos)
  
  -- MÉTRICAS
  qtd_itens integer,  -- De periodo ou count de analítico
  qtd_pessoas integer,  -- De periodo
  qtd_pagamentos integer,  -- Count de pagamentos (rateio)
  
  -- CLIENTE PRINCIPAL (de periodo)
  cliente_principal_nome text,
  cliente_principal_fone text,
  cliente_principal_email text,
  cliente_principal_dtnasc date,
  
  -- OPERACIONAL
  usr_abriu text,
  hr_abertura timestamp,  -- Min de pagamentos.hr_lancamento
  hr_ultimo_pedido timestamp,  -- De periodo.ultimo_pedido
  hr_fechamento timestamp,  -- Max de pagamentos.hr_lancamento
  
  -- FLAGS ANALÍTICAS
  tem_rateio boolean,  -- qtd_pagamentos > 1
  tem_desconto boolean,  -- vr_desconto > 0
  tem_couvert boolean,  -- vr_couvert > 0
  motivo_desconto text,  -- De periodo.motivo
  
  -- AUDITORIA
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  
  PRIMARY KEY (bar_id, venda_id, dt_gerencial)
);

-- Índices
CREATE INDEX idx_silver_vendas_dt ON silver_vendas(dt_gerencial);
CREATE INDEX idx_silver_vendas_mesa ON silver_vendas(mesa);
CREATE INDEX idx_silver_vendas_cliente ON silver_vendas(cliente_principal_fone) WHERE cliente_principal_fone IS NOT NULL;
CREATE INDEX idx_silver_vendas_valor ON silver_vendas(vr_total);
```

### Dimensão: `silver_vendas_pagamentos`

```sql
CREATE TABLE silver_vendas_pagamentos (
  pagamento_id serial PRIMARY KEY,
  
  -- FOREIGN KEY
  bar_id integer NOT NULL,
  venda_id text NOT NULL,
  dt_gerencial date NOT NULL,
  
  -- IDENTIFICAÇÃO
  transacao_id text,
  pag_seq integer NOT NULL,
  
  -- VALORES
  valor numeric NOT NULL,
  taxa numeric DEFAULT 0,
  liquido numeric NOT NULL,
  
  -- FORMA PAGAMENTO
  tipo text,
  meio text,
  bandeira text,
  cartao_ultimos_digitos text,
  codigo_autorizacao text,
  
  -- CLIENTE QUE PAGOU (pode ser diferente por pag)
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
CREATE INDEX idx_silver_pagamentos_cliente ON silver_vendas_pagamentos(cliente_fone) WHERE cliente_fone IS NOT NULL;
```

### Dimensão: `silver_vendas_itens`

```sql
CREATE TABLE silver_vendas_itens (
  item_id serial PRIMARY KEY,
  
  -- FOREIGN KEY
  bar_id integer NOT NULL,
  venda_id text NOT NULL,
  dt_gerencial date NOT NULL,
  
  -- IDENTIFICAÇÃO
  transacao_id text NOT NULL,
  item_seq integer NOT NULL,
  
  -- PRODUTO
  produto_codigo text,
  produto_nome text NOT NULL,
  produto_grupo text,
  categoria_mix text,
  
  -- VALORES
  quantidade numeric NOT NULL,
  valor_unitario numeric,
  valor_final numeric NOT NULL,
  desconto numeric DEFAULT 0,
  custo numeric,
  margem numeric,  -- Calculado: (valor_final - custo) / valor_final
  
  -- OPERACIONAL
  usr_lancou text,
  observacao text,
  
  FOREIGN KEY (bar_id, venda_id, dt_gerencial) 
    REFERENCES silver_vendas(bar_id, venda_id, dt_gerencial)
    ON DELETE CASCADE
);

CREATE INDEX idx_silver_itens_venda ON silver_vendas_itens(bar_id, venda_id, dt_gerencial);
CREATE INDEX idx_silver_itens_produto ON silver_vendas_itens(produto_codigo);
CREATE INDEX idx_silver_itens_grupo ON silver_vendas_itens(produto_grupo);
CREATE INDEX idx_silver_itens_categoria ON silver_vendas_itens(categoria_mix);
```

---

## 📊 SCRIPT DE CARGA (Bronze → Silver)

### Função 1: Popular `silver_vendas` (Fato Principal)

```sql
-- Função para popular/atualizar silver_vendas
CREATE OR REPLACE FUNCTION populate_silver_vendas(
  p_dt_inicio date,
  p_dt_fim date
)
RETURNS TABLE(
  total_vendas integer,
  total_valor numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_vendas integer;
  v_total_valor numeric;
BEGIN
  -- Inserir/atualizar vendas
  INSERT INTO silver_vendas (
    bar_id, venda_id, dt_gerencial,
    mesa, tipo_venda, localizacao,
    vr_total, vr_produtos, vr_couvert, vr_repique, vr_desconto,
    vr_taxa_total, vr_liquido_total,
    qtd_itens, qtd_pessoas, qtd_pagamentos,
    cliente_principal_nome, cliente_principal_fone, 
    cliente_principal_email, cliente_principal_dtnasc,
    usr_abriu, hr_abertura, hr_ultimo_pedido, hr_fechamento,
    tem_rateio, tem_desconto, tem_couvert, motivo_desconto
  )
  SELECT 
    per.bar_id,
    per.vd as venda_id,  -- ✅ AGORA EXISTE!
    per.dt_gerencial,
    
    -- Comanda
    per.vd_mesadesc as mesa,
    per.tipovenda as tipo_venda,
    per.vd_localizacao as localizacao,
    
    -- Valores da comanda (periodo)
    per.vr_pagamentos as vr_total,
    per.vr_produtos,
    per.vr_couvert,
    per.vr_repique,
    per.vr_desconto,
    
    -- Valores agregados de pagamentos
    COALESCE(pag_agg.taxa_total, 0) as vr_taxa_total,
    COALESCE(pag_agg.liquido_total, 0) as vr_liquido_total,
    
    -- Métricas
    per.qtd_itens::integer,
    per.pessoas::integer as qtd_pessoas,
    COALESCE(pag_agg.qtd_pagamentos, 0) as qtd_pagamentos,
    
    -- Cliente principal (periodo)
    per.cli_nome as cliente_principal_nome,
    per.cli_fone as cliente_principal_fone,
    per.cli_email as cliente_principal_email,
    per.cli_dtnasc as cliente_principal_dtnasc,
    
    -- Operacional
    per.usr_abriu,
    COALESCE(pag_agg.hr_abertura, NULL) as hr_abertura,
    per.ultimo_pedido::timestamp as hr_ultimo_pedido,
    COALESCE(pag_agg.hr_fechamento, NULL) as hr_fechamento,
    
    -- Flags
    (COALESCE(pag_agg.qtd_pagamentos, 0) > 1) as tem_rateio,
    (per.vr_desconto > 0) as tem_desconto,
    (per.vr_couvert > 0) as tem_couvert,
    per.motivo as motivo_desconto
    
  FROM contahub_periodo per
  
  -- Agregar pagamentos (opcional: uma venda pode não ter pagamentos processados ainda)
  LEFT JOIN (
    SELECT 
      bar_id,
      vd as venda_id,
      dt_gerencial,
      COUNT(*) as qtd_pagamentos,
      SUM(taxa) as taxa_total,
      SUM(liquido) as liquido_total,
      MIN(hr_lancamento::timestamp) as hr_abertura,
      MAX(hr_lancamento::timestamp) as hr_fechamento
    FROM contahub_pagamentos
    WHERE dt_gerencial >= p_dt_inicio 
      AND dt_gerencial <= p_dt_fim
    GROUP BY bar_id, vd, dt_gerencial
  ) pag_agg ON pag_agg.bar_id = per.bar_id
            AND pag_agg.venda_id = per.vd  -- ✅ JOIN DIRETO!
            AND pag_agg.dt_gerencial = per.dt_gerencial
  
  WHERE per.dt_gerencial >= p_dt_inicio 
    AND per.dt_gerencial <= p_dt_fim
    AND per.vd IS NOT NULL  -- ✅ Garantir que VD existe
  
  ON CONFLICT (bar_id, venda_id, dt_gerencial) 
  DO UPDATE SET
    mesa = EXCLUDED.mesa,
    tipo_venda = EXCLUDED.tipo_venda,
    vr_total = EXCLUDED.vr_total,
    vr_produtos = EXCLUDED.vr_produtos,
    vr_couvert = EXCLUDED.vr_couvert,
    vr_repique = EXCLUDED.vr_repique,
    vr_desconto = EXCLUDED.vr_desconto,
    vr_taxa_total = EXCLUDED.vr_taxa_total,
    vr_liquido_total = EXCLUDED.vr_liquido_total,
    qtd_itens = EXCLUDED.qtd_itens,
    qtd_pessoas = EXCLUDED.qtd_pessoas,
    qtd_pagamentos = EXCLUDED.qtd_pagamentos,
    tem_rateio = EXCLUDED.tem_rateio,
    tem_desconto = EXCLUDED.tem_desconto,
    tem_couvert = EXCLUDED.tem_couvert,
    updated_at = now();
  
  -- Retornar estatísticas
  SELECT 
    COUNT(*)::integer,
    SUM(vr_total)
  INTO v_total_vendas, v_total_valor
  FROM silver_vendas
  WHERE dt_gerencial >= p_dt_inicio 
    AND dt_gerencial <= p_dt_fim;
  
  RETURN QUERY SELECT v_total_vendas, v_total_valor;
END;
$$;
```

### Função 2: Popular `silver_vendas_pagamentos`

```sql
-- Popular dimensão de pagamentos
INSERT INTO silver_vendas_pagamentos (
  bar_id, venda_id, dt_gerencial,
  transacao_id, pag_seq,
  valor, taxa, liquido,
  tipo, meio, bandeira, cartao_ultimos_digitos, codigo_autorizacao,
  cliente_id, cliente_nome, cliente_fone, cliente_cpf,
  hr_lancamento, hr_transacao, dt_transacao, dt_credito,
  usr_lancou, usr_aceitou, motivo_desconto
)
SELECT 
  pag.bar_id,
  pag.vd as venda_id,  -- ✅ DIRETO!
  pag.dt_gerencial,
  pag.trn as transacao_id,
  pag.pag::integer as pag_seq,
  pag.valor,
  pag.taxa,
  pag.liquido,
  pag.tipo,
  pag.meio,
  pag.bandeira,
  pag.cartao as cartao_ultimos_digitos,
  pag.autorizacao as codigo_autorizacao,
  pag.cli as cliente_id,
  pag.cliente as cliente_nome,
  pag.cli_fone,
  pag.cli_cpf,
  pag.hr_lancamento::timestamp,
  pag.hr_transacao::timestamp,
  pag.dt_transacao,
  pag.dt_credito,
  pag.usr_lancou,
  pag.usr_aceitou,
  pag.motivodesconto as motivo_desconto
FROM contahub_pagamentos pag
WHERE pag.dt_gerencial >= '2026-04-01'
  AND pag.dt_gerencial <= '2026-04-15'
  -- Garantir que a venda existe em silver
  AND EXISTS (
    SELECT 1 FROM silver_vendas sv
    WHERE sv.bar_id = pag.bar_id
      AND sv.venda_id = pag.vd  -- ✅ JOIN DIRETO!
      AND sv.dt_gerencial = pag.dt_gerencial
  )
ON CONFLICT DO NOTHING;
```

### Função 3: Popular `silver_vendas_itens`

```sql
-- Popular dimensão de itens
-- ⚠️ ATENÇÃO: Analítico não tem VD diretamente
-- Precisamos fazer JOIN via TRN + DATA + MESA com pagamentos para pegar o VD

INSERT INTO silver_vendas_itens (
  bar_id, venda_id, dt_gerencial,
  transacao_id, item_seq,
  produto_codigo, produto_nome, produto_grupo, categoria_mix,
  quantidade, valor_unitario, valor_final, desconto, custo, margem,
  usr_lancou, observacao
)
SELECT DISTINCT ON (a.bar_id, pag.vd, a.trn, a.itm)
  a.bar_id,
  pag.vd as venda_id,  -- ✅ VD vem de pagamentos
  a.trn_dtgerencial as dt_gerencial,
  a.trn::text as transacao_id,
  a.itm as item_seq,
  a.prd as produto_codigo,
  a.prd_desc as produto_nome,
  a.grp_desc as produto_grupo,
  a.categoria_mix,
  a.qtd as quantidade,
  CASE WHEN a.qtd > 0 THEN a.valorfinal / a.qtd ELSE 0 END as valor_unitario,
  a.valorfinal as valor_final,
  a.desconto,
  a.custo,
  CASE 
    WHEN a.valorfinal > 0 THEN (a.valorfinal - COALESCE(a.custo, 0)) / a.valorfinal 
    ELSE 0 
  END as margem,
  a.usr_lancou,
  a.itm_obs as observacao
FROM contahub_analitico a
-- JOIN com pagamentos para pegar VD
INNER JOIN contahub_pagamentos pag
  ON pag.bar_id = a.bar_id
  AND pag.trn::integer = a.trn
  AND pag.dt_gerencial = a.trn_dtgerencial
WHERE a.trn_dtgerencial >= '2026-04-01'
  AND a.trn_dtgerencial <= '2026-04-15'
  -- Garantir que a venda existe em silver
  AND EXISTS (
    SELECT 1 FROM silver_vendas sv
    WHERE sv.bar_id = a.bar_id
      AND sv.venda_id = pag.vd
      AND sv.dt_gerencial = a.trn_dtgerencial
  )
ON CONFLICT DO NOTHING;
```

---

## 🚀 EXECUTAR CARGA COMPLETA

```sql
-- 1. Popular vendas (fato principal)
SELECT * FROM populate_silver_vendas('2026-04-01', '2026-04-15');

-- 2. Popular pagamentos
-- (executar o INSERT acima)

-- 3. Popular itens
-- (executar o INSERT acima)

-- 4. Validar
SELECT 
  'Vendas' as tabela,
  COUNT(*) as total,
  SUM(vr_total) as valor_total
FROM silver_vendas
WHERE dt_gerencial >= '2026-04-01'

UNION ALL

SELECT 
  'Pagamentos' as tabela,
  COUNT(*) as total,
  SUM(valor) as valor_total
FROM silver_vendas_pagamentos
WHERE dt_gerencial >= '2026-04-01'

UNION ALL

SELECT 
  'Itens' as tabela,
  COUNT(*) as total,
  SUM(valor_final) as valor_total
FROM silver_vendas_itens
WHERE dt_gerencial >= '2026-04-01';
```

---

## ✅ VANTAGENS DO MODELO COM VD

1. ✅ **JOIN direto e confiável** entre periodo ↔ pagamentos
2. ✅ **Não precisa de heurísticas** (mesa + data + valor)
3. ✅ **Fonte de verdade única** (periodo é master)
4. ✅ **Suporta casos edge** (mesas reutilizadas no mesmo dia)
5. ✅ **Performance melhor** (índice em VD)
6. ✅ **Dados de cliente completos** (de periodo E pagamentos)
7. ✅ **Validação automática** (comparar vr_total periodo vs soma pagamentos)

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ **Aguardar novos dados de periodo com VD** (qryId 51 já está no código)
2. ✅ **Criar as 3 tabelas Silver**
3. ✅ **Rodar carga inicial** (abril/2026)
4. ✅ **Criar JOB incremental** (atualizar diariamente)
5. ✅ **Criar views GOLD** (métricas prontas)
6. ✅ **Dashboard Metabase** conectado na Silver

---

## 📝 OBSERVAÇÃO IMPORTANTE

**Analítico ainda não tem VD diretamente**, então precisa fazer JOIN via pagamentos:

```sql
-- Estratégia:
analitico (trn, dt, bar_id) 
  → JOIN pagamentos (trn, dt, bar_id) 
  → pegar VD de pagamentos
```

**Alternativa futura**: Solicitar ao ContaHub para incluir VD também no analítico (qryId 77).
