---
title: Estoque
area: producao-cmv
slug: estoque
route: /operacional/estoque-historico
description: Histórico de contagens de estoque valorizado por área e por data, com o preço congelado do momento de cada contagem.
order: 120
icon: Boxes
---

# Estoque

## Visão geral

A tela **Estoque** é o relatório do histórico de contagens de estoque do bar. Cada vez que a equipe conta o estoque (diária, semanal ou mensal), aquele "retrato" fica gravado com **quantidade contada** e **preço vigente naquela data**. A tela mostra esse retrato valorizado: quanto de dinheiro está parado no estoque, quebrado por área (Comidas, Salão, Drinks, Alimentação) e por item.

Serve para o gestor/dono responder perguntas como:
- Quanto tenho em estoque hoje, em reais?
- Onde está concentrado o valor (cozinha? bar? drinks?)?
- O que mudou entre duas contagens — o estoque subiu ou caiu, e em quais itens?
- Além de insumos, cobre itens de **limpeza/descartáveis**, **utensílios** (modelo de quebra) e **produções** (pc/pd da ficha técnica).

É usada principalmente pela gestão de CMV/Produção e pela liderança operacional para acompanhar valor em estoque e variação entre contagens.

## Como acessar

No menu lateral: **Operacional → Estoque** (ícone de caixas).

- Rota: `/operacional/estoque-historico`
- Permissão necessária: módulo **Gestão** (`gestao`). Quem tem a permissão só de leitura vê um selo "Somente leitura" e não consegue cadastrar, editar nem sincronizar.

A tela é essencialmente de **leitura**. As ações de escrita (cadastrar item de limpeza/utensílio, fazer contagem, sincronizar planilha) exigem permissão de inserção/edição no módulo.

## Passo a passo

### Consultar o estoque de uma contagem
1. Escolha a **classe de item** nos botões do topo: Insumo, Limpeza, Utensílio ou Produção.
2. Escolha o **tipo de contagem**: Diária (Curva A), Semanal (Completa) ou Mensal (Inventário).
3. No seletor de **data**, escolha a contagem que quer ver (o sistema já abre na mais recente daquele tipo). Cada opção mostra a data e o número de itens contados. Ao **trocar de aba/classe** (ex.: Insumo → Produção), a **data escolhida é mantida** — só volta para a mais recente quando você troca o **tipo** (Diária/Semanal/Mensal), porque cada tipo tem datas diferentes. Se a data não existir naquela classe, cai na mais recente disponível.
4. A tabela lista os itens com quantidade contada, preço e valor. Os cards no topo mostram o total geral e o total por área.

### Buscar um item
1. Use o campo **"Buscar insumo…"** à direita.
2. Digite parte do nome ou do código. A tabela filtra na hora (busca por nome ou código).

### Comparar duas contagens
1. Clique em **Comparar**.
2. O sistema já sugere uma segunda data; troque no seletor **"com"** se quiser.
3. A tabela muda para o modo comparação, mostrando quantidade e valor de cada item nas duas datas, mais as diferenças (Δ Qtd e Δ Valor). A comparação é sempre entre contagens **do mesmo tipo e da mesma classe**.
4. Itens com maior variação de valor aparecem no topo. Para sair, clique de novo no botão (agora "Comparando").

### Sincronizar a planilha de contagem
1. Clique em **Sincronizar planilha**.
2. O sistema busca as contagens dos últimos 14 dias da planilha (aba INSUMOS) do bar atual e atualiza a base.
3. Ao terminar, aparece um aviso com quantas linhas foram atualizadas e quantas ficaram "sem cadastro" (itens da planilha que não têm cadastro correspondente).

### Fazer uma contagem pelo app
1. Clique em **Fazer contagem**.
2. Escolha tipo (diária/semanal/mensal), data e classe a contar.
3. Preencha as quantidades por item e salve. A contagem entra no histórico e a tela recarrega.

