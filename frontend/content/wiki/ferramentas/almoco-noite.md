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

Esta tela parte o dia em dois por uma **janela de almoço ajustável** (padrão **11h–18h**) e mostra, por data: faturamento de cada turno, quantas pessoas, ticket médio de cada um e quanto saiu do **prato âncora** (por padrão, "feijoada"). O filtro já abre em **sábado** — é o único dia com almoço no Ordinário.

Quem usa: **dono, sócios e operação** — para saber se o almoço está crescendo, quanto ele pesa no sábado e se vale reforçar equipe/compra para o turno.

## Como ler

**Os números do topo** — faturamento do almoço e da noite no período (com a média por dia), o **% do faturamento que vem do almoço**, pessoas e ticket médio de cada turno, e a quantidade/valor do prato âncora.

**Dia sem almoço** — quando o dia escolhido não tem operação de almoço, a tela avisa e troca o rótulo de "Almoço" por "Antes das 18h". O critério é objetivo, e não uma regra chumbada em sábado: **houve venda entre 11h e 15h?** No sábado sim (a feijoada vende de 12h em diante); no domingo e na quinta a primeira venda é 16h/17h — é a **abertura da casa**, não almoço. Sem esse cuidado a tela mentia: domingo aparecia com R$ 2 a 4 mil de "almoço" sem ninguém ter almoçado.

**Almoço × Noite por dia** — as duas barras por data, com a linha do % do almoço. É onde se vê o sábado de feijoada forte contra o sábado fraco.

**Média por dia da semana** — quanto cada dia da semana rende, em média, de almoço e de noite. Responde "o almoço só existe no sábado ou a quinta também puxa?".

**Dia a dia** — a tabela com tudo aberto por data, incluindo pessoas e ticket de cada turno.

## Filtros

- **Período** — 30 / 90 / 180 dias ou ano corrente.
- **Dia da semana** — abre em **sábado**; dá para trocar para qualquer outro dia (ou ver todos).
- **Abre** — a hora em que a janela do almoço começa (10h/11h/12h; padrão **11h**). O que vender antes disso vai para a coluna "fora da janela" e continua somando no total.
- **Corte** — a hora que separa almoço de noite (16h a 20h; padrão **18h**). Vale ajustar conforme a operação de cada casa.
- **Prato âncora** — texto livre que casa com o nome do produto (padrão "feijoada"). Serve para acompanhar o carro-chefe do turno; trocando o texto dá para acompanhar qualquer outro prato.

## De onde vem o dado

- **Faturamento**: `silver.faturamento_hora` (ContaHub, desde out/2024), pela **hora do lançamento do item** — uma comanda aberta às 14h que fecha às 22h fica distribuída no turno certo, item a item.
- **Pessoas e comandas**: avendas/vendas por período do ContaHub, pela **hora de abertura da comanda** — a mesa é creditada ao turno em que sentou.
- **Prato âncora**: itens do analítico por produto cujo nome casa com o texto do filtro.
- Agregação: `operations.fn_dia_noite`.

## Cuidado

- **A madrugada (0h–6h) conta como noite**, não como almoço do dia seguinte — ela pertence ao dia gerencial anterior.
- **Antes das 18h não é sinônimo de almoço.** Em dia que abre 16h/17h, o pré-corte é o começo da noite. A tela sinaliza isso, mas ao comparar dias diferentes vale olhar o aviso.
- **Só ContaHub**: venda de ingresso via Yuzer ou Sympla **não** entra aqui. Em evento com bilheteria forte, o total desta tela fica abaixo do faturamento real do dia.
- Ticket médio do turno usa as pessoas das comandas abertas naquele turno; em dia de virada (mesa que senta 17h50 e consome a noite toda) o ticket do almoço aparece inflado. O corte por hora do item corrige o faturamento, não a atribuição da pessoa.
