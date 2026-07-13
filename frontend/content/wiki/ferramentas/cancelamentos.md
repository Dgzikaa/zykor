---
title: Cancelamentos
area: ferramentas
slug: cancelamentos
route: /ferramentas/cancelamentos
description: Mede a perda financeira com itens cancelados no ContaHub — valor cheio, custo perdido e percentual sobre o faturamento, por dia e por motivo.
order: 60
icon: AlertTriangle
---

# Cancelamentos

## Visão geral

A tela **Cancelamentos** mostra quanto o bar deixou de faturar (e quanto custou) com itens que foram lançados e depois **cancelados** no sistema de PDV (ContaHub). Para cada item cancelado, o sistema soma o **valor cheio** (o quanto aquele item valeria na conta do cliente) e o **custo** correspondente, organizando tudo por dia e por motivo do cancelamento.

Serve para responder perguntas do tipo: *"Estou perdendo muito com cancelamento?"*, *"Em que dia isso disparou?"*, *"Qual o motivo mais comum?"* e *"Quem cancelou aquele item caro?"*. É uma ferramenta de controle e higiene operacional — cancelamento em excesso pode indicar erro de lançamento do garçom, problema na cozinha/bar, ou até abuso.

No dia a dia é usada por **donos, gestores e supervisores de operação** que acompanham perdas e a disciplina da equipe no PDV.

## Como acessar

- Menu lateral: **Ferramentas → Cancelamentos** (ícone de triângulo de alerta).
- Rota direta: `/ferramentas/cancelamentos`.
- Permissão necessária: módulo **`gestao`** (mesma permissão das demais ferramentas analíticas). Sem esse módulo o item nem aparece no menu.

A tela sempre trabalha com o **bar selecionado** no seletor de bar (canto superior). Toda a busca de dados é filtrada pelo `bar_id` do bar ativo — não é possível ver dados de outro bar sem trocar a seleção.

## Passo a passo

### 1. Escolher o período
No topo à direita há quatro botões de período: **Semana (7 dias)**, **Mês (30 dias)**, **Semestre (180 dias)** e **Ano (365 dias)**. Clique no período desejado; a tela recarrega os cartões de resumo e a tabela "Por dia" para o intervalo escolhido. O padrão ao abrir a tela é **Mês (30 dias)**.

### 2. Ler os indicadores de resumo
Logo abaixo aparecem quatro cartões: **Perda**, **% sobre faturamento**, **Custo perdido** e **Itens cancelados**. Eles totalizam o período selecionado (ver a seção "Colunas e cálculos").

### 3. Analisar dia a dia
A tabela **"Por dia"** (à esquerda) lista cada dia com cancelamento, do mais recente para o mais antigo, mostrando quantidade de itens, valor perdido e o percentual sobre o faturamento daquele dia. Dias com **% de faturamento igual ou acima de 5%** ficam destacados em vermelho — sinal de atenção.

### 4. Detalhar um dia específico
**Clique em qualquer linha da tabela "Por dia"** (a data fica sublinhada ao passar o mouse). Abre um modal com a lista item a item de tudo que foi cancelado naquele dia: produto, quantidade, valor unitário, valor total, **quem cancelou** (garçom), **motivo** e **mesa**. A lista vem ordenada do item mais caro para o mais barato. Para fechar, clique no **X** ou fora do modal.

### 5. Ver os principais motivos
À direita fica o cartão **"Top motivos (30d)"**, com um ranking dos motivos de cancelamento dos **últimos 30 dias**, cada um com uma barra proporcional ao valor perdido.

> A tela é somente de **consulta/análise**. Não há cadastro, edição, aprovação ou exportação — os dados vêm automaticamente da ingestão do ContaHub.

## Abas e seções

A tela não tem abas. É uma única página composta por:

- **Barra de período** (Semana / Mês / Semestre / Ano).
- **4 cartões de resumo** (Perda, % sobre faturamento, Custo perdido, Itens cancelados).
- **Tabela "Por dia"** (clicável, abre o detalhe do dia).
- **Cartão "Top motivos (30d)"**.
- **Modal de detalhe** do dia (aberto ao clicar em um dia).

## Colunas e cálculos

