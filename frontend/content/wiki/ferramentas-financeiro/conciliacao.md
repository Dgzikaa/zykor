---
title: Conciliação
area: ferramentas-financeiro
slug: conciliacao
route: /financeiro/conciliacao
description: Confere, dia a dia, se o cartão vendido no ContaHub bateu com o que a Stone cobrou e repassou, e ainda cruza a NF emitida por CNPJ, taxas, recebíveis e chargebacks.
order: 40
icon: Scale
---

# Conciliação

## Visão geral

A tela de **Conciliação & Análise Stone** responde a uma pergunta simples de dono de bar: *"o dinheiro do cartão que eu vendi caiu na conta?"*. Para isso ela coloca lado a lado, por **dia operacional**, o total de cartão registrado no **ContaHub** (o que o caixa lançou) e o total **bruto que a Stone cobrou** (o que a maquininha capturou). Quando os dois números não batem, a tela mostra exatamente onde está a diferença e quais transações a explicam.

Além da conciliação do cartão, a tela agrega três frentes de controle financeiro/fiscal:

- **Conferência fiscal** — a NF emitida por CNPJ bateu com a venda da Stone e com o total do ContaHub? Ajuda a flagrar venda sem nota e emissão no CNPJ errado.
- **Análises Stone** — taxas (MDR) por bandeira, recebíveis futuros, mix de bandeiras/maquininhas e chargebacks.
- **Pendências** — a fila de dias que ainda precisam de investigação.

Quem usa no dia a dia: o financeiro (fecha o caixa e confere repasses) e os sócios/dono (acompanham furos de cartão, taxas caras e alertas fiscais).

## Como acessar

Menu lateral: **Financeiro → Conciliação** (ícone de balança).

Rota: `/financeiro/conciliacao`.

Permissão necessária: `ferramentas financeiro_conciliacao`. Sem essa permissão o item nem aparece no menu. A tela também sempre filtra pelo **bar selecionado** no topo — cada bar vê apenas os próprios dias.

## Passo a passo

### Conferir se um mês bateu (uso mais comum)

1. Abra **Financeiro → Conciliação**. A aba **Conciliação** já vem selecionada.
2. No seletor de período, escolha o mês no dropdown, ou use as setas **‹ ›** para andar mês a mês.
3. Olhe os **cards de resumo**: quantos dias bateram, quantos "recebeu a menos", quantos "recebeu a mais" e o Stone bruto do mês.
4. Clique num card (ex.: **Recebeu a menos**) para filtrar a tabela só aos dias daquele status. Clique de novo para limpar.
5. Percorra a tabela. Dias em verde (**● bate**) estão ok; os coloridos precisam de olhada.

### Investigar um dia divergente

1. Na tabela da aba Conciliação, **clique na linha do dia**. Ela expande.
2. Em **"Onde diverge (ContaHub × Stone)"** você vê a diferença quebrada em **Crédito, Débito, PIX e Total** — isso já indica se o furo é no crédito ou no débito.
3. Em **"Transações que explicam a diferença"** aparecem duas listas: **Só na Stone** (a Stone cobrou mas não achou par no ContaHub) e **Só no ContaHub** (foi lançado no caixa mas a Stone não cobrou). Linhas com valor negativo são marcadas como **estorno**.
4. Use os dados da lista "Só no ContaHub" (cliente, mesa, garçom, comanda) para rastrear a venda no operacional.

### Filtrar por status ou CNPJ

1. Na aba Conciliação, use o dropdown **Status** (Batendo / Pequena dif. / A verificar).
2. Se o bar tiver mais de um CNPJ na Stone, aparece o dropdown **CNPJ** — escolha um para isolar.
3. Marque **Só diferenças ≠ 0** para esconder os dias que bateram ao centavo.

### Usar um intervalo de datas customizado

1. Marque o checkbox **Intervalo custom**.
2. Escolha a data inicial e a final. A tabela e as análises passam a usar esse intervalo em vez do mês.

### Conferir a parte fiscal (NF × Stone × ContaHub)