### Cadastrar/editar item de Limpeza ou Utensílio
> Só aparece para as classes **Limpeza** e **Utensílio**. Insumo vem do VMarket e Produção mora no módulo Produção-CMV, então não têm cadastro aqui.
1. Selecione a classe **Limpeza** ou **Utensílio**.
2. Clique em **Adicionar item** (ou no lápis ao lado do código, para editar).
3. Preencha nome, categoria/seção, preço por unidade base, estoques (ideal para limpeza; mín/máx para utensílio) e a unidade de contagem ("Conta em" + "Contém").
4. Salve. O código é gerado automaticamente (`L0XXX` para limpeza, `u0XXX` para utensílio).

## Abas e seções

A tela combina dois eixos de navegação no topo:

### Classe de item (Insumo · Limpeza · Utensílio · Produção)
- **Insumo** — itens do estoque de insumos, valorizados pelo preço do VMarket na data. Origem do cadastro: VMarket.
- **Limpeza** — descartáveis e material de limpeza. Tem estoque ideal e sugestão de pedido. Cadastro feito nesta tela.
- **Utensílio** — modelo de **quebra**: parte de um estoque anterior, soma compras e calcula o que "sumiu". O valor exibido é o valor da quebra. Cadastro feito nesta tela.
- **Produção** — produtos de ficha técnica (códigos `pc`/`pd`), custo vindo da ficha. Agrupados em Produção Cozinha × Produção Drinks pelo prefixo do código.

### Tipo de contagem (Diária · Semanal · Mensal)
- **Diária — Curva A**: só os itens marcados como Curva A. Esses são contados todo dia, inclusive dentro da contagem de segunda; por isso a aba Diária é definida pelo flag `curva_a` e não pelo tipo da contagem.
- **Semanal — Completa**: a contagem completa (segundas-feiras).
- **Mensal — Inventário**: inventário completo (todo dia 1º).

Para Limpeza e Utensílio o tipo é sempre tratado como semanal.

## Colunas e cálculos

### Cards de total (topo)

| Card | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total em estoque | Valor total do estoque na contagem selecionada | Soma do `valor` de todos os itens da contagem | `silver.estoque_contagem` |
| Valor de quebra (semana) | (só na classe Utensílio) valor total quebrado | Soma do `valor_quebra` de todos os utensílios | `gold.estoque_utensilio_quebra` |
| Card por área | Valor e nº de itens por área (Comidas/Salão/Drinks/Alimentação) | Soma do `valor` dos itens agrupados pela área derivada | `silver.estoque_contagem` + classificador de área |

### Tabela de Insumo / Limpeza / Produção

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cód. | Código do item | `insumo_codigo` (i/L/u = insumo, pc/pd = produção) | `silver.estoque_contagem` |
| Insumo / Item / Produção | Nome do item | `insumo_nome` | `silver.estoque_contagem` |
| Área | Bucket da contagem (Comidas/Salão/Drinks/Alimentação) | Derivada do sufixo da categoria — (C)→Comidas, (S)→Salão, (B)/destilados→Drinks, (F)→Alimentação; alguns não-alcoólicos resolvidos por código. Produção usa prefixo pc/pd | `areaDe()` sobre `categoria`/`insumo_codigo` |
| Categoria | Categoria do item | `categoria` | `silver.estoque_contagem` |
| Estoque Ideal | (só Limpeza) estoque-alvo do item | `estoque_ideal` do cadastro | `silver.estoque_contagem` / cadastro |
| Qtd. contada | Quantidade final contada, na unidade do item | `estoque_final` = estoque fechado + estoque flutuante | `operations.contagem_estoque_insumos` → silver |
| Sug. Pedido | (só Limpeza) quanto pedir para repor até o ideal | `max(0, estoque_ideal − estoque_final)` (nunca negativo) | Calculado na API |
| Preço | Custo unitário usado na valorização | Insumo: preço do VMarket na data quando confiável; senão o efetivo (`valor ÷ qtd`). Produção: custo da ficha. Ver "Regras" | `preco_vmarket` / preço efetivo |
| Valor | Valor do item em estoque | `estoque_final × preço_unitário` (gravado congelado na data) | `silver.estoque_contagem.valor` |

