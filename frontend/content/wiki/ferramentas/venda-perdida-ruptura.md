---
title: Venda Perdida (ruptura)
area: ferramentas
slug: venda-perdida-ruptura
route: /operacional/venda-perdida-ruptura
description: Estima quanto dinheiro ficou na mesa quando um produto que a casa costuma ter faltou em alguns dias, cruzando ruptura de estoque com a velocidade real de venda.
order: 110
icon: PackageX
---

# Venda Perdida (ruptura)

## Visão geral

A tela **Venda Perdida (ruptura)** responde a uma pergunta simples: *"quanto a casa deixou de vender porque um produto acabou?"*

Ela olha para itens que **normalmente estão disponíveis** e que **faltaram em alguns dias** (a chamada ruptura **intermitente**), calcula a velocidade de venda desse item nos dias em que ele estava no estoque e, com isso, estima quanto teria sido vendido nos dias de falta. O resultado é sempre apresentado como uma **faixa** entre um cenário **conservador** e um **teto** — porque é uma estimativa honesta, não um fato registrado no caixa.

É uma ferramenta de gestão operacional, usada por donos, gerentes e responsáveis de compras/estoque para priorizar reposição: quais produtos custam mais caro quando faltam e merecem atenção no abastecimento.

**Importante:** os números aqui são uma *estimativa* de oportunidade perdida, calculada por modelo. Não é receita real nem lançamento financeiro.

## Como acessar

- **Menu lateral:** *Ferramentas → Venda Perdida (ruptura)*
- **Rota:** `/operacional/venda-perdida-ruptura`
- **Permissão necessária:** módulo **`gestao`**. Sem esse acesso o item não aparece no menu e a página não abre.

A tela sempre trabalha sobre o **bar selecionado** no seletor de bar. Se nenhum bar estiver selecionado, aparece a mensagem "Selecione um bar."

## Passo a passo

### Consultar a venda perdida do período

1. Selecione o **bar** desejado no seletor de bar (topo do sistema).
2. Abra *Ferramentas → Venda Perdida (ruptura)*.
3. No topo da tela, escolha o **período** clicando em `7d`, `30d` ou `90d`. O padrão é **30 dias**.
4. Leia os três **cards de resumo** (KPIs) no topo: a faixa de dinheiro deixado na mesa, quantos produtos foram afetados e quantas ocorrências houve.
5. Use os **gráficos** para ver a perda por categoria e a evolução por dia.
6. Desça até a tabela **"Itens que mais custaram"** para ver o ranking dos produtos, do que mais custou para o que menos custou.

### Interpretar o resultado

- Compare **Conservador** e **Teto**: a verdade provável está dentro dessa faixa. O conservador desconta o que ainda foi vendido no dia da falta; o teto assume que nada da demanda foi atendida.
- Priorize os itens do **topo da tabela** (ordenados pelo teto) para revisar a política de compra/reposição.

> A tela é apenas de leitura. Não há botão de exportar, editar, aprovar ou cadastrar — todo o cálculo é automático a partir dos dados de estoque e vendas.

## Abas e seções

A tela não tem abas. Ela é uma página única, organizada em quatro blocos, de cima para baixo:

1. **Barra de período** — seletor `7d / 30d / 90d` e uma nota explicando que só entra ruptura intermitente.
2. **Cards de resumo (KPIs)** — três indicadores-chave.
3. **Gráficos** — "Por categoria" (barras agrupadas) e "Por dia" (linha/área).
4. **Tabela "Itens que mais custaram"** — ranking por produto (até 20 itens).

Quando não há ruptura intermitente relevante no período, no lugar dos blocos aparece uma mensagem verde: *"Nenhuma ruptura intermitente relevante no período — ou o rastreio de estoque deste bar não gera o sinal."*

## Colunas e cálculos

Antes das colunas, o conceito central que alimenta tudo:

