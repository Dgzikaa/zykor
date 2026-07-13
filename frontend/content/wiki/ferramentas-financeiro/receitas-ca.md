---
title: Receitas CA
area: ferramentas-financeiro
slug: receitas-ca
route: /financeiro/receitas
description: Central de conferência e lançamento no Conta Azul das receitas do bar por origem — Stone, Sympla, Yuzer e dinheiro do caixa (ContaHub).
order: 50
icon: TrendingUp
---

# Receitas CA

## Visão geral

A tela **Receitas CA** é o painel onde você confere e lança no **Conta Azul (CA)** todo o dinheiro que **entra** no bar, separado por **origem**. Em vez de digitar recebível por recebível no Conta Azul, o Zykor já traz os valores prontos (bruto, taxa e líquido), calcula a previsão de repasse e cria o lançamento na conta bancária certa com um clique — ou automaticamente, se você ligar o piloto automático.

Ela é organizada em quatro abas, uma por fonte de receita:

- **Stone** — recebíveis de cartão (crédito/débito) e PIX das maquininhas.
- **Sympla** — repasse líquido de venda de ingressos por evento.
- **Yuzer** — repasse de eventos (em construção).
- **Dinheiro (ContaHub)** — dinheiro em espécie recebido no caixa.

Quem usa no dia a dia: **sócio, financeiro e administração** — para manter o Conta Azul batendo com o que realmente entrou, sem retrabalho e sem duplicar lançamento.

## Como acessar

No menu lateral: **Ferramentas Financeiro → Receitas CA** (ícone de tendência de alta). A rota direta é `/financeiro/receitas`.

É preciso ter o módulo de permissão **`ferramentas financeiro_receitas_ca`**. Sem ele, o item nem aparece no menu. Algumas ações de escrita têm verificação adicional por módulo financeiro (ver seção de regras).

Antes de tudo, selecione o **bar** no seletor do topo — todos os dados são filtrados por `bar_id`.

## Passo a passo

### Conferir e lançar recebíveis Stone do dia

1. Abra a aba **Stone**.
2. No campo **Data (dia Stone · 00h–24h)**, escolha o dia que quer conferir. O padrão é **ontem** (horário de Brasília). Não dá para escolher hoje ou o futuro.
3. Clique em **Atualizar preview** para carregar o dia (isso só lê — não escreve nada no CA).
4. Confira os cards de resumo (Recebíveis, Total bruto, Taxa do dia, Líquido) e a lista agrupada por **CNPJ**. Cada CNPJ mostra suas contas bancárias de destino e o par de taxa.
5. Se quiser, use os filtros de **Tipo**, **Bandeira** e **Status** só para visualizar (eles não mudam o que será lançado).
6. Clique em **Lançar no CA (N)**, onde N é o número de lançamentos pendentes.
7. No pop-up de confirmação, reveja o número de lançamentos e a data e confirme em **Lançar N**. Atenção: **o Conta Azul não permite excluir lançamento pela API** — confira o preview antes.
8. Ao terminar, aparece o bloco **Resultado do lançamento** com o status de cada item. O que já foi lançado passa a exibir "lançado" e não é reenviado.

### Lançar um recebível Sympla (evento)

1. Abra a aba **Sympla**.
2. No seletor de **mês**, escolha o período do evento.
3. Confira os cards (Eventos, Líquido a receber, Taxa Sympla, Bruto) e a tabela por evento.
4. Na linha do evento pendente, clique em **Lançar** (coluna **CA**). Ele entra no Conta Azul como **conta a receber** (pendente, sem baixa), vencendo na previsão de repasse.
5. Eventos já lançados mostram "lançado" e não podem ser reenviados.

### Conferir o dinheiro em espécie do caixa

1. Abra a aba **Dinheiro (ContaHub)**.
2. Escolha o **mês** no seletor.
3. Use a busca **Buscar dia/turno…** para localizar um dia específico.
4. A tabela mostra, por dia/turno, quanto foi recebido em dinheiro. O status na coluna **CA** indica se já foi lançado. Aqui **não há botão manual**: o lançamento é feito automaticamente pelo cron (soma do dia, todo dia às 12h).

### Ligar o lançamento automático

