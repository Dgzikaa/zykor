---
title: Almoço × Noite
area: ferramentas
slug: almoco-noite
route: /analitico/dia-noite
description: Quanto do faturamento do dia veio antes e depois de uma hora de corte — separa a feijoada de sábado da noite, com pessoas, ticket médio e o prato âncora.
order: 160
icon: Sun
---

# Almoço × Noite

## Visão geral

Um sábado do Ordinário são dois negócios no mesmo dia: a **feijoada** e a **noite**. O faturamento total não distingue os dois, e a curva horária (em Ferramentas → Insights) tinha blocos que só começavam às 17h — o almoço não tinha bloco nenhum.

Esta tela é, na prática, a **análise do sábado**: parte o dia em dois por uma **janela de almoço ajustável** (padrão **10h–18h**) e mostra, por data: faturamento de cada turno, quantas pessoas, ticket médio de cada um e quanto saiu do **prato âncora** (por padrão, "feijoada"). O filtro já abre em **sábado**.

Nos outros dias a casa abre 16h/17h e roda direto até fechar — não existem dois turnos ali. Por isso, **dia sem almoço aparece como turno único**, com o faturamento do dia inteiro numa coluna só.

**Em bar que não opera em dois turnos, a tela não abre**: mostra só um aviso de "não se aplica" e manda para as telas de faturamento (Desempenho, Visão Geral, Gráficos). Hoje isso vale para todo bar que não seja o Ordinário. O critério é o dado, não o `bar_id`: o bar precisa ter almoço **recorrente** — em pelo menos metade das ocorrências de algum dia da semana. O Ordinário tem 12 de 13 sábados (92%); o Deboche tem no máximo 1 de 13 em qualquer dia (eventos avulsos, um deles de R$ 7,95). Se um bar passar a servir almoço de verdade, a tela liga sozinha.

Quem usa: **dono, sócios e operação** — para saber se o almoço está crescendo, quanto ele pesa no sábado e se vale reforçar equipe/compra para o turno.

## Como ler

**Os números do topo** — faturamento do almoço e da noite no período (com a média por dia), o **% do faturamento que vem do almoço**, pessoas e ticket médio de cada turno, e a quantidade/valor do prato âncora.

**Dia sem almoço = turno único** — quando o dia escolhido não tem operação de almoço, a tela avisa e mostra o **dia inteiro numa coluna só**, sem dividir. O critério é objetivo, e não uma regra chumbada em sábado: **houve venda entre a abertura da janela e 15h?** No sábado sim (a feijoada vende de 12h em diante); no domingo e na quinta a primeira venda é 16h/17h — é a abertura da casa. Sem esse cuidado a tela mentia: domingo aparecia com R$ 2 a 4 mil de "almoço" sem ninguém ter almoçado.

**Quantas feijoadas venderam** — abaixo dos KPIs, a tela lista **cada produto que casa com o texto do prato âncora**, com quantidade e faturamento. Nos últimos sábados do Ordinário: Feijoada Sábado 826 un (R$ 47.482), infantil 15 un (R$ 440) e [Banda] Feijoada 62 un a R$ 0 — a cortesia da banda aparece separada, sem inflar a receita. Se a lista vier vazia, é porque nenhum produto com esse nome foi vendido **naquele bar** (o Deboche não vende feijoada) ou o texto do filtro não casou.

**Almoço × Noite por dia** — as duas barras por data, com a linha do % do almoço. É onde se vê o sábado de feijoada forte contra o sábado fraco.

**Média por dia da semana** — quanto cada dia rende em média. Só o sábado tem as duas barras (almoço + noite); nos demais o dia inteiro é uma barra só.

**Dia a dia** — a tabela com tudo aberto por data, incluindo pessoas e ticket de cada turno.

## Filtros

- **Período** — 30 / 90 / 180 dias ou ano corrente.
- **Dia da semana** — abre em **sábado**; dá para trocar para qualquer outro dia (ou ver todos).
- **Abre** — a hora em que a janela do almoço começa (10h/11h/12h; padrão **10h**). O que vender antes disso vai para a coluna "fora da janela" e continua somando no total.
- **Corte** — a hora que separa almoço de noite (16h a 20h; padrão **18h**). Vale ajustar conforme a operação de cada casa.
- **Prato âncora** — texto livre que casa com o nome do produto (padrão "feijoada"). Serve para acompanhar o carro-chefe do turno; trocando o texto dá para acompanhar qualquer outro prato.

## De onde vem o dado

- **Faturamento**: `silver.faturamento_hora` (ContaHub, desde out/2024), pela **hora do lançamento do item** — uma comanda aberta às 14h que fecha às 22h fica distribuída no turno certo, item a item.
- **Pessoas e comandas**: avendas/vendas por período do ContaHub, pela **hora de abertura da comanda** — a mesa é creditada ao turno em que sentou.
- **Prato âncora**: itens do analítico por produto cujo nome casa com o texto do filtro.
- Agregação: `operations.fn_dia_noite`.

## Cuidado

- **A madrugada (0h–6h) conta como noite**, não como almoço do dia seguinte — ela pertence ao dia gerencial anterior.
- **Antes das 18h não é sinônimo de almoço.** Em dia que abre 16h/17h, o pré-corte é o começo da noite — por isso esse dia vem como turno único.
- **Cortesia entra na quantidade, não na receita.** [Banda] Feijoada sai a R$ 0: conta como prato servido (custo real de cozinha), mas não como faturamento.
- **Só ContaHub**: venda de ingresso via Yuzer ou Sympla **não** entra aqui. Em evento com bilheteria forte, o total desta tela fica abaixo do faturamento real do dia.
- Ticket médio do turno usa as pessoas das comandas abertas naquele turno; em dia de virada (mesa que senta 17h50 e consome a noite toda) o ticket do almoço aparece inflado. O corte por hora do item corrige o faturamento, não a atribuição da pessoa.