1. Clique na aba **Conferência (NF × Stone × ContaHub)**.
2. No card do topo veja, por CNPJ, quanto foi emitido de NF no mês e quanto a Stone vendeu; quando aplicável aparece a **Meta NF (folha projetada)**.
3. Na tabela, olhe a coluna **Diagnóstico**: 🟢 OK, 🟡 (conferir/emitir) ou 🔴 (venda Stone acima da NF).
4. Clique num dia para abrir a quebra pelos dois CNPJs.

### Analisar taxas, recebíveis, mix e chargebacks

1. Clique na aba **Análises** e escolha a sub-aba desejada.
2. Em **Taxas (MDR)**, clique numa linha de bandeira para abrir o modal com a **taxa dia a dia** daquela bandeira/tipo.

## Abas e seções

A tela tem **três abas** no topo, e a aba Análises tem **cinco sub-abas**. O seletor de período (mês ou intervalo) é compartilhado por todas.

### Aba 1 — Conciliação

O coração da tela: cartão do ContaHub × bruto da Stone por dia operacional, com cards de resumo, tabela e drill-down por dia.

### Aba 2 — Conferência (NF × Stone × ContaHub)

Conferência **fiscal** por dia: a NF emitida (por CNPJ) bateu com a venda da Stone e com o total do ContaHub? Foco em detectar **venda sem nota** e **emissão no CNPJ errado** (quando o bar opera com dois CNPJs).

### Aba 3 — Análises (sub-abas)

- **Pendências** — fila de trabalho: só os dias divergentes, separados em "divergências reais" e "gaps de cobertura".
- **Taxas (MDR)** — quanto de taxa você paga por bandeira e tipo, com MDR %.
- **Recebíveis** — o que a Stone ainda vai repassar (líquido futuro) e os repasses já feitos.
- **Mix & Maquininhas** — mix por bandeira e tipo, por dia da semana, por hora, e faturamento por maquininha.
- **Chargebacks** — contestações e cancelamentos do período.

## Colunas e cálculos

### Aba Conciliação — cards de resumo

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dias | Quantidade de dias no período | Contagem de linhas retornadas | `gold.mv_stone_conciliacao_diaria` |
| Batendo | Dias que bateram | Dias com `status = 'ok'` | mesmo |
| Recebeu a menos | Dias com furo grave (ContaHub > Stone) | Dias com `status ≠ 'ok'` e `diferenca > 0,5` (vendeu e a Stone não cobrou — possível BO) | mesmo |
| Recebeu a mais | Dias com Stone > ContaHub | Dias com `status ≠ 'ok'` e `diferenca < -0,5` (ex.: venda fora do caixa não lançada) | mesmo |
| Stone bruto | Total bruto cobrado no período | Soma de `stone_bruto` de todos os dias | mesmo |

### Aba Conciliação — tabela por dia

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data operacional (corte 6h) | `(capture_local_dt − 6h)::date` no lado Stone; `data_pagamento` no lado ContaHub | `gold.stone_conciliacao_diaria` |
| Status | Batendo / Pequena dif. / A verificar | `\|dif\| ≤ 0,50` = **ok**; `\|dif\| ≤ MAIOR(R$50 ; 2% do ContaHub)` = **leve**; acima = **verificar** | mesmo |
| ContaHub | Cartão lançado no caixa | Soma de `valor_bruto` com `tipo IN ('Cred','Deb')` por `data_pagamento` | `silver.faturamento_pagamentos` (ContaHub) |
| Stone bruto | Bruto capturado pela maquininha | Soma de `gross_amount` das transações do dia operacional | `silver.stone_transacoes` (Stone) |
| Dif. (Stone−CH) | Diferença exibida como Stone menos ContaHub | A view guarda `diferenca = ContaHub − Stone`; a tela exibe o valor **invertido** (`−diferenca`) para bater com o rótulo "Stone−CH". Vermelho quando ContaHub > Stone (recebeu a menos); âmbar quando Stone > ContaHub (recebeu a mais) | mesmo |