1. Em qualquer aba com automação disponível (Stone, Sympla, Dinheiro), clique no botão **Lançamento automático** no canto superior direito.
2. Ao ligar, o interruptor fica verde e o automático passa a valer **só para os lançamentos novos, daquele momento em diante** — o histórico continua manual.
3. Para desligar, clique de novo. A aba **Yuzer** mostra "Automático (em breve)" e fica desabilitada.

## Abas e seções

| Aba | O que faz | Lançamento |
|---|---|---|
| **Stone** | Recebíveis de cartão e PIX das maquininhas Stone, agrupados por CNPJ. Lança o **líquido** como conta a receber e um par de taxa que se compensa. | Manual (botão do dia) + automático opcional |
| **Sympla** | Repasse líquido de venda de ingressos, um lançamento por evento, como conta a receber pendente. | Manual (por evento) + automático opcional (lote) |
| **Yuzer** | **Em construção.** O repasse líquido da Yuzer não vem na API operacional; aguardando endpoint de fechamento. | Indisponível |
| **Dinheiro (ContaHub)** | Dinheiro em espécie recebido no caixa por turno. | Automático (cron 12h) — sem botão manual |

## Colunas e cálculos

### Aba Stone

Cards de resumo:

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Recebíveis | Quantidade de linhas de recebível do dia | Contagem das linhas com bruto > 0 | RPC `financial.stone_ca_lancamentos_dia` |
| Total bruto | Valor bruto vendido no dia | Soma do `bruto` dos recebíveis | idem |
| Taxa do dia | Taxa total da maquininha no dia | Soma da `taxa` por CNPJ | idem |
| Líquido (caixa) | O que entra de fato no caixa | Soma de (`bruto − taxa`) dos recebíveis | idem |

Cabeçalho de cada grupo por CNPJ (empresa):

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Empresa / contas | Nome curto do CNPJ e badges das contas bancárias de destino | Roteamento por `stone_code` para as contas do CA (CONFIG do bar) | RPC + de-para de contas |
| Pendente(s) / lançado | Situação do grupo | Nº de linhas do CNPJ ainda não lançadas | `financial.stone_ca_lancamento_log` |
| bruto (grupo) | Bruto do CNPJ | Soma do `bruto` das linhas do CNPJ | RPC |
| líq (grupo) | Líquido do CNPJ | Soma de (`bruto − taxa`) das linhas do CNPJ | RPC |

Tabela de recebíveis (por linha):

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Descrição | Tipo (Crédito/Débito/PIX) + descrição | Crédito/Débito: `[Zykor] Nome · Bandeira Tipo`; PIX: `[Zykor] Nome · PIX · Pagador` | RPC |
| Conta destino | Banco no CA que recebe | Conta financeira do CNPJ × tipo (crédito/débito, PIX e taxa têm contas próprias) | de-para de contas do CA |
| Venc. | Data em que o valor liquida | `prevision_payment_date` do relatório Stone (num mesmo dia pode variar por fds/feriado) | RPC |
| Tx | Nº de transações agregadas na linha | Contagem de transações do grupo bandeira × vencimento (PIX = 1 por transação) | RPC |
| Bruto | Valor bruto da linha | Soma do bruto das transações | RPC |
| Taxa | Taxa Stone da linha | Soma da taxa das transações | RPC |
| Líquido | O que entra no caixa | `bruto − taxa` | RPC |
| Status | Lançado / pendente | Existe registro com chave `RECEITA` no log? | `financial.stone_ca_lancamento_log` |

Par de taxa (compensação), por CNPJ:

| Item | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| DESPESA — TAXA MAQUININHA | Taxa total do dia do CNPJ como conta a pagar | Soma das taxas do CNPJ | RPC |
| RECEITA — Outras Receitas | Compensação de mesmo valor que anula a despesa | Mesmo total da taxa | RPC |

> Por que o par? Como o recebível já é lançado pelo **líquido**, a despesa da taxa e a receita de compensação se anulam no caixa — mas deixam a taxa visível como linha de custo no CA. Após criar, o Zykor ainda **baixa** (marca paga/recebida) as duas pontas da taxa.

### Aba Sympla

Cards de resumo:

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Eventos | Nº de eventos no período | Contagem de eventos com líquido > 0 | `silver.sympla_recebiveis_evento` |
| Líquido a receber | Total líquido do período | Soma do `liquido` dos eventos | idem |
| Taxa Sympla | Total de taxas | Soma da `taxa` dos eventos | idem |
| Bruto | Total bruto vendido | Soma do `bruto` dos eventos | idem |

