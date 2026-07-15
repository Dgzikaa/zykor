---
title: Fichas Técnicas
area: producao-cmv
slug: fichas-tecnicas
route: /operacional/fichas-tecnicas
description: Cadastro das receitas (preparos internos e itens de cardápio) com insumos, peso, fator de correção e custo — base do CMV teórico do bar.
order: 80
icon: ChefHat
---

# Fichas Técnicas

## Visão geral

A tela de **Fichas Técnicas** é onde você monta a "receita" de cada item do bar: quais insumos entram, em que quantidade, com que perda (fator de correção) e quanto custa. É a base de todo o **CMV teórico** — sem ficha montada, o Zykor não sabe quanto deveria custar produzir/vender um item.

A tela trabalha com dois tipos de ficha, separados em abas:

- **Produção** — preparos internos (molhos, bases, pré-batidos, itens de cozinha/bar). Ex.: "Molho da casa", "Caipirinha base". Um preparo pode virar componente de outra ficha.
- **Finalização** — itens do cardápio, aquilo que é de fato vendido (e tem código no ContaHub/Yuzer). Ex.: "Caipirinha de Limão", "Mega Coxinha". A ficha de um produto pode usar insumos diretos **e/ou** produções.

Quem usa no dia a dia: gestão de CMV, cozinha/bar (chefs, sous-chefs) e a operação que precisa manter as receitas e custos atualizados. É a partir daqui que o custo do item flui para o **CMV Teórico**, **Desvios de Consumo** e **Planejamento da Produção**.

## Como acessar

Menu lateral: **Produção - CMV › Fichas Técnicas** (`/operacional/fichas-tecnicas`).

Permissão necessária: módulo **gestão** (mesma permissão das demais telas de Produção/CMV). Quem não tiver permissão de **editar**, **inserir** nem **excluir** nesse módulo entra em **modo Somente leitura** — vê tudo, mas os botões de salvar/criar/excluir ficam bloqueados (a badge "Somente leitura" aparece no topo).

## Passo a passo

### 1. Escolher a aba e encontrar a ficha
1. Selecione o bar no seletor (todas as fichas são por bar).
2. Clique na aba **Produção** (preparos) ou **Finalização** (cardápio).
3. Use a busca da coluna da esquerda para achar o item por **nome**, **código** ou (na finalização) **código ContaHub**.
4. Clique no item na lista — a ficha abre no painel da direita, com os cards de custo no topo e a tabela de componentes embaixo.

### 2. Montar/editar a receita (adicionar componente)
1. Com a ficha aberta, clique em **Adicionar componente**.
2. Escolha o tipo: **Insumo** (item comprado, código `i0XXX`) ou **Produção** (outro preparo).
3. Busque e selecione o componente.
4. Informe a **quantidade**. A unidade **não é escolhida** — ela segue o cadastro do insumo (unidade-base) ou o rendimento do preparo.
5. Clique em **Adicionar**. O custo do item e o custo total da ficha se recalculam na hora.

Para **editar a quantidade** de um componente já na ficha, clique no lápis da linha, ajuste a quantidade e salve. Para **remover**, clique na lixeira da linha.

### 3. Ajustar o Fator de Correção (FC)
Só aparece para insumos marcados como "tem FC" no cadastro. Digite o **aproveitamento entre 0 e 1** direto na coluna FC (ex.: `0,9` = 90% de aproveitamento, 10% de perda). O sistema recusa valores fora de 0–1 (evita digitar `90` no lugar de `0,9`). O peso efetivo usado no custo é `quantidade ÷ FC`.

### 4. Marcar o insumo mestre (só Produção)
Na aba Produção, clique na **estrela** da linha para marcar o **insumo mestre** (o insumo principal do preparo). Marcar um desmarca os outros da mesma ficha. O mestre é usado no cruzamento com desvios/estoque.

### 5. Editar dados do item (produção ou produto)
- **Produção**: clique no lápis ao lado do nome para editar **nome, código, rendimento, unidade, unidade de contagem e conversor de contagem**.
- **Produto (finalização)**: clique no lápis para editar **nome e código**; use **editar códigos** para o de-para ContaHub (prd) e Yuzer. A edição é por **chip** (adicionar/remover), sem digitar vírgula: em **Cód. ContaHub** você **busca o código real** (por número ou nome) e clica para virar um chip — assim não tem erro de digitação; em **ID Yuzer** você digita o ID e clica em **adicionar**. O `×` de cada chip remove.
- O painel **"Códigos ContaHub + Yuzer nesta ficha"** lista, além dos códigos ContaHub (com **Preço CH** e **CMV** de cada um), também os **códigos Yuzer** vinculados ao mesmo produto (com o **preço Yuzer** e o CMV correspondente) — assim você vê todos os vínculos do produto num lugar só.

