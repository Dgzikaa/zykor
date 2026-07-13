---
title: Despesas CA
area: ferramentas-financeiro
slug: despesas-ca
route: /financeiro/despesas
description: Central de lançamentos de despesa (e as contrapartidas de receita) que o Zykor cria no Conta Azul durante o fechamento — dinheiro em espécie, variação de estoque, bonificações, consumações, impostos simulados e ajuste da virada do mês.
order: 60
icon: TrendingDown
---

# Despesas CA

## Visão geral

A tela **Despesas CA** é o painel onde o Zykor prepara e envia para o **Conta Azul** os lançamentos de despesa (e as contrapartidas de receita que acompanham cada despesa) que fazem parte do **fechamento** contábil do bar.

Ela não substitui o Conta Azul: ela **calcula os valores a partir dos dados operacionais** (ContaHub, Stone, contagem de estoque, fichas técnicas, XML das notas fiscais) e cria o lançamento já no lugar certo — na categoria, competência e sinal (receita ou despesa) corretos. Cada aba cuida de um tipo de lançamento diferente.

Um princípio se repete em quase todas as abas: os lançamentos entram **por competência, sem baixa** (não movimentam saldo bancário) e, quando existe uma contrapartida, o par **soma zero** (uma receita e uma despesa de mesmo valor). Isso ajuda o resultado gerencial (DRE) a ficar correto sem inflar caixa.

Quem usa: o **dono/sócio** e a pessoa responsável pelo **financeiro/fechamento** do grupo. É uma ferramenta de retaguarda, usada tipicamente no fechamento diário (consumações, saídas) e no fechamento mensal (variação de estoque, impostos, bonificações, virada do mês).

> Importante: o Conta Azul **não permite excluir** um lançamento pela API. Por isso todas as abas mostram um passo de conferência/confirmação antes de enviar. Depois de lançado, só dá para corrigir dentro do próprio Conta Azul.

## Como acessar

- Menu lateral: **Ferramentas → Financeiro → Despesas CA** (rota `/financeiro/despesas`).
- Também é possível abrir direto numa aba específica via link com o parâmetro `?aba=` (ex.: `?aba=bonificacoes`). O Zykor abre naquela aba e limpa o parâmetro em seguida.
- **Permissão necessária:** a ferramenta financeira **Despesas CA** (`ferramentas financeiro_despesas_ca`). As ações têm níveis diferentes:
  - **ver** — para abrir a tela e ver as prévias.
  - **inserir** — para lançar no Conta Azul e cadastrar bonificações.
  - **excluir** — para apagar uma bonificação ainda não lançada.

Todas as consultas e lançamentos são sempre filtrados pelo **bar selecionado** no seletor de bar do topo.

## Passo a passo

### Lançar uma saída de dinheiro (aba Dinheiro em Espécie)
1. Abra a aba **Dinheiro em Espécie**.
2. Escolha o **mês** no seletor à direita.
3. Vá para a sub-aba **Saídas de Caixa**.
4. Localize a retirada (use a busca por motivo/turno ou os filtros de coluna Dia, Turno e Motivo).
5. Clique em **Lançar** na linha desejada. Abre um modal: confira a **descrição** (vem do motivo), o **valor** (fixo, vindo do ContaHub), a **competência** e o **vencimento** (ambos = data gerencial do turno) e a **conta** (Caixa Dinheiro).
6. Escolha a **categoria de despesa** do Conta Azul.
7. Clique em **Lançar**. A saída vira uma **conta a pagar com baixa imediata** no Conta Azul.

### Lançar variação de estoque do mês (aba Variação de Estoque)
1. Abra a aba **Variação de Estoque** e escolha o **mês**.
2. Confira a tabela por categoria (Bebidas, Comidas, Drinks): estoque inicial, final e variação.
3. Para uma linha só, clique em **Lançar** naquela linha; para tudo, clique em **Lançar todos os pendentes** e depois **Confirmar**.

