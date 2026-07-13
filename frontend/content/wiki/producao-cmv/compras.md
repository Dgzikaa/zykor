---
title: Compras
area: producao-cmv
slug: compras
route: /operacional/compras
description: Consulta e análise dos pedidos e cotações de compra do bar vindos do VMarket, com resumo de gastos, insights de preço e comparativo de fornecedores.
order: 70
icon: ShoppingCart
---

# Compras

## Visão geral

A tela **Compras** reúne, em um só lugar, tudo o que o bar comprou pela plataforma **VMarket** (SisFood): os **pedidos** de compra, as **cotações** e um painel de **análises** com insights de gasto e preço.

Ela serve para o gestor de compras, o dono e o time de CMV/Produção acompanharem:

- Quanto foi gasto no período e com quais fornecedores;
- O detalhe de cada pedido (itens, quantidades, preços e nota fiscal);
- Quais produtos subiram de preço e onde há oportunidade de economizar comprando o mesmo insumo de outro fornecedor.

Os dados **não são digitados na tela** — eles vêm da integração com o VMarket. A tela é de **consulta e análise**. A única coisa que dá para editar aqui é a **data de entrega** de um pedido (usada pelo cálculo de Desvios de Consumo).

## Como acessar

No menu lateral: **Produção - CMV → Compras** (`/operacional/compras`).

A permissão exigida para ver o item no menu é o módulo **gestão** (`gestao`). A ação de gravar (ajustar data de entrega e "Atualizar agora") passa pela autenticação padrão da API; não há bloqueio adicional por módulo específico na rota de escrita de compras.

A tela sempre trabalha no contexto do **bar selecionado** no topo do sistema. Trocar o bar recarrega os dados daquele bar.

## Passo a passo

### Consultar os pedidos de um período

1. Selecione o **bar** no seletor do topo do sistema.
2. No canto superior direito, ajuste as duas datas: **de** (início) e **até** (fim). O padrão é do **1º dia do mês atual** até **hoje**.
3. A aba **Pedidos** já abre carregada. Cada linha é um pedido do VMarket.
4. Clique em qualquer linha para **expandir** e ver os itens daquele pedido (insumo, produto, seção, quantidade, preço e total).
5. Se o pedido tiver nota fiscal, aparece um ícone de link à direita — clique para abrir a **NF-e** em nova aba.

### Buscar por fornecedor, nº do pedido ou produto

1. Use o campo **"Buscar por fornecedor, CNPJ ou nº do pedido"** para filtrar a lista já carregada (filtro local, instantâneo).
2. Use o campo **"Buscar por produto"** (ex.: `abacaxi`, `Spaten`) para achar pedidos que contenham aquele item. Essa busca consulta o servidor (com um pequeno atraso enquanto você digita) e considera tanto o nome que o VMarket manda quanto o de-para pelo código do insumo cadastrado.
3. Os "chips" de **Top fornecedores** e de **Status** logo acima da tabela também funcionam como filtro: clique para filtrar só aquele fornecedor/status; clique de novo para limpar.

### Ajustar a data de entrega de um pedido

1. Na coluna **Entrega**, passe o mouse sobre a data (aparece um lápis) e clique.
2. Escolha a nova data no seletor e confirme no **✓** (ou cancele no **✕**).
3. A data ajustada fica em **destaque (azul)** com o selo **"manual"**, e o valor original do VMarket continua acessível ao passar o mouse.
4. Para desfazer e voltar à data original do VMarket, entre em edição e clique no botão **"VMarket"**.

> Por que isso importa: o **Desvio de Consumo** conta a compra pela data de entrega. Ajustar aqui faz a compra "cair" na data certa automaticamente.

### Atualizar as compras agora (sem esperar o robô)

1. Clique no botão **"Atualizar"** (ícone de setas) no canto superior direito.
2. O sistema puxa os **pedidos mais recentes** do VMarket na hora — pode levar até ~2 minutos.
3. Ao terminar, a tela recarrega com os pedidos novos já visíveis.

> Normalmente o sistema já busca os pedidos sozinho algumas vezes por dia. O botão só serve quando você quer ver algo que acabou de ser lançado no VMarket.

### Ver as análises do período

1. Clique na aba **Análises**. Ela carrega sob demanda (respeita o período escolhido).
2. Analise os cards de topo, o ranking de fornecedores e de produtos, os produtos que subiram de preço e o comparativo entre fornecedores.
3. Nas seções **"Subiu de preço"** e **"Mesmo insumo, fornecedores diferentes"** há o botão **"Só Curva A"** para focar apenas nos insumos que realmente pesam no custo.