### 6. Definir o multiplicador da porção (só Finalização)
No campo **Porção** (badge âmbar), informe quantas unidades da ficha compõem a porção vendida. Ex.: a ficha da "Mega Coxinha" tem 1 coxinha, mas a porção vendida tem 5 → multiplicador `5`. O **Custo Total** (base do CMV teórico) passa a ser `custo unitário × 5`.

### 7. Criar uma ficha nova
1. Clique em **Nova produção** / **Novo produto** (canto superior direito).
2. Informe **nome** e escolha a **categoria** (define o prefixo do código, gerado automaticamente).
3. Na finalização, opcionalmente informe **Cód. CH** e **ID Yuzer**.
4. Opcionalmente escolha uma ficha **modelo** para copiar os componentes.
5. Clique em **Criar** e depois monte/ajuste a ficha.

### 8. Importar em massa (planilha / ContaHub)
- **Importar preparos** (aba Produção) / **Importar cardápio** (aba Finalização): puxa itens novos da planilha mestre no Google Sheets (só insere os que ainda não existem).
- **Atualizar (ContaHub)** (só Finalização): consulta o ContaHub e atualiza o **status ativo/inativo** e o **preço de venda** dos produtos, e recalcula o CMV teórico.

### 9. Vincular fichas réplica (receita compartilhada)
Quando dois itens têm a mesma receita (ex.: a mesma bebida em preços diferentes: Happy Hour, Preço Promo, etc.), abra a ficha "mestre", clique em **Vincular fichas réplica**, selecione as outras e confirme. A receita da mestre é copiada para as selecionadas e, a partir daí, **editar uma edita todas**. Use "desvincular esta" para tirar uma do grupo.

### 10. Agrupar em uma ficha só (mesma receita, preços diferentes)
Quando vários códigos ContaHub têm a **mesma receita** e só mudam o preço (ex.: Caipirinha, Caipirinha HH, [PP] Caipirinha, [50%] Caipirinha):
1. Abra o produto que vai virar variante (ex.: `[50%] Caipirinha`).
2. Clique em **agrupar (mesma ficha)** e escolha o **produto principal** (a Caipirinha base, que tem a ficha).
3. Pronto: o variante passa a **usar a ficha do principal** (mostrada na tela com um aviso roxo, em modo leitura) e o **CMV recalcula na hora** — com o **custo do principal** e o **preço próprio** do variante.

A partir daí você mantém **uma ficha só**: mudou a receita no principal, vale para todos do grupo. Promoção nova? Basta criar o código no ContaHub e **agrupar** no principal — sem copiar ficha. Para desfazer, abra o variante e clique em **desagrupar**.

> **Agrupar (mesma ficha) × Vincular réplica:** *agrupar* mantém **uma ficha só** (a do principal) e é o caminho recomendado. *Vincular réplica* **copia** a receita para cada item (fichas separadas que ficam iguais no momento do vínculo) — modelo mais antigo, ainda disponível.

### 11. Buscar por insumo e substituir em massa
No topo, clique em **Buscar por insumo**. Digite o nome/código, veja em quais fichas ele aparece e, se quiser, escolha um insumo substituto para **trocá-lo em todas as fichas do bar de uma vez** (as quantidades são mantidas).

## Abas e seções

### Aba Produção (preparos internos)
Fichas de itens que a casa produz. Cada produção tem **rendimento** (quanto sai da receita) e **unidade**. Traz opções extras de gestão de estoque via checkboxes:

- **Aparece no Controle de Produção** — inclui o preparo na tela de Controle de Produção.
- **Curva A (contagem diária)** — entra na contagem diária de estoque; ligar força também "entra na contagem".
- **Entra na contagem de estoque** — se desmarcado, o preparo não aparece em nenhuma contagem; desmarcar também zera o Curva A.
- **Pré-batch (decompor nos insumos ao contar)** — ao contar, a quantidade é decomposta nos insumos que a compõem (soma no estoque cru; não vira SKU próprio).
- **Unidade de contagem / conversor** — como o preparo é contado no estoque (ex.: conta em "porção" e cada uma tem 0,4 kg).