Tabela por evento:

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Evento | Nome do evento (ou "Evento {id}") | `e.name` do evento Sympla | `bronze.bronze_sympla_eventos` |
| Data | Data do evento | `start_date` do evento | idem |
| Pedidos | Pedidos aprovados que geram receita | Contagem de pedidos com status `A` (aprovado) e líquido > 0; abaixo, "N canc." = pedidos com status `C` (cancelado) | `bronze.bronze_sympla_pedidos` |
| Bruto | Valor de venda | Σ `order_total_sale_price` dos aprovados | idem |
| Taxa | Taxa da Sympla | `bruto − liquido` (Σ preço de venda − Σ valor líquido) | idem |
| Líquido | O que a Sympla repassa | Σ `order_total_net_value` dos aprovados (cancelados já fora) | idem |
| Previsão repasse | Quando o dinheiro cai | Data do evento **+ 5 dias úteis** (pula fins de semana e feriados de `operations.feriados_eventos`). Se já lançado, usa a previsão gravada no log | cálculo na API / `financial.sympla_ca_log` |
| CA | Lançar / lançado | "lançado" se há registro no log; senão botão **Lançar** | `financial.sympla_ca_log` |

### Aba Dinheiro (ContaHub)

Cards de resumo (do mês selecionado):

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Entradas (dinheiro) | Dinheiro recebido no mês + nº de dias e média/dia | Soma de `total_liquido` das entradas; média = total ÷ dias com entrada | `silver.contahub_entrada_caixa_dinheiro` |
| Saídas (sangria) | Retiradas de caixa no mês | Soma de `valor_saida` das saídas | `silver.contahub_caixa_saida` |
| Líquido do mês | Entradas − saídas | `total_entradas − total_saidas` | derivado |
| Ticket saída | Valor médio por retirada | `total_saidas ÷ qtd_saidas` | derivado |

Tabela de entradas:

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data gerencial + dia da semana | `dt_gerencial` | `silver.contahub_entrada_caixa_dinheiro` |
| Turno | Nº do turno | `trn` | idem |
| Pgtos | Nº de pagamentos em dinheiro | `qtd_pagamentos` | idem |
| Dinheiro recebido | Valor recebido em espécie | `total_liquido` | idem |
| CA | Lançado / pendente | "lançado" se há registro no dia; senão "pendente" (será lançado pelo cron das 12h) | `financial.entrada_caixa_ca_log` |

> Observação: como esta aba é embutida com foco em **entradas**, as abas internas (Saídas / Por turno) da tela de Fluxo de Dinheiro ficam ocultas aqui — mas os cards de Saídas e Ticket saída continuam sendo exibidos como referência.

## Filtros e opções

- **Seletor de bar** (topo do sistema): define o `bar_id` de tudo. Cada bar vê só os seus dados.
- **Aba Stone — Data**: escolhe o dia Stone (00h–24h). Padrão = ontem (BRT); máximo = ontem.
- **Aba Stone — filtros de visualização**: **Tipo** (Crédito/Débito/PIX), **Bandeira** (Visa/Master/Elo/Amex) e **Status** (Todos/Pendentes/Lançados). Só afetam a exibição — **o lançamento sempre processa todos os pendentes do dia**.
- **Aba Stone — recolher CNPJ**: clique no cabeçalho de um CNPJ para expandir/recolher suas linhas.
- **Aba Sympla — mês**: filtra os eventos por mês (com base na data do evento).
- **Aba Dinheiro — mês** e **busca dia/turno**: filtram a lista de entradas.
- **Botão Lançamento automático** (por aba): liga/desliga o cron para aquela origem. Ao ligar, vale só para os novos.

## Regras e detalhes importantes