### Drill-down do dia — "Onde diverge"

| Linha | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Crédito | ContaHub crédito × Stone crédito | ContaHub = `ch_credito` (tipo `Cred`); Stone = soma de `gross_amount` com `account_type IN (2,4)` | `gold.stone_conciliacao_diaria` + `silver.stone_transacoes` |
| Débito | ContaHub débito × Stone débito | ContaHub = `ch_debito` (tipo `Deb`); Stone = `account_type IN (1,3)` | mesmo |
| PIX | Só aparece se houve PIX no dia | ContaHub = pagamentos com meio "Pix"; Stone = `account_type = 99` | `silver.faturamento_pagamentos` + `silver.stone_transacoes` |
| Total | Soma geral do dia | ContaHub cartão × Stone bruto total | mesmo |
| Dif. da linha | ContaHub − Stone da linha | Vermelho se > 0 (recebeu a menos), âmbar se < 0 (recebeu a mais); exibida invertida no rótulo Stone−CH | cálculo na API `/dia` |

### Drill-down do dia — "Transações que explicam a diferença"

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Só na Stone (Hora, Tipo, Bandeira, Cartão, Valor) | Transações cobradas pela Stone sem par no ContaHub | Casamento por **lado (Crédito/Débito/PIX) + valor**; o que sobra na Stone é marcado como "suspeita" (o ContaHub não fornece NSU/autorização) | `silver.stone_transacoes` |
| Só no ContaHub (Tipo, Cliente, Mesa, Meio, Garçom, Comanda, Valor) | Lançamentos no caixa sem cobrança correspondente na Stone | O que sobra no ContaHub após o casamento; garçom/comanda vêm do bronze cruzando por mesa + valor | `silver.faturamento_pagamentos` + `bronze.bronze_contahub_financeiro_pagamentosrecebidos` |
| Estorno (marcação) | Valor negativo destacado | Linha com `valor < 0` = venda cancelada/ajustada de um lado só — investigar | mesmo |

### Aba Conferência — cards por CNPJ e totais

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| NF emitida (mês) | Nota fiscal autorizada no mês, por CNPJ | Soma de `nf_autorizado` por `cnpj_indice` | `gold.conciliacao_nf_stone_cnpj_diaria` |
| Venda Stone (mês) | Bruto da Stone no mês, por CNPJ | Soma de `stone_bruto` por `cnpj_indice` (mapeada via `stone_code`) | `gold.conciliacao_nf_stone_cnpj_diaria` + `financial.stone_cnpj_map` |
| Meta NF (folha projetada) | Teto ideal de NF no CNPJ do Simples | Soma de `valor_projetado` (ou `valor_planejado`) da categoria "EMPRESA FUNCION..." do período; só para o CNPJ do Simples (bar 3 = índice 2, bar 4 = índice 3). Mostra % emitido e alerta se estourou | `meta.orcamento_planilha` |
| Venda Stone (total) | Bruto Stone do período | Soma de `stone_bruto` | `gold.conciliacao_contahub_nf_diaria` |
| NF emitida (total) | NF autorizada do período | Soma de `nf_autorizado` | mesmo |
| ContaHub total | Venda total do ContaHub | Soma de `contahub_total` | mesmo |

### Aba Conferência — tabela por dia

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data operacional | `data`; ⚠ quando houve venda nos 2 CNPJs no dia | `gold.conciliacao_nf_stone_cnpj_diaria` |
| Venda Stone | Bruto Stone do dia | `stone_bruto` | `gold.conciliacao_contahub_nf_diaria` |
| NF emitida | NF autorizada do dia | `nf_autorizado` | mesmo |
| CH total | Venda total do ContaHub | `contahub_total`; cor por proximidade com a NF (verde/âmbar/vermelho) | mesmo |
| Diagnóstico | Semáforo fiscal do dia | 🔴 quando venda Stone excede a NF (mostra o excedente); 🟡 "2 CNPJs · conferir" quando teve venda nos dois; 🟡 "NF a emitir" quando NF < ContaHub em > 5%; 🔴 "NF acima do ContaHub" quando NF > ContaHub em > 5%; senão 🟢 OK | cálculo no frontend sobre os golds |
| Linha por CNPJ (expandida) | NF − Stone daquele CNPJ | `nf_autorizado − stone_bruto`; 🚨 quando a Stone (cartão) supera a NF nesse CNPJ | `gold.conciliacao_nf_stone_cnpj_diaria` |

