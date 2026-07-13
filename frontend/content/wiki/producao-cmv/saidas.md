---
title: Saídas de Insumo
area: producao-cmv
slug: saidas
route: /operacional/consumo-insumo
description: Mostra o consumo teórico do estoque no período — quanto de cada insumo e de cada produção "saiu" a partir das vendas do ContaHub, explodidas na ficha técnica.
order: 50
icon: LogOut
---

# Saídas de Insumo

## Visão geral

A tela **Saídas** responde a uma pergunta simples do dia a dia da operação: *"a partir do que foi vendido, quanto deveria ter saído do estoque?"*.

Ela não lê contagem de estoque nem nota de compra. Em vez disso, parte das **vendas do ContaHub** (e do Yuzer, quando o evento usa Yuzer) e **explode cada produto vendido na sua ficha técnica**. Assim, cada caipirinha vendida "puxa" a quantidade de cachaça, limão, açúcar etc. definida na ficha; cada prato puxa suas produções (preparos) e insumos.

O resultado é o **consumo teórico** do período: a saída de estoque que a venda justifica. É a base para comparar depois com o consumo real (contagem) na tela de Desvios, e serve para entender rapidamente:

- quais insumos mais saíram no dia / semana / mês;
- quais produções (preparos de cozinha e bar) foram mais demandadas;
- e, no modo Geral, a foto lado a lado de finalizações vendidas e produções consumidas.

Quem mais usa: gestão de CMV, cozinha/bar e sócios que acompanham consumo e desvios.

## Como acessar

No menu lateral: **Produção - CMV → Saídas**.

Rota direta: `/operacional/consumo-insumo`.

**Permissão necessária:** módulo `gestao`. Sem esse acesso o item nem aparece no menu.

Os dados são sempre filtrados pelo **bar selecionado** no topo do sistema. Trocar de bar recarrega toda a tela.

## Passo a passo

### Ver as saídas de um período

1. Escolha a aba desejada (**Insumos** ou **Produções**) logo abaixo do título.
2. Selecione a **granularidade** com os botões **Dia**, **Semana** ou **Mês**.
3. Escolha o período de referência no campo ao lado dos botões:
   - **Dia:** um seletor de data. O padrão é **ontem** (hoje − 1), porque o consumo do dia atual ainda está em andamento e ficaria incompleto.
   - **Semana:** um menu com as 16 últimas semanas (segunda a domingo).
   - **Mês:** um menu com os 12 últimos meses.
4. A tabela recarrega automaticamente. O intervalo aplicado aparece em texto ao lado (ex.: `12/07/2026` ou `06/07/2026 → 12/07/2026`).

### Buscar e filtrar por categoria

1. Use o campo **Buscar…** (canto direito) para filtrar por **nome** ou **código** do item. O filtro é aplicado na hora, sobre o que já foi carregado.
2. Se houver mais de uma categoria no resultado, aparecem **chips de categoria** acima da tabela. Clique em um para filtrar; clique em **Todas** (ou no chip ativo de novo) para limpar.

### Abrir a quebra de um item (drill-down)

1. Na aba **Insumos** ou **Produções**, **clique em qualquer linha** da tabela. A seta à esquerda (▸ / ▾) indica que a linha é expansível.
2. O que aparece na quebra depende do contexto:
   - **Insumos + período de 1 dia:** mostra **cada produto vendido** que puxou aquele insumo, com a quantidade vendida e a saída de insumo correspondente.
   - **Insumos + Semana ou Mês:** mostra a **saída por dia** do período, e dentro de cada dia os produtos que a geraram.
   - **Produções:** mostra cada produto vendido que consome aquela produção, incluindo a coluna **Por produto** (quanto da produção cada unidade do produto usa).
3. Clique de novo na linha para fechar a quebra.

> A aba Geral não abre quebra por produto (as linhas não são clicáveis).

### Exportar em CSV

1. Ajuste aba, período e filtros como quiser.
2. Clique em **CSV** (canto direito). É baixado um arquivo com o que está visível na tela, no formato `saidas-<aba>_<ini>_<fim>.csv`, separado por `;` e com acentuação preservada (BOM UTF-8).

