---
title: CMV Teórico
area: producao-cmv
slug: cmv-teorico
route: /operacional/cmv-teorico
description: Calcula o CMV teórico de cada produto cruzando o custo da ficha técnica com o preço de venda e as vendas do período, e explica por que ele sobe ou desce.
order: 20
icon: BarChart3
---

# CMV Teórico

## Visão geral

A tela **CMV Teórico** responde a uma pergunta central de gestão: *"quanto o produto deveria custar, segundo a ficha técnica, para o preço que estou cobrando?"*.

Ela cruza duas informações:

- **Custo teórico** — o custo do produto calculado a partir da **ficha técnica** (a receita: quais insumos e quanto de cada um), usando o **último preço de compra** de cada insumo.
- **Preço de venda** — o preço praticado, vindo do **ContaHub** (ou do **Yuzer** em dias de operação de evento).

O **CMV teórico** é a razão entre os dois: `custo ÷ preço`. Diferente do CMV real (que vem do estoque e das compras do mês), o teórico mostra a margem *desenhada* de cada item — serve para achar produtos mal precificados, fichas caras, receitas sem cadastro e para entender o que puxou o CMV para cima ou para baixo entre dois períodos.

Quem usa: sócios, gestão de CMV/produção e time de compras — no dia a dia para precificar, revisar fichas e investigar variações de custo.

## Como acessar

Menu lateral: **Produção - CMV → CMV Teórico** (`/operacional/cmv-teorico`).

Permissão necessária: módulo **Gestão** (`gestao`). Usuários com acesso somente-leitura veem os dados normalmente, mas as ações de escrita (vincular/cadastrar/ignorar produtos no de-para) ficam ocultas, sinalizadas pelo selo **Somente leitura**.

## Passo a passo

### Consultar o CMV teórico de um período (uso mais comum)