### Aba Análises — Pendências

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data divergente | Dias com `status IN ('leve','verificar')` no período | `public.stone_pendencias` sobre `gold.stone_conciliacao_diaria` |
| Tipo | Classificação | `gap_stone` se `stone_bruto < 1` (falta dado Stone); `gap_contahub` se `contahub < 1` (falta dado ContaHub); senão `real` (divergência de verdade) | mesmo |
| Diferença | ContaHub − Stone do dia | `diferenca` | mesmo |
| Só Stone | Qtd e valor de transações sem par no ContaHub | `so_stone_qtd` · `so_stone_valor` | `public.stone_dia_divergencias` |
| Só ContaHub | Qtd e valor de lançamentos sem par na Stone | `so_ch_qtd` · `so_ch_valor` | mesmo |

### Aba Análises — Taxas (MDR)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Bruto | Bruto do período | Soma de `gross_amount` | `public.stone_analise` (`silver.stone_transacoes`) |
| Taxa paga | Taxa total | Soma de `fee_amount` | mesmo |
| MDR médio | Taxa média efetiva | `taxa / bruto × 100` | mesmo |
| Líquido | Líquido do período | Soma de `net_amount` | mesmo |
| Bandeira / Tipo | Bandeira (Visa, Master, Amex, Hipercard, Elo) e tipo (Débito, Crédito, Voucher, Private Label, PIX) | De-para de `brand_id` e `account_type` | mesmo |
| Qtd | Nº de transações | Contagem por bandeira × tipo | mesmo |
| Bruto / Taxa | Bruto e taxa da bandeira | Somas por bandeira × tipo | mesmo |
| MDR % | Taxa efetiva da linha | `taxa / bruto × 100`; vermelho ≥ 2%, âmbar ≥ 1,5% | mesmo |
| Modal "Taxa por dia" | Taxa dia a dia da bandeira/tipo clicada | Agrupado por `dt_gerencial`; MDR = `taxa/bruto×100` | `public.stone_taxas_dia` |

### Aba Análises — Recebíveis

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| A receber — Data prevista / Transações / Líquido | Líquido futuro que a Stone vai repassar | Transações com `prevision_payment_date ≥ hoje`, somando `net_amount` por data | `silver.stone_transacoes` |
| Repasses — Data / Pagamentos / Valor | Repasses já efetuados no período | Soma de `total_amount` por `reference_date` | `silver.stone_pagamentos` |

### Aba Análises — Mix & Maquininhas

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Transações | Nº de transações | Soma de `qtd` | `public.stone_analise` |
| Ticket médio | Valor médio por transação | `bruto / qtd` | mesmo |
| Bruto | Bruto do período | Soma de `gross_amount` | mesmo |
| Maquininhas | Nº de terminais | Contagem de seriais distintos | mesmo |
| Mix por tipo | Participação de cada tipo de conta | Bruto por tipo ÷ bruto total | mesmo |
| Mix por bandeira | Participação de cada bandeira | Bruto por bandeira ÷ bruto total | mesmo |
| Por dia da semana | Bruto por dia da semana | Soma de `gross_amount` por `dow` do dia operacional | mesmo |
| Por hora | Bruto por hora | Soma de `gross_amount` por hora da captura | mesmo |
| Faturamento por maquininha (Terminal, Qtd, Bruto, MDR %) | Desempenho por terminal | Agrupado por `poi_serial_number`; MDR = `taxa/bruto×100` | mesmo |