### Cartões de resumo (totais do período)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Perda ({período}) | Valor total perdido com cancelamentos no período | Soma de `valor_cancelado` de todos os dias do período | `gold.cancelamentos_diario` |
| % sobre faturamento | Peso da perda sobre o que foi faturado | `(soma valor_cancelado ÷ soma faturamento_liquido) × 100` do período; 0% se não há faturamento | `gold.cancelamentos_diario` |
| Custo perdido | Custo dos insumos dos itens cancelados | Soma de `custo_perdido` de todos os dias do período | `gold.cancelamentos_diario` |
| Itens cancelados | Quantidade total de itens cancelados | Soma de `qtd_itens` de todos os dias do período | `gold.cancelamentos_diario` |

### Tabela "Por dia"

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data gerencial do cancelamento | `dt_gerencial` (data operacional do PDV) | `gold.cancelamentos_diario` |
| Itens | Nº de itens cancelados no dia | `count(*)` dos itens cancelados agrupados por dia | `gold.cancelamentos_diario` → `bronze_contahub_avendas_cancelamentos` |
| Perda | Valor cheio perdido no dia | `sum(itm_vrcheio)` dos itens cancelados, arredondado a 2 casas | `gold.cancelamentos_diario` |
| % Fat. | Perda do dia sobre o faturamento líquido do dia | `valor_cancelado ÷ faturamento_liquido_r × 100`; vazio ("—") se o dia não tem faturamento; **vermelho quando ≥ 5%** | `gold.cancelamentos_diario` + `silver.vendas_diarias` |

### Cartão "Top motivos (30d)"

Ranking calculado **na hora**, na própria API, a partir dos itens cancelados dos últimos 30 dias (limite de 20.000 linhas lidas). Mostra os **8 maiores motivos** por valor.

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Motivo | Texto do motivo do cancelamento/desconto | Campo `motivocancdesconto`; quando vazio, agrupado como **"Sem motivo"** | `bronze_contahub_avendas_cancelamentos` |
| Valor | Valor perdido acumulado por motivo | Soma de `itm_vrcheio` dos itens com aquele motivo | `bronze_contahub_avendas_cancelamentos` |
| Barra | Peso visual do motivo | Largura proporcional ao maior motivo do período | (cálculo de tela) |

> O campo `qtd` (quantidade por motivo) é calculado na API, mas o cartão exibe apenas o valor.

### Modal de detalhe do dia (item a item)

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Item | Nome do produto (e o grupo abaixo) | `prd_desc` (produto) e `grp_desc` (grupo/categoria) | `bronze_contahub_avendas_cancelamentos` |
| Qtd | Quantidade cancelada | `itm_qtd` | `bronze_contahub_avendas_cancelamentos` |
| Vlr unit. | Valor unitário do item | `itm_vrunitario` | `bronze_contahub_avendas_cancelamentos` |
| Total | Valor cheio total do item (destacado em vermelho) | `itm_vrcheio` | `bronze_contahub_avendas_cancelamentos` |
| Garçom | Quem efetuou o cancelamento | `cancelou` | `bronze_contahub_avendas_cancelamentos` |
| Motivo | Motivo informado no cancelamento | `motivocancdesconto` | `bronze_contahub_avendas_cancelamentos` |
| Mesa | Mesa/comanda de origem | `vd_mesadesc` | `bronze_contahub_avendas_cancelamentos` |

Os itens do modal vêm ordenados por **valor total (`itm_vrcheio`) decrescente**, com limite de 2.000 linhas por dia.

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| **Seletor de bar** (topo do sistema) | Define o `bar_id` de toda a tela. Cada bar vê só os próprios cancelamentos. |
| **Período** (Semana / Mês / Semestre / Ano) | Define o intervalo dos cartões de resumo e da tabela "Por dia". Válido de 7 a 365 dias. |
| **Clique num dia** | Abre o modal com o detalhe item a item **daquele dia**. |
| **Top motivos** | Fixo em **30 dias**, independente do período selecionado acima. |

Não há filtro por produto, garçom, motivo ou categoria — o recorte é por bar, período e (no detalhe) por dia.

## Regras e detalhes importantes