## Abas e seções

A tela tem duas abas navegáveis mais um terceiro modo servido pela API:

| Aba | O que lista | Nível de explosão |
|---|---|---|
| **Insumos** (padrão) | Um insumo por linha, com a quantidade total que saiu do estoque no período. | Explode a venda até o **insumo final** da ficha (matéria-prima). |
| **Produções** | Uma produção/preparo por linha (drinks/bar e cozinha). | Explode a venda até a **produção** (preparo intermediário), sem descer ao insumo. |
| **Geral** | Finalizações vendidas + produções consumidas, lado a lado. | Não desce à ficha: mostra produto de cardápio vendido e produção consumida na mesma lista. |

> A aba **Geral** existe na API (`aba=geral`) e traz a coluna de **Faturamento**, mas não está exposta nos botões de aba da tela atual (a lista de abas visíveis é Insumos e Produções). Ao usá-la, cada linha ganha um selo **Finalização** (azul, produto vendido) ou **Produção** (âmbar, preparo consumido).

## Colunas e cálculos

Ideia central de todos os cálculos: a **saída teórica** = quantidade consumida na venda (`qtd_consumo`) multiplicada pela **quantidade da ficha** por produto (`qtd_por_produto`), somada no período. O `qtd_por_produto` da ficha já considera o **fator de correção** (quantidade ÷ fator de correção).

### Aba Insumos — tabela principal

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Cód.** | Código interno do insumo. | `insumo_codigo` da ficha. | `silver.consumo_teorico_insumo_dia` |
| **Insumo** | Nome do insumo (ou "sem cadastro"). | Nome do cadastro de insumos; se faltar, cai no nome do produto VMarket (por `codigo_planilha`/`cod_interno`). | `operations.insumos`, `bronze_vmarket_produtos` |
| **Categoria** | Categoria do insumo (chips de filtro). | Categoria do cadastro; se faltar, usa a seção do VMarket; senão "Outros". | `operations.insumos`, `bronze_vmarket_produtos` |
| **Saída** | Quantidade total que saiu no período, com unidade. | `soma(qtd_consumo × qtd_por_produto)` de todas as vendas, arredondada a 2 casas. Exibida com unidade; g→kg e ml→L quando ≥ 1000. | `silver.consumo_teorico_insumo_dia` |
| **(Unidade)** | Unidade de medida da saída. | Deriva igual à ficha: override do catálogo silver > derivação pelo **nome** do insumo (ml/g/un por padrões como "ml", "kg", "vinho", "whisky", "c/ 12") > `unidade_medida` do cadastro. | `silver.insumo_catalogo`, `operations.insumos` |
| **Dias** | Em quantos dias distintos do período houve saída daquele insumo. | `count(distinct data)`. | `silver.consumo_teorico_insumo_dia` |

Ordenação: por saída total (maior consumo primeiro).

**Drill de Insumos (período de 1 dia) — "Puxado por cada produto vendido":**

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Produto** | Produto de cardápio vendido que usa o insumo (nome + código). | `cod_interno` da venda + nome do cardápio. | `silver.vendas_consolidada_dia`, `produto_cardapio` |
| **Qtd vendida** | Quanto do produto foi consumido. | `soma(qtd_consumo)`. | `silver.vendas_consolidada_dia` |
| **Saída** | Saída do insumo puxada por esse produto. | `soma(qtd_consumo × qtd_por_produto)`, só linhas com resultado > 0. | `silver.insumo_por_produto` |

**Drill de Insumos (Semana / Mês) — "Saída por dia do período":** mesma quebra, mas agrupada por **dia**; cada dia mostra o total e, abaixo, os produtos daquele dia (`qtd vendida` + saída). Vem de `fn_consumo_insumo_por_dia`.

