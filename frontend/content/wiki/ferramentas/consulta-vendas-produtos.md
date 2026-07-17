---
title: Consulta de Vendas
area: ferramentas
slug: consulta-vendas-produtos
route: /ferramentas/vendas-produtos
description: Consulta rápida de venda de produtos por período, com filtros de grupo, local, garçom e tipo de venda — o "sintético" do ContaHub sem as limitações do CH.
order: 25
icon: ShoppingCart
---

# Consulta de Vendas

## Visão geral

A tela de **Consulta de Vendas** é um "sintético" da venda de produtos do bar — igual em espírito ao relatório sintético do ContaHub, mas com filtros que o CH não oferece: **grupo**, **local**, **garçom** e **tipo de venda**, além de busca livre por nome do produto.

Serve pra responder rapidinho perguntas do dia-a-dia como *"quanto vendemos de Parmegiana entre 01/07 e 15/07?"*, *"qual o valor total de bebidas quentes no mês passado?"*, *"o quanto o Beto vendeu em qual categoria essa semana?"*. A base é a mesma que alimenta as outras análises de venda (mesmo dado do ContaHub), então o resultado casa com o resto do sistema.

## Como acessar

- **Menu lateral:** Ferramentas → **Consulta de Vendas** (ícone de carrinho de compras).
- **Rota:** `/ferramentas/vendas-produtos`.
- **Permissão:** módulo `gestao`.

Tudo respeita o **bar selecionado** no topo. Ao trocar de bar, a consulta é refeita.

## Passo a passo

**1. Escolher o período**
No topo, use os presets **Hoje**, **Ontem**, **Semana**, **Mês** (padrão), **Mês passado** ou **30 dias**. Também dá pra ajustar manualmente **De** e **Até**. Qualquer mudança dispara a consulta automaticamente; o botão de atualizar ao lado força a recarga.

**2. Filtrar**
Todos os filtros combinam (AND) entre si:
- **Buscar produto** — texto livre, casa por `ILIKE` no nome do produto (server-side).
- **Grupo** — multi-select do grupo/categoria do produto (Chopes, Petiscos, etc.).
- **Local** — multi-select do local/setor da venda (Bar, Cozinha, etc.).
- **Garçom** — multi-select de quem lançou a venda.
- **Tipo de venda** — multi-select (Consumo, Delivery, etc.).

Os multi-selects mostram só os valores que **existem no período escolhido** — se você trocar de "Mês" pra "Ano", a lista de garçons pode aumentar.

**3. Ler os totais**
Três cards no topo:
- **Valor total** — soma de `valorfinal` das linhas filtradas; sub mostra o desconto total.
- **Quantidade** — soma da `qtd`; sub mostra nº de produtos distintos e nº de lançamentos.
- **Custo total** — soma do `custo` das linhas; sub mostra a margem % (`(valor − custo) ÷ valor × 100`).

**4. Ordenar a tabela**
Clique em qualquer cabeçalho (Produto, Grupo, Qtd, Valor, Desconto, Custo, Ticket médio, Lançamentos) para ordenar; clique de novo para inverter. Ticket médio = `valor ÷ qtd`.

**5. Exportar**
Botão **CSV** baixa a tabela ordenada como aparece na tela.

## Colunas e cálculos

### Cartões de totais

| Indicador | O que mostra | Como é calculado |
|---|---|---|
| Valor total | Faturamento do que foi filtrado | Σ `valorfinal` |
| Desconto (sub) | Desconto acumulado | Σ `desconto` |
| Quantidade | Itens vendidos | Σ `qtd` |
| Produtos (sub) | Nº de produtos distintos | Contagem distinta de `prd_desc` |
| Lançamentos (sub) | Nº de linhas do ContaHub | Contagem de linhas |
| Custo total | Custo apurado do que foi vendido | Σ `custo` |
| Margem % (sub) | Margem sobre o valor | `(valor − custo) ÷ valor × 100` |

### Tabela

| Coluna | O que mostra | Como é calculado |
|---|---|---|
| Produto | Nome do produto | `prd_desc` |
| Grupo | Categoria do produto | `grp_desc` |
| Qtd | Quantidade vendida | Σ `qtd` do produto |
| Valor | Faturamento do produto | Σ `valorfinal` |
| Desconto | Desconto acumulado | Σ `desconto` |
| Custo | Custo apurado | Σ `custo` |
| Ticket médio | Valor médio por unidade | `valor ÷ qtd` |
| Lanç. | Nº de linhas | Contagem |

## Regras e detalhes importantes

- **Sempre por `bar_id`**: nenhum número mistura bares.
- **Data usada é `trn_dtgerencial`** — o "dia gerencial" do ContaHub (o dia da noite, não o horário exato do lançamento).
- **Todos os filtros passam pro servidor** — a consulta acontece em SQL, não é filtragem no navegador; por isso funciona bem mesmo pra ano inteiro.
- **Performance**: a função `gold.consulta_vendas_produtos` roda a query pesada uma vez e devolve total, agregado e opções de filtro num único bloco. Janela de 15 dias: ~300ms. Ano inteiro: ~3 s (com loader visível). Se ficar lento em janelas grandes, a próxima otimização será materializar as listas de filtro por bar+mês.
- **Ordenação padrão**: valor decrescente (maiores faturamentos primeiro).
- **Sem paginação**: a agregação já reduz para uma linha por produto, então até bares grandes cabem numa página só (~300–500 produtos no ano).

## Dúvidas frequentes

**Bate com o sintético do ContaHub?**
Sim — a fonte é o mesmo dado analítico do ContaHub. Se o CH mostra X reais de Parmegiana, o Zykor mostra o mesmo.

**Por que o multi-select de garçons/grupos mudou quando troquei o período?**
Porque a lista de opções vem do próprio período — só aparece quem apareceu naquele intervalo. Isso evita listar 40 garçons antigos que não trabalharam mais.

**A busca por produto respeita acento?**
Sim, é `ILIKE` no PostgreSQL — case e acento insensíveis. "parmegiana" acha "Parmegiana de Frango".

**Consigo filtrar por comanda / mesa?**
Ainda não — essa tela é por produto. Se precisar de mesa, tem outras análises específicas (Raio-x por Garçom, Gargalo de Cozinha, etc.).

## Fonte dos dados

- **Página:** `src/app/ferramentas/vendas-produtos/page.tsx`.
- **API:** `/api/ferramentas/vendas-produtos/route.ts` (autentica, valida datas, monta arrays dos filtros e chama a RPC).
- **RPC principal:** `gold.consulta_vendas_produtos(p_bar_id, p_data_inicio, p_data_fim, p_produto, p_grupos[], p_locais[], p_garcons[], p_tipos[])` — retorna `jsonb` com `{ total, agregado, filtros }`.
- **Tabela de vendas:** `gold.gold_contahub_avendas_porproduto_analitico` (analítico por produto do ContaHub, ~1 M de linhas em jul/2026).