- **Sempre filtrado por bar.** Tanto a série diária quanto os motivos e o detalhe são consultados com `bar_id` do usuário autenticado. Nunca há mistura entre bares.
- **Data usada = `dt_gerencial`** (data gerencial/operacional do ContaHub, que trata a virada do dia por horário). Não é a data-calendário do cancelamento, e sim o dia de operação a que o cancelamento pertence. Linhas sem `dt_gerencial` são ignoradas na série diária.
- **"Perda" = valor cheio, não desconto.** O valor perdido é o `itm_vrcheio` — quanto aquele item valeria cheio na conta. É a receita que deixou de existir por causa do cancelamento.
- **"Custo perdido" ≠ perda.** É o custo do insumo (`custototal`), calculado na ingestão do ContaHub como `itm_vrcheio × itm_qtd` de cada item (com fallbacks quando o custo não vem preenchido). Serve para estimar o prejuízo real (o que efetivamente foi consumido/desperdiçado), não a receita perdida.
- **% sobre faturamento** cruza a perda com o **faturamento líquido do dia** (`silver.vendas_diarias.faturamento_liquido_r`). Se o dia não tem faturamento registrado, o percentual fica vazio ("—") em vez de mostrar número enganoso.
- **Destaque de risco:** dias com percentual **≥ 5%** aparecem em vermelho na tabela, como alerta visual.
- **Arredondamentos:** valor cancelado, custo e faturamento são arredondados a 2 casas na origem (view gold); os cartões de resumo exibem valores sem centavos (arredondados na tela), enquanto o modal de detalhe mostra os centavos.
- **Automático, não manual.** Nenhum dado é digitado aqui: tudo é ingerido do ContaHub (query de cancelamentos/avendas) e processado pelo pipeline. Se o ETL do ContaHub não rodou, o dia pode não aparecer.
- **Estado vazio:** se não houver cancelamentos no período, a tela mostra *"Sem cancelamentos no período."*; sem motivos, o cartão mostra *"Sem motivos registrados."*; e um dia sem itens no modal mostra *"Nenhum item cancelado neste dia."*
- **Limites de leitura:** os motivos leem até 20.000 linhas dos últimos 30 dias e o detalhe do dia até 2.000 itens — suficiente para o volume normal, mas em dias atípicos muito grandes pode haver corte.

## Dúvidas frequentes

**A "Perda" é o valor do desconto ou o valor do item?**
É o **valor cheio do item** (`itm_vrcheio`) — o quanto ele valeria na conta. Representa a receita que sumiu com o cancelamento.

**Qual a diferença entre "Perda" e "Custo perdido"?**
Perda é a **receita** que deixaria de entrar. Custo perdido é o **custo do insumo** daqueles itens (quanto o bar gastou para produzir o que foi cancelado). Custo perdido é sempre menor ou igual à perda.

**Por que o % de faturamento aparece "—" em alguns dias?**
Porque naquele dia não há faturamento líquido registrado em `silver.vendas_diarias` para cruzar. Sem base de faturamento, o sistema não calcula o percentual para não induzir a erro.

**O "Top motivos" segue o período que eu escolhi?**
Não. O ranking de motivos é **sempre dos últimos 30 dias**, mesmo que você esteja olhando a semana ou o ano nos cartões.

**Consigo ver quem cancelou?**
Sim. **Clique no dia** e o modal traz a coluna **Garçom** (campo `cancelou`) para cada item, além do motivo e da mesa.

**Um dia sumiu / não apareceu. É bug?**
Provavelmente o ETL do ContaHub ainda não trouxe os cancelamentos daquele dia, ou não houve nenhum cancelamento. A tela reflete o que está na camada bronze do ContaHub.

## Fonte dos dados

- **`gold.cancelamentos_diario`** — view que agrega, por bar e por `dt_gerencial`: `qtd_itens` (contagem), `valor_cancelado` (`sum(itm_vrcheio)`), `custo_perdido` (`sum(custototal)`) e `pct_sobre_faturamento` (join com o faturamento do dia). Alimenta os cartões de resumo e a tabela "Por dia".
- **`bronze.bronze_contahub_avendas_cancelamentos`** — tabela bronze com os itens cancelados linha a linha (produto, grupo, quantidade, valor cheio, valor unitário, custo, quem cancelou, motivo, mesa, data gerencial). Alimenta o cartão de motivos e o modal de detalhe.
- **`silver.vendas_diarias`** — fornece o `faturamento_liquido_r` do dia, usado no cálculo do % sobre faturamento (join dentro da view gold).

**Origem/integração:** todos os dados vêm do **ContaHub** (PDV do bar). A ingestão é feita pela função `contahub-processor` (Edge Function), que lê a query de cancelamentos/avendas e grava na camada bronze; a partir daí as camadas silver e gold consolidam os números exibidos na tela.