### Cadastrar e lançar uma bonificação (aba Bonificações)
1. Abra a aba **Bonificações** e escolha o mês de **chegada**.
2. Preencha o formulário **Nova bonificação**: fornecedor, "referente a" (opcional), valor, competência e categoria da **receita**, competência e categoria da **despesa**.
3. Clique em **Cadastrar bonificação**.
4. Na tabela, clique em **Lançar** para enviar o par (receita + despesa) ao Conta Azul. Enquanto não estiver lançada, dá para **excluir** (ícone de lixeira).

### Lançar consumações de um dia (aba Consumações)
1. Abra a aba **Consumações**. Escolha a granularidade **dia**, **semana** ou **mês** e a data de referência.
2. No modo **dia**, veja as categorias de cortesia e seus custos. Clique em **Lançar** numa categoria ou em **Lançar dia inteiro**.
3. No modo **semana/mês**, veja o resumo por dia (total e quantos itens já foram lançados). Clique num dia para abrir suas categorias, use **Lançar dia** por linha, ou **Lançar todos os dias pendentes** para o lote.

### Simular e lançar impostos do mês (aba Simulação Impostos)
1. Abra a aba **Simulação Impostos** e escolha o mês.
2. (Recomendado) Suba o **XML das NFC-e** do mês na caixa de importação para separar faturamento e bebida fria por CNPJ.
3. Confira os blocos por CNPJ (base e valores simulados de cada tributo).
4. Clique em **Lançar** por tributo, ou **Lançar todos os pendentes** e **Confirmar**.

### Lançar o ajuste da virada do mês (aba Ajuste Virada do Mês)
1. Abra a aba **Ajuste Virada do Mês** e escolha o mês que fechou.
2. Veja o faturamento Stone da madrugada (00h–06h) do dia 01 do mês seguinte e as duas pernas (receita no último dia; despesa/estorno no dia 01).
3. Clique em **Lançar todos os pendentes** e **Confirmar** (ou **Lançar** por perna).

### Ligar o lançamento automático
Nas abas que suportam (Variação, Consumações, Impostos, Virada), há um botão **Lançamento automático** no topo. Ao ligar, um cron passa a lançar sozinho **apenas os novos** a partir daquela data (o histórico continua manual). Bonificações e Saídas em dinheiro são sempre manuais e não têm esse botão.

## Abas e seções

A tela tem **seis abas**:

### 1. Dinheiro em Espécie
Reaproveita o painel de **Fluxo de Dinheiro** (ContaHub) filtrado só nas saídas. Mostra 4 cards de resumo do mês e três sub-abas: **Entradas de Caixa**, **Saídas de Caixa** e **Por turno**.
- **Entradas** (dinheiro recebido) são lançadas **automaticamente** como conta a receber no Conta Azul (categoria "Dinheiro", conta "Caixa Dinheiro"), somando o dia, todo dia às 12h. Aqui elas só aparecem com status "lançado"/"pendente".
- **Saídas** (sangria/retirada de caixa) são lançadas manualmente pelo botão **Lançar**. Só aparece o botão para saídas a partir de **04/07/2026** (início do uso do Zykor); as anteriores já foram lançadas por fora e ficam com "—" para não duplicar.

### 2. Variação de Estoque
Fechamento mensal: diferença de estoque por categoria, lançada por competência (sem baixa).

### 3. Bonificações
Cadastro manual de bonificações de fornecedores. Cada bonificação vira um par **soma-zero** (1 receita + 1 despesa de mesmo valor).

### 4. Consumações
Fechamento diário das cortesias/consumações, por categoria, também **soma-zero** por dia.

### 5. Simulação Impostos
Simulação dos tributos do mês por CNPJ, com importação opcional do XML das NFC-e.

### 6. Ajuste Virada do Mês
Move para a competência certa o faturamento da madrugada que "vira" o mês.

## Colunas e cálculos

