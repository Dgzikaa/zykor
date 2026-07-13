---
title: Vazamento (descontos)
area: ferramentas
slug: vazamento-descontos
route: /operacional/vazamento-descontos
description: Mostra quanto dinheiro sai em descontos nas vendas, quebrado por operador, categoria, dia e item, para separar promoção legítima de desconto discricionário.
order: 120
icon: Percent
---

# Vazamento (descontos)

## Visão geral

A tela **Vazamento (descontos)** responde a uma pergunta simples e cara: **quanto o bar está deixando na mesa em descontos?** Ela soma todo o desconto concedido nas vendas reais do período e mostra de onde ele vem — qual operador desconta mais, em qual categoria de produto o desconto se concentra, como o valor evolui dia a dia e quais itens mais recebem abatimento.

O objetivo é ajudar o gestor a separar o **desconto legítimo** (uma promoção como Happy Hour, que é uma regra da casa) do **desconto discricionário** — aquele que o operador dá por conta própria, cliente a cliente, e que pode virar vazamento de receita. Por isso a própria tela avisa: o Happy Hour aparece alto porque é promo, então o olhar mais crítico deve ir para o **% de desconto por operador**.

Quem usa no dia a dia: donos, gerentes e responsáveis pela operação de salão que querem controlar margem e coibir abuso de desconto.

> **Importante:** esta tela olha apenas **vendas reais** (item com valor final positivo). Cortesia e consumo interno (item zerado) **não entram aqui** — isso fica no módulo de Consumação, para evitar dupla contagem.

## Como acessar

No menu lateral, abra **Ferramentas** e clique em **Vazamento (descontos)** (ícone de porcentagem). A rota direta é `/operacional/vazamento-descontos`.

**Permissão necessária:** módulo `gestao`. Sem essa permissão o item não aparece no menu e a página fica bloqueada. É preciso também ter um bar selecionado — se nenhum bar estiver ativo, a tela mostra "Selecione um bar".

## Passo a passo

**Analisar o desconto do período**

1. Abra **Ferramentas → Vazamento (descontos)**.
2. Confirme no topo que o bar correto está selecionado (o seletor de bar fica no cabeçalho do sistema).
3. Escolha o período no botão de atalho: **7d**, **30d** ou **90d** (o padrão é 30 dias). A tela recarrega sozinha ao trocar.
4. Leia primeiro os quatro cartões de destaque no topo: desconto total em R$, % sobre vendas, comandas com desconto e itens descontados.

**Identificar quem desconta demais**

1. Olhe o gráfico **"Quem mais desconta"** (barras horizontais por operador).
2. As barras são coloridas: **vermelho** sinaliza operador cujo **% de desconto** está bem acima da média do bar (acima de 1,5× a média, com piso de 3%); **âmbar/laranja** é o desconto dentro do esperado.
3. Um operador em vermelho e com barra grande é o candidato número um a uma conversa: ele desconta muito, em valor e em proporção.

**Ver onde e quando o desconto acontece**

1. No gráfico **"Onde o desconto concentra"**, veja quais **categorias** de produto puxam o desconto (bebida, comida, drink etc.).
2. No gráfico **"Desconto por dia"**, acompanhe a evolução diária em R$ (barras) e o **% sobre vendas** (linha vermelha). Picos na linha indicam dias em que o desconto pesou mais na receita.
3. Na tabela **"Itens que mais recebem desconto"**, identifique produtos específicos que concentram abatimento.

## Colunas e cálculos

Todos os números partem da mesma base: itens de venda do bar no período, com **valor final maior que zero** (vendas reais). O percentual de desconto é sempre calculado sobre a **venda cheia**, ou seja, o valor final somado ao desconto (o preço antes do abatimento).

### Cartões de destaque (KPIs)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Desconto no período | Total de desconto concedido em R$ | Soma de `desconto` de todos os itens de venda real, arredondada a zero casas | `gold_contahub_avendas_porproduto_analitico` |
| % sobre vendas | Peso do desconto sobre o faturamento cheio | `100 × soma(desconto) ÷ (soma(valorfinal) + soma(desconto))`, 1 casa decimal | idem |
| Comandas com desconto | Quantas comandas tiveram ao menos um item descontado | Contagem de comandas distintas onde houve desconto > 0. Comanda = dia + mesa (`trn_dtgerencial` + `vd_mesadesc`) | idem |
| Itens descontados | Quantas linhas de venda receberam desconto | Contagem de itens com `desconto > 0` | idem |

### Gráfico "Quem mais desconta" (por operador)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Operador | Quem lançou a venda | Campo `usr_lancou` do item | `gold_contahub_avendas_porproduto_analitico` |
| Desconto (R$) | Total descontado por aquele operador | Soma de `desconto` por operador; só entra quem tem desconto > 0; top 25 por valor | idem |
| % de desconto | Cor da barra e sinal de alerta | `100 × soma(desconto) ÷ (soma(valorfinal) + soma(desconto))` do operador. Barra fica vermelha se esse % passar de `máx(1,5 × média do bar; 3%)` | idem |
| Vendas (R$) | Faturamento real do operador no período | Soma de `valorfinal` por operador | idem |

