# 📖 REGRAS DE NEGÓCIO COMPLETAS - ZYKOR

**Data**: 03/03/2026  
**Status**: 🟢 DOCUMENTO OFICIAL DE REFERÊNCIA

> Este documento contém TODAS as regras de negócio, fórmulas, limites e definições do sistema Zykor.  
> **É A ÚNICA FONTE DE VERDADE para entender como cada métrica é calculada.**

---

## 📋 ÍNDICE

1. [Fonte de Dados Confiável](#fonte-de-dados-confiável)
2. [**DIFERENÇAS ENTRE BARES**](#diferenças-entre-bares) ⭐ CRÍTICO
3. [Tabela eventos_base](#tabela-eventos_base)
4. [Tabela desempenho_semanal](#tabela-desempenho_semanal)
5. [Regras de Atrasos](#regras-de-atrasos)
6. [Regras de Mix de Produtos](#regras-de-mix-de-produtos)
7. [Regras de Happy Hour](#regras-de-happy-hour)
8. [Regras de Stockout](#regras-de-stockout)
9. [Regras de Tempos](#regras-de-tempos)
10. [Agregações Semanais](#agregações-semanais)
11. [Agregações Mensais](#agregações-mensais)
12. [Planejamento Comercial](#planejamento-comercial)

---

## 🏆 FONTE DE DADOS CONFIÁVEL

### ContaHub - A ÚNICA fonte confiável

**Sistema**: ContaHub  
**Integração**: API REST  
**Frequência de Sync**: Diário às 10h BRT

**Tabelas do ContaHub (100% confiáveis)**:
1. `contahub_analitico` - Vendas produto a produto
2. `contahub_tempo` - Tempos de preparação/entrega
3. `contahub_stockout` - Produtos sem estoque
4. `contahub_fatporhora` - Faturamento por hora
5. `contahub_pagamentos` - Formas de pagamento
6. `contahub_periodo` - Análise de turnos

**Regra de Ouro**: 
> Sempre que possível, calcular métricas DIRETAMENTE do ContaHub, NÃO de tabelas agregadas.

---

## 🏢 DIFERENÇAS ENTRE BARES

> **CRÍTICO**: Cada bar tem regras DIFERENTES! Não podemos usar a mesma lógica para ambos.

### 📊 Bares no Sistema

| ID | Nome | CNPJ | Status | Observações |
|----|------|------|--------|-------------|
| **3** | **Ordinário Bar** | 12.345.678/0001-90 | ✅ PRINCIPAL | Mais complexo, mais regras |
| **4** | **Deboche Bar** | 98.765.432/0001-10 | ✅ ATIVO | Operação mais simples |

---

## 🎯 DIFERENÇA #1: LOCAIS DO CONTAHUB (loc_desc)

### Ordinário (bar_id = 3)

**BEBIDAS** (Cervejas, Chopps):
```javascript
['Chopp', 'Bar', 'Pegue e Pague', 'Venda Volante', 'Baldes', 'PP']
```

**DRINKS** (Coquetéis, Shots):
```javascript
['Preshh', 'Montados', 'Mexido', 'Drinks', 'Drinks Autorais', 'Shot e Dose', 'Batidos']
```

**COMIDAS** (Cozinha):
```javascript
['Cozinha 1', 'Cozinha 2']
```

**BAR+DRINKS** (Todos os drinks):
```javascript
['Baldes', 'Chopp', 'Shot e Dose', 'Pegue e Pague', 'PP', 
 'Venda Volante', 'Preshh', 'Drinks', 'Drinks Autorais', 
 'Mexido', 'Batidos', 'Bar', 'Montados']
```

---

### Deboche (bar_id = 4)

**BEBIDAS** (Cervejas, Chopps):
```javascript
['Salao']
```

**DRINKS** (Coquetéis, Shots):
```javascript
['Bar']
```

**COMIDAS** (Cozinha):
```javascript
['Cozinha', 'Cozinha 2']
```

**BAR+DRINKS** (Todos os drinks):
```javascript
['Bar', 'Salao']
```

**⚠️ IMPORTANTE**: 
- Ordinário tem **operação complexa** com muitos pontos de venda
- Deboche tem **operação simples**: Salão (bebidas) + Bar (drinks) + Cozinha

---

## ⏱️ DIFERENÇA #2: TEMPOS (Qual campo usar?)

### 🍹 BAR/DRINKS

| Bar | Campo Usado | Descrição | Por quê? |
|-----|-------------|-----------|----------|
| **Ordinário** | `t0_t3` | Lançamento até entrega | Mede tempo total |
| **Deboche** | `t0_t2` | Lançamento até produção | Operação diferente |

**Exemplo**:
```sql
-- Ordinário (bar_id = 3)
SELECT AVG(t0_t3) / 60.0 as tempo_bar_minutos
FROM contahub_tempo
WHERE bar_id = 3 AND categoria = 'drink'

-- Deboche (bar_id = 4)
SELECT AVG(t0_t2) / 60.0 as tempo_bar_minutos
FROM contahub_tempo
WHERE bar_id = 4 AND categoria = 'drink'
```

### 🍽️ COZINHA/COMIDA

| Bar | Campo Usado | Descrição | Por quê? |
|-----|-------------|-----------|----------|
| **Ordinário** | `t0_t2` | Lançamento até produção | Mede tempo de preparo |
| **Deboche** | `t0_t2` | Lançamento até produção | Mesma lógica |

**Conclusão**: Cozinha usa `t0_t2` para AMBOS os bares ✅

---

## 😤 DIFERENÇA #3: ATRASOS (Limites diferentes!)

### 🍹 BAR/DRINKS

#### Ordinário (bar_id = 3) - USA t0_t3

| Categoria | Limite | Campo | Segundos |
|-----------|--------|-------|----------|
| 🟡 Atrasinho | > 5 min | `t0_t3 > 300` | 300s |
| 🔴 Atrasão | > 10 min | `t0_t3 > 600` | 600s |

**Query**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE t0_t3 > 300) as atrasinho_bar,
  COUNT(*) FILTER (WHERE t0_t3 > 600) as atrasao_bar
FROM contahub_tempo
WHERE bar_id = 3 AND loc_desc = ANY(locais_bar_drinks)
```

#### Deboche (bar_id = 4) - USA t0_t2

| Categoria | Limite | Campo | Segundos |
|-----------|--------|-------|----------|
| 🟡 Atrasinho | > 5 min | `t0_t2 > 300` | 300s |
| 🔴 Atrasão | > 10 min | `t0_t2 > 600` | 600s |

**Query**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE t0_t2 > 300) as atrasinho_bar,
  COUNT(*) FILTER (WHERE t0_t2 > 600) as atrasao_bar
FROM contahub_tempo
WHERE bar_id = 4 AND loc_desc = ANY(locais_bar_drinks)
```

**⚠️ CRÍTICO**: 
- Ordinário conta atrasos com base no **tempo total** (t0_t3)
- Deboche conta atrasos com base no **tempo de produção** (t0_t2)

---

### 🍽️ COZINHA/COMIDA

#### Ambos os Bares - USA t0_t2

| Categoria | Limite | Campo | Segundos |
|-----------|--------|-------|----------|
| 🟡 Atrasinho | > 15 min | `t0_t2 > 900` | 900s |
| 🔴 Atrasão | > 20 min | `t0_t2 > 1200` | 1200s |

**Query** (IGUAL para ambos):
```sql
SELECT 
  COUNT(*) FILTER (WHERE t0_t2 > 900) as atrasinho_cozinha,
  COUNT(*) FILTER (WHERE t0_t2 > 1200) as atrasao_cozinha
FROM contahub_tempo
WHERE bar_id IN (3, 4) AND loc_desc = ANY(locais_comidas)
```

**✅ Conclusão**: Cozinha tem mesma regra para ambos os bares.

---

## 🍺 DIFERENÇA #4: GRUPOS DE PRODUTOS (grp_desc)

### Ordinário (bar_id = 3) - 24 Grupos

**Bebidas**:
- Cervejas
- Baldes
- Garrafas
- Vinhos
- Bebidas Prontas
- Bebidas Não Alcoólicas

**Drinks**:
- Drinks Autorais
- Drinks Classicos
- Drinks sem Álcool
- Doses
- Dose Dupla
- Espressos
- Fest Moscow

**Comida**:
- Pratos Individuais
- Pratos Para Compartilhar - P/ 4 Pessoas
- Sanduíches
- Sobremesas

**Especiais**:
- Happy Hour
- Combos
- Pegue e Pague
- Venda Volante
- Insumos
- Adicionais

---

### Deboche (bar_id = 4) - 25 Grupos

**Bebidas**:
- Cervejas
- Bebidas Não-alcóolicas
- Combos e Garrafas

**Drinks**:
- Drinks Autorais
- Drinks Clássicos
- Drinks Mocktails
- Drinks Prontos
- Shots e Doses
- Dose Dupla!
- Dose Dupla Sem Álcool
- Festival de Caipi
- Festival de Moscow Mule
- Promo Chivas

**Comida**:
- Chapas e Parrilla
- Pastel
- Petiscos
- Sandubas
- Sobremesa

**Especiais**:
- Happy Hour
- Insumos
- Uso Interno
- Mercadorias- Compras
- Tabacaria e Chicles
- Grupo Adicional

---

## 💰 DIFERENÇA #5: CUSTOS NIBO (Categorias)

### Ordinário (bar_id = 3)

**Custo Artístico**:
```sql
WHERE categoria_nome = 'Atrações Programação'
```

**Custo de Produção**:
```sql
WHERE categoria_nome = 'Produção Eventos'
```

**Total**:
```sql
c_art + c_prod
```

---

### Deboche (bar_id = 4)

**Custo Artístico**:
```sql
WHERE categoria_nome = 'Atrações/Eventos'
```

**Custo de Produção**:
```sql
-- NÃO TEM! = 0
```

**Total**:
```sql
c_art (sem produção)
```

**⚠️ IMPORTANTE**: Deboche não tem categoria "Produção Eventos" separada.

---

## 🛑 DIFERENÇA #6: STOCKOUT (Locais por categoria)

### Ordinário (bar_id = 3)

**Locais Confirmados**:
- Baldes
- Bar
- Batidos
- Chopp
- Cozinha 1
- Cozinha 2
- Mexido
- Montados
- Preshh
- Shot e Dose
- Venda Volante
- (null)

**Categorização**:
- **BAR**: Baldes, Bar, Chopp, Venda Volante
- **DRINKS**: Preshh, Montados, Mexido, Batidos, Shot e Dose
- **COMIDA**: Cozinha 1, Cozinha 2

---

### Deboche (bar_id = 4)

**Locais Confirmados**:
- Bar
- Cozinha
- Cozinha 2
- Salao
- (null)

**Categorização**:
- **BAR**: Salao
- **DRINKS**: Bar
- **COMIDA**: Cozinha, Cozinha 2

**⚠️ CRÍTICO**: Classificação de locais é COMPLETAMENTE DIFERENTE!

---

## 📋 DIFERENÇA #7: RESERVAS (APIs)

| Bar | Sistema | API | Status |
|-----|---------|-----|--------|
| **Ordinário** | Yuzer | ✅ Ativa | Integração completa |
| **Deboche** | Manual | ❌ Sem API | Dados manuais no sistema |

**Campos afetados**:
- `res_tot` - Reservas totais
- `res_p` - Reservas presentes
- `num_mesas_tot` - Mesas reservadas
- `num_mesas_presentes` - Mesas presentes

**Fonte de Dados**:
- Ordinário: API Yuzer → `yuzer_reservas`
- Deboche: Input manual na tela de planejamento

---

## 💰 DIFERENÇA #8: FATURAMENTO POR HORÁRIO

### Ordinário (bar_id = 3)

**% Faturamento até 19h** - Happy Hour e início:
```sql
SELECT 
  (SUM(valor) FILTER (WHERE hora < 19) / SUM(valor) * 100) as perc_ate_19h
FROM contahub_fatporhora
WHERE bar_id = 3 AND vd_dtgerencial = '2026-02-14'
```

**% Faturamento após 22h** - Horário nobre:
```sql
SELECT 
  (SUM(valor) FILTER (WHERE hora >= 22) / SUM(valor) * 100) as perc_apos_22h
FROM contahub_fatporhora
WHERE bar_id = 3 AND vd_dtgerencial = '2026-02-14'
```

**Campos em eventos_base**:
- `fat_19h` - Valor em R$ até 19h
- `fat_19h_percent` - % do total

**Campos em desempenho_semanal**:
- `perc_faturamento_ate_19h` - Média ponderada da semana
- `perc_faturamento_apos_22h` - Média ponderada da semana

---

### Deboche (bar_id = 4)

**MESMAS REGRAS** de horário que Ordinário:
- % até 19h
- % após 22h

**⚠️ PORÉM**: Pode ter horários diferentes de operação

---

## 💰 FÓRMULAS DE FATURAMENTO - FONTE DA VERDADE

> **ATENÇÃO**: Estas são as fórmulas OFICIAIS validadas com dados reais. Use EXATAMENTE como documentado aqui.

### 📊 Fontes de Dados

**1. ContaHub** (sempre presente, ambos os bares):
```sql
-- Líquido (já com taxas descontadas, SEM conta assinada)
SELECT SUM(liquido) FROM contahub_pagamentos 
WHERE bar_id = ? AND dt_gerencial::date = ?

-- Clientes
SELECT SUM(pessoas) FROM contahub_periodo
WHERE bar_id = ? AND dt_gerencial::date = ?

-- Couvert
SELECT SUM(vr_couvert) FROM contahub_periodo
WHERE bar_id = ? AND dt_gerencial::date = ?
```

**2. Yuzer** (APENAS Ordinário bar_id=3, APENAS eventos especiais como Carnaval):
```sql
-- Total líquido Yuzer (já com taxa descontada)
SELECT valor_liquido FROM yuzer_pagamento
WHERE bar_id = 3 AND data_evento = ?

-- Ingressos Yuzer (filtro por nome do produto)
SELECT 
  SUM(valor_total) as yuzer_ingressos_valor,
  SUM(quantidade) as yuzer_ingressos_qtd
FROM yuzer_produtos
WHERE bar_id = 3 
  AND data_evento = ?
  AND LOWER(produto_nome) LIKE '%ingresso%'

-- Yuzer Bar (derivado)
yuzer_bar = yuzer_pagamento.valor_liquido - yuzer_ingressos_valor
```

**3. Sympla** (ambos os bares, eventos especiais):
```sql
-- Ingressos Sympla
SELECT 
  SUM(valor_liquido) as sympla_liquido,
  COUNT(DISTINCT pedido_sympla_id) as sympla_checkins
FROM sympla_pedidos
WHERE bar_id = ?
  AND data_evento = ?
  AND status_pedido = 'APPROVED'
```

### 🧮 Fórmulas de Cálculo

**FATURAMENTO TOTAL:**
```
faturamento_total = contahub_liquido + yuzer_liquido_total + sympla_liquido
```

**FATURAMENTO ENTRADA (Couvert):**
```
faturamento_entrada = couvert + yuzer_ingressos_valor + sympla_liquido
```

**FATURAMENTO BAR:**
```
faturamento_bar = (contahub_liquido - couvert) + yuzer_bar
```

**CLIENTES TOTAL:**
```
clientes = contahub_pessoas + yuzer_ingressos_qtd + sympla_checkins
```

**TICKET MÉDIO:**
```
ticket_medio = faturamento_total / clientes
```

### 🎪 Eventos Especiais (Carnaval, Réveillon)

Quando evento usa Yuzer ou Sympla:
- ✅ Calcular: faturamento_total, faturamento_entrada, faturamento_bar, clientes, ticket_medio
- ❌ NÃO calcular: mix %, tempos, atrasos, happy hour, stockout (dados operacionais do ContaHub não aplicáveis)

**Identificação**: Campo `usa_yuzer` ou `usa_sympla` na tabela `eventos_base`

**Exemplo**: Carnaval 2026 (13-17/02) no Ordinário:
```sql
UPDATE eventos_base 
SET usa_yuzer = true 
WHERE bar_id = 3 
  AND data_evento BETWEEN '2026-02-13' AND '2026-02-17';
```

### ✅ Validação com Dados Reais

**Carnaval 13/02/2026 (Ordinário bar_id=3):**
- Faturamento Total: R$ 144.320
- Faturamento Entrada: R$ 33.208
- Faturamento Bar: R$ 111.111
- Clientes: 1.177
- Ticket Médio: R$ 122,57
- Mix/Tempos: NULL

**Dia Normal 22/02/2026 (Ordinário bar_id=3):**
- Faturamento Total: R$ 43.186
- Clientes: 444
- Ticket Médio: R$ 97,27
- Mix: Bebidas 57%, Drinks 35%, Comida 7%

---

## 📅 DIFERENÇA #9: DIAS PRINCIPAIS DA SEMANA

### Ordinário (bar_id = 3)

**QUI+SÁB+DOM** - Dias de maior movimento:

```sql
-- eventos_base (não tem campo específico)
SELECT SUM(real_r) 
FROM eventos_base 
WHERE bar_id = 3 
  AND data_evento BETWEEN '2026-02-09' AND '2026-02-15'
  AND dia_semana IN ('Quinta', 'Sábado', 'Domingo')
```

**Campo em desempenho_semanal**:
- `qui_sab_dom` - Soma de Quinta + Sábado + Domingo

**Cálculo**:
```typescript
const quiSabDom = eventos
  .filter(e => ['Quinta', 'Sábado', 'Domingo'].includes(e.dia_semana))
  .reduce((sum, e) => sum + e.real_r, 0)
```

**Por quê?** Ordinário opera 7 dias, mas esses 3 dias concentram ~70% do faturamento semanal.

---

### Deboche (bar_id = 4)

**TER+QUA+QUI** - Dias intermediários:
```sql
SELECT SUM(real_r) as ter_qua_qui
FROM eventos_base 
WHERE bar_id = 4 
  AND data_evento BETWEEN '2026-02-09' AND '2026-02-15'
  AND dia_semana IN ('Terça', 'Quarta', 'Quinta')
```

**SEX+SÁB** - Dias principais (fim de semana):
```sql
SELECT SUM(real_r) as sex_sab
FROM eventos_base 
WHERE bar_id = 4 
  AND data_evento BETWEEN '2026-02-09' AND '2026-02-15'
  AND dia_semana IN ('Sexta', 'Sábado')
```

**⚠️ PROBLEMA ATUAL**: 
- Campo `qui_sab_dom` em desempenho_semanal **NÃO SERVE para Deboche!**
- Deboche precisa de **2 campos separados**: `ter_qua_qui` e `sex_sab`
- Atualmente `qui_sab_dom` está retornando 0 para Deboche ❌

**Solução Necessária**:
```sql
-- Adicionar colunas em desempenho_semanal
ALTER TABLE desempenho_semanal
ADD COLUMN ter_qua_qui NUMERIC,
ADD COLUMN sex_sab NUMERIC;

-- Lógica condicional:
IF bar_id = 3 THEN
  UPDATE SET qui_sab_dom = (Quinta + Sábado + Domingo)
ELSIF bar_id = 4 THEN
  UPDATE SET ter_qua_qui = (Terça + Quarta + Quinta),
             sex_sab = (Sexta + Sábado)
END IF;
```

---

## 💳 DIFERENÇA #10: CONTA ASSINADA

### O que é?

**Conta Assinada** = Consumo que será cobrado depois (ex: sócios, funcionários, parcerias).

**Não é receita líquida** - Será pago depois ou pode virar cortesia.

---

### Como calcular?

**Fonte**: `contahub_pagamentos.meio = 'Conta Assinada'`

```sql
-- Faturamento COM conta assinada
SELECT SUM(liquido) as total_bruto
FROM contahub_pagamentos
WHERE bar_id = 3 AND dt_gerencial = '2026-02-14'

-- Faturamento SEM conta assinada (líquido real)
SELECT SUM(liquido) as total_liquido
FROM contahub_pagamentos
WHERE bar_id = 3 
  AND dt_gerencial = '2026-02-14'
  AND meio != 'Conta Assinada'

-- Valor da conta assinada
SELECT SUM(liquido) as conta_assinada
FROM contahub_pagamentos
WHERE bar_id = 3 
  AND dt_gerencial = '2026-02-14'
  AND meio = 'Conta Assinada'
```

**Regra**: 
- `faturamento_liquido` = `faturamento_total` - `conta_assinada`
- `eventos_base.real_r` = Já vem SEM conta assinada ✅

**Campos**:
- eventos_base: `faturamento_liquido` (já calculado)
- desempenho_semanal: `faturamento_total` (já sem conta assinada)

**✅ MESMA REGRA** para Ordinário e Deboche.

---

## 💸 DIFERENÇA #11: DESCONTOS

### Tipos de Desconto

**Fonte**: `contahub_analitico.tipo`

| Tipo | Descrição | Impacto |
|------|-----------|---------|
| `venda integral` | Sem desconto | 100% do preço |
| `com desconto` | Desconto parcial | < 100% do preço |
| `100% desconto` | Cortesia | R$ 0,00 |
| `Insumo` | Não é venda | Ignorar |

**Cálculo de Descontos**:
```sql
-- Total de descontos dados
SELECT 
  SUM(valorfinal) FILTER (WHERE tipo = 'com desconto') as descontos_parciais,
  COUNT(*) FILTER (WHERE tipo = '100% desconto') as cortesias,
  SUM(valor_original - valorfinal) FILTER (WHERE tipo = 'com desconto') as valor_desconto
FROM contahub_analitico
WHERE bar_id = 3 AND trn_dtgerencial = '2026-02-14'
```

**⚠️ PROBLEMA**: 
- Não temos campo `valor_original` no `contahub_analitico`!
- Não conseguimos calcular QUANTO de desconto foi dado

**Solução**: 
- Adicionar campo `valor_desconto` no ContaHub
- OU calcular baseado no preço de tabela vs preço vendido

**✅ MESMA REGRA** para Ordinário e Deboche.

---

## ❌ DIFERENÇA #12: CANCELAMENTOS

### O que são?

**Cancelamentos** = Produtos lançados mas depois removidos (cliente desistiu, erro, etc).

**Fonte**: `contahub_analitico.tipo = 'CANCELAMENTO'`

**⚠️ ATENÇÃO**: `valorfinal` de cancelamento vem **NEGATIVO**!

---

### Cálculo

**Diário** (eventos_base):
```sql
-- Valor total cancelado (em positivo)
SELECT ABS(SUM(valorfinal)) as total_cancelamentos
FROM contahub_analitico
WHERE bar_id = 3 
  AND trn_dtgerencial = '2026-02-14'
  AND tipo = 'CANCELAMENTO'
```

**⚠️ PROBLEMA ATUAL**: 
- Não há campo `cancelamentos` em `eventos_base`! ❌
- Apenas em `desempenho_semanal`

**Semanal** (desempenho_semanal):
```sql
-- Soma de cancelamentos da semana
SELECT ABS(SUM(valorfinal)) as cancelamentos_semana
FROM contahub_analitico
WHERE bar_id = 3 
  AND trn_dtgerencial BETWEEN '2026-02-09' AND '2026-02-15'
  AND tipo = 'CANCELAMENTO'
```

**Campos**:
- desempenho_semanal: `cancelamentos` (NUMERIC) ✅
- desempenho_semanal: `cancelamentos_detalhes` (JSONB) ✅

**Estrutura do JSONB**:
```json
[
  {
    "dia_semana": "Segunda",
    "data": "2026-02-09",
    "valor": 45.50,
    "quantidade": 3
  },
  ...
]
```

**✅ MESMA REGRA** para Ordinário e Deboche.

---

## 🚫 DIFERENÇA #13: DIAS DE OPERAÇÃO

### Ordinário (bar_id = 3)

**Opera 7 dias por semana** (2026):
- Segunda ✅
- Terça ✅
- Quarta ✅
- Quinta ✅
- Sexta ✅
- Sábado ✅
- **Domingo ✅** (MUDOU EM 2026!)

**Exceções**:
- Carnaval 2026 (13-17/fev): Pode ter operação especial
- Feriados: Verificar caso a caso

**Código**:
```sql
-- NÃO PULAR DOMINGOS para Ordinário!
IF p_bar_id = 3 THEN
  -- Calcula TODOS os dias
END IF
```

---

### Deboche (bar_id = 4)

**Opera 6 dias por semana**:
- **Segunda ❌ FECHADO**
- Terça ✅
- Quarta ✅
- Quinta ✅
- Sexta ✅
- Sábado ✅
- Domingo ✅

**Código**:
```sql
-- PULAR SEGUNDAS para Deboche!
IF p_bar_id = 4 THEN
  IF EXTRACT(dow FROM p_data_evento) = 1 THEN
    RETURN; -- Segunda = dia 1 (dow)
  END IF;
END IF
```

**⚠️ CRÍTICO**: 
- Ordinário: **NÃO PULAR** domingos (dow=0)
- Deboche: **PULAR** segundas (dow=1)

---

## 🎯 RESUMO DAS DIFERENÇAS

| Aspecto | Ordinário (bar_id=3) | Deboche (bar_id=4) |
|---------|---------------------|-------------------|
| **Locais** | 11+ locais complexos | 4 locais simples |
| **Tempo Bar** | t0_t3 (total) | t0_t2 (produção) |
| **Tempo Cozinha** | t0_t2 | t0_t2 |
| **Atraso Bar** | t0_t3 > 300/600 | t0_t2 > 300/600 |
| **Atraso Cozinha** | t0_t2 > 900/1200 | t0_t2 > 900/1200 |
| **Custos NIBO** | 2 categorias | 1 categoria |
| **Reservas** | API Yuzer | Manual |
| **Grupos Produtos** | 24 grupos | 25 grupos |
| **% Faturamento** | Até 19h / Após 22h | Até 19h / Após 22h |
| **Dias Principais** | **QUI+SÁB+DOM** ⚠️ | **TER+QUA+QUI + SEX+SÁB** ⚠️ |
| **Dias de Operação** | **7 dias (com domingo)** ⚠️ | **6 dias (sem segunda)** ⚠️ |
| **Conta Assinada** | Sim (igual) | Sim (igual) |
| **Descontos** | Sim (igual) | Sim (igual) |
| **Cancelamentos** | Sim (igual) | Sim (igual) |

**⚠️ CRÍTICOS**: 
- Campo `qui_sab_dom` NÃO SERVE para Deboche! Precisa criar `ter_qua_qui` e `sex_sab`.
- Ordinário opera domingos, Deboche NÃO opera segundas!

---

## 🔒 TABELA DE CONFIGURAÇÃO: bares_config

### 📖 Definição

**Propósito**: Centralizar TODAS as configurações específicas de cada bar em uma única tabela.

**Por quê?**
- ✅ Fácil de consultar
- ✅ Fácil de editar (sem mexer em código)
- ✅ Histórico de mudanças
- ✅ Uma fonte única de verdade

---

### 📊 Estrutura da Tabela

```sql
CREATE TABLE bares_config (
  id SERIAL PRIMARY KEY,
  bar_id INTEGER UNIQUE REFERENCES bares(id),
  
  -- DIAS DE OPERAÇÃO
  opera_segunda BOOLEAN DEFAULT true,
  opera_terca BOOLEAN DEFAULT true,
  opera_quarta BOOLEAN DEFAULT true,
  opera_quinta BOOLEAN DEFAULT true,
  opera_sexta BOOLEAN DEFAULT true,
  opera_sabado BOOLEAN DEFAULT true,
  opera_domingo BOOLEAN DEFAULT true,
  
  -- HORÁRIOS
  horario_abertura TIME DEFAULT '18:00',
  horario_fechamento TIME DEFAULT '02:00',
  happy_hour_inicio TIME DEFAULT '18:00',
  happy_hour_fim TIME DEFAULT '20:00',
  
  -- INTEGRAÇÕES
  tem_api_yuzer BOOLEAN DEFAULT false,
  tem_api_sympla BOOLEAN DEFAULT false,
  tem_api_contahub BOOLEAN DEFAULT true,
  tem_api_zigpay BOOLEAN DEFAULT false,
  
  -- AGREGAÇÕES
  dias_principais TEXT[], -- Ex: ['Quinta','Sábado','Domingo']
  
  -- AUDIT
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 📝 Dados Iniciais

**Ordinário (bar_id = 3)**:
```sql
INSERT INTO bares_config (
  bar_id,
  opera_segunda, opera_terca, opera_quarta, opera_quinta,
  opera_sexta, opera_sabado, opera_domingo,
  horario_abertura, horario_fechamento,
  happy_hour_inicio, happy_hour_fim,
  tem_api_yuzer, tem_api_sympla, tem_api_contahub,
  dias_principais
) VALUES (
  3,
  true, true, true, true, true, true, true, -- 7 dias
  '18:00', '02:00',
  '18:00', '20:00',
  true, true, true,
  ARRAY['Quinta', 'Sábado', 'Domingo']
);
```

**Deboche (bar_id = 4)**:
```sql
INSERT INTO bares_config (
  bar_id,
  opera_segunda, opera_terca, opera_quarta, opera_quinta,
  opera_sexta, opera_sabado, opera_domingo,
  horario_abertura, horario_fechamento,
  happy_hour_inicio, happy_hour_fim,
  tem_api_yuzer, tem_api_sympla, tem_api_contahub,
  dias_principais
) VALUES (
  4,
  false, true, true, true, true, true, true, -- 6 dias (sem segunda)
  '18:00', '02:00',
  '18:00', '20:00',
  false, true, true,
  ARRAY['Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
);
```

---

### 🔍 Como Usar na Função

```sql
-- LER DO BANCO, NÃO HARDCODE!
DECLARE
  v_config RECORD;
BEGIN
  SELECT * INTO v_config FROM bares_config WHERE bar_id = p_bar_id;
  
  -- Verificar se opera no dia
  IF NOT v_config.opera_segunda AND EXTRACT(dow FROM p_data_evento) = 1 THEN
    RETURN; -- Não opera segunda
  END IF;
  
  -- Usar horários do happy hour
  IF hora BETWEEN v_config.happy_hour_inicio AND v_config.happy_hour_fim THEN
    -- É happy hour
  END IF;
  
  -- Verificar se tem API Yuzer
  IF v_config.tem_api_yuzer THEN
    -- Buscar dados da Yuzer
  END IF;
END;
```

**Vantagens**:
- Mudar horário = UPDATE na tabela (não mexe em código)
- Adicionar novo bar = INSERT na tabela
- Consultar = SELECT simples

---

## 🔄 DADOS BRUTOS vs DADOS CALCULADOS

### ❌ NUNCA EDITAR (Dados Brutos - Imutáveis)

**Tabelas do ContaHub** (Fonte Confiável):
- `contahub_analitico` ⚠️ **IMUTÁVEL**
- `contahub_tempo` ⚠️ **IMUTÁVEL**
- `contahub_stockout` ⚠️ **IMUTÁVEL**
- `contahub_fatporhora` ⚠️ **IMUTÁVEL**
- `contahub_pagamentos` ⚠️ **IMUTÁVEL**
- `contahub_periodo` ⚠️ **IMUTÁVEL**
- `contahub_vendas` ⚠️ **IMUTÁVEL**

**Tabelas de Integrações** (Fontes Originais):
- `yuzer_reservas` ⚠️ **IMUTÁVEL**
- `yuzer_pagamento` ⚠️ **IMUTÁVEL**
- `sympla_participantes` ⚠️ **IMUTÁVEL**
- `nibo_agendamentos` ⚠️ **IMUTÁVEL**
- `google_sheets_*` ⚠️ **IMUTÁVEL**
- `getin_reservations` ⚠️ **IMUTÁVEL**

**Por quê NUNCA editar?**
1. São a **fonte original** dos dados
2. Precisamos poder **recalcular** tudo a qualquer momento
3. Em caso de **bug**, podemos voltar no tempo
4. **Auditoria**: Sempre temos o histórico completo

---

### ✅ PODE RECALCULAR (Dados Processados)

**eventos_base** (Tabela Processada):
- Todos os campos `_real` são **calculados**
- Campos de mix %, tempos, atrasos são **calculados**
- Pode rodar `calculate_daily_metrics()` **infinitas vezes**
- Sempre vai dar o mesmo resultado (se dados brutos não mudarem)

**desempenho_semanal** (Tabela Agregada):
- Todos os campos são **agregados** de eventos_base
- Pode rodar `aggregate_weekly_metrics()` **infinitas vezes**
- Sempre vai dar o mesmo resultado (se eventos_base não mudar)

**Regra**:
```
DADOS BRUTOS (imutável) 
   → calculate_daily_metrics() 
   → eventos_base (pode recalcular)
   → aggregate_weekly_metrics()
   → desempenho_semanal (pode recalcular)
```

---

### ✏️ PODE EDITAR (Dados Manuais)

**eventos_base - Campos de Planejamento**:
- `m1_r` - Meta de receita
- `cl_plan` - Clientes planejados
- `artista` - Nome do artista
- `genero` - Gênero musical
- `nome` - Nome do evento
- Tudo com sufixo `_plan`

**bares_config** (Nova Tabela):
- Todos os campos podem ser editados
- Mudanças afetam cálculos futuros

**Por quê pode editar?**
- São **inputs do usuário**
- Não são calculados automaticamente
- Usuário tem controle total

---

## 📅 TABELA: eventos_base

**Descrição**: Dados DIÁRIOS de cada evento/operação.  
**Granularidade**: 1 linha = 1 dia de operação de 1 bar  
**Total de Colunas**: 60

### 🔑 Colunas de Identificação

| Coluna | Tipo | Descrição | Fonte | Regra |
|--------|------|-----------|-------|-------|
| `id` | INTEGER | PK auto-increment | Sistema | - |
| `bar_id` | INTEGER | FK para bares (3=Ordinário, 4=Deboche) | Manual | Obrigatório |
| `data_evento` | DATE | Data do evento | Manual | Obrigatório, único por bar |
| `dia_semana` | VARCHAR | Dia da semana (Domingo-Sábado) | Calculado | Auto-preenchido |
| `semana` | INTEGER | Número da semana ISO | Calculado | Auto-preenchido |
| `nome` | VARCHAR | Nome do evento | Manual | Ex: "Pagode da Cúpula" |
| `nome_evento` | TEXT | Alias do nome | Manual | Duplicado? |
| `artista` | VARCHAR | Nome do artista/banda | Manual | Ex: "Samba de Primeira" |
| `genero` | VARCHAR | Gênero musical | Manual | Ex: "Pagode", "Samba", "MPB" |
| `ativo` | BOOLEAN | Evento ativo? | Manual | true = considerar em análises |

---

### 💰 Colunas de FATURAMENTO (Planejado)

**Prefixo**: `_plan` = planejado/previsto

| Coluna | Tipo | Descrição | Fonte | Fórmula/Regra |
|--------|------|-----------|-------|---------------|
| `m1_r` | NUMERIC | Meta 1 de Receita (R$) | Manual | Ex: R$ 70.000 (sexta) |
| `te_plan` | NUMERIC | Ticket Entrada planejado (R$) | Manual | Ex: R$ 15,50 |
| `tb_plan` | NUMERIC | Ticket Bar planejado (R$) | Manual | Ex: R$ 77,50 |
| `cl_plan` | INTEGER | Clientes planejados | Manual | Ex: 1.000 pessoas |
| `res_p` | INTEGER | Reservas planejadas (pessoas) | Manual | Previsão de reservas |
| `lot_max` | INTEGER | Lotação máxima permitida | Manual | Ex: 850 simultâneas |
| `c_artistico_plan` | NUMERIC | Custo artístico planejado (R$) | Manual | Cachê + produção |

---

### 💵 Colunas de FATURAMENTO (Real)

**Prefixo**: `_real` = realizado/aconteceu

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `real_r` | NUMERIC | **Faturamento Total Real** (R$) | **ContaHub** | `SUM(contahub_analitico.valorfinal)` |
| `cl_real` | INTEGER | **Clientes Atendidos** | **ContaHub** | `SUM(contahub_analitico.pax)` |
| `res_tot` | INTEGER | Reservas totais (pessoas) | Yuzer/Manual | Total de pessoas reservadas |
| `publico_real` | INTEGER | Público real | Calculado | Alias de `cl_real`? |
| `te_real` | NUMERIC | Ticket Entrada real (R$) | Yuzer + Sympla | `(yuzer_liquido + sympla_liquido) / cl_real` |
| `te_real_calculado` | NUMERIC | TE calculado | Calculado | Versão recalculada |
| `tb_real` | NUMERIC | Ticket Bar real (R$) | ContaHub | `faturamento_bar / cl_real` |
| `tb_real_calculado` | NUMERIC | TB calculado | Calculado | Versão recalculada |
| `t_medio` | NUMERIC | Ticket Médio Geral (R$) | ContaHub | `real_r / cl_real` |
| `c_art` | NUMERIC | Custo Artístico real (R$) | Manual/NIBO | Cachê pago |
| `c_prod` | NUMERIC | Custo de Produção (R$) | Manual/NIBO | Luz, som, etc |
| `percent_art_fat` | NUMERIC | % Artístico no Faturamento | Calculado | `(c_art / real_r) * 100` |

**⚠️ IMPORTANTE**: 
- `real_r` = ContaHub APENAS (não inclui Conta Assinada que é descontada depois)
- `te_real` = (Yuzer + Sympla) / Clientes
- `tb_real` = (Faturamento Bar) / Clientes

---

### 💳 Colunas de FATURAMENTO Detalhado

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `faturamento_liquido` | NUMERIC | Faturamento líquido | Calculado | `real_r - conta_assinada` |
| `faturamento_couvert` | NUMERIC | Faturamento Couvert/Entrada | Yuzer + Sympla | `yuzer_liquido + sympla_liquido` |
| `faturamento_couvert_manual` | NUMERIC | Couvert manual | Manual | Override manual |
| `faturamento_bar` | NUMERIC | Faturamento Bar | Calculado | `real_r - faturamento_couvert` |
| `faturamento_bar_manual` | NUMERIC | Bar manual | Manual | Override manual |
| `sympla_liquido` | NUMERIC | Faturamento Sympla líquido | Sympla API | Ingressos online |
| `sympla_checkins` | INTEGER | Check-ins Sympla | Sympla API | Pessoas que entraram |
| `yuzer_liquido` | NUMERIC | Faturamento Yuzer líquido | Yuzer API | Reservas online |
| `yuzer_ingressos` | NUMERIC | Ingressos Yuzer | Yuzer API | Total de ingressos |
| `fat_19h` | NUMERIC | Faturamento até 19h (R$) | ContaHub | Horário happy hour |
| `fat_19h_percent` | NUMERIC | % Faturamento até 19h | ContaHub | `(fat_19h / real_r) * 100` |

---

### 🍺 Colunas de MIX DE PRODUTOS

**Fonte**: `contahub_analitico` agregado por grupo de produtos

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `percent_b` | NUMERIC | **% Bebidas** (Chopps, Cervejas) | **ContaHub** | `(Σ valorfinal WHERE grp_desc LIKE '%Cerveja%' OR '%Chopp%') / real_r * 100` |
| `percent_d` | NUMERIC | **% Drinks** (Coquetéis, Shots) | **ContaHub** | `(Σ valorfinal WHERE grp_desc LIKE '%Drinks%' OR '%Shot%') / real_r * 100` |
| `percent_c` | NUMERIC | **% Comida** (Pratos, Sanduíches) | **ContaHub** | `(Σ valorfinal WHERE grp_desc LIKE '%Pratos%' OR '%Sanduíches%') / real_r * 100` |
| `percent_happy_hour` | NUMERIC | **% Happy Hour** | **ContaHub** | `(Σ valorfinal WHERE grp_desc = 'Happy Hour') / real_r * 100` |

**Grupos de Produtos (grp_desc)**:

**BEBIDAS**:
- Cerveja em Lata
- Cerveja em Garrafa
- Chopp
- Baldes de Cerveja
- Vinhos
- Espumantes

**DRINKS**:
- Drinks Autorais
- Drinks Clássicos
- Pressh (drinks prontos)
- Montados
- Mexidos
- Batidos
- Shot e Dose

**COMIDA**:
- Pratos Executivos
- Sanduíches
- Petiscos
- Sobremesas
- Combos

**HAPPY HOUR**:
- Grupo específico: "Happy Hour"
- Produtos com desconto em horário específico
- Geralmente das 18h às 20h

**EXCLUIR** (produtos especiais):
- `[HH]` prefix = Happy Hour promocional (duplicação)
- `[DD]` prefix = Dose Dupla (promoção)
- `[IN]` prefix = Insumos (não vendáveis)

---

### ⏱️ Colunas de TEMPOS

**Fonte**: `contahub_tempo` - Tempos em **SEGUNDOS** no banco!

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `t_coz` | NUMERIC | **Tempo médio Cozinha** (minutos) | **ContaHub** | `AVG(t1_t2) / 60` WHERE categoria='comida' |
| `t_bar` | NUMERIC | **Tempo médio Bar** (minutos) | **ContaHub** | `AVG(t0_t3) / 60` WHERE categoria='drink' |

**Campos do contahub_tempo**:
- `t0_lancamento` - Pedido lançado no sistema
- `t1_prodini` - Produção iniciada
- `t2_prodfim` - Produção finalizada
- `t3_entrega` - Pedido entregue ao cliente

**Intervalos calculados** (em segundos):
- `t0_t1` - Tempo até iniciar produção
- `t1_t2` - Tempo de produção
- `t2_t3` - Tempo até entregar
- `t0_t2` - Tempo até produção ficar pronta
- `t0_t3` - Tempo total (lançamento até entrega)

**Lógica por Bar**:
- **Ordinário (bar_id=3)**: 
  - Drinks: usa `t0_t3` (lançamento até entrega)
  - Comida: usa `t1_t2` (tempo de produção)
- **Deboche (bar_id=4)**: 
  - Drinks: usa `t0_t2` (até produção pronta)
  - Comida: usa `t0_t2` (até produção pronta)

**⚠️ CONVERSÃO OBRIGATÓRIA**: Banco guarda em segundos, exibir em minutos!

---

### 😤 Colunas de ATRASOS (eventos_base)

**Fonte**: `contahub_tempo` - Contagem de itens atrasados

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `atrasinho_bar` | INTEGER | **Atrasinhos Bar** (4-8 min) | **ContaHub** | `COUNT(*) WHERE categoria='drink' AND t0_t3 > 240 AND t0_t3 <= 480` |
| `atrasinho_cozinha` | INTEGER | **Atrasinhos Cozinha** (15-20 min) | **ContaHub** | `COUNT(*) WHERE categoria='comida' AND t1_t2 > 900 AND t1_t2 <= 1200` |
| `atrasao_bar` | INTEGER | **Atrasões Bar** (>20 min) | **ContaHub** | `COUNT(*) WHERE categoria='drink' AND t0_t3 > 1200` |
| `atrasao_cozinha` | INTEGER | **Atrasões Cozinha** (>30 min) | **ContaHub** | `COUNT(*) WHERE categoria='comida' AND t1_t2 > 1800` |

**⚠️ NOTA**: Campos escritos no SINGULAR em `eventos_base`!

---

### 📊 Colunas de RESERVAS

| Coluna | Tipo | Descrição | Fonte | Obs |
|--------|------|-----------|-------|-----|
| `res_tot` | INTEGER | **Pessoas Reservadas** (total) | Yuzer/Manual | Total de PAX reservados |
| `res_p` | INTEGER | **Pessoas Presentes** | Yuzer/Manual | PAX que compareceram |
| `num_mesas_tot` | INTEGER | **Mesas Reservadas** (count) | Yuzer/Manual | Quantidade de mesas |
| `num_mesas_presentes` | INTEGER | **Mesas Presentes** | Yuzer/Manual | Mesas que compareceram |

**⚠️ DIFERENÇA IMPORTANTE**:
- `res_tot` e `res_p` = PESSOAS (soma)
- `num_mesas_tot` e `num_mesas_presentes` = MESAS (contagem de reservas)

**Exemplo**:
- 10 mesas reservadas (num_mesas_tot = 10)
- 45 pessoas no total (res_tot = 45) - média 4.5 pessoas/mesa
- 8 mesas compareceram (num_mesas_presentes = 8)
- 38 pessoas presentes (res_p = 38)
- Quebra de reservas = (45 - 38) / 45 * 100 = 15.56%

---

### 🛑 Colunas de STOCKOUT

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `percent_stockout` | NUMERIC | **% Stockout Geral** | **ContaHub** | `(produtos sem estoque / produtos ativos) * 100` |

**Cálculo Detalhado**:
```sql
-- Produtos ATIVOS (prd_ativo = 'S')
-- EXCLUIR prefixos: [HH], [DD], [IN]
-- EXCLUIR grupos: Insumos

SELECT 
  COUNT(*) FILTER (WHERE prd_venda = 'N') as sem_estoque,
  COUNT(*) as total_produtos,
  (COUNT(*) FILTER (WHERE prd_venda = 'N')::numeric / COUNT(*) * 100) as percent_stockout
FROM contahub_stockout
WHERE bar_id = 3
  AND data_consulta = '2026-03-01'
  AND prd_ativo = 'S'
  AND prd_desc NOT LIKE '[HH]%'
  AND prd_desc NOT LIKE '[DD]%'
  AND prd_desc NOT LIKE '[IN]%'
  AND grp_desc NOT LIKE '%Insumo%'
```

---

### 🛠️ Colunas de CONTROLE

| Coluna | Tipo | Descrição | Fonte | Obs |
|--------|------|-----------|-------|-----|
| `calculado_em` | TIMESTAMPTZ | Quando foi calculado | Sistema | Auto |
| `precisa_recalculo` | BOOLEAN | Flag de recálculo | Sistema | true = precisa recalcular |
| `versao_calculo` | INTEGER | Versão do algoritmo | Sistema | Incrementa a cada mudança |
| `criado_em` | TIMESTAMP | Data de criação | Sistema | Auto |
| `atualizado_em` | TIMESTAMP | Última atualização | Sistema | Auto |
| `observacoes` | TEXT | Observações manuais | Manual | Notas livres |

---

### 🎪 Colunas LEGADAS (Verificar se ainda são usadas)

| Coluna | Tipo | Descrição | Status | Obs |
|--------|------|-----------|--------|-----|
| `capacidade_estimada` | INTEGER | Capacidade estimada | ⚠️ | Duplicado de lot_max? |
| `faturamento_entrada_yuzer` | NUMERIC | Fat entrada Yuzer | ⚠️ | Parte de yuzer_liquido? |
| `faturamento_bar_yuzer` | NUMERIC | Fat bar Yuzer | ⚠️ | Parte de yuzer_liquido? |

---

## 📊 TABELA: desempenho_semanal

**Descrição**: Dados SEMANAIS agregados de cada bar.  
**Granularidade**: 1 linha = 1 semana de 1 bar  
**Total de Colunas**: 65

### 🔑 Colunas de Identificação

| Coluna | Tipo | Descrição | Fonte | Regra |
|--------|------|-----------|-------|-------|
| `id` | INTEGER | PK auto-increment | Sistema | - |
| `bar_id` | INTEGER | FK para bares | Sistema | 3 ou 4 |
| `ano` | INTEGER | Ano da semana | Sistema | Ex: 2026 |
| `numero_semana` | INTEGER | Número da semana ISO | Sistema | 1-53 |
| `ano_sistema` | INTEGER | Ano do sistema | Sistema | ? |
| `data_inicio` | DATE | Segunda-feira da semana | Sistema | Sempre segunda |
| `data_fim` | DATE | Domingo da semana | Sistema | Sempre domingo |

**Semana ISO**: Primeira semana com 4+ dias em janeiro.

---

### 💰 Colunas de FATURAMENTO (Agregado)

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `faturamento_total` | NUMERIC | **Faturamento Total Semanal** | eventos_base | `SUM(real_r) - conta_assinada` |
| `faturamento_entrada` | NUMERIC | Faturamento Entrada | eventos_base | `SUM(faturamento_couvert)` |
| `faturamento_bar` | NUMERIC | Faturamento Bar | eventos_base | `SUM(faturamento_bar)` |
| `faturamento_cmovivel` | NUMERIC | Faturamento CMVível | eventos_base | Faturamento sujeito a CMV |
| `meta_semanal` | NUMERIC | Meta de Faturamento | eventos_base | `SUM(m1_r)` |
| `atingimento` | NUMERIC | % Atingimento da Meta | Calculado | `(faturamento_total / meta_semanal) * 100` |
| `qui_sab_dom` | NUMERIC | Fat Qui+Sáb+Dom | eventos_base | `SUM(real_r) WHERE dia_semana IN ('Quinta', 'Sábado', 'Domingo')` |
| `perc_faturamento_ate_19h` | NUMERIC | % Fat até 19h | eventos_base | Média ponderada de `fat_19h_percent` |
| `perc_faturamento_apos_22h` | NUMERIC | % Fat após 22h | ContaHub | Faturamento após 22h |
| `venda_balcao` | NUMERIC | Vendas no balcão | ContaHub | ? |
| `couvert_atracoes` | NUMERIC | Couvert das atrações | ? | ? |

---

### 👥 Colunas de CLIENTES

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `clientes_atendidos` | INTEGER | **Total de Clientes** | eventos_base | `SUM(cl_real)` |
| `clientes_ativos` | INTEGER | **Clientes Ativos** (2+ visitas) | Calculado | Clientes com 2+ visitas na semana |
| `clientes_30d` | INTEGER | Clientes últimos 30d | Calculado | Clientes únicos em 30d |
| `clientes_60d` | INTEGER | Clientes últimos 60d | Calculado | Clientes únicos em 60d |
| `clientes_90d` | INTEGER | Clientes últimos 90d | Calculado | Clientes únicos em 90d |
| `perc_clientes_novos` | NUMERIC | **% Clientes Novos** | Calculado | `(clientes_novos / clientes_atendidos) * 100` |
| `retencao_1m` | NUMERIC | **Retenção 1 mês** | Calculado | % clientes que voltaram em 30d |
| `retencao_2m` | NUMERIC | **Retenção 2 meses** | Calculado | % clientes que voltaram em 60d |

---

### 🎫 Colunas de RESERVAS (Agregado)

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `reservas_totais` | INTEGER | **Pessoas Reservadas** | eventos_base | `SUM(res_tot)` |
| `reservas_presentes` | INTEGER | **Pessoas Presentes** | eventos_base | `SUM(res_p)` |
| `mesas_totais` | INTEGER | **Mesas Reservadas** | eventos_base | `SUM(num_mesas_tot)` |
| `mesas_presentes` | INTEGER | **Mesas Presentes** | eventos_base | `SUM(num_mesas_presentes)` |

**Quebra de Reservas** (calculado no frontend):
```typescript
const quebraReservas = (reservas_totais - reservas_presentes) / reservas_totais * 100
```

---

### 🎯 Colunas de TICKETS MÉDIOS

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `ticket_medio` | NUMERIC | **Ticket Médio Geral** | eventos_base | `faturamento_total / clientes_atendidos` |
| `tm_entrada` | NUMERIC | **TM Entrada** (soma) | eventos_base | `SUM(te_real)` - MÉDIA: dividir por nº eventos |
| `tm_bar` | NUMERIC | **TM Bar** (soma) | eventos_base | `SUM(tb_real)` - MÉDIA: dividir por nº eventos |

**⚠️ PROBLEMA**: `tm_entrada` e `tm_bar` são SOMAS, não médias! Frontend precisa dividir pelo número de eventos.

---

### 💵 Colunas de CUSTOS

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `cmv_rs` | NUMERIC | **CMV em R$** | cmv_semanal | Custo das Mercadorias Vendidas |
| `cmv_limpo` | NUMERIC | **CMV Limpo %** | cmv_semanal | CMV sem considerações |
| `cmv_global_real` | NUMERIC | **CMV Global %** | Calculado | `(cmv_rs / faturamento_total) * 100` |
| `cmv_teorico` | NUMERIC | **CMV Teórico %** | cmv_semanal | CMV esperado |
| `cmv` | NUMERIC | CMV | ? | Legado? |
| `cmo` | NUMERIC | **CMO %** | cmo_semanal | `(cmo_total / faturamento_total) * 100` |
| `cmo_custo` | NUMERIC | CMO em R$ | ? | Valor absoluto? |
| `custo_atracao_faturamento` | NUMERIC | **% Atração/Faturamento** | eventos_base | `SUM(c_art + c_prod) / faturamento_total * 100` |
| `freelas` | NUMERIC | Custo Freelas | NIBO | Freelancers da semana |
| `cmo_fixo_simulacao` | NUMERIC | CMO Fixo simulado | cmo_semanal | Funcionários CLT/PJ |
| `alimentacao` | NUMERIC | CMA - Alimentação | cmv_semanal.cma_total | Custo alimentação funcionários |

**Custos Fixos**:
- `imposto` - Impostos
- `comissao` - Comissões
- `pro_labore` - Pro Labore dos sócios
- `ocupacao` - Aluguel e ocupação
- `adm_fixo` - Administrativo fixo
- `marketing_fixo` - Marketing fixo
- `escritorio_central` - Escritório central
- `adm_mkt_semana` - Adm + Marketing
- `rh_estorno_outros_operacao` - RH e outros
- `materiais` - Materiais de consumo
- `manutencao` - Manutenção
- `atracoes_eventos` - Atrações
- `utensilios` - Utensílios
- `consumacao_sem_socio` - Consumação sócios
- `quebra_utensilios` - Quebra de utensílios
- `bonificacoes_contratos` - Bonificações

**Lucro**:
- `lucro_rs` - Lucro líquido em R$

---

### 🛑 Colunas de STOCKOUT (Agregado)

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `stockout_bar` | NUMERIC | Stockout Bar | ContaHub | Média de % stockout bar |
| `stockout_drinks` | NUMERIC | Stockout Drinks | ContaHub | Média de % stockout drinks |
| `stockout_comidas` | NUMERIC | Stockout Comidas | ContaHub | Média de % stockout comidas |
| `stockout_bar_perc` | NUMERIC | % Stockout Bar | **Calculado** | **MÉDIA dos % diários** |
| `stockout_drinks_perc` | NUMERIC | **% Stockout Drinks** | **Calculado** | **MÉDIA dos % diários** |
| `stockout_comidas_perc` | NUMERIC | **% Stockout Comidas** | **Calculado** | **MÉDIA dos % diários** |

**Categorias de Local (loc_desc)**:

**BAR/BEBIDAS**:
- Baldes, Chopp, Pegue e Pague, Venda Volante, Bar

**DRINKS**:
- Pressh, Preshh, Montados, Mexido, Drinks, Drinks Autorais, Shot e Dose, Batidos

**COMIDA**:
- Cozinha, Cozinha 1, Cozinha 2

---

### 🍺 Colunas de MIX (Agregado)

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `perc_bebidas` | NUMERIC | **% Bebidas** | eventos_base | **Média ponderada** pelo faturamento |
| `perc_drinks` | NUMERIC | **% Drinks** | eventos_base | **Média ponderada** pelo faturamento |
| `perc_comida` | NUMERIC | **% Comida** | eventos_base | **Média ponderada** pelo faturamento |
| `perc_happy_hour` | NUMERIC | **% Happy Hour** | eventos_base | **Média ponderada** pelo faturamento |

**Fórmula de Média Ponderada**:
```typescript
const percBebidasPonderado = eventos.reduce((sum, e) => 
  sum + (e.real_r * e.percent_b / 100), 0
) / faturamentoTotal * 100
```

**Exemplo**:
```
Dia 1: R$ 100.000 com 60% bebidas = R$ 60.000 em bebidas
Dia 2: R$ 10.000 com 20% bebidas = R$ 2.000 em bebidas
---
Total: R$ 110.000 com R$ 62.000 em bebidas = 56.36% (não 40% de média simples!)
```

---

### ⏱️ Colunas de TEMPOS (Agregado)

| Coluna | Tipo | Descrição | Fonte | Fórmula |
|--------|------|-----------|-------|---------|
| `tempo_saida_bar` | NUMERIC | **Tempo médio Bar** (min) | contahub_tempo | `AVG(t0_t3) / 60` WHERE categoria='drink' |
| `tempo_saida_cozinha` | NUMERIC | **Tempo médio Cozinha** (min) | contahub_tempo | `AVG(t1_t2) / 60` WHERE categoria='comida' |
| `qtde_itens_bar` | INTEGER | **Quantidade itens Bar** | contahub_tempo | `COUNT(*) WHERE categoria='drink'` |
| `qtde_itens_cozinha` | INTEGER | **Quantidade itens Cozinha** | contahub_tempo | `COUNT(*) WHERE categoria='comida'` |

---

### 😤 Colunas de ATRASOS (Agregado Semanal)

**CRITICAL**: Há 3 níveis de atraso (atrasinho, atraso, atrasão)!

#### BAR/DRINKS

| Coluna | Tipo | Descrição | Limite | Fonte | Fórmula |
|--------|------|-----------|--------|-------|---------|
| `atrasinhos_bar` | INTEGER | **Atrasinhos Bar** | 4-8 min | contahub_tempo | `COUNT(*) WHERE t0_t3 > 240 AND t0_t3 <= 480` |
| `atraso_bar` | INTEGER | **Atrasos Bar** | 8-10 min | contahub_tempo | `COUNT(*) WHERE t0_t3 > 480 AND t0_t3 <= 600` |
| `atrasos_bar` | INTEGER | **ATRASÕES Bar** | >20 min | contahub_tempo | `COUNT(*) WHERE t0_t3 > 1200` |
| `atrasos_bar_perc` | NUMERIC | **% Atrasão Bar** | - | contahub_tempo | `(atrasos_bar / qtde_itens_bar) * 100` |

**Conversão de Segundos**:
- 4 min = 240 segundos
- 8 min = 480 segundos
- 10 min = 600 segundos
- 20 min = 1200 segundos

#### COZINHA/COMIDA

| Coluna | Tipo | Descrição | Limite | Fonte | Fórmula |
|--------|------|-----------|--------|-------|---------|
| `atrasinhos_cozinha` | INTEGER | **Atrasinhos Cozinha** | 15-20 min | contahub_tempo | `COUNT(*) WHERE t1_t2 > 900 AND t1_t2 <= 1200` |
| `atraso_cozinha` | INTEGER | **Atrasos Cozinha** | 20-30 min | contahub_tempo | `COUNT(*) WHERE t1_t2 > 1200 AND t1_t2 <= 1800` |
| `atrasos_cozinha` | INTEGER | **ATRASÕES Cozinha** | >30 min | contahub_tempo | `COUNT(*) WHERE t1_t2 > 1800` |
| `atrasos_cozinha_perc` | NUMERIC | **% Atrasão Cozinha** | - | contahub_tempo | `(atrasos_cozinha / qtde_itens_cozinha) * 100` |

**Conversão de Segundos**:
- 15 min = 900 segundos
- 20 min = 1200 segundos
- 30 min = 1800 segundos

#### DETALHES (JSONB)

| Coluna | Tipo | Descrição | Estrutura |
|--------|------|-----------|-----------|
| `atrasinhos_detalhes` | JSONB | Atrasinhos por dia | `[{ dia_semana, atrasinhos_bar, atrasinhos_cozinha, atraso_bar, atraso_cozinha }]` |
| `atraso_detalhes` | JSONB | Atrasos por dia | `[{ dia_semana, atrasinhos_bar, atrasinhos_cozinha, atraso_bar, atraso_cozinha }]` |
| `atrasos_bar_detalhes` | JSONB | Atrasões bar por dia | `[{ dia_semana, itens: [{ nome, atraso_minutos, quantidade }] }]` |
| `atrasos_cozinha_detalhes` | JSONB | Atrasões cozinha por dia | `[{ dia_semana, itens: [{ nome, atraso_minutos, quantidade }] }]` |

---

### 📊 Colunas de AVALIAÇÕES

| Coluna | Tipo | Descrição | Fonte | Obs |
|--------|------|-----------|-------|-----|
| `avaliacoes_5_google_trip` | INTEGER | Avaliações 5⭐ | Google/TripAdvisor | Reviews máximas |
| `media_avaliacoes_google` | NUMERIC | Média Google | Google Reviews | Média geral |
| `nps_geral` | NUMERIC | **NPS Geral** | Google Sheets | % Promotores - % Detratores |
| `nps_reservas` | NUMERIC | NPS Reservas | Google Sheets | NPS específico reservas |
| `nps_ambiente` | NUMERIC | NPS Ambiente | Google Sheets | Categoria ambiente |
| `nps_atendimento` | NUMERIC | NPS Atendimento | Google Sheets | Categoria atendimento |
| `nps_limpeza` | NUMERIC | NPS Limpeza | Google Sheets | Categoria limpeza |
| `nps_musica` | NUMERIC | NPS Música | Google Sheets | Categoria música |
| `nps_comida` | NUMERIC | NPS Comida | Google Sheets | Categoria comida |
| `nps_drink` | NUMERIC | NPS Drink | Google Sheets | Categoria drinks |
| `nps_preco` | NUMERIC | NPS Preço | Google Sheets | Categoria preço |

---

### 😊 Colunas de RH E EQUIPE

| Coluna | Tipo | Descrição | Fonte | Obs |
|--------|------|-----------|-------|-----|
| `nota_felicidade_equipe` | NUMERIC | Nota Felicidade | Google Sheets | Pesquisa interna |
| `quorum_pesquisa_felicidade` | NUMERIC | Quórum da pesquisa | ? | % de respostas |
| `nota_producao_bar` | NUMERIC | Nota Produção Bar | Manual | Avaliação interna |
| `nota_producao_cozinha` | NUMERIC | Nota Produção Cozinha | Manual | Avaliação interna |
| `perc_checklist_producao` | NUMERIC | % Checklist Produção | checklist_execucoes | % de conclusão |
| `perc_checklist_rh` | NUMERIC | % Checklist RH | checklist_execucoes | % de conclusão |
| `perc_checklist_semanal_terca` | NUMERIC | % Checklist Terça | checklist_execucoes | Checklist semanal |
| `vagas_abertas` | INTEGER | Vagas abertas | Manual | RH |
| `num_testes_ps` | INTEGER | Testes PS realizados | Manual | Processo seletivo |
| `perc_comparecimento_ps` | NUMERIC | % Comparecimento PS | Manual | Taxa de comparecimento |
| `aprovados_ps` | INTEGER | Aprovados no PS | Manual | RH |
| `absenteismo` | NUMERIC | % Absenteísmo | Manual | Faltas |
| `desvio_semana` | NUMERIC | Desvio da semana | ? | ? |

---

### 💳 Colunas FINANCEIRAS

| Coluna | Tipo | Descrição | Fonte | Obs |
|--------|------|-----------|-------|-----|
| `cancelamentos` | NUMERIC | Valor cancelado (R$) | contahub_analitico | Cancelamentos da semana |
| `cancelamentos_detalhes` | JSONB | Detalhes cancelamentos | contahub_analitico | `[{ dia_semana, data, valor }]` |
| `num_lancamentos_vencidos` | INTEGER | Lançamentos vencidos | NIBO | Contas a pagar vencidas |
| `conciliacoes_pendentes` | INTEGER | Conciliações pendentes | ? | Financeiro |
| `erros_pente_fino` | INTEGER | Erros no pente fino | ? | Auditoria |
| `lancamentos_atrasados` | INTEGER | Lançamentos atrasados | NIBO | Contas atrasadas |

---

### 📱 Colunas de MARKETING

**Orgânico (o_)**:
| Coluna | Tipo | Descrição | Fonte | Obs |
|--------|------|-----------|-------|-----|
| `o_num_posts` | INTEGER | Nº de posts | Meta/Instagram | Posts orgânicos |
| `o_alcance` | INTEGER | Alcance orgânico | Meta | Pessoas alcançadas |
| `o_interacao` | INTEGER | Interações | Meta | Curtidas, comentários |
| `o_compartilhamento` | INTEGER | Compartilhamentos | Meta | Shares |
| `o_engajamento` | NUMERIC | Taxa de engajamento % | Meta | `(interacao / alcance) * 100` |
| `o_num_stories` | INTEGER | Nº de stories | Meta | Stories publicados |
| `o_visu_stories` | INTEGER | Visualizações stories | Meta | Views dos stories |

**Mídia Paga (m_)**:
| Coluna | Tipo | Descrição | Fonte | Obs |
|--------|------|-----------|-------|-----|
| `m_valor_investido` | NUMERIC | Valor investido (R$) | Meta Ads | Budget |
| `m_alcance` | INTEGER | Alcance pago | Meta Ads | Pessoas alcançadas |
| `m_frequencia` | NUMERIC | Frequência | Meta Ads | Vezes que cada pessoa viu |
| `m_cpm` | NUMERIC | CPM (R$) | Meta Ads | Custo por mil impressões |
| `m_cliques` | INTEGER | Cliques | Meta Ads | Total de cliques |
| `m_ctr` | NUMERIC | CTR % | Meta Ads | `(cliques / impressoes) * 100` |
| `m_custo_por_clique` | NUMERIC | CPC (R$) | Meta Ads | Custo por clique |
| `m_conversas_iniciadas` | INTEGER | Conversas no WhatsApp | Meta Ads | Leads gerados |

---

### 🛠️ Colunas de CONTROLE

| Coluna | Tipo | Descrição | Obs |
|--------|------|-----------|-----|
| `created_at` | TIMESTAMPTZ | Data de criação | Auto |
| `updated_at` | TIMESTAMPTZ | Última atualização | Auto |
| `atualizado_em` | TIMESTAMPTZ | Última atualização (dup) | Auto |
| `atualizado_por` | TEXT | ID do usuário | Manual |
| `atualizado_por_nome` | TEXT | Nome do usuário | Manual |
| `observacoes` | TEXT | Observações livres | Manual |

---

## 😤 REGRAS DE ATRASOS

### 🎯 Definições Oficiais

#### Para BAR/DRINKS

**Campo usado**: `t0_t3` (tempo total: lançamento até entrega)  
**Unidade no banco**: SEGUNDOS

| Categoria | Nome | Limite | Descrição |
|-----------|------|--------|-----------|
| 🟢 **NORMAL** | Normal | 0 - 4 min | Dentro do esperado |
| 🟡 **ATRASINHO** | Atrasinho | 4 - 8 min | Leve atraso aceitável |
| 🟠 **ATRASO** | Atraso | 8 - 10 min | Atraso moderado |
| 🔴 **ATRASÃO** | Atrasão | > 20 min | Atraso crítico inaceitável |

**Limites em Segundos**:
- Normal: 0 - 240s
- Atrasinho: 241 - 480s
- Atraso: 481 - 600s
- **GAP**: 601 - 1199s (não categorizado?)
- Atrasão: >= 1200s

**Query SQL**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE t0_t3 > 240 AND t0_t3 <= 480) as atrasinhos,
  COUNT(*) FILTER (WHERE t0_t3 > 480 AND t0_t3 <= 600) as atrasos,
  COUNT(*) FILTER (WHERE t0_t3 > 1200) as atrasoes
FROM contahub_tempo
WHERE bar_id = 3 
  AND data = '2026-03-01'
  AND categoria = 'drink'
```

#### Para COZINHA/COMIDA

**Campo usado**: `t1_t2` (tempo de produção: início até fim)  
**Unidade no banco**: SEGUNDOS

| Categoria | Nome | Limite | Descrição |
|-----------|------|--------|-----------|
| 🟢 **NORMAL** | Normal | 0 - 15 min | Dentro do esperado |
| 🟡 **ATRASINHO** | Atrasinho | 15 - 20 min | Leve atraso aceitável |
| 🟠 **ATRASO** | Atraso | 20 - 30 min | Atraso moderado |
| 🔴 **ATRASÃO** | Atrasão | > 30 min | Atraso crítico inaceitável |

**Limites em Segundos**:
- Normal: 0 - 900s
- Atrasinho: 901 - 1200s
- Atraso: 1201 - 1800s
- Atrasão: >= 1801s

**Query SQL**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE t1_t2 > 900 AND t1_t2 <= 1200) as atrasinhos,
  COUNT(*) FILTER (WHERE t1_t2 > 1200 AND t1_t2 <= 1800) as atrasos,
  COUNT(*) FILTER (WHERE t1_t2 > 1800) as atrasoes
FROM contahub_tempo
WHERE bar_id = 3 
  AND data = '2026-03-01'
  AND categoria = 'comida'
```

### 🔄 Agregação Semanal de Atrasos

**Método**: SOMA simples de todos os atrasos da semana

```typescript
// Para a semana (ex: 23/fev - 01/mar)
const tempoData = await supabase
  .from('contahub_tempo')
  .select('categoria, t0_t3, t1_t2')
  .eq('bar_id', barId)
  .gte('data', '2026-02-23')
  .lte('data', '2026-03-01')

// Filtrar por categoria
const tempoDrinks = tempoData.filter(t => t.categoria === 'drink')
const tempoComida = tempoData.filter(t => t.categoria === 'comida')

// Contar atrasos BAR
const atrasinhosBar = tempoDrinks.filter(t => t.t0_t3 > 240 && t.t0_t3 <= 480).length
const atrasoBar = tempoDrinks.filter(t => t.t0_t3 > 480 && t.t0_t3 <= 600).length
const atrasoesBar = tempoDrinks.filter(t => t.t0_t3 > 1200).length
const atrasoesBarPerc = (atrasoesBar / tempoDrinks.length) * 100

// Contar atrasos COZINHA
const atrasinhosCozinha = tempoComida.filter(t => t.t1_t2 > 900 && t.t1_t2 <= 1200).length
const atrasoCozinha = tempoComida.filter(t => t.t1_t2 > 1200 && t.t1_t2 <= 1800).length
const atrasoesCozinha = tempoComida.filter(t => t.t1_t2 > 1800).length
const atrasoesCozinhaPerc = (atrasoesCozinha / tempoComida.length) * 100
```

### 📊 Exemplo Real

**Semana 9/2026 - Ordinário (23/fev - 01/mar)**:

**Dados Reais do ContaHub**:
- Bar: 2.149 itens → 366 atrasinhos (17%), 25 atrasos (1.2%), 12 atrasões (0.56%)
- Cozinha: 892 itens → 51 atrasinhos (5.7%), 14 atrasos (1.6%), 1 atrasão (0.11%)

**Dados Salvos no Banco (ERRADOS!)**:
- Bar: 10 atrasinhos, 2 atrasos, 0 atrasões ❌
- Cozinha: 7 atrasinhos, 0 atrasos, 0 atrasões ❌

**Causa**: Edge Function `recalcular-desempenho-auto` NÃO está calculando atrasos!

---

## 🍹 REGRAS DE MIX DE PRODUTOS

### 📦 Categorização de Produtos

**Baseada em**: `contahub_analitico.grp_desc` (grupo do produto)

#### BEBIDAS (percent_b)

**Grupos incluídos**:
- Cerveja em Lata
- Cerveja em Garrafa
- Cerveja em Barril
- Chopp Claro
- Chopp Escuro
- Baldes de Cerveja
- Vinho Tinto
- Vinho Branco
- Espumante
- Água
- Refrigerante
- Energético

#### DRINKS (percent_d)

**Grupos incluídos**:
- Drinks Autorais
- Drinks Clássicos
- Pressh (drinks prontos)
- Montados
- Mexidos
- Batidos
- Shot e Dose
- Cachaças Premium
- Destilados

#### COMIDA (percent_c)

**Grupos incluídos**:
- Pratos Executivos
- Pratos Principais
- Sanduíches
- Hambúrgueres
- Petiscos Quentes
- Petiscos Frios
- Porções
- Sobremesas
- Combos

#### HAPPY HOUR (percent_happy_hour)

**Grupo específico**: "Happy Hour"

**Características**:
- Produtos com preço promocional
- Geralmente disponível 18h-20h
- Pode incluir bebidas, drinks e comidas
- Identificado pelo grupo "Happy Hour" no ContaHub

### 🧮 Cálculo do Mix (DIÁRIO)

**Fórmula para cada categoria**:

```sql
-- Para um dia específico
SELECT 
  evento_id,
  -- % Bebidas
  (SUM(valorfinal) FILTER (WHERE grp_desc IN ('Cerveja em Lata', 'Chopp Claro', ...))
   / SUM(valorfinal) * 100) as percent_b,
  
  -- % Drinks  
  (SUM(valorfinal) FILTER (WHERE grp_desc IN ('Drinks Autorais', 'Pressh', ...))
   / SUM(valorfinal) * 100) as percent_d,
  
  -- % Comida
  (SUM(valorfinal) FILTER (WHERE grp_desc IN ('Pratos Executivos', 'Sanduíches', ...))
   / SUM(valorfinal) * 100) as percent_c,
   
  -- % Happy Hour
  (SUM(valorfinal) FILTER (WHERE grp_desc = 'Happy Hour')
   / SUM(valorfinal) * 100) as percent_happy_hour

FROM contahub_analitico
WHERE bar_id = 3 
  AND trn_dtgerencial = '2026-03-01'
  AND prd_desc NOT LIKE '[HH]%'  -- Excluir duplicatas HH
  AND prd_desc NOT LIKE '[DD]%'  -- Excluir dose dupla
  AND prd_desc NOT LIKE '[IN]%'  -- Excluir insumos
GROUP BY evento_id
```

### 🔄 Agregação Semanal do Mix

**Método**: **MÉDIA PONDERADA pelo faturamento**

**Por que média ponderada?**
- Um dia com R$ 100k tem mais peso que um dia com R$ 10k
- Reflete melhor o comportamento real do negócio

**Fórmula**:

```typescript
// Para cada categoria (bebidas, drinks, comida, happy hour)
const percPonderado = eventos.reduce((soma, evento) => {
  // Multiplicar faturamento do dia pelo % da categoria
  const valorCategoria = evento.real_r * (evento.percent_categoria / 100)
  return soma + valorCategoria
}, 0) / faturamentoTotalSemana * 100

// Exemplo com 2 dias:
// Dia 1: R$ 100.000 com 60% bebidas = R$ 60.000 em bebidas
// Dia 2: R$ 10.000 com 20% bebidas = R$ 2.000 em bebidas
// Total: R$ 110.000 com R$ 62.000 em bebidas = 56.36% bebidas
// (NÃO é 40% que seria a média simples de 60% e 20%)
```

**Implementação**:

```typescript
// Edge Function: recalcular-desempenho-auto
const { data: eventos } = await supabase
  .from('eventos_base')
  .select('real_r, percent_b, percent_d, percent_c, percent_happy_hour')
  .eq('bar_id', barId)
  .gte('data_evento', startDate)
  .lte('data_evento', endDate)
  .eq('ativo', true)
  .not('real_r', 'is', null)
  .gt('real_r', 0)

const faturamentoTotal = eventos.reduce((sum, e) => sum + parseFloat(e.real_r), 0)

const somaBebidasPonderada = eventos.reduce((sum, e) => 
  sum + (parseFloat(e.real_r) * (parseFloat(e.percent_b) || 0) / 100), 0)

const percBebidasPonderado = (somaBebidasPonderada / faturamentoTotal) * 100
```

### ⚠️ Tratamento de Dias Atípicos

**Problema**: Dias com comportamento diferente distorcem a média.

**Exemplo - Carnaval 2026 (13-17/fev)**:
- Quinta 14/02: R$ 126k com **77.44% comida** (atípico!)
- Puxou média da semana 7 para 41.9% comida
- Ordinário normalmente tem ~15-20% comida

**Solução Futura**: Sistema de dias ativos/inativos
- Marcar dias atípicos como "inativos"
- Não considerar no cálculo de % mix
- Manter faturamento e clientes

---

## 🍹 REGRAS DE HAPPY HOUR

### 📖 Definição

**Happy Hour** = Produtos vendidos com preço promocional em horário específico.

**Horário Padrão**: 18h - 20h (pode variar)

### 🏷️ Como Identificar

**Método 1 - Por Grupo** (ATUAL):
```sql
WHERE grp_desc = 'Happy Hour'
```

**Método 2 - Por Horário** (ALTERNATIVO):
```sql
WHERE EXTRACT(HOUR FROM t0_lancamento) BETWEEN 18 AND 19
  AND prd_desc LIKE '%HH%'  -- Produtos marcados
```

### 📊 Cálculo do % Happy Hour

**Diário** (eventos_base):
```sql
SELECT 
  (SUM(valorfinal) FILTER (WHERE grp_desc = 'Happy Hour') 
   / SUM(valorfinal) * 100) as percent_happy_hour
FROM contahub_analitico
WHERE bar_id = 3 
  AND trn_dtgerencial = '2026-03-01'
```

**Semanal** (desempenho_semanal):
```typescript
// Média PONDERADA pelo faturamento
const somaHappyHourPonderada = eventos.reduce((sum, e) => 
  sum + (e.real_r * (e.percent_happy_hour || 0) / 100), 0)

const percHappyHourSemanal = (somaHappyHourPonderada / faturamentoTotal) * 100
```

### 🎯 Meta Típica

**% Happy Hour esperado**: 8-15% do faturamento

**Dias com mais HH**:
- Terças e Quartas: 10-20% (dias mais tranquilos)
- Quintas e Sextas: 5-10% (dias movimentados)
- Sábados e Domingos: 0-5% (dias de maior ticket)

---

## 🛑 REGRAS DE STOCKOUT

### 📖 Definição

**Stockout** = Produto cadastrado como ativo mas **sem estoque** para venda.

**Campo do ContaHub**: `prd_venda`
- `'S'` = Produto disponível para venda
- `'N'` = Produto SEM estoque (stockout)

### 🏷️ Produtos EXCLUÍDOS do Stockout

**Prefixos no nome** (`prd_desc`):
1. `[HH]` - Happy Hour (produtos promocionais)
2. `[DD]` - Dose Dupla (promoções)
3. `[IN]` - Insumos (não vendáveis)

**Grupos excluídos** (`grp_desc`):
- Qualquer grupo com "Insumo" no nome

**Motivo**: Esses produtos não são vendas normais e distorcem a métrica.

### 📦 Categorias de Stockout

#### Por Local (loc_desc)

**BAR/BEBIDAS**:
- Baldes
- Chopp
- Pegue e Pague
- Venda Volante
- Bar

**DRINKS**:
- Pressh
- Preshh
- Montados
- Mexido
- Drinks
- Drinks Autorais
- Shot e Dose
- Batidos

**COMIDA**:
- Cozinha
- Cozinha 1
- Cozinha 2

### 🧮 Cálculo do Stockout

**Diário** (eventos_base):
```sql
SELECT 
  (COUNT(*) FILTER (WHERE prd_venda = 'N')::numeric 
   / COUNT(*) * 100) as percent_stockout
FROM contahub_stockout
WHERE bar_id = 3
  AND data_consulta = '2026-03-01'
  AND prd_ativo = 'S'
  AND prd_desc NOT LIKE '[HH]%'
  AND prd_desc NOT LIKE '[DD]%'
  AND prd_desc NOT LIKE '[IN]%'
  AND grp_desc NOT LIKE '%Insumo%'
```

**Semanal por Categoria**:
```sql
-- Stockout DRINKS
SELECT 
  COUNT(*) FILTER (WHERE prd_venda = 'N') as sem_estoque,
  COUNT(*) as total,
  (COUNT(*) FILTER (WHERE prd_venda = 'N')::numeric / COUNT(*) * 100) as perc
FROM contahub_stockout
WHERE bar_id = 3
  AND data_consulta BETWEEN '2026-02-23' AND '2026-03-01'
  AND prd_ativo = 'S'
  AND loc_desc IN ('Pressh', 'Preshh', 'Montados', 'Mexido', 'Drinks', 'Drinks Autorais', 'Shot e Dose', 'Batidos')
  AND prd_desc NOT LIKE '[HH]%'
  AND prd_desc NOT LIKE '[DD]%'
  AND prd_desc NOT LIKE '[IN]%'

-- Stockout COMIDAS
WHERE loc_desc IN ('Cozinha', 'Cozinha 1', 'Cozinha 2')

-- Stockout BAR
WHERE loc_desc IN ('Baldes', 'Chopp', 'Pegue e Pague', 'Venda Volante', 'Bar')
```

### 🎯 Metas de Stockout

**Meta Ideal**: < 5%  
**Aceitável**: 5-10%  
**Problemático**: > 10%  
**Crítico**: > 15%

**Stockout médio histórico Ordinário**: 8.55% (corrigido 26/02/2026)

---

## ⏱️ REGRAS DE TEMPOS

### 📖 Definição

**Tempos de Preparação e Entrega** medidos pelo ContaHub KDS (Kitchen Display System).

### 🕐 Timestamps do ContaHub

**Campos na tabela `contahub_tempo`**:

| Campo | Descrição | Quando ocorre |
|-------|-----------|---------------|
| `t0_lancamento` | Pedido lançado | Cliente faz pedido no garçom/balcão |
| `t1_prodini` | Produção iniciada | Chef/bartender começa a preparar |
| `t2_prodfim` | Produção finalizada | Item está pronto |
| `t3_entrega` | Entregue ao cliente | Cliente recebeu o pedido |

**Intervalos** (em segundos):

| Campo | Descrição | O que mede |
|-------|-----------|------------|
| `t0_t1` | Tempo até iniciar | Demora para começar a preparar |
| `t1_t2` | Tempo de produção | Quanto tempo leva para preparar |
| `t2_t3` | Tempo até entregar | Demora entre pronto e entregue |
| `t0_t2` | Tempo até ficar pronto | Total até estar pronto |
| `t0_t3` | **TEMPO TOTAL** | Total desde pedido até entrega |
| `t1_t3` | Produção + entrega | Tempo de produção + espera |

### 🍹 BAR/DRINKS - Qual tempo usar?

**Ordinário (bar_id = 3)**:
- Campo: `t0_t3` (tempo total)
- Motivo: Medir desde o pedido até a entrega

**Deboche (bar_id = 4)**:
- Campo: `t0_t2` (até ficar pronto)
- Motivo: Diferença operacional do bar

### 🍽️ COZINHA/COMIDA - Qual tempo usar?

**Ordinário (bar_id = 3)**:
- Campo: `t1_t2` (tempo de produção)
- Motivo: Medir eficiência da cozinha

**Deboche (bar_id = 4)**:
- Campo: `t0_t2` (até ficar pronto)
- Motivo: Operação diferente

### 📊 Cálculo dos Tempos

**Diário** (eventos_base):

```sql
-- Ordinário
SELECT 
  AVG(t1_t2) / 60.0 as t_coz,  -- Converter para minutos
  AVG(t0_t3) / 60.0 as t_bar
FROM contahub_tempo
WHERE bar_id = 3
  AND data = '2026-03-01'
  AND t1_t2 > 0 AND t1_t2 <= 2700  -- Filtrar outliers (45 min max)
  AND t0_t3 > 0 AND t0_t3 <= 1200  -- Filtrar outliers (20 min max)

-- Deboche  
SELECT 
  AVG(t0_t2) / 60.0 as t_coz,
  AVG(t0_t2) / 60.0 as t_bar
FROM contahub_tempo
WHERE bar_id = 4
  AND data = '2026-03-01'
```

**Semanal** (desempenho_semanal):

```typescript
// Média simples dos tempos da semana
const tempoData = await supabase
  .from('contahub_tempo')
  .select('categoria, t0_t3, t1_t2')
  .eq('bar_id', barId)
  .gte('data', startDate)
  .lte('data', endDate)

const tempoDrinks = tempoData.filter(t => t.categoria === 'drink')
const tempoComida = tempoData.filter(t => t.categoria === 'comida')

// CONVERTER DE SEGUNDOS PARA MINUTOS!
const tempoSaidaBar = tempoDrinks.reduce((sum, t) => 
  sum + parseFloat(t.t0_t3), 0) / tempoDrinks.length / 60.0

const tempoSaidaCozinha = tempoComida.reduce((sum, t) => 
  sum + parseFloat(t.t1_t2), 0) / tempoComida.length / 60.0
```

### 🎯 Metas de Tempo

**Bar/Drinks**:
- ⭐ Excelente: < 3 min
- ✅ Bom: 3-5 min
- ⚠️ Aceitável: 5-8 min
- 🔴 Problemático: > 8 min

**Cozinha/Comida**:
- ⭐ Excelente: < 10 min
- ✅ Bom: 10-15 min
- ⚠️ Aceitável: 15-20 min
- 🔴 Problemático: > 20 min

---

## 📊 AGREGAÇÕES SEMANAIS

### 🔄 Como Funciona

**Fluxo Oficial**:

```
1️⃣ COLETA DIÁRIA (ContaHub → Banco)
   ├─ 10h: Cron `contahub-sync-7h-ambos`
   ├─ Coleta 7 tipos de dados do ContaHub
   └─ Salva em tabelas: contahub_analitico, contahub_tempo, etc

2️⃣ PROCESSAMENTO DIÁRIO (eventos_base)
   ├─ 11h: Cron `contahub-update-eventos-ambos`
   ├─ Chama função `update_eventos_ambos_bares()`
   ├─ Calcula métricas DIÁRIAS de cada evento
   └─ Atualiza eventos_base (real_r, percent_b, t_coz, etc)

3️⃣ AGREGAÇÃO SEMANAL (desempenho_semanal)
   ├─ 11h: Cron `desempenho-auto-diario`
   ├─ Chama função `executar_recalculo_desempenho_auto()`
   ├─ Chama Edge Function `recalcular-desempenho-auto`
   ├─ LÊ eventos_base da semana
   ├─ AGREGA métricas semanais
   └─ Atualiza desempenho_semanal
```

### ✅ O QUE ESTÁ SENDO AGREGADO HOJE

**Edge Function**: `recalcular-desempenho-auto/index.ts`

**Linhas 77-223** agregam:

1. **Faturamento** ✅
   - Soma de `eventos_base.real_r`
   - Menos conta assinada do `contahub_pagamentos`

2. **Clientes** ✅
   - Soma de `eventos_base.cl_real`

3. **Ticket Médio** ✅
   - `faturamento_total / clientes_atendidos`

4. **Metas** ✅
   - Soma de `eventos_base.m1_r`

5. **Reservas e Mesas** ✅
   - Soma de `res_tot`, `res_p`, `num_mesas_tot`, `num_mesas_presentes`

6. **Stockout %** ✅
   - Média de % stockout de drinks e comidas do `contahub_stockout`

7. **Mix de Produtos %** ✅
   - Média PONDERADA de `percent_b`, `percent_d`, `percent_c`, `percent_happy_hour`

### ❌ O QUE ESTÁ FALTANDO

1. **Tempos** ❌
   - `tempo_saida_bar` - Tempo médio drinks
   - `tempo_saida_cozinha` - Tempo médio comida
   - `qtde_itens_bar` - Quantidade de itens bar
   - `qtde_itens_cozinha` - Quantidade de itens cozinha

2. **Atrasos** ❌
   - `atrasinhos_bar` / `atrasinhos_cozinha`
   - `atraso_bar` / `atraso_cozinha`
   - `atrasos_bar` / `atrasos_cozinha`
   - `atrasos_bar_perc` / `atrasos_cozinha_perc`
   - `atrasinhos_detalhes` / `atraso_detalhes` (JSONB)

3. **Outros 30+ Campos** ❌
   - Retenção, Clientes novos, CMV detalhado, CMO detalhado, etc.

---

## 📅 AGREGAÇÕES MENSAIS

### 🔄 Como Funciona

**Arquivo**: `frontend/src/app/estrategico/desempenho/services/desempenho-mensal-service.ts`

**Método Híbrido**:
1. **Dados Diários**: Busca `eventos_base` do mês inteiro
2. **Dados Semanais Proporcionais**: Busca `desempenho_semanal` das semanas que tocam o mês

**Por que híbrido?**
- Algumas métricas são melhores somadas dos dias (faturamento)
- Outras são melhores das semanas (atrasos já agregados)

### 📐 Semanas Proporcionais

**Problema**: Semanas cortam o mês.

**Exemplo - Março 2026**:
- Semana 9: 23/fev - 01/mar (1 dia em março = 14.3% da semana)
- Semana 10: 02-08/mar (7 dias em março = 100% da semana)
- Semana 13: 23-29/mar (7 dias em março = 100%)
- Semana 14: 30/mar - 05/abr (2 dias em março = 28.6% da semana)

**Solução**: Proporcionar semanas:
```typescript
const proporcao = diasNoMes / 7  // Ex: 2 dias = 0.286

const metricaProporcional = semanasComProporcao.reduce((sum, s) => {
  const valorSemana = desempenhoMap.get(`${s.anoISO}-${s.semana}`)
  return sum + (valorSemana?.metrica || 0) * s.proporcao
}, 0)
```

---

## 📋 PLANEJAMENTO COMERCIAL

### 📖 Definição

**Planejamento Comercial** = Previsão de métricas para eventos futuros.

**Onde está**: Tela `/estrategico/planejamento-comercial`

### 📊 Estrutura

**Não há tabela `planejamento_comercial`!**

Os dados de planejamento estão em `eventos_base` com sufixo `_plan`:
- `m1_r` - Meta de receita
- `cl_plan` - Clientes planejados
- `te_plan` - Ticket entrada planejado
- `tb_plan` - Ticket bar planejado
- `res_p` - Reservas planejadas
- `c_artistico_plan` - Custo artístico planejado

### 📝 Processo de Planejamento

**1. Criar Evento** (Manual):
- Data do evento
- Nome e artista
- Gênero musical
- Meta de faturamento (m1_r)
- Clientes esperados (cl_plan)
- Tickets esperados (te_plan, tb_plan)
- Custo artístico (c_artistico_plan)

**2. Após Evento Acontecer** (Automático):
- ContaHub sync coleta dados reais
- Função `calculate_evento_metrics` calcula realizado
- Preenche campos `_real`

**3. Análise de Atingimento**:
- Compara planejado (_plan) vs realizado (_real)
- Calcula % atingimento
- Identifica desvios

### 📊 Métricas de Planejamento

**Principais**:
1. **Meta M1** - Faturamento esperado
2. **Clientes Planejados** - Público esperado
3. **Ticket Esperado** - Valor médio por pessoa
4. **ROI Esperado** - Retorno sobre custo artístico

**Cálculos**:
```typescript
const atingimento = (real_r / m1_r) * 100
const desvioClientes = cl_real - cl_plan
const desvioTicket = t_medio - (te_plan + tb_plan)
const roiReal = (real_r / (c_art + c_prod)) * 100
```

---

## 🚀 PRÓXIMAS SEÇÕES A DOCUMENTAR

1. ❌ CMV - Custo das Mercadorias Vendidas
2. ❌ CMO - Custo de Mão de Obra
3. ❌ CMA - Custo de Alimentação
4. ❌ Retenção de Clientes
5. ❌ NPS e Avaliações
6. ❌ Marketing (Orgânico e Pago)
7. ❌ Checklists e Produção
8. ❌ RH e Absenteísmo
9. ❌ Financeiro (NIBO)

---

**Status**: 🟡 EM CONSTRUÇÃO - Continuar documentando...