### Aba Dinheiro em Espécie — Cards de resumo (do mês)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Entradas (dinheiro) | Total de dinheiro recebido no mês | Soma de `total_liquido` das entradas do período | `silver.contahub_entrada_caixa_dinheiro` |
| Entradas — dias / média | Nº de dias com entrada e média por dia | `dias_entrada` = dias distintos; média = total_entradas ÷ dias_entrada | idem |
| Saídas (sangria) | Total retirado do caixa no mês | Soma de `valor_saida` das saídas do período | `silver.contahub_caixa_saida` |
| Saídas — retiradas / dias | Nº de retiradas e de dias com saída | `qtd_saidas` = nº de linhas; `dias` = dias distintos | idem |
| Líquido do mês | Sobra de caixa | `total_entradas − total_saidas` | cálculo na tela |
| Ticket saída | Valor médio por retirada | `total_saidas ÷ qtd_saidas` | cálculo na tela |

### Aba Dinheiro em Espécie — Sub-aba Entradas de Caixa

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data gerencial + dia da semana | `dt_gerencial` | `silver.contahub_entrada_caixa_dinheiro` |
| Turno | Nº do turno | `trn` | idem |
| Pgtos | Quantidade de pagamentos em dinheiro | `qtd_pagamentos` | idem |
| Dinheiro recebido | Valor líquido recebido em dinheiro | `total_liquido` | idem |
| CA | Se o dia já foi lançado (auto às 12h) | "lançado" se o dia consta em `entrada_caixa_ca_log`, senão "pendente" | `financial.entrada_caixa_ca_log` |

### Aba Dinheiro em Espécie — Sub-aba Saídas de Caixa

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data gerencial + dia da semana | `dt_gerencial` | `silver.contahub_caixa_saida` |
| Turno | Nº do turno | `trn` | idem |
| Motivo | Motivo da retirada | `motivo` | idem |
| Valor | Valor retirado | `valor_saida` | idem |
| CA | Status/ação de lançamento | "lançado" se está em `saida_caixa_ca_log`; "—" se anterior a 04/07/2026; senão botão **Lançar** | `financial.saida_caixa_ca_log` |

### Aba Dinheiro em Espécie — Sub-aba Por turno

| Coluna | O que mostra | Fonte |
|---|---|---|
| Dia / Turno | Data gerencial e nº do turno | `silver.contahub_caixa_turno_resumo` |
| Saldo anterior | Saldo de caixa herdado do turno anterior | `saldo_anterior` |
| Início decl. | Valor declarado na abertura (+ diferença de abertura se houver) | `inicio_declarado`, `diferenca_abertura` |
| Recebim. $ | Recebimentos em dinheiro no turno | `recebimentos_dinheiro` |
| Saídas | Total e quantidade de retiradas do turno | `total_saidas`, `qtd_saidas` |
| Saldo final | Saldo de fechamento do turno | `saldo_final` |

### Aba Variação de Estoque

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Categoria | Bebidas, Comidas ou Drinks | Fixo | — |
| Estoque inicial | Estoque no começo do mês | `estoque_inicial_*` da semana ISO que contém o **dia 01 do mês** | `financial.cmv_semanal` |
| Estoque final | Estoque no fim do mês | `estoque_final_*` da semana ISO que contém o **dia 01 do mês seguinte** | `financial.cmv_semanal` |
| Variação | Diferença do estoque | `final − inicial` (arredondado a 2 casas) | cálculo |
| Destino no CA | Para onde o lançamento vai | Variação ≥ 0 → **Receita** na categoria "VARIAÇÃO DE ESTOQUE"; variação < 0 → **Despesa** na categoria "Variação de Estoque" | convenção contábil |
| Status | Se já foi lançado | "lançado" se há registro no log para a categoria/competência; senão botão **Lançar** | `financial.lancamento_manual_ca_log` (tipo `variacao_estoque`) |

> Convenção contábil: estoque que **cresceu** reduz o CMV, então entra como **receita**; estoque que **caiu** entra como **despesa**. Competência = último dia do mês. Só lança linhas com variação ≥ R$ 0,01.