### Gráfico "Onde o desconto concentra" (por categoria)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Categoria | Grupo do produto (bebida, comida, drink etc.) | Campo `grp_desc`; vazio vira "—"; top 15 por valor | `gold_contahub_avendas_porproduto_analitico` |
| Desconto (R$) | Total descontado na categoria | Soma de `desconto` por categoria; só categorias com desconto > 0 | idem |
| % de desconto | Peso do desconto na categoria | `100 × soma(desconto) ÷ (soma(valorfinal) + soma(desconto))` da categoria | idem |

### Gráfico "Desconto por dia"

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data gerencial | `trn_dtgerencial`, exibida como dia/mês | `gold_contahub_avendas_porproduto_analitico` |
| Desconto R$ (barra) | Desconto do dia | Soma de `desconto` por dia | idem |
| % vendas (linha) | Peso do desconto no dia | `100 × soma(desconto) ÷ (soma(valorfinal) + soma(desconto))` do dia | idem |

### Tabela "Itens que mais recebem desconto"

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Item | Nome do produto | Campo `prd_desc` | `gold_contahub_avendas_porproduto_analitico` |
| Vezes descontado | Quantas vendas do item tiveram desconto | Contagem de linhas com `desconto > 0` para o produto | idem |
| Desconto total | Valor total abatido no item | Soma de `desconto` por produto; só itens com desconto > 0; top 15 por valor | idem |

## Filtros e opções

| Filtro | Efeito |
|---|---|
| **Bar** | Herdado do seletor de bar do sistema. Todos os números são filtrados por `bar_id`; a tela nunca mistura bares. Sem bar selecionado, nada é exibido. |
| **Período (7d / 30d / 90d)** | Define a janela de dias contados a partir de hoje para trás. Padrão 30 dias. A API aceita entre 7 e 180 dias, mas a interface oferece apenas 7, 30 e 90. |

Não há exportação, edição nem cadastro nesta tela — ela é somente de leitura/análise.

## Regras e detalhes importantes

- **Só vendas reais:** entram apenas itens com `valorfinal > 0`. Cortesia e consumo interno (item zerado) ficam de fora, para não contar duas vezes o que já é tratado em Consumação.
- **Base de cálculo do %:** o percentual é sempre sobre a **venda cheia** (valor final + desconto), não sobre o valor já com desconto. Isso responde "de cada real de preço original, quanto virou desconto".
- **Happy Hour infla o gráfico de categoria:** por ser uma promoção da casa, o Happy Hour aparece com desconto alto e isso é esperado. O sinal de vazamento discricionário está no **% por operador**, não no volume por categoria.
- **Definição de comanda:** para contar "comandas com desconto", o sistema identifica a comanda pela combinação **data gerencial + descrição da mesa** (`vd_mesadesc`). Mesas sem descrição podem não ser agrupadas de forma perfeita.
- **Arredondamento:** valores em R$ são arredondados para reais inteiros (zero casas); percentuais têm 1 casa decimal.
- **Limites de linhas:** operadores são limitados aos 25 maiores, categorias e itens aos 15 maiores, todos ordenados por valor de desconto. Só entram registros com desconto positivo.
- **Data gerencial:** o período usa `trn_dtgerencial` (a data de negócio do ContaHub), não a data-calendário bruta.
- **Estado vazio:** se não houver vendas com desconto no período, a tela mostra "Sem dados no período".
- **Somente leitura:** todos os dados vêm automaticamente do ContaHub, já processados na camada gold. Não há campo manual nesta tela.

## Dúvidas frequentes

**Por que o Happy Hour aparece com tanto desconto?**
Porque ele é uma promoção da casa — o desconto ali é intencional e previsto. O que merece atenção é o desconto que um operador dá por conta própria; para isso, olhe o **% por operador**, não o total por categoria.

**O que significa a barra vermelha no gráfico de operadores?**
Que o percentual de desconto daquele operador está bem acima da média do bar (mais de 1,5× a média, com piso de 3%). É um sinal de que ele desconta em proporção maior que os colegas.

**Cortesia e consumo interno entram nessa conta?**
Não. A tela considera apenas vendas com valor final positivo. Cortesia e consumo interno são tratados no módulo de Consumação, para não haver contagem em dobro.

**O % de desconto é sobre o quê?**
Sobre a venda cheia — o valor final somado ao desconto. Ou seja, o preço original antes do abatimento.

**Posso mudar o período para além de 90 dias?**
Na interface, não: os botões são 7, 30 e 90 dias. Internamente o cálculo suporta até 180 dias, mas isso não está exposto na tela.

**Os dados são em tempo real?**
Eles acompanham a atualização do ContaHub na camada gold. Refletem as vendas já processadas até a última sincronização, não o exato instante do consumo.

## Fonte dos dados

- **Função SQL:** `operations.fn_vazamento_descontos(p_bar_id, p_dias)` — consolida KPIs, quebras por operador, categoria, dia e item.
- **Tabela/base:** `gold.gold_contahub_avendas_porproduto_analitico` (camada gold, granularidade de item de venda por produto).
- **Integração de origem:** **ContaHub** (analítico de vendas por produto).
- **API:** `GET /api/operacional/vazamento-descontos?bar_id={id}&dias={7|30|90}` (autenticação de usuário; RPC executada via service role).