### Aba Análises — Chargebacks

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Chargebacks | Nº de contestações | Transações com `ev_chargebacks > 0` | `public.stone_analise` |
| Cancelamentos | Nº de cancelamentos | Transações com `ev_cancellations > 0` | mesmo |
| Eventos listados | Linhas na tabela | Transações com chargeback OU cancelamento (até 300) | mesmo |
| Dia / Bandeira / Tipo / Cartão / Valor / CB / Canc. | Detalhe de cada evento | Campos da transação; `gross_amount`, contadores `ev_chargebacks` / `ev_cancellations` | `silver.stone_transacoes` |

## Filtros e opções

- **Bar** — implícito, sempre o bar selecionado no topo. Todas as consultas filtram por `bar_id`.
- **Período (mês)** — dropdown com os meses disponíveis; setas ‹ › andam mês a mês. É o filtro principal.
- **Intervalo custom** — checkbox que troca o mês por um intervalo de datas livre (De / Até).
- **Status** (aba Conciliação) — todos / Batendo (ok) / Pequena dif. (leve) / A verificar (verificar).
- **CNPJ** (aba Conciliação) — só aparece quando o bar tem mais de um CNPJ na Stone; filtra por substring do nome da empresa.
- **Só diferenças ≠ 0** (aba Conciliação) — esconde os dias que bateram ao centavo.
- **Cards clicáveis** (aba Conciliação) — clicar em Batendo / Recebeu a menos / Recebeu a mais filtra a tabela por aquele grupo.

## Regras e detalhes importantes

- **Dia operacional com corte de 6h.** A madrugada conta para o dia anterior: a Stone é alinhada por `capture_local_dt − 6h`, para bater com o `dt_gerencial`/`data_pagamento` do ContaHub. Sem esse corte a diferença diária vira ruído (testado: corte 0h dava ~R$121k de diferença; a partir de 3h estabiliza em ~R$10,9k).
- **Regra D+2 (dia parcial).** Como a madrugada mora no arquivo Stone do dia seguinte, um dia operacional só fecha 100% em D+2. Dias a partir de `stone_fechado_ate` (maior `reference_date` com HTTP 200 em `bronze.bronze_stone_conciliacao`) recebem o selo **parcial** e um aviso — eles se ajustam sozinhos quando a Stone libera o arquivo.
- **Direção da diferença (leitura de negócio).** `diferenca = ContaHub − Stone`. ContaHub **maior** que a Stone = "recebeu a menos" (vermelho — vendeu e a Stone não cobrou, possível BO). Stone **maior** que o ContaHub = "recebeu a mais" (âmbar — ex.: venda fora do caixa não lançada). Na tabela o valor é exibido invertido (Stone−CH) para casar com o rótulo.
- **Três níveis de status.** `ok` = bate ao centavo (≤ R$0,50); `leve` = defasagem pequena tolerável (≤ maior entre R$50 e 2% do ContaHub); `verificar` = acima disso. Antes era binário e uma diferença de −220 num dia de R$20k parecia "ok" por estar dentro de 2%.
- **Casamento sem NSU.** O ContaHub não fornece NSU/autorização, então o par Stone × ContaHub é feito por **lado (Crédito/Débito/PIX) + valor**. É uma heurística; transações do mesmo valor podem casar de forma imperfeita.
- **Dinheiro fica fora.** Só entram na conciliação os meios que passam pela Stone (crédito, débito e PIX). Pagamento em dinheiro não passa pela maquininha e não é conciliado aqui.
- **PIX.** Crédito Stone = `account_type` 2 e 4; débito = 1 e 3; PIX = 99 (Stone PIX via webhook). O PIX só aparece na quebra do dia quando houve PIX naquele dia.
- **CNPJ da Stone.** O `stone_code` é mapeado para o CNPJ real via `financial.stone_cnpj_map`. Bar 3 (Ordinário) usa 2 CNPJs; bar 4 (Deboche) idem. A **Meta NF** (folha projetada) só se aplica ao CNPJ do Simples Nacional de cada bar.
- **Manual vs. automático.** Tudo aqui é **automático**: bronze (XML da Stone) → silver (tipado) → gold (cruzamento), com cron diário. Não há edição manual de valores nesta tela.
- **Estados vazios.** Sem dados no período aparece "Sem dados no período."; na aba Pendências, período todo conciliado mostra "Tudo conciliado no período. 🎉".
- **Performance.** A aba Conciliação lê a **materialized view** `gold.mv_stone_conciliacao_diaria` (versão materializada de `gold.stone_conciliacao_diaria`), o que derrubou o tempo de ~2,8s para ~100ms.