### Aba Bonificações

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Fornecedor | Quem concedeu a bonificação | Digitado no cadastro | `financial.bonificacoes` |
| Referente | Motivo (contrato, cashback, etc.) | Digitado (opcional) | idem |
| Receita (comp. · categoria) | Competência e categoria da perna de receita | Digitado no cadastro | idem |
| Despesa (comp. · categoria) | Competência (dia que chegou) e categoria da perna de despesa | Digitado no cadastro | idem |
| Valor | Valor de cada perna (igual nas duas) | Digitado no cadastro | idem |
| CA | Status/ação | "lançado" ou botão **Lançar** | flag `ca_lancado` |
| (lixeira) | Excluir | Só aparece se ainda **não** lançada | — |
| Total (rodapé) | Total do mês e total já lançado | Soma de `valor`; total lançado soma só as com `ca_lancado` | cálculo |

> A listagem é por **data de chegada** (competência da despesa) dentro do mês selecionado. Ao lançar, gera **2 lançamentos** no Conta Azul (1 receita + 1 despesa, sem baixa), cada um na sua competência e categoria.

### Aba Consumações — modo Dia

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Categoria | Tipo de cortesia (Sócios, Relacionamento, Funcionários, Artistas, Influencers, Benefício Clientes, Aniversários, Programa de Pontos, Ajuste CMV) e a contrapartida "Ajuste CMV" | Mapeamento fixo de categorias | função `get_consumos_9_custo_semana` |
| Tipo | Despesa ou Receita | Cada categoria de cortesia = **despesa**; a linha "Ajuste CMV (contrapartida)" = **receita** | lógica da rota |
| Valor (custo) | Custo da cortesia pela ficha técnica | `custo_real` da função, com o **fator de CMV** do bar aplicado | `get_consumos_9_custo_semana` + `getFatorCmv` |
| Status | Se já foi lançado | "lançado" ou botão **Lançar** | `financial.lancamento_manual_ca_log` (tipo `consumacao`) |
| Rodapé | Total despesas · soma-zero · não lançado | "soma-zero" = total de despesas − receita de contrapartida (deve dar 0); "não lançado" = valor da categoria "outros", que fica de fora | cálculo |

> A receita de contrapartida entra na categoria **"[CONSUMAÇÃO] AJUSTE CMV"** (maiúscula) e é igual à soma das despesas do dia, zerando o dia. Cada despesa entra na categoria mista minúscula "[Consumação] X". Competência = o dia, sem baixa. A categoria "outros" **não** é lançada.

### Aba Consumações — modo Semana / Mês

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data + dia da semana (clicável, abre o modo dia) | — | — |
| Total (custo) | Total de despesas de consumação do dia | Soma dos custos das categorias do dia | `get_consumos_9_custo_semana` |
| Lançados | Itens já lançados / total de itens do dia | `n_lancados / n_itens`; verde quando 0 pendentes | log `consumacao` |
| Ação | "ok" ou botão **Lançar dia** | — | — |
| Total do período (rodapé) | Soma dos totais dos dias | Soma de `total` dos dias | cálculo |

### Aba Simulação Impostos — Base por CNPJ (cards)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Faturamento (usado) | Base de faturamento adotada | **Maior** entre NF (ContaHub) e Stone bruto, por CNPJ | `fn_impostos_base_mensal_cnpj` (ou `fn_impostos_base_mensal` no legado) |
| — NF / Stone | Os dois valores comparados | NF emitidas × Stone bruto | idem |
| Couvert | Couvert do mês | Vem da base do CNPJ | idem |
| Gorjeta | Gorjeta do mês | Vem da base do CNPJ | idem |
| Bebida fria | Bebida monofásica (CST 04/05/06) | Vem do **XML importado**; sem XML fica 0 nesse CNPJ | XML NFC-e importado |
| Base lucro | Base para IRPJ/CSLL | `faturamento − gorjeta − couvert` | cálculo |

### Aba Simulação Impostos — Tributos (por CNPJ)