### Aba Finalização (cardápio)
Fichas dos itens vendidos. Traz o de-para de vendas e os indicadores de preço/CMV:

- **Cód. CH / ID Yuzer** — ligam o produto às vendas do ContaHub e do Yuzer (sem eles, a venda não entra no CMV).
- **Agrupar (mesma ficha)** — faz o produto usar a **ficha (receita/custo) de um produto principal**, mas mantendo o **seu próprio preço e o seu próprio CMV**. Ideal para variações que têm a mesma receita e só mudam o preço: Happy Hour, PagPag, PPHH, promoções [50%]. Assim você mantém **uma ficha só** (editada no principal) e vale para todas. **Dose Dupla não** entra (leva o dobro de insumo → é outra receita, tem ficha própria). Produto agrupado não conta como "sem ficha" nem como "sem cód CH".
- **Porção (multiplicador)** — nº de unidades da ficha por porção vendida.
- **Status (ContaHub)** — filtro Ativos/Inativos vindo do ContaHub.

### Modal "Vendeu sem cadastro"
Botão vermelho que aparece na aba Finalização quando há itens **vendidos no ContaHub nos últimos 30 dias sem produto cadastrado no Zykor** (a venda não entra no CMV). Ali você escolhe a categoria e cadastra o item de uma vez (depois monta a ficha).

## Colunas e cálculos

### Cards de resumo da ficha selecionada

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Rendimento (só Produção) | Quanto sai da receita e em qual unidade | Campo cadastrado (`rendimento` + `unidade`) | `producao_base` |
| Custo / Custo Unit. | Custo de 1 unidade da ficha | Soma do custo de cada componente: `Σ custo_atual`. Para cada componente, `custo_atual = (quantidade ÷ FC) × preço por unidade-base` | `producao_ficha_item` + preço do catálogo |
| Custo Total ×N (só Finalização, quando porção > 1) | Custo da porção vendida | `Custo Unit. × multiplicador`. É o valor que entra no CMV teórico | `produto_cardapio.multiplicador` |
| Preço CH | Preço de venda no ContaHub | Maior `preco_venda` mapeado para o código do produto | `produto_contahub_map` |
| Preço Yuzer | Preço de venda no Yuzer (último) | `preco_yuzer` do de-para Yuzer | `gold.produto_preco_yuzer` |
| CMV CH / CMV Yuzer / CMV teórico | % do preço que é custo | `Custo Total ÷ preço × 100`. Mostra CMV CH e CMV Yuzer quando há os dois preços; senão o único disponível | Calculado na tela |
| Indicador "méd. X%" | Compara o CMV do item com a média da categoria (90 dias) | Verde (seta pra baixo) se o CMV ≤ média da categoria; vermelho se acima | `gold.fn_cmv_media_categoria` |

### Tabela de componentes da ficha

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Mestre (só Produção) | Estrela do insumo principal do preparo | Flag `is_mestre` (só 1 por ficha) | `producao_ficha_item` |
| Código | Código do componente | Insumo: `insumo_codigo` (`i0XXX`). Produção: código da produção referenciada | `producao_ficha_item` / `producao_base` |
| Componente | Nome do item | Insumo: **nome canônico do cadastro** (não a grafia do VMarket). Produção: nome do preparo | `silver.insumo_catalogo` / `producao_base` |
| Tipo | Se é Insumo ou Produção | Campo `componente_tipo` | `producao_ficha_item` |
| Peso/Qtd | Quantidade do componente na receita | `quantidade`, exibida na unidade-base do insumo (g/ml normaliza p/ kg/L ≥ 1000) | `producao_ficha_item` |
| FC | Fator de Correção (aproveitamento 0–1) | Editável só para insumos marcados com FC. Peso efetivo = `quantidade ÷ FC`. Mostra "→ peso efetivo" quando FC ≠ 1 | `producao_ficha_item.fator_correcao` |
| Preço insumo | Preço por unidade-base do insumo | `preço da última compra ÷ embalagem`, normalizado (g→/kg, ml→/L). Produção: custo por unidade do preparo referenciado | `silver.insumo_catalogo` |
| Valor | Custo do componente na ficha | `(quantidade ÷ FC) × preço por unidade-base`. Marca **⚠** em âmbar quando o valor fica 5× acima do previsto na planilha (provável unidade/embalagem errada) | Calculado na API |

### Coluna da lista (esquerda)