### Tabela de Utensílio (modelo de quebra)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cód. | Código do utensílio | `insumo_codigo` | `gold.estoque_utensilio_quebra` |
| Item | Nome do utensílio | `insumo_nome` | `gold.estoque_utensilio_quebra` |
| Seção | Local do utensílio (Cozinha/Drink/Salão/Uniformes) | `secao` | `gold.estoque_utensilio_quebra` |
| Mín/Máx | Estoque mínimo/máximo do cadastro | `estoque_min` / `estoque_max` | `gold.estoque_utensilio_quebra` |
| Estoque | Estoque contado nesta data | `estoque` | `gold.estoque_utensilio_quebra` |
| Compra | Compras registradas no período | `compra` | `gold.estoque_utensilio_quebra` |
| Quebra | Quanto "sumiu" (perda). Vermelho = quebra positiva | `quebra` (estoque anterior + compra − estoque atual). Cor: >0 vermelho, <0 verde | `gold.estoque_utensilio_quebra` |
| Valor de Quebra | Valor financeiro da quebra | `valor_quebra` = quebra × preço. É o "valor" da aba | `gold.estoque_utensilio_quebra` |

### Tabela de comparação (modo Comparar)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cód. / Insumo | Código e nome do item | Chave = `insumo_codigo` (ou nome quando sem código) | duas contagens `silver.estoque_contagem` |
| Qtd (data A) / Qtd (data B) | Quantidade em cada contagem | `estoque_final` de cada lado | silver |
| Δ Qtd | Variação de quantidade | `qtd_b − qtd_a` (verde sobe, vermelho cai) | Calculado na API/cliente |
| Valor (data A) / Valor (data B) | Valor em cada contagem | `valor` de cada lado | silver |
| Δ Valor | Variação de valor; ordena a lista pelo módulo | `valor_b − valor_a` | Calculado na API/cliente |

Os cards do modo comparação mostram o valor total de cada data e a **Diferença** (`valor_b − valor_a`), verde quando sobe e vermelho quando cai.

## Filtros e opções

| Filtro / Opção | Efeito |
|---|---|
| Bar | Sempre o bar selecionado no topo do sistema; todas as consultas filtram por `bar_id`. |
| Classe (Insumo/Limpeza/Utensílio/Produção) | Troca a fonte e as colunas da tabela. Limpeza e Utensílio forçam tipo semanal. |
| Tipo (Diária/Semanal/Mensal) | Filtra quais contagens aparecem. Diária = só itens Curva A; semanal/mensal casam o tipo exato da contagem. |
| Data | Seleciona a contagem a exibir. Abre na mais recente. |
| Comparar + data "com" | Ativa o modo de comparação entre duas contagens do mesmo tipo/classe. |
| Buscar insumo | Filtra a tabela por nome ou código (local, sem recarregar). |

## Regras e detalhes importantes