| Tributo | O que mostra | Como é calculado | Periodicidade / Vencimento |
|---|---|---|---|
| IRPJ | Imposto de renda simulado | `base_lucro × 1,2% + max(0; (base_lucro − 250.000) × 0,8%)` | Trimestral (venc. dia 30 do mês seguinte ao trimestre) |
| CSLL | Contribuição social simulada | `base_lucro × 1,08%` | Trimestral |
| ICMS | ICMS simulado | `faturamento × 2%` | Mensal (venc. dia 20 do mês seguinte) |
| COFINS | COFINS simulado | `base_monofásica × 3%`, onde base_monofásica = `faturamento − gorjeta − couvert − bebida fria` | Mensal (venc. dia 20) |
| PIS | PIS simulado | `base_monofásica × 0,65%` | Mensal (venc. dia 20) |
| Status | Se já foi lançado | "lançado" ou botão **Lançar** | log `imposto` (chave `SIGLA` ou `SIGLA#índice` por CNPJ) |
| Total de impostos | Soma de todos os tributos de todos os CNPJs | Soma dos valores | cálculo na tela |

> Os lançamentos são **placeholders de despesa** na categoria "IMPOSTO", por competência, sem baixa. Depois são substituídos manualmente pelo valor oficial no Conta Azul. Bares com 2 CNPJs (Ordinário e Deboche) geram um conjunto por CNPJ.

### Aba Simulação Impostos — Importação de XML das NFC-e

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Notas / canceladas / sem CNPJ | Contagem das notas do lote | Agregação dos XML lidos | XML NFC-e (lido no navegador) |
| Total | Valor total das notas | Soma dos valores autorizados | idem |
| Bebida fria | Valor monofásico | Itens com CST COFINS 04/05/06 | idem |
| Por CNPJ | Faturamento e bebida fria de cada CNPJ | Agregação por CNPJ emitente | idem, salvo no servidor após confirmar |

### Aba Ajuste Virada do Mês

| Indicador / Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Faturamento madrugada | Faturamento Stone bruto da madrugada que fecha o mês | Stone bruto **00:00–06:00** do dia 01 do mês seguinte (hora local; soma todas as empresas do bar) | `fn_stone_bruto_intervalo` |
| Perna Receita | +Receita na competência do último dia do mês | Mesmo valor da madrugada | cálculo |
| Perna Despesa | −Despesa (estorno) na competência do dia 01 do mês seguinte | Mesmo valor | cálculo |
| Competência | Data de cada perna | Último dia do mês / dia 01 do seguinte | cálculo |
| Status | Se já foi lançado | "lançado" ou botão **Lançar** | log `ajuste_virada` (chave `receita`/`despesa`) |

> Ambas as pernas usam a categoria "Ajuste Receita Virada do Mês", sem baixa. O par **soma zero**: só reposiciona a receita da virada na competência certa.

## Filtros e opções

- **Bar:** definido pelo seletor de bar global; todas as consultas e lançamentos filtram por `bar_id`.
- **Mês (Variação, Bonificações, Impostos, Virada):** seletor com os últimos 12 meses, começando pelo **mês anterior** ao atual.
- **Granularidade + data (Consumações):** alterna entre **dia**, **semana** e **mês**; a data de referência define o período. O padrão é **ontem**.
- **Mês (Dinheiro em Espécie):** seletor alimentado pelos meses que têm dados de turno.
- **Busca e filtros de coluna (Entradas/Saídas):** busca livre por motivo/turno e filtros por valores distintos nas colunas Dia, Turno e Motivo.
- **Lançamento automático (toggle):** por bar e por tipo, nas abas Variação, Consumações, Impostos e Virada. Ligar afeta só os lançamentos **novos** a partir da data em que ligou.

## Regras e detalhes importantes