### Aba Produções — tabela principal

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Cód.** | Código da produção/preparo. | `producao_cod`. | `silver.consumo_producao_dia` |
| **Produção** | Nome do preparo. | Nome do cadastro de produção. | `public.producao_base` |
| **Categoria** | "Drink" ou "Comida". | Pelo **prefixo do código**: começa com `pd` → **Drink** (bar); senão → **Comida** (cozinha). Classificação feita na API, não no banco. | Regra da API |
| **Saída** | Quantidade da produção consumida no período. | `soma(qtd_consumo × qtd_por_produto)`, arredondada. Exibida com a unidade da produção (kg/L quando grande). | `silver.consumo_producao_dia` |
| **(Unidade)** | Unidade da produção. | `unidade` do cadastro de produção. | `public.producao_base` |
| **Dias** | Dias distintos com consumo dessa produção. | `count(distinct data)`. | `silver.consumo_producao_dia` |

**Drill de Produções — "Puxado por cada produto vendido":**

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Produto** | Produto de cardápio vendido que usa a produção. | `produto_cod` + nome do cardápio. | `silver.producao_por_produto`, `produto_cardapio` |
| **Qtd vendida** | Quanto do produto foi consumido. | `soma(qtd_consumo)`. | `silver.vendas_consolidada_dia` |
| **Por produto** | Quanto da produção cada unidade do produto usa. | `max(qtd_por_produto)` da ficha. | `silver.producao_por_produto` |
| **Saída** | Saída da produção puxada por esse produto. | `soma(qtd_consumo × qtd_por_produto)`. | `silver.producao_por_produto` |

### Aba Geral — tabela principal

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Tipo** | Selo **Finalização** (produto vendido) ou **Produção** (preparo consumido). | Campo `tipo` (`finalizacao` \| `producao`) do `UNION`. | `fn_saidas_geral_periodo` |
| **Cód.** | Código do produto ou da produção. | `pc.codigo` (finalização) ou `producao_cod`. | `produto_cardapio`, `consumo_producao_dia` |
| **Item** | Nome do produto/produção. | Nome do cardápio ou da produção. | `produto_cardapio`, `producao_base` |
| **Categoria** | Categoria do produto (finalização) ou seção da produção. | `pc.categoria` ou `pb.secao` (senão "Produção"). | `produto_cardapio`, `producao_base` |
| **Saída** | Quantidade vendida (finalização) ou consumida (produção). | `soma(qtd_consumo)` na finalização; `soma(qtd_consumo × qtd_por_produto)` na produção. | `fn_saidas_geral_periodo` |
| **Faturamento** | Valor faturado — só para finalizações. | `soma(valor)` das vendas; nas linhas de produção fica em branco. | `silver.vendas_consolidada_dia` |
| **Dias** | Dias distintos com movimento. | `count(distinct data)`. | `fn_saidas_geral_periodo` |

> Nas finalizações a unidade é sempre `un` (unidades vendidas). O faturamento aparece só no tipo Finalização; produções não têm valor de venda associado.

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| **Bar** (seletor global do topo) | Todas as consultas filtram por `bar_id`. Sem bar selecionado, a tela não carrega. |
| **Aba** (Insumos / Produções) | Troca o nível de explosão da ficha e a chamada de dados. Ao trocar, fecha qualquer drill aberto e limpa a categoria. |
| **Granularidade** (Dia / Semana / Mês) | Define o tamanho do intervalo. Semana = segunda a domingo da data de referência; Mês = do 1º ao último dia. |
| **Data de referência** | Escolhe o dia, a semana ou o mês analisado. Padrão: ontem. |
| **Buscar** | Filtra as linhas por nome ou código (client-side, sobre o resultado já carregado). |
| **Chips de categoria** | Filtram por categoria; só aparecem quando há mais de uma. |
| **CSV** | Exporta exatamente as linhas visíveis (respeita busca e categoria). Fica desabilitado quando não há linhas. |

## Regras e detalhes importantes