- **Velocidade disponível (`vel_dia`)**: média de unidades vendidas do produto **apenas nos dias em que ele estava disponível** (sem ruptura). É a baseline "limpa" de demanda.
- **Conservador** (por dia de falta) = `max(0, velocidade_disponível − unidades_realmente_vendidas_nesse_dia) × preço`. Ou seja, desconta o que ainda saiu no dia da ruptura.
- **Teto** (por dia de falta) = `velocidade_disponível × preço`. Assume que toda a demanda esperada foi perdida.

Os KPIs e tabelas somam esses valores ao longo dos dias e produtos.

### Cards de resumo (KPIs)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Deixado na mesa (faixa) | Faixa de dinheiro estimado como perdido, do cenário conservador ao teto | `Σ conservador` → `Σ teto` sobre todas as ocorrências (produto·dia) do período | `operations.fn_venda_perdida_ruptura` (KPIs) |
| Produtos afetados | Quantos produtos distintos sofreram ruptura intermitente relevante | `count(DISTINCT prd)` das ocorrências | mesma função |
| Ocorrências (produto·dia) | Quantas combinações de produto + dia de falta entraram no cálculo | `count(*)` das linhas de perda | mesma função |

### Gráfico "Por categoria"

Barras agrupadas: para cada categoria de mix, duas barras (Conservador em âmbar, Teto em vermelho).

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Categoria | Categoria de mix do produto (Comidas, Drinks, Bar, etc.) | `categoria_mix` da view de stockout; vazio vira "—" | `categoria_mix` |
| Conservador | Perda conservadora acumulada da categoria | `Σ conservador` agrupado por categoria | `fn_venda_perdida_ruptura` (por_categoria) |
| Teto | Perda no teto acumulada da categoria | `Σ teto` agrupado por categoria | mesma função |

### Gráfico "Por dia"

Linha/área com a evolução da perda estimada dia a dia (Conservador em âmbar, Teto em vermelho). O eixo X mostra a data no formato `dd/mm`.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data do dia com ruptura | `data_consulta` (dia da ocorrência), exibido como `dd/mm` | `fn_venda_perdida_ruptura` (por_dia) |
| Conservador | Perda conservadora daquele dia | `Σ conservador` agrupado por dia | mesma função |
| Teto | Perda no teto daquele dia | `Σ teto` agrupado por dia | mesma função |

### Tabela "Itens que mais custaram"

Ranking dos produtos, ordenado pelo **Teto** (maior para menor), limitado a 20 itens.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Item | Nome do produto | `prd_desc` do produto em ruptura | view de stockout filtrado |
| Dias em falta | Em quantos dias do período o produto ficou em ruptura | `count(*)` de dias de ruptura do produto (após o filtro de intermitência) | `fn_venda_perdida_ruptura` (por_produto) |
| Preço | Preço de venda usado no cálculo | `max(prd_precovenda)` do produto no período | `prd_precovenda` |
| Vende/dia | Velocidade disponível: média de unidades vendidas nos dias com estoque | `avg(unidades)` só nos dias **sem** ruptura | vendas × stockout |
| Conservador | Perda conservadora total do produto | `Σ max(0, vel_disponível − vendido_no_dia) × preço` | `fn_venda_perdida_ruptura` |
| Teto | Perda no teto total do produto | `Σ vel_disponível × preço` | mesma função |

## Filtros e opções

| Filtro | Onde fica | Efeito |
|---|---|---|
| **Bar** | Seletor de bar global (topo do sistema) | Todo o cálculo é filtrado por `bar_id`. Cada bar tem sua própria ruptura e velocidade. |
| **Período** | Botões `7d / 30d / 90d` no topo da tela | Define a janela de análise (dias para trás a partir de hoje). Padrão 30 dias. A API aceita de 7 a 180 dias, mas a tela só expõe 7/30/90. |

Não há filtro por categoria, produto ou toggle adicional — a categorização aparece apenas no gráfico "Por categoria".

## Regras e detalhes importantes