| Elemento | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome + código + nº de itens | Identificação da ficha | `qtd_componentes` = nº de linhas da ficha | `v_produto_ficha_count` / contagem em `producao_ficha_item` |
| Selo "A" (Produção) | Produção marcada como Curva A | Flag `curva_a` | `producao_base` |
| "ch: ..." (Finalização) | Códigos ContaHub mapeados | `cods_ch` do de-para | `produto_contahub_map` |
| Badge "ficha vazia" | Fichas sem nenhum componente | `qtd_componentes = 0` (produtos **agrupados** são excluídos — usam a ficha do principal) | Calculado |
| Badge "item R$0" | Fichas com algum insumo sem preço | Códigos vindos da view de itens zerados | `gold.v_ficha_item_zerado` |
| Badge "sem mestre" (Produção) | Fichas com itens mas sem insumo mestre | `qtd_componentes > 0` e nenhum `is_mestre` | Calculado |
| Badge "sem cód CH" (Finalização) | Produtos sem código de venda e não agrupados | `cods_ch` vazio e sem `agrupado_em` | Calculado |
| Badge "curva A" (Produção) | Contagem de produções Curva A | Flag `curva_a` | `producao_base` |
| Badge "sem un. contagem" (Produção) | Produções sem unidade de contagem | `unidade_contagem` nulo | `producao_base` |
| Badge "vendeu sem cadastro" (Finalização) | Itens vendidos no ContaHub sem cadastro | RPC de vendas sem produto (30 dias) | `operations.fn_vendas_sem_cadastro` |

## Filtros e opções

- **Bar** — tudo é filtrado por `bar_id` (seletor de bar). Fichas de um bar não aparecem no outro.
- **Aba Produção / Finalização** — troca entre preparos e cardápio.
- **Busca** — por nome, código interno ou (finalização) código ContaHub.
- **Filtros por categoria** — Produção: Bar / Cozinha (pelo prefixo `pd`/`pc`). Finalização: Bebida / Drink / Comida / Outros (pela 1ª letra do código: `b`/`d`/`c`/outros).
- **Status (ContaHub)** — só na Finalização: Todos / Ativos / Inativos (segue o ativo/inativo do ContaHub).
- **Badges de higiene** — clicáveis; funcionam como filtro rápido (ficha vazia, item R$0, sem mestre, sem cód CH, curva A, sem un. contagem). Os contadores respeitam os outros filtros ativos (categoria + status).

## Regras e detalhes importantes

- **Sempre por bar.** Todas as consultas filtram por `bar_id`; nenhuma ficha cruza entre bares.
- **Preço vem do catálogo, por código.** A ficha **não aponta para o SKU do VMarket** — o vínculo é sempre por **código do insumo** (`i0XXX`). O preço usado é o da **última compra** (catálogo `silver.insumo_catalogo`), dividido pela embalagem para virar preço por unidade-base.
- **Custo é ao vivo.** Corrigir o preço/embalagem de um insumo (aqui ou na tela de Insumos) reflete no custo da ficha na hora — a view é viva.
- **Unidade segue o cadastro.** Ao adicionar/editar componente, a unidade não é escolhida: insumo usa a unidade-base do cadastro; produção usa a unidade do rendimento. Só cai no valor legado da linha se não houver cadastro.
- **Fator de Correção (FC)** é aproveitamento entre 0 e 1 (não percentual). Peso efetivo = `quantidade ÷ FC`. Valores fora de 0–1 são recusados na tela e na API.
- **Multiplicador da porção** (finalização) é inteiro ≥ 1. Só aparece o card "Custo Total ×N" quando maior que 1. É esse Custo Total que entra no CMV teórico.
- **Fichas vinculadas (réplicas):** ao vincular, a receita da mestre **substitui** a das outras, e adicionar/editar/remover componente propaga para todas as irmãs do grupo. Grupo com menos de 2 membros é desfeito automaticamente.
- **Alerta de custo (⚠).** Quando o custo de um componente fica 5× acima do previsto na planilha, a tela apenas **alerta** (âmbar) — não zera nem esconde o valor. Costuma indicar unidade/embalagem do insumo cadastrada errada.
- **Recalcular CMV.** Toda inclusão/edição/remoção de componente, mudança de rendimento (produção) ou de multiplicador (produto) dispara o recálculo do CMV teórico do parent afetado.
- **Excluir.** Excluir produto/produção remove também a ficha, mas mantém o de-para ContaHub/Yuzer e não afeta o ContaHub. Ação sem desfazer.
- **Estados vazios.** Sem ficha selecionada, o painel pede para selecionar um item. Ficha sem componentes mostra "Ficha vazia". Listas vazias orientam a importar/cadastrar.
- **Manual vs. automático.** A receita (componentes, quantidades, FC, mestre, multiplicador) é **manual**. O preço dos insumos, o status ativo/inativo e o preço de venda são **automáticos** (VMarket/última compra, ContaHub, Yuzer).