## Dúvidas frequentes

**O que significa "recebeu a menos"?**
O ContaHub registrou mais cartão do que a Stone cobrou naquele dia. Ou seja: vendeu e o dinheiro não entrou. É o caso mais grave (possível BO/estorno indevido) — abra o dia e veja em "Só no ContaHub" quais vendas não têm par na Stone.

**Por que um dia recente aparece como "parcial"?**
Porque a Stone só publica o arquivo de um dia depois que ele acaba, e o corte de 6h puxa a madrugada para o arquivo do dia seguinte. Cada dia fecha em D+2 e se ajusta sozinho quando a Stone libera o arquivo.

**A diferença é de poucos reais. Preciso me preocupar?**
Se o status é "Batendo" (≤ R$0,50) ou "Pequena dif." (≤ R$50 ou 2%), é apenas arredondamento/defasagem tolerável. Foque nos dias "A verificar".

**Dinheiro e voucher entram na conciliação do cartão?**
Dinheiro não — ele não passa pela Stone. A conciliação cruza crédito, débito e PIX. Voucher/Private Label aparecem no detalhe de bandeiras, mas o cruzamento principal é por crédito/débito/PIX.

**O que é a "Meta NF" na aba Conferência?**
É o teto ideal de emissão de nota no CNPJ do Simples Nacional, baseado na folha projetada (categoria "EMPRESA FUNCIONÁRIO" do orçamento). Emitir NF acima disso nesse CNPJ é sinal de que o restante deveria sair no outro CNPJ.

**Por que aparece o alerta ⚠ de "2 CNPJs" num dia?**
Porque houve venda (Stone ou NF) nos dois CNPJs do bar no mesmo dia. Vale conferir se não houve venda ou emissão no CNPJ errado.

## Fonte dos dados

Integração de origem: **Stone** (arquivo XML de conciliação), **ContaHub** (pagamentos e faturamento) e **NF-e** (notas fiscais). Camada medallion bronze → silver → gold.

- `gold.mv_stone_conciliacao_diaria` — materialized view lida pela aba Conciliação (mesma lógica de `gold.stone_conciliacao_diaria`).
- `gold.stone_conciliacao_diaria` — view que cruza Stone × ContaHub por dia operacional; usada no drill-down do dia e nas pendências.
- `silver.stone_transacoes` — transações Stone tipadas (1 linha por parcela): bruto, líquido, taxa, bandeira, tipo, maquininha, chargebacks.
- `silver.stone_pagamentos` — repasses/pagamentos da Stone (recebíveis já quitados).
- `silver.faturamento_pagamentos` — pagamentos do ContaHub (crédito, débito, PIX).
- `bronze.bronze_contahub_financeiro_pagamentosrecebidos` — bronze do ContaHub, usado para garçom e comanda no drill-down.
- `bronze.bronze_stone_conciliacao` — controle de quais arquivos Stone já chegaram (base do "fechado até").
- `gold.conciliacao_contahub_nf_diaria` e `gold.conciliacao_nf_stone_cnpj_diaria` — golds da aba Conferência (ContaHub × NF e NF × Stone por CNPJ).
- `financial.stone_cnpj_map` — de-para `stone_code` → CNPJ/empresa.
- `meta.orcamento_planilha` — origem da Meta NF (categoria "EMPRESA FUNCIONÁRIO").
- Funções SQL: `public.stone_analise`, `public.stone_pendencias`, `public.stone_dia_divergencias`, `public.stone_taxas_dia`.