- **Só ruptura intermitente.** Entram apenas produtos que faltaram em **no máximo metade dos dias** do período (`dias_em_falta` entre 1 e `dias/2`). Isso exclui itens que faltam "todo dia" — que quase sempre são ruído de cadastro (produtos sem controle de estoque marcados como faltando, mas que continuam vendendo).
- **Baseline limpa.** A velocidade de venda (`vel_dia`) é medida **exclusivamente nos dias sem ruptura**, para não contaminar a média com os dias de falta.
- **Filtro por bar_id.** Nada é misturado entre bares; a função recebe `p_bar_id` e filtra tanto as vendas quanto o stockout.
- **Produtos elegíveis.** A base de ruptura já vem "higienizada" pela view `contahub_stockout_filtrado`: exclui Happy Hour, Baldes, Dose Dupla, Combos, Garrafas, Adicionais, Embalagens, Insumos, Uso Interno, Pegue e Pague e Venda Volante, entre outros, e considera só produtos ativos (`prd_ativo = 'S'`).
- **Só conta com preço e demanda.** Para uma ocorrência entrar no cálculo, o produto precisa ter **velocidade disponível > 0** e **preço > 0**.
- **Vendas contam apenas o que foi faturado.** As vendas usadas na velocidade consideram somente linhas com `valorfinal > 0`.
- **Faixa, não fato.** Conservador e Teto delimitam uma estimativa. O conservador desconta o que ainda foi vendido no dia da falta; o teto ignora esse abatimento.
- **Snapshot diário de estoque.** A ruptura é lida de um snapshot por dia (`data_consulta`) — a granularidade da falta é o **dia**, não a hora.
- **Arredondamentos.** KPIs e valores de gráfico são arredondados para inteiro (R$ sem centavos); na tabela, `Preço` fica com 2 casas e `Vende/dia` com 1 casa.
- **Estado vazio.** Se nenhum produto atende aos critérios (ou o bar não gera sinal de estoque), a tela mostra a mensagem verde de "sem ruptura relevante" — o que é um bom sinal operacional.
- **Tudo automático.** Não há campo manual nesta tela; nada é editado ou aprovado pelo usuário.

## Dúvidas frequentes

**Esse valor é dinheiro que eu realmente perdi?**
Não. É uma *estimativa* de oportunidade perdida. Por isso vem em faixa (conservador → teto). Use-o para priorizar reposição, não como número contábil.

**Por que um produto que vive faltando não aparece aqui?**
Porque a tela ignora ruptura constante (mais da metade dos dias). Item que "falta sempre" costuma ser cadastro sem controle de estoque, não ruptura real. Só entra o item que a casa normalmente tem e faltou em alguns dias.

**Qual a diferença entre Conservador e Teto?**
O **Teto** assume que toda a demanda esperada do dia foi perdida (velocidade × preço). O **Conservador** desconta o que ainda foi vendido naquele dia de falta. A realidade tende a ficar entre os dois.

**Como o sistema sabe a "velocidade" de venda?**
Ele calcula a média de unidades vendidas do produto **só nos dias em que ele estava disponível**, para ter uma baseline limpa de demanda.

**A tela some / mostra mensagem verde. Está com erro?**
Não necessariamente. Significa que não houve ruptura intermitente relevante no período — ou que o rastreio de estoque desse bar não gera o sinal. É o cenário desejado do ponto de vista operacional.

**Posso mudar o período para além de 90 dias?**
Na tela, não — só há 7/30/90. Internamente o cálculo aceita até 180 dias.

## Fonte dos dados

- **Função SQL:** `operations.fn_venda_perdida_ruptura(p_bar_id, p_dias)` — orquestra todo o cálculo e devolve KPIs, por produto, por categoria e por dia. Executada via `service_role`.
- **API:** `GET /api/operacional/venda-perdida-ruptura?bar_id=…&dias=…` (autenticação de usuário; chama a RPC no schema `operations`).
- **Ruptura (estoque):** `gold.gold_contahub_operacional_stockout_filtrado` — snapshot diário de produtos em ruptura, já filtrado (view `contahub_stockout_filtrado`). Origem: **ContaHub** (tabela `contahub_stockout`).
- **Vendas (velocidade real):** `gold.gold_contahub_avendas_porproduto_analitico` — vendas por produto e dia gerencial. Origem: **ContaHub**.