## Dúvidas frequentes

**O custo da ficha está zerado ou com ⚠. O que fazer?**
Zerado = o insumo não tem preço no catálogo (sem compra registrada) — veja o badge "item R$0". Com ⚠ = o custo destoou muito do previsto; quase sempre é a unidade/embalagem do insumo cadastrada errada. Ajuste na tela de Insumos.

**Por que não escolho a unidade ao adicionar um componente?**
Porque a unidade segue o cadastro do insumo (unidade-base) ou o rendimento do preparo. Você informa só a quantidade, evitando divergência de unidade.

**Qual a diferença entre a aba Produção e a Finalização?**
Produção = preparos internos (podem virar componente de outras fichas). Finalização = itens do cardápio, que têm código de venda (ContaHub/Yuzer) e entram no CMV teórico.

**O que é o multiplicador "Porção"?**
Quantas unidades da ficha compõem a porção vendida. A ficha é por 1 unidade; se a porção vendida tem N, o Custo Total (base do CMV) é custo unitário × N. Ex.: Mega Coxinha 5×.

**Vinculei duas fichas por engano. Como desfaço?**
Abra a ficha e clique em "desvincular esta". Ela deixa de sincronizar com as outras; se sobrar só uma no grupo, o grupo é desfeito.

**Agrupei um produto (mesma ficha) e a ficha não apareceu / aparece como "sem ficha". Por quê?**
O produto agrupado **usa a ficha do principal** — a tela mostra essa ficha (com o aviso roxo "usa a ficha de X"), e ele **não** deve contar como sem ficha. Se estiver aparecendo o valor antigo/vazio, é só **recarregar** a tela: o agrupar recalcula o CMV na hora, mas a aba "Por período" do CMV Teórico lê uma matview que atualiza no cron — use a aba **Cardápio** (ao vivo) ou o botão **Recalcular**.

**Qual a diferença entre "agrupar (mesma ficha)" e "vincular réplica"?**
*Agrupar* deixa **uma ficha só** (a do principal) e cada código mantém seu preço/CMV — é o recomendado, some a duplicata. *Vincular réplica* **copia** a receita para cada item (fichas separadas, iguais só no momento do vínculo). A Dose Dupla nunca se agrupa (leva o dobro de insumo → é outra receita).

**Um produto vende no ContaHub mas o CMV não aparece. Por quê?**
Provavelmente falta o **Cód. CH** (de-para) ou a ficha está vazia. Verifique o badge "vendeu sem cadastro" e "sem cód CH" e use "editar códigos".

## Fonte dos dados

- **`producao_base`** — cadastro das produções (preparos): código, nome, unidade, rendimento, unidade/fator de contagem, flags (curva A, controle, entra contagem, decompor).
- **`produto_cardapio`** — cadastro dos produtos (finalização): código, nome, categoria, ativo, agrupamento, multiplicador.
- **`producao_ficha_item`** — os componentes de cada ficha (insumo ou produção), quantidade, FC, insumo mestre e grupo de fichas vinculadas.
- **`silver.insumo_catalogo`** — nome canônico, unidade-base/embalagem e **preço da última compra** dos insumos (origem VMarket / compras).
- **`produto_contahub_map`** — de-para do produto para o código do ContaHub (`prd`) e preço de venda do cardápio.
- **`produto_yuzer_map`** / **`gold.produto_preco_yuzer`** — de-para e preço de venda no Yuzer.
- **`v_produto_ficha_count`** — contagem de itens da ficha por produto.
- **`gold.v_ficha_item_zerado`** — fichas com componente sem preço (R$0).
- **`gold.fn_cmv_media_categoria`** — média de CMV teórico por categoria (90 dias), usada no comparativo.
- **`operations.fn_vendas_sem_cadastro`** — itens vendidos no ContaHub (30 dias) sem produto cadastrado no Zykor.

Integrações de origem: **VMarket / Compras** (preço dos insumos), **ContaHub** (status, preço de venda, vendas sem cadastro), **Yuzer** (preço/venda em eventos) e **Google Sheets** (planilha mestre de importação inicial).