## Abas e seções

A tela tem três abas.

### Pedidos
Lista cada pedido do VMarket no período, com resumo por fornecedor e por status em chips. Cada pedido pode ser expandido para ver os itens. É a aba padrão ao abrir a tela.

### Cotações
Lista as cotações do VMarket no período (nome, fornecedor, se está aberta ou fechada e quanto foi economizado com aquela cotação).

### Análises
Painel de insights do período: cabeçalho com totais, Top 10 fornecedores, Top produtos, produtos que subiram de preço e comparativo do mesmo insumo entre fornecedores diferentes.

## Colunas e cálculos

### Cards de resumo (topo, sempre visíveis)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total comprado | Soma do valor de todos os pedidos do período | Soma de `valor_total` dos pedidos filtrados | `gold.vmarket_pedido` |
| Pedidos | Quantidade de pedidos no período | Contagem de pedidos | `gold.vmarket_pedido` |
| Ticket médio | Valor médio por pedido | Total comprado ÷ nº de pedidos | `gold.vmarket_pedido` |
| Economia (cotações) | Quanto foi economizado nas cotações | Soma de `valor_economizado` das cotações do período | `gold.vmarket_cotacao` |

### Aba Pedidos — tabela

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| (seta) | Expande o pedido para ver os itens | Interação; carrega itens sob demanda | `gold.vmarket_pedido_item` |
| Pedido | Data do pedido | `dt_inclusao` convertida para data | `gold.vmarket_pedido` |
| Entrega | Data de entrega (editável) | `dt_entrega` = data manual (se ajustada na mão) senão a do VMarket. Sem entrega, mostra a **previsão** (`dt_prazo_entrega`) com o rótulo "prev." | `gold.vmarket_pedido` + `operations.pedido_entrega_manual` |
| Fornecedor | Nome do fornecedor | `nome_fantasia`; se vazio, usa `razao_social` | `gold.vmarket_pedido` |
| Status | Situação do pedido no VMarket | `nm_status` (texto). Cor: verde = Entrega Confirmada (id 6), vermelho = cancelado (id 9), âmbar = em andamento (id 1/2) | `gold.vmarket_pedido` (`id_pedido_status`) |
| Origem | Como o pedido nasceu | Rótulo por `origem`: Cotação, Homologada (`cotacao_homologada`) ou Manual (`pedido_manual`) | `gold.vmarket_pedido` |
| Itens | Quantidade de itens do pedido | Contagem de itens (`qtd_itens`) | `gold.vmarket_pedido` |
| Valor | Valor total do pedido | Soma de `total` dos itens (`valor_total`) | `gold.vmarket_pedido` |
| (link NF-e) | Abre a nota fiscal | Link `url_nfe`, quando existe | `gold.vmarket_pedido` |

### Aba Pedidos — itens do pedido (linha expandida)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Insumo | Código interno do insumo | `cod_interno` (fica em âmbar "—" quando o item não tem código) | `gold.vmarket_pedido_item` |
| Produto | Nome do produto/marca | `nome_cotacao`; se vazio, resolve pelo código no cadastro de insumos; complementa com `marca_cotacao` | `gold.vmarket_pedido_item` + `operations.insumos` |
| Seção | Seção/categoria do item no VMarket | `nome_secao` | `gold.vmarket_pedido_item` (via `bronze_vmarket_produtos`) |
| Qtd | Quantidade comprada | `quantidade` (mais `gramatura_cotacao` quando informada) | `gold.vmarket_pedido_item` |
| Preço | Preço unitário | `preco` | `gold.vmarket_pedido_item` |
| Total | Total do item | `total` | `gold.vmarket_pedido_item` |

### Aba Cotações — tabela

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Data | Data da cotação | `dt_inclusao` convertida para data | `gold.vmarket_cotacao` |
| Cotação | Nome da cotação | `nome`; se vazio, mostra `#` + id da cotação | `gold.vmarket_cotacao` |
| Fornecedor | Fornecedor da cotação | `nome_fantasia`; se vazio, `razao_social` | `gold.vmarket_cotacao` |
| Status | Aberta ou fechada | `cotacao_fechada` (verde = Fechada, âmbar = Aberta) | `gold.vmarket_cotacao` |
| Economia | Valor economizado na cotação | `valor_economizado` | `gold.vmarket_cotacao` |

