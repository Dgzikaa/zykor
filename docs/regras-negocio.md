# Regras de Negócio — Sistema Zykor (SGB)

> **Documento de referência** para validação semanal de dados.  
> Toda semana, conferir se os dados batem com estas regras antes de enviar relatórios.  
> Atualizado em: 08/04/2026

---

## Índice

1. [Bares e Identidades](#1-bares-e-identidades)
2. [Pipeline de Dados — ContaHub](#2-pipeline-de-dados--contahub)
3. [Desempenho Semanal](#3-desempenho-semanal)
4. [Stockout](#4-stockout)
5. [CMV Semanal](#5-cmv-semanal)
6. [Planejamento Comercial](#6-planejamento-comercial)
7. [Campos Manuais (Nunca Sobrescrever)](#7-campos-manuais-nunca-sobrescrever)
8. [Configurações Críticas por Bar no Banco](#8-configurações-críticas-por-bar-no-banco)
9. [Checklist de Validação Semanal](#9-checklist-de-validação-semanal)

---

## 1. Bares e Identidades

| Bar | `bar_id` | Dias de Operação | Observação |
|-----|----------|-----------------|------------|
| **Ordinário Bar** | `3` | Todos os dias | Principal, maior volume |
| **Deboche Bar** | `4` | Terça a Domingo | Só segunda não abre |

**Regra fundamental:** SEMPRE filtrar por `bar_id` em todas as queries. NUNCA assumir um bar.

---

## 2. Pipeline de Dados — ContaHub

### 2.1 Fluxo Geral

```
ContaHub API → contahub_raw_data → contahub-processor → tabelas processadas → calculadores → desempenho_semanal
```

### 2.2 Coleta (contahub-sync-automatico)

**Queries ContaHub (por ID):**
| ID | Dados |
|----|-------|
| 77 | Analítico |
| 81 | Tempo de produção |
| 7 | Pagamentos |
| 101 | Faturamento por hora |
| 5 | Período |
| 57 | Cancelamentos |

**Locais coletados (Ordinário):**
`Bar`, `Cozinha 1`, `Cozinha 2`, `Montados`, `Baldes`, `Shot e Dose`, `Chopp`, `Batidos`, `Preshh`, `Mexido`, `Venda Volante`, `Pegue e Pague`, vazio (`''`)

**Retry:** máx 3 tentativas, base 1000ms. Delay 300ms entre locais.  
**Lock:** 30 minutos para evitar execuções paralelas.

### 2.3 Processamento (contahub-processor)

#### Regra de Data Real

```
Se dataLancamento > dtGerencial E hora >= 15h:
    data_real = dataLancamento
Senão:
    data_real = dtGerencial
```

> **Pagamentos:** NÃO corrigem data por hora. Usam apenas `dt_gerencial`.

#### Categorização de Produtos

| `grp_desc` contém | Categoria | Tempo calculado |
|-------------------|-----------|-----------------|
| `cerveja`, `bebida` | `bebida` | `t0_t3` |
| `drink` | `drink` | `t0_t3` |
| qualquer outro | `comida` | `t0_t2` |

#### Regra de Tempo (minutos)

- ContaHub envia intervalos em **segundos → dividir por 60**
- Se `t0_t3 > 1440` (= 24h) **ou** `t0_t3 === 0`: recalcular por timestamps
- `tempo_final` é o campo calculado final para cada pedido

#### Filtros de Venda

- Registros sem campo `vd` (voucher/venda) são **descartados**

#### Cancelamentos — `custototal`

```
custototal = Σ(itm_vrcheio × qtd) em raw_data
```
Usa fallbacks se campos não disponíveis.

#### Tabelas Populadas pelo Processor

| Tabela | Conteúdo |
|--------|----------|
| `contahub_analitico` | Vendas analíticas por transação |
| `contahub_periodo` | Resumo por período |
| `contahub_fatporhora` | Faturamento por hora |
| `contahub_pagamentos` | Pagamentos |
| `contahub_tempo` | Tempos de produção |
| `contahub_prodporhora` | Produção por hora |
| `contahub_vendas` | Vendas consolidadas |
| `contahub_cancelamentos` | Cancelamentos com `custototal` |

#### UPSERT (não INSERT)

Desde 08/04/2026, o processor usa **UPSERT** em `contahub_tempo` para evitar duplicados em syncs diários.

### 2.5 ⚠️ Regra Crítica: `visitas` e `contahub_periodo`

**Fonte de verdade de couvert e comissão é `contahub_periodo`**, nunca `visitas` diretamente.

A tabela `visitas` é populada pelo `adapter_contahub_to_visitas` com `ON CONFLICT (bar_id, origem, origem_ref)` — ou seja, cada registro de `contahub_periodo` tem exatamente 1 registro em `visitas` pelo `origem_ref = cp.id`.

**Bug corrigido em 08/04/2026:**  
`process_periodo_data` fazia `DELETE + INSERT` em `contahub_periodo`, gerando IDs novos. Os registros antigos de `visitas` (com `origem_ref` para os IDs velhos) ficavam como órfãos — **dobrando couvert e comissão no desempenho**.

**Fix aplicado:** `process_periodo_data` agora limpa `visitas` do dia **antes** de limpar `contahub_periodo`:
```sql
DELETE FROM visitas WHERE bar_id = p_bar_id AND data_visita = p_data_date AND origem = 'contahub';
-- só então: DELETE FROM contahub_periodo
```

**Verificação de sanidade (rodar se suspeitar de duplicata):**
```sql
-- Deve retornar 0 linhas
SELECT bar_id, COUNT(*) as orfaos
FROM visitas v
WHERE origem = 'contahub'
  AND NOT EXISTS (
    SELECT 1 FROM contahub_periodo cp
    WHERE cp.id = v.origem_ref AND cp.bar_id = v.bar_id
  )
GROUP BY bar_id;
```

### 2.4 Resync Semanal (contahub-resync-semanal)

- Padrão: `bar_id = 3`, `dias_anteriores = 7`
- Processa 1 dia por vez em ordem cronológica
- Delay de **2000ms** entre dias
- Aguarda **30 segundos** antes de verificar `contahub_raw_data`
- Chama `contahub-sync-automatico` para cada dia

---

## 3. Desempenho Semanal

### 3.1 Tabela Principal: `desempenho_semanal`

Populada pelo engine `recalcular-desempenho-v2`, que executa **6 calculadores em paralelo**.

**Chaves:** `bar_id` + `ano` + `numero_semana` (ISO week)  
**Tolerância de diff:** 1% (campos com variação < 1% não geram alerta)

### 3.2 Calculador: Faturamento

**Fonte:** `eventos_base` (filtro: `ativo = true`)

| Campo | Fórmula |
|-------|---------|
| `faturamento_total` | `Σ real_r` |
| `faturamento_entrada` | `Σ faturamento_entrada` |
| `faturamento_bar` | `Σ faturamento_bar` |
| `clientes_atendidos` | `Σ cl_real` |
| `ticket_medio` | `faturamento_total / clientes_atendidos` |
| `tm_entrada` | `faturamento_entrada / clientes_atendidos` |
| `tm_bar` | `faturamento_bar / clientes_atendidos` |
| `meta_semanal` | `Σ m1_r` de `eventos_base` (meta de faturamento por dia somada) |
| `reservas_totais` | `Σ res_tot` |
| `reservas_presentes` | `Σ res_p` |
| `mesas_totais` | `Σ num_mesas_tot` |
| `mesas_presentes` | `Σ num_mesas_presentes` |
| `desconto_total` | `Σ desconto` de `contahub_analitico` |
| `desconto_percentual` | `(desconto_total / faturamento_total) × 100` (2 casas) |

**Observações por bar:**
- **Ordinário (3):** ticket médio automático (ContaHub)
- **Deboche (4):** ticket médio **manual** (Stone) — campo preenchido manualmente

### 3.3 Calculador: Custos

**Custo de Atração:**
- Fonte: `contaazul_lancamentos` (tipo `DESPESA`)
- Categorias: definidas em `bar_categorias_custo` (tipo `atracao`, ativo = true) — **por bar**
- **Ordinário (3):** `Atrações Programação` + `Produção Eventos`
- **Deboche (4):** `Atrações/Eventos` + `Administrativo Deboche`
- Filtro: `data_competencia` no período da semana
- ⚠️ Os nomes das categorias devem bater **exatamente** (com acentos) com os nomes no Conta Azul

| Campo | Fórmula |
|-------|---------|
| `custo_atracao_faturamento` | `(custoAtracao / faturamentoTotal) × 100` |
| `atracoes_eventos` | `Σ valor_bruto` dos lançamentos de atração |
| `couvert_atracoes` | `Σ valor_couvert` de `visitas` |
| `comissao` | `Σ valor_repique` de `visitas` |
| `cancelamentos` | `Σ custototal` de `contahub_cancelamentos` |

**Alerta automático:** Se `custo_atracao_faturamento < 3%` e `faturamento_total > R$10.000` → warning nos logs (verificar lançamentos no Conta Azul).

### 3.4 Calculador: Operacional

#### Stockout (via RPC `calcular_stockout_semanal`)

| Campo | Categoria RPC |
|-------|--------------|
| `stockout_bar` / `stockout_bar_perc` | `Bebidas` |
| `stockout_drinks` / `stockout_drinks_perc` | `Drinks` |
| `stockout_comidas` / `stockout_comidas_perc` | `Comidas` |

#### Mix de Vendas (ponderado por faturamento_bar)

```
perc_bebidas_semanal = Σ(percent_b × faturamento_bar) / Σ faturamento_bar
perc_drinks_semanal  = Σ(percent_d × faturamento_bar) / Σ faturamento_bar
perc_comida_semanal  = Σ(percent_c × faturamento_bar) / Σ faturamento_bar
perc_happy_hour      = Σ(percent_happy_hour × faturamento_bar) / Σ faturamento_bar
```

Fonte: `eventos_base` (filtro: `ativo = true` E `real_r > 0`)

**Cadeia do Happy Hour:**
`contahub_analitico` (onde `grp_desc = 'Happy Hour'`) → processado para `eventos_base.percent_happy_hour` → calculador semanal

#### Tempo de Saída (RPC `calcular_tempo_saida`)

Média de TODOS os pedidos válidos (sem outliers), por categoria.

| Campo | Fórmula |
|-------|---------|
| `tempo_saida_bar` | AVG(`tempo_final`) onde bebida/drink E `0 < tempo_final ≤ 60` |
| `tempo_saida_cozinha` | AVG(`tempo_final`) onde comida E `0 < tempo_final ≤ 60` |

#### Atrasinhos, Atrasos e Outliers — Mapa Completo

Todos os dados vêm de `contahub_tempo`. Outliers > 60 min são sempre excluídos.

| Faixa (min) | Bar (bebida/drink) | Cozinha (comida) |
|-------------|-------------------|-----------------|
| `0` | Descartado | Descartado |
| `0 < t ≤ 5` | Normal (entra no tempo médio) | Normal |
| `5 < t ≤ 10` | **Atrasinho bar** | Normal |
| `10 < t ≤ 15` | **Atraso bar** | Normal |
| `15 < t ≤ 20` | **Atraso bar** | **Atrasinho cozinha** |
| `20 < t ≤ 60` | **Atraso bar** | **Atraso cozinha** |
| `t > 60` | Outlier — descartado | Outlier — descartado |

```
atrasos_bar_perc     = (atrasos_bar / qtde_itens_bar) × 100
atrasos_cozinha_perc = (atrasos_cozinha / qtde_itens_cozinha) × 100
atrasinhos_bar_perc  = (atrasinhos_bar / qtde_itens_bar) × 100
atrasinhos_cozinha_perc = (atrasinhos_cozinha / qtde_itens_cozinha) × 100
```

> `qtde_itens_*` = total de pedidos válidos (0 < tempo ≤ 60) — denominador para todos os percentuais.

### 3.5 Calculador: Satisfação

| Campo | Fonte |
|-------|-------|
| `avaliacoes_5_google_trip` | RPC `get_google_reviews_stars_by_date` (stars === 5) |
| `media_avaliacoes_google` | RPC (média de stars no período) |
| `nps_geral` | Tabela `nps_agregado_semanal` (coluna `nps_geral`) |
| `nps_digital` | RPC `calcular_nps_semanal_por_pesquisa` (`search_name = 'NPS Digital'`) |
| `nps_salao` | RPC `calcular_nps_semanal_por_pesquisa` (`search_name = 'Salão'`) |
| `nps_digital_respostas` | Total de respostas do NPS Digital |
| `nps_salao_respostas` | Total de respostas do NPS Salão |
| `nps_reservas` | **MANUAL** — preenchido pelo time |
| `nps_reservas_respostas` | **MANUAL** — preenchido pelo time |

### 3.6 Calculador: Distribuição

#### Distribuição Horária (fonte: `faturamento_hora`)

| Campo | Condição |
|-------|---------|
| `perc_faturamento_ate_19h` | `hora < 19` |
| `perc_faturamento_apos_22h` | `hora >= 22` OU `hora <= 5` (madrugada) |

#### Faturamento por Agrupamento de Dias (fonte: `eventos_base`)

| Campo | Dias (UTCDay) | Usado por |
|-------|--------------|-----------|
| `qui_sab_dom` | Qui(4), Sab(6), Dom(0) | **Ordinário** — principais dias de movimento |
| `ter_qua_qui` | Ter(2), Qua(3), Qui(4) | **Deboche** |
| `sex_sab` | Sex(5), Sab(6) | **Deboche** |

> **Ordinário** abre todos os dias, mas para distribuição de faturamento o agrupamento de referência é **Qui+Sab+Dom** (dias de maior movimento). Os outros dias (Seg, Ter, Qua, Sex) são considerados dias leves e não têm agrupamento próprio.  
> **Deboche:** Opera domingo, mas domingo **não entra em nenhum agrupamento** de distribuição (dia leve).  
> O código calcula os 3 agrupamentos para TODOS os bares (sem `if bar_id`), mas cada bar usa apenas os seus no frontend.

### 3.7 Calculador: Clientes

| Campo | Fonte |
|-------|-------|
| `clientes_ativos` | RPC `get_count_base_ativa` (janela de 90 dias) |
| `perc_clientes_novos` | RPC `calcular_metricas_clientes` (semana -7 dias) |

**Observação por bar:**
- **Ordinário (3):** clientes ativos e % novos calculados automaticamente
- **Deboche (4):** esses campos não são usados ainda (aguardando integração Zig)

### 3.8 Regras Especiais por Período

**Carnaval 2026 (ambos os bares):**
- Dias `13/02` a `17/02/2026` são **excluídos** do cálculo mensal de fevereiro
- Implementado em: `desempenho-mensal-service.ts` (corrigido em 08/04/2026 — antes só excluía Ordinário)

### 3.9 Thresholds de Alertas (UI — Planejamento Comercial)

| Indicador | Condição de Alerta |
|-----------|-------------------|
| Ticket Médio | `ticket_medio >= 93` |
| % Custo Atração | `percent_art_fat <= 15%` |
| Tempo Cozinha | `tempo_cozinha <= 12 min` |
| Tempo Bar | `tempo_bar <= 4 min` |
| Fat até 19h | `fat_19h_percent >= 40%` |

---

## 4. Stockout

### 4.1 Fonte de Dados

**Coleta diária:** API ContaHub → `contahub_stockout` → VIEW `contahub_stockout_filtrado`

**Parâmetros da API:**
- `grp = -29` (grupo de produtos ativos)
- `nfe = 1`
- `prd_desc = %20`
- Hora de consulta padrão: **20:00:00** (horário de Brasília)

### 4.2 Filtros da VIEW `contahub_stockout_filtrado`

Todos os filtros abaixo são aplicados **automaticamente** pela VIEW para ambos os bares. Os dados que chegam pelo StockOut sync já passam por esses filtros.

#### Condições base
- `prd_ativo = 'S'` — apenas produtos ativos
- `loc_desc IS NOT NULL` — apenas produtos com local definido
- `categoria_mix IS NOT NULL` — apenas produtos categorizados (Bebida/Drink/Comida)

#### Prefixos excluídos no nome do produto

| Filtro no nome | Significado |
|----------------|-------------|
| `[HH]` | Happy Hour |
| `[PP]` | Pegue e Pague |
| `[PPHH]` | Combo prefixo |
| `[DD]` | Dose Dupla |
| `[IN]` | Insumos |

#### Texto excluído no nome do produto

| Padrão (case-insensitive) | Observação |
|--------------------------|-----------|
| `Happy Hour` | |
| `HappyHour` | |
| `Happy-Hour` | |
| ` HH` (espaço + HH no final) | |
| `Dose Dupla` | |
| `Dose Dulpa` | ✅ typo incluído |
| `Balde` | |
| `Garrafa` | |
| `Combo ` (início) | |
| `Adicional` | |
| `Adicionais` | |
| `Embalagem` | |

#### Grupos (`grp_desc` do `raw_data`) excluídos

```
Baldes, Happy Hour, Chegadeira,
Dose dupla, Dose Dupla, Dose dupla!, Dose Dupla!,
Dose dupla sem álcool, Dose Dupla sem álcool,
Grupo adicional, Grupo Adicional,
Insumos,
Promo chivas, Promo Chivas,
Uso interno, Uso Interno,
Pegue e Pague,
Tabacaria,
Adicionais
```

#### Locais excluídos

- `Pegue e Pague`
- `Venda Volante`

> ✅ **Todos os filtros estão implementados na VIEW** — incluindo os específicos do Deboche (Chegadeira, Dose dupla, Promo chivas, Uso interno, etc.). Não há gap de implementação.

### 4.4 Definição de Status

| `prd_venda` | Status |
|-------------|--------|
| `'S'` | Disponível (em venda) |
| `'N'` | Stockout (fora de venda) |

> Atenção: `prd_venda` é **TEXT** (não boolean).

### 4.5 Cálculo de Percentual

```
percentual_stockout = (produtos com prd_venda='N') / (total de produtos ativos) × 100
```

### 4.7 Regra Especial: Feijoada + Sobremesa (apenas Ordinário)

- Produto do **Ordinário** exibido no cardápio **apenas aos sábados**
- Nos outros dias, é **excluído** tanto do total quanto do numerador do stockout
- Implementado na API de stockout e no cálculo por local
- **Deboche não tem essa regra**

### 4.8 Agrupamento por Categoria Local (VIEW `contahub_stockout_filtrado`)

A view já normaliza os locais para 3 categorias:

| Categoria | Produtos |
|-----------|---------|
| `Bar` | Bebidas em geral |
| `Drinks` | Drinks/coquetéis |
| `Comidas` | Pratos e porções |

### 4.9 Stockout Semanal (RPC `calcular_stockout_semanal`)

Usado pelo calculador de desempenho. Agrega o stockout de todos os dias da semana por categoria (Bebidas, Drinks, Comidas), usando a mesma view `contahub_stockout_filtrado`.

### 4.10 UPSERT (não DELETE+INSERT)

Desde 04/04/2026, o stockout usa UPSERT com chave `(bar_id, data_consulta, prd)` para evitar duplicados.

---

## 5. CMV Semanal

### 5.1 Tabela Principal: `cmv_semanal`

**Chaves:** `bar_id` + `ano` + `semana` (número ISO)

### 5.2 Fórmula CMV Real

```
CMV Bruto = Estoque Inicial + Compras do Período - Estoque Final

CMV Real = CMV Bruto - Total Consumos + Ajuste de Bonificações

CMV % (bruto)  = (CMV Real / Vendas Brutas) × 100
CMV Limpo %    = (CMV Real / Vendas Líquidas) × 100
GAP            = CMV Limpo % - CMV Teórico %
```

> `cmv_percentual` é coluna **GENERATED ALWAYS** no banco — não pode ser atualizada diretamente.  
> `cmv_teorico_percentual` é **preenchido manualmente** pelo usuário no CMV semanal (não vem de tabela de configuração).

### 5.3 Estoques

**Estoque Inicial:** Contagem da **segunda-feira** da semana (= `data_inicio`)  
**Estoque Final:** Contagem da **segunda-feira seguinte** ao fim da semana

Fonte: tabela `contagem_estoque_insumos`  
Valor: `estoque_final × custo_unitario` (preço **congelado** no momento da contagem)

**Categorização dos insumos:**

| Categoria | Critério | Coluna |
|-----------|---------|--------|
| **Bebidas (Bar)** | `tipo_local = 'bar'` | `estoque_*_bebidas` |
| **Drinks** | código começa com `pd*` (Produção B) | `estoque_*_drinks` |
| **Cozinha** | código começa com `pc*` (Produção C) | `estoque_*_cozinha` |
| **Drinks** | `tipo_local = 'cozinha'` + categoria em `[ARMAZÉM B, DESTILADOS, DESTILADOS LOG, HORTIFRUTI B, IMPÉRIO, MERCADO B, POLPAS, OUTROS]` | `estoque_*_drinks` |
| **Cozinha** | `tipo_local = 'cozinha'` + categoria em `[cozinha, ARMAZÉM (C), HORTIFRUTI (C), MERCADO (C), Mercado (S), PÃES, PEIXE, PROTEÍNA, tempero, hortifruti, líquido]` | `estoque_*_cozinha` |
| **Drinks** | `tipo_local = 'cozinha'` + `categoria = 'Não-alcóolicos'` | `estoque_*_drinks` |
| **Excluídos do CMV** | `categoria IN [HORTIFRUTI (F), MERCADO (F), PROTEÍNA (F)]` | (entram no CMA) |

### 5.4 Compras do Período

Fonte: `lancamentos_financeiros` (`tipo = 'DESPESA'`)  
Critério de data: `data_competencia` (padrão) ou `created_at` (modo planilha)

| Coluna | Categorias Conta Azul (case-insensitive) |
|--------|------------------------------------------|
| `compras_custo_bebidas` | `custo bebidas` + `custo outros` |
| `compras_custo_comida` | `custo comida` |
| `compras_custo_drinks` | `custo drinks` |
| `compras_custo_outros` | **zero** (limpeza/operação não entra no CMV) |

### 5.5 Consumos (deduções do CMV)

**4 categorias, cada uma × Fator CMV do bar:**

| Categoria | Fonte (campo `motivo_desconto` em `visitas`) |
|-----------|---------------------------------------------|
| Sócios (`consumo_socios`) | Padrões: `sócio`, `socio`, `x-socio`, `gonza`, `corbal`, `diogo`, `cadu`, `augusto`, `rodrigo`, `digao`, `vinicius`, `vini`, `bueno`, `kaizen`, `caisen`, `joão pedro`, `joao pedro`, `jp`, `3v`, `cantucci` |
| Artistas (`consumo_artista`) | Padrões: `musico`, `músicos`, `dj`, `banda`, `artista`, `breno`, `benza`, `stz`, `zelia`, `tia`, `samba`, `sambadona`, `doze`, `boca`, `boka`, `pé`, `chão`, `segunda`, `resenha`, `pagode`, `roda`, `reconvexa`, `rodie`, `roudier`, `roudi`, `som`, `técnico`, `tecnico`, `pv`, `paulo victor`, `prod` |
| Funcionários (`consumo_adm`) | Padrões: `funcionários`, `funcionario`, `financeiro`, `fin`, `mkt`, `marketing`, `slu`, `adm`, `administrativo`, `prêmio`, `confra`, `rh`, `recursos humanos` |
| Clientes (`consumo_beneficios`) | Padrões: `aniver`, `anivers`, `aniversário`, `aniversario`, `aniversariante`, `niver`, `voucher`, `benefício`, `beneficio`, `mesa mágica`, `mágica`, `influencer`, `influ`, `influencia`, `influência`, `club`, `clube`, `midia`, `mídia`, `social`, `insta`, `digital`, `cliente`, `ambev`, `chegadeira`, `chegador` |

**Prioridade de classificação (cada registro entra em apenas 1 categoria):**
1. Sócios
2. Artistas
3. Funcionários
4. Clientes

**Valor calculado:**
```
valor_desconto + valor_produtos = total bruto do consumo
consumo_categoria = total_bruto × fatorCmv
```

**Fator CMV:** configurado na tabela `bar_regras_negocio.cmv_fator_consumo` por `bar_id`.  
- **0.35 (35%) para ambos os bares** (Ordinário e Deboche — confirmado no banco)
- Cache de 5 minutos
- **SEM fallback** — erro se não configurado

### 5.6 CMA (Custo de Mão de Obra / Alimentação de Funcionários)

```
CMA = Estoque Inicial Funcionários + Compras Alimentação - Estoque Final Funcionários
```

- Estoques de funcionários: categorias `HORTIFRUTI (F)`, `MERCADO (F)`, `PROTEÍNA (F)`
- Compras de alimentação: categoria `alimentação` em `lancamentos_financeiros`

### 5.7 Faturamento CMVível

```
faturamento_cmvivel = Vendas Líquidas - Comissão (valor_repique)
```

Exclui `Conta Assinada` dos pagamentos (consumo de sócios já está nos consumos).

---

## 6. Planejamento Comercial

### 6.1 Fonte de Dados

**Principal:** tabela `eventos_base` — 1 linha por data de evento por bar  
**Dias de operação:** `bares_config` via `getBarOperacao()` — filtra dias fechados

**Regra de dias por bar:**

| Bar | Dias que opera | Aparece no Planejamento |
|-----|---------------|------------------------|
| **Ordinário (3)** | Todos os dias | Todos os dias |
| **Deboche (4)** | Terça a Domingo | Terça a Domingo |

> Ordinário abre todos os dias da semana (`opera_*` = true para todos).  
> Deboche abre todos os dias exceto segunda (`opera_segunda = false` — corrigido em 08/04/2026).  
> Fonte de verdade: tabela **`bares_config`**, usada pelo `calendario-helper.ts`. O campo `bares.config.dia_fechamento` é legado e não é usado.

### 6.2 Colunas Fixas

Desde 08/04/2026, o planejamento usa **colunas fixas** (não mais configuração dinâmica por mês). Cada bar tem sua grade de colunas permanente.

### 6.3 Recálculo de Evento

Trigger automático de recálculo quando:
- `precisa_recalculo = true`
- `versao_calculo !== 999` (999 = bloqueado/manual)
- `real_r === 0` ou `null`

Função: `calculate_evento_metrics`

### 6.4 Custos Artísticos por Bar

| Bar | Colunas de Custo Artístico |
|-----|---------------------------|
| **Ordinário (3)** | Custo Artístico + Custo Produção + % Art/Fat |
| **Deboche (4)** | Custo Artístico + $ Couvert + Couv/Art |

### 6.5 Reservas

| Bar | Como preenche |
|-----|--------------|
| **Ordinário (3)** | Automático (GetIn) |
| **Deboche (4)** | Manual (edição inline de `res_tot` / `res_p`) |

### 6.6 Metas por Semana

- **Faturamento (`meta_semanal`):** soma de `eventos_base.m1_r` — meta de receita por dia somada na semana
- **Demais métricas** (CMV %, clientes, ticket, etc.): preenchidas manualmente pelo usuário via tela de metas (`metas_desempenho`)

### 6.7 Métricas de Clientes no Planejamento

- `calcular_metricas_clientes` (RPC) — semana anterior
- `get_count_base_ativa` (RPC) — janela de **90 dias** antes da data final

---

## 7. Campos Manuais (Nunca Sobrescrever)

O engine `recalcular-desempenho-v2` **protege** os seguintes campos — se já preenchidos, nunca são sobrescritos pelo recálculo automático:

### NPS
- `nps_reservas` — NPS de Reservas (manual pelo time)
- `nps_reservas_respostas` — Respostas (manual)

### Marketing Orgânico (todos manuais)
- `o_num_posts`, `o_alcance`, `o_interacao`, `o_compartilhamento`
- `o_engajamento`, `o_num_stories`, `o_visu_stories`

### Marketing Pago — Meta (todos manuais)
- `m_valor_investido`, `m_alcance`, `m_frequencia`, `m_cpm`
- `m_cliques`, `m_ctr`, `m_custo_por_clique`, `m_conversas_iniciadas`

### Google Ads (todos manuais)
- `g_valor_investido`, `g_impressoes`, `g_cliques`, `g_ctr`, `g_solicitacoes_rotas`

### GMN — Google Meu Negócio (todos manuais)
- `gmn_total_acoes`, `gmn_total_visualizacoes`, `gmn_solicitacoes_rotas`

---

## 8. Configurações Críticas por Bar no Banco

### 8.1 `bar_categorias_custo` — Categorias de Atração

```sql
-- Ver configuração atual
SELECT bar_id, tipo, nome_categoria, ativo
FROM bar_categorias_custo
WHERE tipo = 'atracao'
ORDER BY bar_id;
```

| bar_id | tipo | nome_categoria |
|--------|------|---------------|
| 3 (Ordinário) | atracao | `Atrações Programação` |
| 3 (Ordinário) | atracao | `Produção Eventos` |
| 4 (Deboche) | atracao | `Atrações/Eventos` |
| 4 (Deboche) | atracao | `Administrativo Deboche` |

> Se vazio → calculador falha com erro. Sempre verificar.

### 8.2 `bar_regras_negocio` — Fator CMV

```sql
-- Ver configuração atual
SELECT bar_id, cmv_fator_consumo
FROM bar_regras_negocio;
```

**Valor atual:** 0.35 (35%) para `bar_id = 3` e `bar_id = 4`

> Se ausente ou ≤ 0 → CMV falha com erro. Sem fallback.

### 8.3 `bares` / `bares_config` — Dias de Operação

Controla quais dias o bar opera. Usado em:
- Planejamento Comercial (filtrar dias fechados)
- CMV Semanal (filtrar dias abertos nos consumos)
- Stockout (verificar se bar estava aberto)

### 8.4 `api_credentials` — Credenciais ContaHub

Por `bar_id`. Contém `empresa_id` (emp_id) para login na API do ContaHub.

---

## 9. Dívida Técnica — Duplicidade e Sobreposição

Campos e tabelas legados que existem no banco mas **não devem ser usados** em código novo. Risco de sobreposição silenciosa.

| Campo / Tabela | Localização | Status | Fonte Correta |
|---------------|------------|--------|--------------|
| `bares.config.dia_fechamento` | JSONB em `bares` | Legado — não é lido pelo código | `bares_config.opera_*` |
| `bares.config.dia_fechamento_nome` | JSONB em `bares` | Legado | `bares_config.opera_*` |
| `nibo_agendamentos` | Tabela | Legado (NIBO removido 04/2026) | `contaazul_lancamentos` / VIEW `lancamentos_financeiros` |
| Tabelas `nibo_*` | Banco | Apenas dados históricos, não usar em código novo | `contaazul_lancamentos` |

> Ao criar código novo: **sempre usar `bares_config`** para dias de operação, nunca ler `bares.config.dia_fechamento`.

---

## 10. Checklist de Validação Semanal

### Antes de Fechar o Desempenho

```
[ ] contahub_raw_data tem dados dos 7 dias da semana?
    → SELECT data, COUNT(*) FROM contahub_raw_data WHERE bar_id = ? GROUP BY data

[ ] contahub_cancelamentos tem custototal calculado (não zero)?
    → SELECT data, SUM(custototal) FROM contahub_cancelamentos WHERE bar_id = ? GROUP BY data

[ ] contahub_tempo não tem duplicados?
    → SELECT data, COUNT(*) FROM contahub_tempo WHERE bar_id = ? GROUP BY data, grp_desc ORDER BY COUNT(*) DESC

[ ] bar_categorias_custo está configurado para os 2 bares?
    → SELECT * FROM bar_categorias_custo WHERE tipo = 'atracao' AND ativo = true

[ ] bar_regras_negocio tem cmv_fator_consumo > 0 para os 2 bares?
    → SELECT * FROM bar_regras_negocio

[ ] contahub_stockout tem dados dos dias da semana?
    → SELECT data_consulta, COUNT(*) FROM contahub_stockout WHERE bar_id = ? GROUP BY data_consulta

[ ] lancamentos_financeiros tem lançamentos de atração na semana?
    → SELECT data_competencia, categoria_nome, SUM(valor_bruto) 
       FROM contaazul_lancamentos 
       WHERE bar_id = ? AND tipo = 'DESPESA' AND data_competencia BETWEEN ? AND ?
       GROUP BY data_competencia, categoria_nome

[ ] desempenho_semanal foi recalculado (recalcular-desempenho-v2 com mode=write)?
    → Verificar timestamp atualizado_em
```

### Pontos de Atenção Recorrentes

1. **Duplicados no sync:** Verificar se houve execução dupla do contahub-sync-automatico no mesmo dia
2. **Custo de atração zerado:** Verificar lançamentos no Conta Azul com categoria correta e `data_competencia` dentro do período
3. **Stockout não batendo com desempenho:** Ambos devem usar `contahub_stockout_filtrado` — se divergirem, a VIEW pode estar desatualizada
4. **CMV vs Desempenho:** O campo `cancelamentos` do desempenho vem de `contahub_cancelamentos.custototal`; verificar se o processor calculou corretamente
5. **NPS Digital zerado:** Verificar sync do Falaê — cron diário às 09:00 BRT; `nps_agregado_semanal` deve ter linha para a semana
6. **Feijoada no stockout:** Verificar se está aparecendo corretamente só nos sábados
8. **Orphans em visitas:** Após qualquer reprocessamento manual do ContaHub, rodar a query de sanidade da seção 2.5 para garantir que não há registros órfãos em `visitas`
7. **Desempenho Deboche:** Ticket médio é MANUAL — não recalcular/sobrescrever automaticamente

---

## Appendix A — Mapeamento de Campos (FIELD_MAPPING)

O arquivo `recalcular-desempenho-v2/index.ts` define o mapeamento completo calculador → coluna `desempenho_semanal`:

| Calculador | Campo Calculado | Coluna `desempenho_semanal` |
|------------|----------------|---------------------------|
| Faturamento | `faturamento_total` | `faturamento_total` |
| Faturamento | `faturamento_entrada` | `faturamento_entrada` |
| Faturamento | `faturamento_bar` | `faturamento_bar` |
| Faturamento | `clientes_atendidos` | `clientes_atendidos` |
| Faturamento | `ticket_medio` | `ticket_medio` |
| Faturamento | `tm_entrada` | `tm_entrada` |
| Faturamento | `tm_bar` | `tm_bar` |
| Faturamento | `meta_semanal` | `meta_semanal` |
| Faturamento | `mesas_totais` | `mesas_totais` |
| Faturamento | `mesas_presentes` | `mesas_presentes` |
| Faturamento | `reservas_totais` | `reservas_totais` |
| Faturamento | `reservas_presentes` | `reservas_presentes` |
| Faturamento | `desconto_total` | `desconto_total` |
| Faturamento | `desconto_percentual` | `desconto_percentual` |
| Custos | `custo_atracao_faturamento` | `custo_atracao_faturamento` |
| Custos | `couvert_atracoes` | `couvert_atracoes` |
| Custos | `comissao` | `comissao` |
| Custos | `atracoes_eventos` | `atracoes_eventos` |
| Custos | `cancelamentos` | `cancelamentos` |
| Operacional | `stockout_bar` | `stockout_bar` |
| Operacional | `stockout_bar_perc` | `stockout_bar_perc` |
| Operacional | `stockout_drinks` | `stockout_drinks` |
| Operacional | `stockout_drinks_perc` | `stockout_drinks_perc` |
| Operacional | `stockout_comidas` | `stockout_comidas` |
| Operacional | `stockout_comidas_perc` | `stockout_comidas_perc` |
| Operacional | `perc_bebidas` | `perc_bebidas` |
| Operacional | `perc_drinks` | `perc_drinks` |
| Operacional | `perc_comida` | `perc_comida` |
| Operacional | `perc_happy_hour` | `perc_happy_hour` |
| Operacional | `tempo_saida_bar` | `tempo_saida_bar` |
| Operacional | `tempo_saida_cozinha` | `tempo_saida_cozinha` |
| Operacional | `qtde_itens_bar` | `qtde_itens_bar` |
| Operacional | `qtde_itens_cozinha` | `qtde_itens_cozinha` |
| Operacional | `atrasinhos_bar` | `atrasinhos_bar` |
| Operacional | `atrasinhos_bar_perc` | `atrasinhos_bar_perc` |
| Operacional | `atrasinhos_cozinha` | `atrasinhos_cozinha` |
| Operacional | `atrasinhos_cozinha_perc` | `atrasinhos_cozinha_perc` |
| Operacional | `atrasos_bar` | `atrasos_bar` |
| Operacional | `atrasos_cozinha` | `atrasos_cozinha` |
| Operacional | `atrasos_bar_perc` | `atrasos_bar_perc` |
| Operacional | `atrasos_cozinha_perc` | `atrasos_cozinha_perc` |
| Satisfação | `avaliacoes_5_google_trip` | `avaliacoes_5_google_trip` |
| Satisfação | `media_avaliacoes_google` | `media_avaliacoes_google` |
| Satisfação | `nps_geral` | `nps_geral` |
| Satisfação | `nps_digital` | `nps_digital` |
| Satisfação | `nps_salao` | `nps_salao` |
| Satisfação | `nps_digital_respostas` | `nps_digital_respostas` |
| Satisfação | `nps_salao_respostas` | `nps_salao_respostas` |
| Distribuição | `perc_faturamento_ate_19h` | `perc_faturamento_ate_19h` |
| Distribuição | `perc_faturamento_apos_22h` | `perc_faturamento_apos_22h` |
| Distribuição | `qui_sab_dom` | `qui_sab_dom` |
| Distribuição | `ter_qua_qui` | `ter_qua_qui` |
| Distribuição | `sex_sab` | `sex_sab` |
| Clientes | `clientes_ativos` | `clientes_ativos` |
| Clientes | `perc_clientes_novos` | `perc_clientes_novos` |

---

## Appendix B — Edge Functions Críticas

| Function | Trigger | Frequência | Descrição |
|---------|---------|-----------|-----------|
| `contahub-sync-automatico` | Cron | Diário | Coleta dados do ContaHub |
| `contahub-processor` | Manual/API | Por demanda | Processa raw → tabelas |
| `contahub-resync-semanal` | Manual | Por demanda | Reprocessa últimos 7 dias |
| `contahub-stockout-sync` | Cron | Diário ~20h | Sincroniza stockout |
| `recalcular-desempenho-v2` | Manual/API | Por demanda | Recalcula desempenho_semanal |
| `cmv-semanal-auto` | Cron/Manual | Semanal | Calcula CMV automático |
| `sync-falae` (NPS) | Cron | Diário ~09h | Sincroniza NPS do Falaê |

---

*Documento gerado a partir do código-fonte real. Revisar quando houver mudanças nas fórmulas ou regras.*