- **Consumo teórico, não real.** Todos os números vêm da venda explodida na ficha. Não refletem perdas, quebras, cortesias não registradas nem erro de porção. Para o consumo real, veja Desvios/Contagem.
- **Filtragem por `bar_id`** em todas as consultas — nunca mistura bares.
- **Padrão = ontem.** O dia de hoje é evitado por padrão porque o fechamento do ContaHub ainda não terminou.
- **Fonte da venda:** ContaHub por padrão. Em dias/eventos marcados como Yuzer, a venda vem do Yuzer (quantidade líquida de devoluções) e o ContaHub entra só com cortesias. A consolidação está na matview `vendas_consolidada_dia`.
- **Ficha técnica (`qtd_por_produto`)** já aplica o **fator de correção** (`quantidade ÷ fator_correcao`). Só entram itens da ficha do tipo `insumo` com código preenchido.
- **Linhas só com saída > 0.** As quebras por produto exigem saída positiva; produto sem ficha vinculada simplesmente não aparece.
- **Unidade e arredondamento:** quantidades arredondadas a 2 casas. Na exibição, `g` vira `kg` e `ml` vira `L` quando o valor absoluto é ≥ 1000 (ex.: 5.542 g → 5,54 kg).
- **Nome "sem cadastro":** quando o insumo não tem cadastro nem correspondência no VMarket, a linha mostra o código e o rótulo "sem cadastro".
- **Categoria de produção é heurística:** derivada do prefixo do código (`pd` = Drink/bar, resto = Comida) — não é um campo de seção do cadastro.
- **Estado vazio:** "Sem saídas no período (ou fichas/de-para pendentes)." costuma indicar que faltam fichas técnicas ou o de-para produto→código, não necessariamente que não houve venda.
- **Dados materializados:** `consumo_teorico_insumo_dia`, `consumo_producao_dia` e `vendas_consolidada_dia` são **matviews**. Se estiverem desatualizadas (refresh pendente), o período recente pode vir incompleto.

## Dúvidas frequentes

**Esses números são o que realmente saiu do estoque?**
Não. É o que *deveria* ter saído com base na venda e na ficha técnica (consumo teórico). O real vem da contagem, e a diferença aparece na tela de Desvios.

**Por que o dia de hoje vem vazio ou baixo?**
Porque o padrão é ontem e o fechamento do ContaHub do dia corrente ainda não terminou. Escolha um dia já fechado para números completos.

**Um insumo apareceu como "sem cadastro". E agora?**
A venda puxou um insumo cujo código não está no cadastro nem no VMarket. Cadastre/vincule o insumo para o nome e a categoria aparecerem corretamente.

**Qual a diferença entre a aba Insumos e a aba Produções?**
Insumos desce até a matéria-prima final (ex.: gramas de farinha). Produções para no preparo intermediário (ex.: litros de molho). A mesma venda alimenta as duas visões.

**Vendi bastante e o insumo não aparece. Por quê?**
Provavelmente falta ficha técnica do produto, o item da ficha não está marcado como `insumo`, ou o de-para produto→código está pendente. Sem ficha, a explosão não acontece.

**O CSV exporta tudo do período?**
Exporta o que está visível — respeitando a busca e o filtro de categoria ativos. Limpe os filtros antes de exportar se quiser o período inteiro.

## Fonte dos dados

Schema `silver` (camada de transformação), servido pelas funções chamadas na rota `/api/operacional/consumo-insumo`:

- **Funções (RPC):** `fn_consumo_insumo_periodo`, `fn_consumo_insumo_por_produto`, `fn_consumo_insumo_por_dia`, `fn_consumo_producao_periodo`, `fn_consumo_producao_por_produto`, `fn_saidas_geral_periodo`.
- **Matviews:** `silver.consumo_teorico_insumo_dia`, `silver.consumo_producao_dia`, `silver.vendas_consolidada_dia`.
- **Views de ficha:** `silver.insumo_por_produto`, `silver.producao_por_produto`, `silver.insumo_catalogo`.
- **Tabelas de apoio:** `operations.insumos`, `public.produto_cardapio`, `public.producao_base`, `public.producao_ficha_item`, `public.bronze_vmarket_produtos`.

**Integrações de origem:** vendas do **ContaHub** (padrão) e do **Yuzer** (em eventos marcados como Yuzer); catálogo de insumos com apoio do **VMarket** para nome/seção. As fichas técnicas e o cadastro de produção/insumos são internos ao Zykor.