### Aba Análises — cabeçalho (headline)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total comprado | Gasto total do período | Soma de `valor_total` dos pedidos | `fn_compras_analises` sobre `gold.vmarket_pedido` |
| Pedidos | Nº de pedidos | Contagem de pedidos | `fn_compras_analises` |
| Fornecedores | Nº de fornecedores distintos | Contagem distinta de `fornecedor` | `fn_compras_analises` |
| Ticket médio | Valor médio por pedido | Total ÷ nº de pedidos | `fn_compras_analises` |
| Economia cotação | Economia das cotações | Soma de `valor_economizado` | `gold.vmarket_cotacao` |

### Aba Análises — Top 10 fornecedores

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Fornecedor | Nome do fornecedor | Agrupado por fornecedor, ordenado pelo valor comprado (top 10) | `fn_compras_analises` |
| Nº de pedidos | Quantos pedidos com aquele fornecedor | Contagem distinta de `id_pedido` | `fn_compras_analises` |
| Ticket | Valor médio por pedido do fornecedor | Valor comprado ÷ nº de pedidos | `fn_compras_analises` |
| Valor | Total comprado do fornecedor | Soma de `valor_total` | `fn_compras_analises` |

### Aba Análises — Top produtos

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Produto | Nome do produto | Agrupado por nome (nome da cotação ou do cadastro), top 50 por valor | `fn_compras_analises` |
| Badges (FT / A / fora curva A / sem cadastro) | Situação do insumo | **FT** = está em ficha técnica; **A** = Curva A; **fora curva A** = cadastrado mas fora da Curva A; **sem cadastro** = não é insumo Zykor | `operations.insumos` + `producao_ficha_item` |
| Qtd | Unidades compradas | Soma de `quantidade` | `fn_compras_analises` |
| Nº de compras | Quantas vezes foi comprado | Contagem de linhas de item | `fn_compras_analises` |
| Preço médio | Preço médio pago | Média de `preco` | `fn_compras_analises` |
| Valor | Total gasto no produto | Soma de `total` | `fn_compras_analises` |

### Aba Análises — Produtos que subiram de preço

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Produto | Nome do produto + período (1ª → última compra) | Agrupado por produto do VMarket (SKU), com pelo menos 2 datas de compra distintas no período | `fn_compras_analises` |
| Preço inicial | Preço da 1ª compra do período | Primeiro `preco` na ordem de data | `fn_compras_analises` |
| Preço atual | Preço da última compra do período | Último `preco` na ordem de data | `fn_compras_analises` |
| Variação | Quanto subiu | (preço final − preço inicial) ÷ preço inicial × 100 | `fn_compras_analises` |

Filtros anti-ruído: só considera preços > 0, preço inicial ≥ R$ 0,50 e preço final ≤ 5× o inicial (**exclui troca de unidade** e picos irreais). Ordenado da maior alta para a menor.

### Aba Análises — Mesmo insumo, fornecedores diferentes

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Insumo | Nome do insumo + código | Agrupado por `cod_interno` (só códigos que começam com "i"), casado com o cadastro de insumos | `fn_compras_analises` + `operations.insumos` |
| Mais barato | Fornecedor com menor preço | Fornecedor do menor `preco` | `fn_compras_analises` |
| Menor | Menor preço encontrado | `min(preco)` | `fn_compras_analises` |
| Mais caro | Fornecedor com maior preço | Fornecedor do maior `preco` | `fn_compras_analises` |
| Maior | Maior preço encontrado | `max(preco)` | `fn_compras_analises` |
| Diferença | Distância entre menor e maior | (maior − menor) ÷ menor × 100 | `fn_compras_analises` |

Só entram insumos comprados de **2 ou mais fornecedores** no período, com o maior preço até 5× o menor (corta outlier). Ordenado da maior diferença para a menor.

## Filtros e opções

| Filtro / opção | Onde | Efeito |
|---|---|---|
| Bar | Seletor global do topo | Todos os dados são do bar selecionado (`bar_id`). Trocar o bar recarrega tudo. |
| Período (de / até) | Canto superior direito | Define a janela por **data do pedido** (`dt_inclusao`). Vale para as três abas. |
| Atualizar | Botão no topo | Puxa os pedidos mais recentes do VMarket na hora e recarrega. |
| Buscar (fornecedor / CNPJ / nº) | Aba Pedidos | Filtra a lista já carregada, na hora (local). |
| Buscar por produto | Aba Pedidos | Filtra pedidos que contêm o produto; consulta o servidor (nome do VMarket + de-para por código). |
| Chips de fornecedor | Aba Pedidos | Mostra só os pedidos daquele fornecedor. |
| Chips de status | Aba Pedidos | Mostra só os pedidos naquele status (aparecem quando há mais de um status). |
| Só Curva A | Aba Análises (Subiu de preço / Comparativo) | Restringe a tabela aos insumos da Curva A. |