- **Filtragem por bar**: todas as consultas exigem e filtram por `bar_id`. A tela nunca mistura bares.
- **Preço congelado por data**: cada contagem guarda o preço vigente **na data dela**. Uma compra nova nunca reescreve o valor de uma contagem passada. Contagens de datas anteriores a hoje ficam "congeladas" (imutáveis); só a contagem de hoje ainda pode receber preço do dia.
- **Cascata de preço do insumo**: 1) VMarket (último pedido com data ≤ data da contagem); 2) sem compra no VMarket até a data → preço da **planilha**; 3) senão, custo do **cadastro**. O VMarket é descartado quando é 0 ou está mais de 5× acima do custo de referência (proteção contra troca de embalagem/preço absurdo) — nesse caso usa o custo efetivo (`valor ÷ qtd`).
- **Produção**: não tem VMarket; o custo vem da ficha técnica e já está embutido no `valor`. Área definida pelo prefixo do código (`pd`→Drinks, senão Cozinha).
- **Diária = Curva A**: a aba Diária mostra os itens marcados como Curva A, contados todo dia, mesmo quando fazem parte da contagem de segunda. Se filtrasse pelo tipo da contagem, a contagem de segunda "sumiria" da aba Diária.
- **Utensílio ≠ estoque parado**: para utensílios o "valor" é o **valor de quebra** (perda), não o valor em estoque.
- **Sincronizar planilha**: por padrão puxa 14 dias. Itens da planilha sem cadastro correspondente entram na contagem "sem cadastro" e são reportados no aviso.
- **Manual × automático**: quantidade sempre vem da contagem (planilha ou app). Itens de Limpeza/Utensílio são cadastrados manualmente nesta tela; Insumo vem do VMarket; Produção do módulo Produção-CMV.
- **Estados vazios**: sem contagem na data, a tabela mostra "Nenhuma contagem nessa data."; sem histórico, o seletor mostra "Sem contagens".
- **Arredondamento**: valores em reais (pt-BR); quantidades com até 3 casas decimais; variações da comparação com até 2 casas.

## Dúvidas frequentes

**Por que o valor de uma contagem antiga não muda quando o preço do insumo muda?**
Porque o preço fica congelado na data da contagem. Isso é proposital: uma compra nova nunca deve alterar o retrato de um estoque do passado.

**O que significa "sem cadastro" depois de sincronizar?**
São itens que estavam na planilha de contagem mas não têm um cadastro de insumo correspondente. Eles não recebem preço/valor até serem cadastrados/vinculados.

**Por que a aba Diária mostra menos itens?**
A Diária mostra só os itens de Curva A (giro alto). Semanal traz a contagem completa e Mensal o inventário.

**Como sei onde está concentrado o dinheiro do estoque?**
Nos cards por área (Comidas, Salão, Drinks, Alimentação) no topo, que somam o valor de cada área na contagem selecionada.

**Na aba Utensílio, o "valor" é quanto tenho em estoque?**
Não. Ali o valor é o **valor de quebra** — a perda estimada (estoque anterior + compras − estoque atual, vezes o preço).

**Posso corrigir uma contagem antiga?**
Sim, pelo fluxo "Fazer contagem" na data desejada. O sistema des-congela apenas aquela data e reprocessa o preço; as demais datas permanecem travadas.

## Fonte dos dados

- **`silver.estoque_contagem`** — contagens valorizadas de insumo/limpeza/produção (preço congelado por data, cascata VMarket → planilha → cadastro). Alimentada por `silver.fn_refresh_estoque_contagem`.
- **`operations.contagem_estoque_insumos`** — contagens brutas por item/data (fonte da silver). Alimentada por `operations.fn_refresh_contagem_estoque`.
- **`operations.contagem_datas`** (RPC) — histórico de datas por tipo e classe (usado no seletor de datas).
- **`gold.estoque_utensilio_quebra`** — modelo de quebra dos utensílios (estoque, compra, quebra, valor de quebra).
- **`public.bronze_contagem_sheet`** — planilha de contagem (aba INSUMOS) importada pelo Google Sheets.
- **VMarket** (`gold.vmarket_pedido` / `gold.vmarket_pedido_item` / `public.bronze_vmarket_produtos`) — preços de compra usados na valorização dos insumos.
- **`operations.insumos`** / **`public.producao_base`** / **`public.producao_ficha_item`** — cadastros de insumo e produção (custo, curva A, categoria, unidade).
- **API**: `GET/POST /api/operacional/estoque-historico` (leitura e sync) e `GET/POST /api/operacional/estoque-cadastro` (cadastro de limpeza/utensílio).
- **Integração de origem**: Google Sheets (planilha de contagem) e **VMarket** (compras/preços). O sync é feito pela edge function `sync-contagem-sheets`.