- **Sempre por `bar_id`**: todos os cálculos e o roteamento de contas são por bar. O sistema nunca assume um bar.
- **Modelo Stone (definido com o sócio)**: lança-se o **líquido** (bruto − taxa) como conta a receber, para cartão e PIX; a taxa vira um **par que se compensa** (despesa + receita de mesmo valor), por CNPJ. O caixa fica correto no líquido e a taxa fica visível como custo.
- **Roteamento por CNPJ (StoneCode)**: cada bar fatura em 2 CNPJs e cada CNPJ tem contas próprias no CA. Crédito/débito, PIX e taxa vão cada um para a sua conta. Se aparecer um StoneCode sem conta configurada, o Zykor **não lança** aquela linha (trava anti-erro) e sinaliza no resultado.
- **Idempotência**: nada é duplicado. Stone controla por `bar_id + dia + chave + natureza`; Sympla por `bar_id + event_id`; dinheiro por dia. Reexecutar apenas completa o que faltou.
- **CA não permite excluir por API**: confira sempre o preview antes de lançar Stone. Um lançamento errado precisa ser ajustado manualmente no Conta Azul.
- **Competência × vencimento**: Stone → competência = dia da venda, vencimento = previsão de liquidação da Stone. Sympla → competência = data do evento, vencimento = previsão de repasse (evento + 5 dias úteis). Dinheiro → competência/vencimento = dia gerencial.
- **Sympla firma após reverificação**: o líquido só é definitivo depois da reverificação diária de cancelados. O botão manual ignora a trava de data; o **cron** só lança eventos a partir de `lancar_desde` (para não mexer em eventos antigos já lançados por fora) e trabalha a janela D+2 a D+8.
- **Prefixo `[Zykor]`**: tudo que o sistema lança no CA leva o prefixo `[Zykor]` na descrição — para distinguir do que foi lançado por fora e permitir a baixa achar o lançamento certo.
- **Arredondamento**: valores em duas casas (centavos).
- **Automático vale só para novos**: ao ligar o piloto automático, grava-se um corte (cutoff) e o histórico anterior continua manual.
- **Estados vazios**: cada aba mostra mensagem própria quando não há dado no período ("Nenhum recebível…", "Nenhum recebível Sympla no período.", "Nenhuma entrada de dinheiro no período.").
- **Yuzer**: sem dado disponível — a origem não expõe o repasse líquido na API operacional.

## Dúvidas frequentes

**Se eu clicar em "Lançar" duas vezes, duplica no Conta Azul?**
Não. Todos os lançamentos são idempotentes — o que já foi lançado é pulado e marcado como "lançado".

**Por que o recebível Stone entra pelo líquido e não pelo bruto?**
Porque é o que de fato cai na conta. A taxa é lançada à parte como um par despesa + compensação que se anula no caixa, mas mantém a taxa visível como custo.

**Consigo apagar um lançamento errado pela tela?**
Não. O Conta Azul não permite exclusão pela API. Por isso a confirmação avisa para conferir o preview antes; correções são feitas manualmente no CA.

**Quando o dinheiro do caixa é lançado?**
Automaticamente, pelo cron, todo dia às 12h (soma do dia), como conta a receber na categoria "Dinheiro", conta "Caixa Dinheiro". Não há botão manual nessa aba.

**Quando cai o repasse da Sympla?**
A previsão é a data do evento mais 5 dias úteis (pulando fins de semana e feriados). O lançamento entra como conta a receber pendente e vence nessa data; a baixa é a conciliação do depósito, depois.

**Por que a aba Yuzer está vazia?**
O repasse líquido da Yuzer (com taxas e aluguel de equipamento) não vem na API operacional deles. A aba fica "em construção" até liberarem o endpoint de fechamento.

## Fonte dos dados

- **Stone** (cartão/PIX): função `financial.stone_ca_lancamentos_dia`, com destino de contas via `bronze.bronze_contaazul_contas_financeiras`; log de lançamentos em `financial.stone_ca_lancamento_log`. Origem: relatório de recebíveis da **Stone**; escrita no **Conta Azul** (API v2).
- **Sympla**: view `silver.sympla_recebiveis_evento` (sobre `bronze.bronze_sympla_pedidos` e `bronze.bronze_sympla_eventos`); feriados em `operations.feriados_eventos`; log em `financial.sympla_ca_log`. Origem: **Sympla**; escrita no **Conta Azul**.
- **Dinheiro (ContaHub)**: views `silver.contahub_entrada_caixa_dinheiro`, `silver.contahub_caixa_saida` e `silver.contahub_caixa_turno_resumo`; log em `financial.entrada_caixa_ca_log`. Origem: relatório de turno do **ContaHub**; escrita no **Conta Azul**.
- **Automação**: `financial.lancamento_auto_config` guarda o liga/desliga do cron por bar e tipo.
- **Yuzer**: sem fonte disponível (aguardando integração de fechamento).