## Regras e detalhes importantes

- **Sempre por bar**: todas as consultas filtram por `bar_id`; a tela nunca mistura bares.
- **Fonte é o VMarket**: os pedidos e cotações são lidos das *gold views* do VMarket, não digitados. Se algo não apareceu, provavelmente ainda não foi sincronizado (use "Atualizar" ou aguarde o robô).
- **Nome do produto em branco**: o VMarket manda o nome vazio em boa parte dos itens (ex.: AMBEV). O sistema resolve isso pelo **código do insumo** (`cod_interno` → nome no cadastro). Por isso um item pode aparecer com nome mesmo sem `nome_cotacao`.
- **Data de entrega manual**: o ajuste é gravado em `operations.pedido_entrega_manual` e entra na própria view por `coalesce(manual, VMarket)`. Limpar o ajuste apaga o registro e volta à data original. O valor original do VMarket nunca é perdido.
- **Período conta pela data do pedido** (`dt_inclusao`), não pela data de entrega. A data de entrega é usada por outra tela (Desvios de Consumo).
- **Paginação**: pedidos e cotações são lidos de forma paginada, então períodos grandes (mais de 1.000 pedidos) não ficam truncados.
- **Cortes das análises são propositais**: "Subiu de preço" e "Comparativo de fornecedores" descartam variações irreais (preço final acima de 5× o inicial, preço muito baixo, troca de unidade) para não gerar alarme falso.
- **Estados vazios**: sem pedidos/cotações no período, cada aba mostra a mensagem "Nenhum pedido/cotação no período"; na aba Análises, "Sem dados de compras no período".

## Dúvidas frequentes

**De onde vêm esses dados?**
Da integração com o **VMarket (SisFood)**, o portal de compras. A tela apenas lê e organiza; não é onde se lança a compra.

**Cliquei em "Atualizar" e não apareceu nada de novo. Por quê?**
Só aparece o que já foi lançado e confirmado no VMarket. Se o pedido ainda não está lá, não há o que puxar. A atualização pode levar até ~2 minutos.

**Por que alguns itens aparecem sem nome ou com "—" no código?**
O VMarket às vezes envia o item sem nome e/ou sem código. Quando há código, o sistema busca o nome no cadastro de insumos; sem código, não há como fazer o de-para.

**Ajustar a data de entrega muda o valor do pedido?**
Não. Muda apenas a data usada para contar a compra no **Desvio de Consumo**. Valor, itens e fornecedor continuam iguais.

**O que significam os selos FT, A, "fora curva A" e "sem cadastro"?**
**FT** = o insumo está em alguma ficha técnica; **A** = é Curva A (pesa no custo); **fora curva A** = está cadastrado, mas não é Curva A; **sem cadastro** = não é um insumo cadastrado no Zykor.

**A "Economia" das cotações é dinheiro que entrou no caixa?**
Não. É o quanto o VMarket calcula que a cotação economizou em relação às opções — é um indicador de eficiência de compra, não uma receita.

## Fonte dos dados

Integração de origem: **VMarket (SisFood)** — portal de compras/cotações.

- `gold.vmarket_pedido` — pedidos (a partir de `bronze_vmarket_pedidos` + `bronze_vmarket_pedido_itens`, com override de entrega de `operations.pedido_entrega_manual`).
- `gold.vmarket_pedido_item` — itens de cada pedido (`bronze_vmarket_pedido_itens` + `bronze_vmarket_produtos`).
- `gold.vmarket_cotacao` — cotações (`bronze_vmarket_cotacoes`).
- `gold.fn_compras_analises(bar, início, fim)` — função que monta o painel de Análises.
- `operations.insumos` — de-para de código → nome e sinalização de Curva A / cadastro.
- `producao_ficha_item` / `producao_base` / `produto_cardapio` — para o selo "está em ficha técnica" (FT).
- `operations.pedido_entrega_manual` — data de entrega ajustada na mão.
- `fn_vmarket_sync_pedidos_now(bar)` — sincronização sob demanda do botão "Atualizar" (cabeçalho dos últimos 10 dias + itens + reconciliação de códigos).