1. Ao abrir, a tela já está no modo **Por período**, no granularidade **Dia**, mostrando o dia anterior (ontem).
2. Escolha a granularidade: **Dia**, **Semana** ou **Mês**.
3. Selecione a data de referência: em **Dia** use o seletor de data; em **Semana**/**Mês** use a lista suspensa (últimas 16 semanas / 12 meses).
4. Leia os cartões de topo (CMV teórico, Faturamento, Custo teórico, Margem) e a faixa que compara com o período anterior.
5. Desça para a tabela **por categoria** e clique numa categoria para filtrar a tabela de produtos abaixo.
6. Use a busca para achar um produto específico e o botão **Exportar CSV** para levar a lista para uma planilha.

### Revisar a precificação do cardápio inteiro

1. Clique na aba **Cardápio** (canto superior direito).
2. Veja o **CMV médio** e os contadores de pendências (Sem ficha, Ficha s/ preço, Sem preço CH).
3. Clique num contador para filtrar a tabela só pelos produtos naquela situação.
4. A linha principal mostra o **custo da ficha** e selos com quantos **códigos ContaHub** e se há **Yuzer**. **Clique na linha** (ou em **Expandir todos**) para abrir as sub-linhas — uma por código de origem, com o **nome cru** daquela origem e o **preço/CMV próprio** de cada uma.
5. Compare o CMV de cada origem (a cor vermelha indica CMV alto) para achar preços mal ajustados por canal (ContaHub × Yuzer × HH/PP).

### Comparar dois períodos e entender a variação

1. Clique na aba **Comparativo**.
2. Escolha a granularidade (**Semana** ou **Mês**) e os dois períodos a comparar (A vs B).
3. Leia os três cartões (CMV atual, anterior e variação em pontos percentuais).
4. Veja a decomposição em **Preço**, **Mix** e **Intramix** e a lista de itens que mais puxaram cada efeito.

### Recalcular o custo das fichas

1. Clique em **Recalcular** (topo direito).
2. O sistema recalcula o custo teórico de todos os produtos do cardápio e grava um **snapshot do dia**.
3. Ao terminar, os dados e a coluna **Δ** (variação vs. o último snapshot) são atualizados.

> Recalcular é o que faz o custo refletir o preço de insumo mais recente. Faça isso depois de precificar insumos ou montar/ajustar fichas.

> **Editou uma ficha e não mudou aqui?** A aba **Cardápio** mostra o custo **ao vivo** (reflete a edição na hora). A aba **Por período** lê uma tabela que só atualiza no processo diário — depois de mexer numa ficha, use a aba **Cardápio** para conferir na hora, ou clique em **Recalcular**.

> **Produtos agrupados (mesma ficha):** um produto agrupado num principal (ex.: `[50%] Caipirinha` → Caipirinha) herda o **custo/receita do principal** mas mantém o **seu preço**, então tem o **seu próprio CMV**. Ele conta normalmente no CMV do período pelo que vendeu em cada código.

As **categorias** (no Cardápio e nos filtros) seguem o **prefixo do código**: `b`→Bebida, `d`→Drink, `c`→Comida, resto→Outros — igual nos dois bares.

### Resolver produtos "fora do de-para" (modo Por período)

Quando um produto foi vendido no ContaHub mas não tem código interno vinculado, ele aparece num aviso laranja. Clicando nele:

1. **Vincular** — associa o produto do ContaHub a um código já existente no cardápio. Sugestões por nome idêntico ("exato") podem ser vinculadas em massa.
2. **Cadastrar novo** — cria um produto novo no cardápio (escolhendo a categoria b/c/d/o), já vinculado; depois monte a ficha em Fichas Técnicas.
3. **Ignorar** — remove da lista itens que não são produto de cardápio (ingresso, vale, taxa, embalagem etc.).

## Abas e seções

A tela tem três modos, alternados pelo seletor no topo:

### Cardápio
Catálogo estático: o CMV teórico "de tabela" de cada produto (custo da ficha ÷ preço), independente de ter vendido. É a fonte para revisar precificação e caçar fichas pendentes. Traz o comparativo **Δ** contra o último snapshot salvo.

Cada produto é uma **linha expansível**: o principal traz só o **custo da ficha** (que é único por produto) e selos de quantos códigos **ContaHub** e se tem **Yuzer**; o preço e o CMV ficam **em branco no principal** — de propósito, porque um produto pode ter vários códigos com preços diferentes. Ao expandir, aparece **uma sub-linha por código de origem** (ContaHub ou Yuzer), cada uma com o **nome cru** daquela origem, o código e o **preço/CMV próprio** (mesmo custo de ficha ÷ preço daquele código). O preço Yuzer vem da tabela `gold.produto_preco_yuzer`.

### Por período (padrão)
CMV teórico **ponderado pelas vendas** do dia/semana/mês escolhido: pesa cada produto pela quantidade vendida. Traz cartões de headline, comparação com o período anterior (Mix × Compras), avisos de cobertura, lista por categoria e por produto, e a fila de produtos fora do de-para.

### Comparativo
Compara dois períodos (semana×semana ou mês×mês) e **decompõe** a variação do CMV em três efeitos: **Preço** (insumo ficou mais caro/barato), **Mix** (mudou a proporção entre categorias) e **Intramix** (dentro da categoria, vendeu itens de CMV melhor/pior).

## Colunas e cálculos

### Aba Cardápio — cartões

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| CMV médio | Média simples do CMV % dos produtos que têm CMV | média de `cmv_pct` dos produtos com valor não nulo | `gold.produto_cmv` |
| Produtos c/ CMV | Quantos produtos têm CMV calculável | contagem de itens com `cmv_pct` não nulo | `gold.produto_cmv` |
| Sem ficha | Produtos sem receita cadastrada | `itens_ficha = 0` | `gold.produto_cmv` |
| Ficha s/ preço | Tem ficha, mas o custo saiu zero (insumo sem preço) | `itens_ficha > 0` e `custo` nulo/zero | `gold.produto_cmv` |
| Sem preço CH | Produtos sem preço de venda no ContaHub | `preco_venda` ausente | `gold.produto_cmv` |

### Aba Cardápio — tabela de produtos (linha principal)

A linha principal é **por produto interno** e mostra só o que é único por produto. Preço, Margem e CMV **ficam em branco no principal** — eles aparecem nas sub-linhas por origem (expanda a linha).

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cód. | Código interno do produto (com a seta de expandir) | direto | `produto_cardapio.codigo` |
| Produto | Nome do produto + selos `N CH` e `🎟️ Yuzer` (quantos códigos de cada origem) | direto | `produto_cardapio.nome`, `produto_contahub_map`, `produto_yuzer_map` |
| Categoria | Categoria (Bebida/Drink/Comida/Outros) | direto | `produto_cardapio.categoria` |
| Custo (ficha) | Custo teórico de 1 unidade | soma dos itens da ficha (`quantidade × custo do insumo`, corrigido por `fator_correcao`) × `multiplicador` de finalização | `producao_ficha_item`, `gold.insumo_custo_un` |
| Δ | Variação do CMV vs. o último snapshot | `cmv_pct_atual − cmv_pct_anterior`, em pontos percentuais | `gold.produto_cmv_historico` |

### Aba Cardápio — sub-linhas por origem (ao expandir)

Uma sub-linha para **cada código ContaHub** (`prd`) e **cada código Yuzer** (`cod_yuzer`) que aponta para o produto. Mesmo custo de ficha; **preço e CMV próprios de cada origem**.

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cód. | Selo `CH`/`🎟️ Yz` + o código da origem (`prd` do ContaHub ou `cod_yuzer`) | direto | `produto_contahub_map` / `produto_yuzer_map` |
| Produto | **Nome cru** daquela origem (ex.: "Corona Lata" no ContaHub vs. "Corona LATA 350ml") | direto | `prd_desc` (ContaHub) / `nome` (Yuzer) |
| Preço | Preço daquele código | ContaHub: `preco_venda` do mapa; Yuzer: preço efetivo | `produto_contahub_map.preco_venda` / `gold.produto_preco_yuzer` |
| Margem | Sobra por unidade naquela origem | `preço − custo (ficha)` | calculado |
| CMV % | Custo sobre o preço daquela origem | `custo ÷ preço × 100` | calculado |

### Aba Por período — cartões de headline

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| CMV teórico | CMV do período ponderado pelas vendas | `Σ(qtd × custo_unit) ÷ Σ faturamento × 100`, só produtos com ficha | `fn_cmv_teorico_periodo` |
| Faturamento | Receita dos produtos considerados | `Σ valor` dos produtos com ficha | `silver.vendas_consolidada_dia` |
| Custo teórico | Custo total teórico | `Σ(qtd × custo_unit)` | ficha × vendas |
| Margem | Faturamento − custo | `faturamento − custo_total` | calculado |
| Cobertura do CMV | % do faturamento que já tem custo apurado | `(faturamento − faturamento de fichas sem preço) ÷ faturamento` | calculado |

### Aba Por período — tabela por categoria

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Categoria | Bebida, Drink, Comida ou Outros | derivada do 1º caractere do código (b/d/c/o) | `fn_cmv_teorico_periodo` |
| Itens | Nº de produtos distintos vendidos | contagem | agregação |
| Qtd vendida | Unidades vendidas | `Σ qtd_venda` | `vendas_consolidada_dia` |
| Faturamento | Receita da categoria | `Σ valor` | `vendas_consolidada_dia` |
| Custo teórico | Custo teórico da categoria | `Σ(qtd × custo_unit)` | ficha × vendas |
| Margem | Faturamento − custo | calculado | calculado |
| CMV % | Custo ÷ faturamento | `custo_total ÷ faturamento × 100` | calculado |

### Aba Por período — tabela por produto

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cód. | Código interno | direto | `produto_cardapio` |
| Produto | Nome (marca 🎟️ Yuzer quando a linha é de operação Yuzer) | direto | `produto_cardapio` / `fonte` |
| Categoria | Categoria do produto | por prefixo do código | derivada |
| Qtd | Unidades vendidas | `Σ qtd_venda` | `vendas_consolidada_dia` |
| Preço venda | Preço unitário | ContaHub: preço de tabela do cardápio; Yuzer: `faturamento ÷ qtd` do evento | `gold.produto_cmv` / Yuzer |
| Custo unit. | Custo teórico por unidade | `custo` da ficha (`gold.produto_cmv.custo`); "—" quando sem ficha/custo | `gold.produto_cmv` |
| Faturamento | Receita do produto | `Σ valor` | `vendas_consolidada_dia` |
| Custo total | Custo teórico total | `Σ(qtd_venda × custo)` | calculado |
| Margem | Faturamento − custo total | calculado | calculado |
| CMV % | Custo ÷ faturamento | `custo_total ÷ faturamento × 100` | calculado |

### Aba Por período — fila "fora do de-para"

| Coluna | O que mostra | Fonte |
|---|---|---|
| Cód. CH | Código do produto no ContaHub (`prd`) | `fn_depara_sugestoes` |
| Produto (ContaHub) | Nome como veio do ContaHub | `fn_depara_sugestoes` |
| Qtd | Unidades vendidas no período | `silver.vendas_produto_dia` |
| Faturamento | Receita gerada | `silver.vendas_produto_dia` |
| Sugestão / vincular | Melhor palpite de vínculo por nome (badge "exato" ou "~xx%") + ações | `fn_depara_sugestoes` |

### Aba Comparativo

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| CMV teórico — atual | CMV do período A | `Σ(qtd × custo_unit) ÷ Σ faturamento` no período A | `fn_cmv_teorico_produto_preco` |
| CMV teórico — anterior | CMV do período B | idem para o período B | `fn_cmv_teorico_produto_preco` |
| Variação | Diferença em pontos percentuais | `CMV_A − CMV_B` | calculado |
| Efeito Preço (compras) | Quanto do delta veio de o insumo ficar mais/menos caro | CMV de A com preço de A − CMV de A com preço de B | decomposição |
| Efeito Mix (entre categorias) | Quanto veio de mudar a proporção entre categorias | `Σ (share_A − share_B) × CMV_B` por categoria | decomposição |
| Efeito Intramix (dentro) | Quanto veio de trocar de item dentro da mesma categoria | `Σ share_A × (CMV_A − CMV_B)` por categoria | decomposição |
| Tabela por categoria | Faturamento atual, CMV atual, CMV anterior e variação por categoria | agregação dos 3 cenários | `fn_cmv_teorico_produto_preco` |
| Itens que mais puxaram | Produtos com maior contribuição de mix/intramix ou de preço | contribuição por produto em p.p. | drivers da API |

> **Nota importante:** no modo Comparativo, o efeito **Preço** usa o **preço de insumo histórico** (VMarket na data de referência de cada período), então ele isola de verdade a variação de custo de compra. No modo **Por período**, a faixa "CMV subiu/caiu vs. período anterior" separa a variação em **Mix** e **Compras**, mas usando o custo atual congelado (`gold.produto_cmv`) e o histórico de custo mais próximo de cada período (`produto_cmv_historico`).

## Filtros e opções

| Filtro / opção | Onde | Efeito |
|---|---|---|
| Bar | Seletor global de bar | Toda a tela é filtrada por `bar_id`; nada é somado entre bares |
| Modo | Cardápio / Por período / Comparativo | Troca a lógica e o layout inteiro |
| Granularidade | Dia / Semana / Mês (Por período e Comparativo) | Define a janela de datas |
| Data de referência | Seletor de data ou lista de semanas/meses | Escolhe o período analisado |
| Períodos A e B | Modo Comparativo | Define os dois períodos comparados (ex.: junho × abril) |
| Busca | Campo de texto | Filtra por nome ou código do produto |
| Categoria | Botões (Cardápio) / clique na linha (Por período) | Filtra a lista de produtos |
| Contadores clicáveis | Sem ficha / Ficha s/ preço / Sem preço CH (Cardápio) | Filtra a tabela pela pendência |
| Avisos clicáveis | "Sem ficha" / "Ficha sem preço" (Por período) | Ativa o filtro "só fora do custo" |
| Recalcular | Botão do topo | Recalcula custos e grava snapshot |
| Exportar CSV | Modo Por período | Baixa a tabela de produtos filtrada |

## Regras e detalhes importantes

- **Só produtos com ficha entram no CMV.** No modo Por período, produtos vendidos **sem ficha técnica** (`itens_ficha = 0`) ficam **fora** da base do CMV — nem faturamento nem custo. Se entrassem, o custo seria zero e diluiriam o CMV artificialmente para baixo. Eles seguem aparecendo no aviso e na tabela para você cadastrar a receita.
- **Ficha sem preço.** Produto com ficha, mas cujo insumo está sem preço (custo zero), **continua** na base (é precificável). O impacto é medido pela **Cobertura do CMV** — quanto do faturamento já tem custo real apurado.
- **Custo do insumo — cascata.** O custo unitário de cada insumo vem da **última compra no VMarket**; na falta dela, cai para o **preço da planilha** (`custo_planilha`). Fichas que usam outra produção como componente têm o custo resolvido em cadeia (até 6 níveis).
- **Multiplicador de finalização.** Fichas em unidade que rendem uma porção (ex.: Mega Coxinha 5×) têm o custo unitário multiplicado pelo `multiplicador` do produto.
- **Cortesia / consumação.** Itens dados como cortesia consomem insumo mas não geram faturamento. O CMV% é calculado **só sobre o que foi vendido**; a cortesia aparece numa nota à parte (quantidade e custo) e é contabilizada nas Saídas/Desvios, não aqui. O cálculo é `qtd_consumo − qtd_venda`.
- **Dias Yuzer.** Em dias de operação de evento (fonte da verdade: `eventos_base.usa_yuzer = true`), o CMV usa o **preço do Yuzer** (preço efetivo = faturamento ÷ quantidade), não o preço de tabela do ContaHub. Um selo 🎟️ sinaliza esses dias.
- **Categoria canônica.** A categoria é derivada do **prefixo do código** (b=Bebida, d=Drink, c=Comida, o=Outros) para blindar contra divergências de caixa/nulos na origem.
- **Snapshot e Δ.** Recalcular grava um snapshot diário em `produto_cmv_historico`. A coluna Δ (aba Cardápio) e o comparativo interno usam esse histórico. Sem um snapshot anterior, o Δ aparece como "—".
- **Cores do CMV.** Verde até 33%, âmbar entre 33% e 45%, vermelho acima de 45%.
- **Recalcular é manual.** O custo das fichas só reflete o preço de insumo mais recente **depois** de clicar em Recalcular (ou do processo automático que roda o mesmo `fn_cmv_teorico`).
- **Vincular/Cadastrar refresca na hora.** Ao vincular ou cadastrar um produto do de-para, a matview de vendas é atualizada na hora, para o item entrar no CMV imediatamente. Ignorar remove da lista sem refresh.

## Dúvidas frequentes

**Por que meu CMV teórico é diferente do CMV real do mês?**
O teórico é o que a ficha *diz* que deveria custar (receita × preço de insumo). O real vem do estoque e das compras (`financial.cmv_mensal`) e inclui perdas, desvios, cortesias e erros de porcionamento. A diferença entre os dois é justamente o que você quer investigar.

**Um produto que vendi não aparece na lista. Por quê?**
Provavelmente ele está **sem ficha técnica** (fica fora do CMV, mas aparece no aviso vermelho) ou **fora do de-para** (foi vendido no ContaHub sem código interno vinculado — veja o aviso laranja e vincule/cadastre).

**O que significa "Cobertura do CMV"?**
É a fatia do faturamento que já tem custo apurado. Se está abaixo de 100%, há produtos com ficha mas insumo sem preço — precifique o insumo para fechar a conta.

**Cortesia entra no CMV?**
Não no CMV%. O CMV% é só sobre o que foi vendido. A cortesia consome insumo e aparece à parte (e nas Saídas/Desvios).

**Qual a diferença entre "Mix" e "Preço" no comparativo?**
**Mix/Intramix** = você vendeu produtos diferentes (mudou o que sai). **Preço/Compras** = os insumos ficaram mais caros ou mais baratos (mudou o custo). A soma dos três efeitos é a variação total do CMV.

**Preciso clicar em Recalcular toda vez?**
Não para consultar. Recalcule depois de mudar fichas ou precificar insumos, para o custo teórico refletir os valores atuais.

## Fonte dos dados

- **`gold.produto_cmv`** e **`gold.produto_cmv_historico`** — custo teórico e snapshot por produto (função `gold.fn_cmv_teorico`).
- **`gold.fn_cmv_teorico_periodo`** — CMV ponderado pelas vendas do período (por produto e categoria).
- **`gold.fn_cmv_teorico_produto_preco`** — cenários de preço para o comparativo (usa `fn_insumo_custo_un_asof`, preço de insumo histórico VMarket).
- **`gold.fn_cmv_teorico_comparativo`** — decomposição Mix × Compras vs. período anterior (modo Por período).
- **`gold.fn_cmv_teorico_vs_real`** — comparação teórico × real (`financial.cmv_mensal`).
- **`gold.fn_depara_sugestoes`** — produtos vendidos fora do de-para, com sugestão de vínculo.
- **`silver.vendas_consolidada_dia`** / **`silver.vendas_produto_dia`** — vendas por produto/dia (base ContaHub + Yuzer).
- **`public.produto_cardapio`**, **`public.producao_ficha_item`**, **`public.producao_base`** — cardápio e fichas técnicas.
- **`public.produto_contahub_map`**, **`public.produto_contahub_ignorar`** — de-para ContaHub ↔ código interno.
- **`gold.insumo_custo_un`** e **`gold.produto_preco_yuzer`** — custo de insumo (VMarket/planilha) e preço Yuzer.
- **`operations.eventos_base`** — sinaliza dias de operação Yuzer (`usa_yuzer`).

Integrações de origem: **ContaHub** (vendas e preço de tabela), **Yuzer** (vendas e preço em eventos), **VMarket** (preço de compra de insumo) e o cadastro interno de **fichas técnicas**.