- **Sempre por bar.** Nenhuma aba mistura dados de bares diferentes.
- **Competência, não caixa.** Quase todos os lançamentos entram **sem baixa** — não movimentam saldo bancário, só a competência/DRE. A exceção é a **saída em dinheiro**, que entra como conta a pagar **com baixa imediata**, e as **entradas em dinheiro**, lançadas como conta a receber automática.
- **Pares soma-zero.** Bonificações, Consumações e Ajuste da Virada sempre geram receita + despesa de mesmo valor para não distorcer o resultado.
- **Idempotência.** O Zykor registra tudo que lançou em `financial.lancamento_manual_ca_log` (e nos logs específicos de saída/entrada). Reenviar não duplica: o que já está no log aparece como "lançado" e é pulado.
- **Sem exclusão no Conta Azul.** A API do Conta Azul não apaga lançamento. Por isso há a etapa de confirmação, e uma bonificação só pode ser excluída **antes** de ser lançada.
- **Corte de 04/07/2026 nas saídas.** Saídas anteriores ao início do Zykor não mostram botão Lançar (já foram lançadas por fora), evitando duplicidade.
- **Valores mínimos.** Linhas com valor abaixo de R$ 0,01 são ignoradas no lançamento (variação, consumação, impostos).
- **Impostos dependem do XML.** Sem o XML das NFC-e importado, a **bebida fria** fica 0 naquele CNPJ, o que aumenta PIS/COFINS simulados. Suba o XML para a simulação ficar fiel.
- **Categorias precisam existir no Conta Azul.** Se a categoria alvo (ex.: "IMPOSTO", "[CONSUMAÇÃO] AJUSTE CMV", "Variação de Estoque") não existir e sincronizada no Conta Azul do bar, o lançamento falha com aviso — crie e re-sincronize antes.
- **Arredondamento.** Todos os valores são arredondados a 2 casas decimais antes de lançar.
- **Manual vs automático.** Bonificações e Saídas em dinheiro são sempre manuais. As demais podem virar automáticas pelo toggle (só para os novos).

## Dúvidas frequentes

**Lançar aqui "gasta" dinheiro no caixa do Conta Azul?**
Não, na maioria dos casos. Os lançamentos entram por competência, sem baixa. Só as **saídas de dinheiro** têm baixa (pagamento efetivo) e as entradas viram conta a receber.

**Por que uma variação de estoque positiva vira receita?**
Porque estoque que cresceu **reduz o CMV** do período. Pela convenção contábil, essa redução de custo aparece como receita ("VARIAÇÃO DE ESTOQUE"). Estoque que caiu vira despesa.

**Lancei sem querer. Como desfaço?**
Pela tela, não dá — o Conta Azul não permite excluir por API. É preciso corrigir/estornar diretamente dentro do Conta Azul.

**Preciso mesmo subir o XML das notas na aba de impostos?**
Fortemente recomendado. Sem ele, a bebida fria (monofásica) fica zerada e o PIS/COFINS simulados saem mais altos que o real. Com o XML, faturamento e bebida fria são separados por CNPJ.

**Por que algumas saídas antigas não têm botão "Lançar"?**
Saídas anteriores a 04/07/2026 já foram lançadas fora do Zykor. O botão fica escondido para não duplicar no Conta Azul.

**O que é o "Ajuste da Virada do Mês"?**
É o faturamento da madrugada (00h–06h) da última noite do mês, que o sistema registra no dia 01 seguinte. O ajuste devolve essa receita para a competência do mês que fechou (e estorna no dia 01), sem alterar o total.

## Fonte dos dados

- **ContaHub** (camada silver): `silver.contahub_caixa_saida`, `silver.contahub_caixa_turno_resumo`, `silver.contahub_entrada_caixa_dinheiro` — alimentam a aba Dinheiro em Espécie.
- **CMV semanal:** `financial.cmv_semanal` — estoque inicial/final por categoria (aba Variação de Estoque).
- **Fichas técnicas / consumo:** função `get_consumos_9_custo_semana` + fator de CMV do bar (`getFatorCmv`) — custos das consumações.
- **Impostos:** funções `fn_impostos_base_mensal_cnpj` / `fn_impostos_base_mensal` (base por CNPJ, com NF ContaHub e Stone) e o **XML das NFC-e** importado (bebida fria monofásica).
- **Stone:** função `fn_stone_bruto_intervalo` — faturamento da madrugada (aba Ajuste da Virada).
- **Conta Azul:** categorias em `bronze.bronze_contaazul_categorias`; destino de todos os lançamentos. Idempotência e status em `financial.lancamento_manual_ca_log`, `financial.saida_caixa_ca_log` e `financial.entrada_caixa_ca_log`.
- **Cadastro manual:** `financial.bonificacoes` (aba Bonificações).
- **Configuração de automação:** endpoint `/api/financeiro/fechamento/auto-config` (toggle de lançamento automático por bar e tipo).
