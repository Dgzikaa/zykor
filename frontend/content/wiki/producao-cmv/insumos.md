---
title: Insumos
area: producao-cmv
slug: insumos
route: /operacional/insumos
description: Cadastro mestre de insumos do bar (1 nome por insumo), com preço da última compra, variação de preço, curva ABC e impacto de variação no CMV.
order: 60
icon: Package
---

# Insumos

## Visão geral

A tela **Insumos** é o cadastro mestre de tudo o que o bar compra e usa como matéria-prima — a "lista oficial" de insumos do Zykor, com **um nome por insumo** (uma linha só, sem duplicar o mesmo item que aparece em várias compras). É a base sobre a qual todo o resto do módulo de Produção/CMV se apoia: fichas técnicas, contagem de estoque, desvios de consumo, plano de compras e CMV teórico.

Cada insumo tem um código único no padrão `i0XXX` (ex.: `i0084`). Esse código é a "chave" que amarra o insumo às fichas técnicas, às compras do VMarket e à contagem de estoque.

A tela junta duas coisas que na prática vinham separadas:
- **O cadastro do Zykor** (o que a operação define como insumo, sua unidade, se é curva A, etc.).
- **O preço real de compra**, que chega automaticamente do **VMarket** (sistema de cotação/compras) e alimenta o preço de cada insumo sem ninguém digitar.

Quem usa no dia a dia: o time de **compras e produção** (para manter o cadastro limpo, vincular o que foi comprado, e marcar curva A), e a **gestão** (para acompanhar variação de preço, curva ABC e impacto das variações no CMV).

## Como acessar

Menu lateral: **Operacional → Insumos** (rota `/operacional/insumos`).

A tela tem **guard de permissão** pelo módulo `/operacional/insumos`. O que você pode fazer depende do seu nível:
- **Ver** a tela (leitura) — todos com acesso ao módulo.
- **Adicionar insumo** — só quem tem permissão de inserir.
- **Editar / marcar FC / marcar curva A** — só quem tem permissão de editar.
- **Excluir insumo** — só quem tem permissão de excluir.

Quem tem acesso somente leitura vê um selo **"Somente leitura"** no topo, e os botões de criar/editar/excluir ficam ocultos.

Todas as queries filtram por **bar_id** (o bar selecionado no seletor de bar do topo). O cadastro é independente por bar — o mesmo código `i0XXX` pode existir em bares diferentes representando insumos diferentes.

## Passo a passo

### Buscar e filtrar um insumo
1. Abra a aba **Insumos** (é a aba inicial).
2. Digite no campo de busca por **nome, código (i0XXX), seção ou fornecedor**.
3. Opcional: use o seletor **"Todas as seções"** para restringir a um Local de Contagem.
4. Opcional: clique nos badges coloridos (sem ficha técnica, curva A, curva A proteína) para filtrar só esses.
5. Opcional: clique no cabeçalho de qualquer coluna com ícone de funil (Local de Contagem, Seção VMarket, FC, Unid., Embalagem, Fornecedor) e marque os valores que quer ver — estilo filtro do Excel.

### Sincronizar as compras do VMarket
1. Clique em **"Sincronizar compras"** (canto superior direito).
2. O sistema busca as compras novas no VMarket, atualiza os preços e reconcilia os códigos (de-para).
3. Ao terminar, os preços da coluna **"Preço (últ.)"** e a lista de "comprados sem cadastro" ficam atualizados. A data do último sync aparece no subtítulo da tela.

### Cadastrar um insumo do zero
1. Clique em **"Adicionar insumo"**.
2. O campo **Código** já vem pré-preenchido com o próximo da sequência (maior `i0XXX` + 1). Ajuste se precisar — tem que ser `i` + números.
3. Preencha **Nome** (obrigatório), **Seção** (Local de Contagem), **Unidade** (g/ml/un), **Embalagem** (conversão da unidade de compra para a unidade da ficha) e **Preço** inicial.
4. Marque **FC** se o insumo tem perda/limpeza (fator de correção).
5. Clique em **Cadastrar**. Se já existir um insumo ativo com o mesmo nome, o sistema avisa e sugere usar o código existente.

### Vincular / cadastrar um item comprado sem cadastro
Quando você comprou algo no VMarket que ainda não existe no cadastro Zykor, aparece uma faixa roxa: **"N comprado(s) no VMarket sem cadastro no Zykor"**.
1. Clique na faixa roxa para ver a lista.
2. Clique no nome do item para expandir e ver o histórico de compras dele.
3. Escolha uma de duas ações:
   - **vincular** — se o insumo **já existe** no cadastro: busque pelo nome ou código e clique nele. A compra passa a apontar para esse insumo.
   - **cadastrar** — se é um insumo **novo**: abre o modal de cadastro já preenchido com nome, código interno e preço da compra. Revise e salve.

### Editar um insumo
1. Clique no ícone de **lápis** na linha do insumo (precisa de permissão de editar).
2. Você pode alterar: **Código** (corrige de-para errado e renomeia em cascata nas fichas/compras/unidade), **Nome**, **Local de Contagem**, **Seção VMarket (compra)**, **FC**, **Curva A**, **Curva A Proteína**, **Unidade** (g/ml/un), **Embalagem** e **"Conta em"** (rótulo da contagem, ex.: garrafa).
3. Clique em **Salvar**. O CMV teórico é recalculado na hora.

### Marcar FC direto na tabela
Na coluna **FC**, clique no traço/✓ para ligar/desligar o fator de correção sem abrir o modal (salva na hora).

### Excluir um insumo
1. Clique no ícone de **lixeira** (só aparece se o insumo **não** estiver em ficha técnica **nem** tiver compra vinculada — caso contrário fica cinza/bloqueado).
2. Confirme. O insumo sai do cadastro; as compras do VMarket permanecem, mas desvinculadas.

### Ver as fichas que usam um insumo
Clique no ícone de **talher** (garfo/faca) ao lado do nome. Abre um modal listando os produtos e produções (fichas técnicas) que usam aquele insumo e a quantidade em cada um. Se o ícone estiver **vermelho**, o insumo não está em nenhuma ficha.

## Abas e seções

A tela tem **4 abas**:

### 1. Insumos
O cadastro em si (tabela 1 linha por insumo). Inclui a faixa de "comprados sem cadastro" e os filtros/badges. É onde se cria, edita e exclui.

### 2. Variação de Preço
Lista cada insumo com o **último preço de compra** contra o **preço anterior**, e a variação percentual — ordenada pela maior variação (em módulo). Clicando na linha, abre a **série histórica** de preços daquele insumo. A **"compra 0"** (marcada em vermelho) é o preço da planilha original; as demais são as compras reais do VMarket. Materiais de limpeza, descartáveis e "outros" (tabaco, impostos, frete) são excluídos por não serem insumos de fato.

### 3. Curva ABC
Aplica o princípio de Pareto sobre o **custo teórico** dos insumos consumidos no período escolhido (7/30/60/90 dias). Divide em três classes: **A** (os que somam até 80% do custo), **B** (de 80% a 95%) e **C** (o resto). Mostra 3 cards de resumo (quantos insumos e quanto de custo em cada classe) e a tabela detalhada com custo teórico, % do total e % acumulado.

### 4. Impacto de Variação
Cruza os insumos que **mudaram de preço** (variação ≥ 1%) com os **produtos do cardápio** que os usam, estimando o impacto no CMV de cada produto. Clicando no insumo, abre a lista de produtos afetados com o delta de custo por unidade, o CMV atual e o delta em pontos percentuais (Δ pp).

## Colunas e cálculos

### Aba Insumos — tabela principal

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Código | Código único do insumo (`i0XXX`) | Direto do cadastro | `operations.insumos.codigo` |
| Insumo | Nome do insumo + ícones (talher = ficha; A = curva A; P = curva A proteína) | Nome direto; ícone talher fica vermelho se o código não estiver em nenhuma ficha do bar | `operations.insumos.nome`; ficha via `operations.fn_insumos_em_ficha` |
| Local de Contagem | Categoria da planilha de contagem (usada só na hora de contar o estoque) | Direto do cadastro | `operations.insumos.categoria` |
| Seção VMarket | Categoria de **compra** do insumo (de-para do VMarket) | `COALESCE(override manual, seção derivada do de-para VMarket)` | `silver.insumo_catalogo.secao_vmarket` (de `bronze_vmarket_produtos.nome_secao`) |
| FC | Se o insumo tem fator de correção (perda/limpeza) | Booleano do cadastro; editável direto na célula | `operations.insumos.fator_correcao` |
| Unid. | Unidade da ficha técnica (g/ml/un) | `base` da unidade cadastrada; se não houver, é derivada do nome/unidade_medida | `insumo_unidade.base` / `deriveUnid()` |
| Embalagem | Conversão da unidade de compra para a unidade da ficha (ex.: 1 pacote = 1000 g) | `embalagem` da unidade cadastrada, ou derivada | `insumo_unidade.embalagem` |
| Preço (últ.) | Último preço unitário do insumo + selo de origem + seta de tendência | `COALESCE(preço da última compra VMarket, custo do cadastro se > 0)`. Selo **VMarket** = veio de compra; **cadastro** = ainda sem compra. Seta ↑ vermelha se preço atual > anterior; ↓ verde se caiu | `silver.insumo_catalogo.preco` / `.preco_anterior` (de `gold.vmarket_insumo_preco`) |
| Fornecedor | Fornecedor da última compra | Fornecedor da última compra VMarket; se sem compra, exibe "Planilha" | `silver.insumo_catalogo.fornecedor` |
| (ações) | Editar (lápis) e Excluir (lixeira) | Excluir bloqueado se `tem_ficha` ou `tem_compra` | — |

### Faixa "comprados sem cadastro" / tabela de sem cadastro

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Comprado no VMarket | Nome do item comprado que não tem cadastro Zykor | Direto | `silver.insumo_sem_cadastro.nome` |
| Cód. interno | Código interno cadastrado na compra do VMarket (mesmo que errado) | Direto | `insumo_sem_cadastro.cod_interno` |
| Seção | Seção do VMarket do item | Direto | `insumo_sem_cadastro.nome_secao` |
| Última compra | Último preço + data | Direto | `insumo_sem_cadastro.preco` / `.preco_data` |
| Fornecedor | Fornecedor | Direto | `insumo_sem_cadastro.fornecedor` |

**Detalhe de compras (ao expandir um item):** Data, Pedido (#id), Status, Qtd (+ gramatura), Preço, Total, Fornecedor — vindos de `gold.vmarket_pedido_item` + `gold.vmarket_pedido`, ordenados da compra mais recente para a mais antiga.

### Aba Variação de Preço

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Insumo | Nome + código planilha | Direto | `gold.insumo_preco_variacao.nome` |
| Seção | Seção do VMarket | Direto | `.secao` |
| Preço anterior | Preço da penúltima "compra" da série | 2ª posição da série (por ordem/data) | `.preco_anterior` |
| Preço atual | Último preço da série | 1ª posição da série | `.preco_atual` |
| Variação | Variação % do atual sobre o anterior | `(preço_atual − preço_anterior) / preço_anterior × 100`, arredondado a 2 casas. Vermelho se > +0,5%; verde se < −0,5% | `.var_pct` |

**Série histórica (ao expandir):** cada linha é uma compra. A **Compra 0 · planilha** é o preço original da planilha (`custo_unitario` do cadastro); as demais são compras do VMarket (`gold.vmarket_insumo_preco_hist`). A coluna **Var.** de cada linha compara aquela compra com a imediatamente anterior da série.

### Aba Curva ABC

Cards de resumo (por classe A/B/C): **nº de insumos** e **custo total** da classe.

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Classe | A, B ou C | Pareto do custo acumulado: até 80% = A; até 95% = B; resto = C | `gold.fn_curva_abc_insumos` |
| Cód. | Código do insumo | Direto | `operations.insumos.codigo` |
| Insumo | Nome | Direto | `operations.insumos.nome` |
| Custo teórico | Custo teórico do insumo no período | `quantidade teórica consumida × custo unitário` | `silver.consumo_teorico_insumo_dia.qtd_teorica × gold.insumo_custo_un.custo_un` |
| % do total | Peso do insumo no custo total | `custo_total ÷ soma de todos × 100` | idem |
| % acum. | Percentual acumulado (ordenado do maior custo para o menor) | Soma corrida do % do total | idem |

### Aba Impacto de Variação

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Insumo | Nome + código | Direto | `gold.fn_impacto_variacao` |
| Variação | Variação % do preço do insumo | Só insumos com \|var_pct\| ≥ 1% | `gold.insumo_preco_variacao.var_pct` |
| Produtos afetados | Quantos produtos do cardápio usam esse insumo | Contagem dos produtos em `silver.insumo_por_produto` | `silver.insumo_por_produto` |
| Δ custo/un (por produto) | Quanto o custo do produto muda por unidade | `qtd_por_produto × custo_un × (var_pct/100) / (1 + var_pct/100)` — o incremento de custo atribuível à variação | `silver.insumo_por_produto × gold.insumo_custo_un` |
| CMV atual (por produto) | CMV % atual do produto | Direto | `gold.produto_cmv.cmv_pct` |
| Δ CMV (Δ pp) | Impacto estimado no CMV do produto, em pontos percentuais | `Δ custo/un ÷ preço de venda × 100` | `gold.produto_cmv.preco_venda` |

### Modal "Fichas com [insumo]"

| Coluna | O que mostra | Fonte |
|---|---|---|
| Tipo | Produção ou Produto | `fn_insumo_fichas` |
| Cód. | Código da ficha | idem |
| Ficha | Nome da ficha/produto | idem |
| Qtd | Quantidade do insumo naquela ficha | idem |

## Filtros e opções

- **Seletor de bar** (topo global): tudo é filtrado por `bar_id`. Trocar de bar recarrega o cadastro daquele bar.
- **Busca livre** (aba Insumos): filtra por nome, código, seção (Local de Contagem) ou fornecedor.
- **Seletor de seções**: restringe a um Local de Contagem específico.
- **Badges de topo** (clicáveis, funcionam como filtro):
  - **N insumos** — total (ou "filtrados/total" quando há filtro de coluna ativo).
  - **N sem ficha técnica** — insumos que não estão em nenhuma ficha (inclui itens parados que não precisam de ficha).
  - **N curva A** — marcados como curva A (contagem diária).
  - **N curva A proteína** — marcados como curva A proteína.
- **Filtros por coluna** (ícone de funil no cabeçalho): Local de Contagem, Seção VMarket, FC, Unid., Embalagem e Fornecedor — escolha múltiplos valores; as opções mostram a contagem de itens e respeitam os outros filtros já aplicados.
- **Faixa roxa "sem cadastro"**: alterna entre a tabela de insumos e a lista de comprados sem cadastro.
- **Período (aba Curva ABC)**: 7, 30, 60 ou 90 dias.
- **Busca (aba Variação)**: por nome, código ou seção.

## Regras e detalhes importantes

- **Um insumo = uma linha.** O cadastro Zykor é 1:1 por nome/código. As compras do VMarket (que podem ter vários SKUs para o mesmo item) só alimentam o **preço**, via camada silver — não viram linhas novas na tela.
- **Filtragem por bar sempre.** O mesmo código `i0XXX` é reusado entre bares para insumos diferentes; por isso "está em ficha" e "tem compra" são checados **por bar**, e a exclusão nunca bloqueia por ficha de outro bar.
- **Preço: compra vence cadastro.** O preço exibido é o da última compra VMarket; só cai para o custo do cadastro (selo "cadastro") quando ainda não há compra. Um preço zero no cadastro é ignorado.
- **Local de Contagem × Seção VMarket** são coisas diferentes: o primeiro é a categoria da planilha de contagem (só serve para contar estoque); o segundo é a categoria de **compra**, derivada do de-para do VMarket. Quando um insumo cai em duas seções VMarket, o sistema pega uma (ordem alfabética) e você fixa a correta no editar (**override manual**).
- **"Conta em" é só rótulo.** O texto (ex.: garrafa) aparece na Contagem e no Desvios, mas **quem converte a unidade é a Embalagem** — não há um segundo fator para não divergir.
- **Curva A** liga o insumo na **contagem diária** (além da semanal e mensal). Ao marcar/desmarcar, a frequência registrada muda para `diaria`/`semanal`. Se a frequência registrada divergir, a tela mostra uma sugestão.
- **Curva A Proteína** entra no **desvio diário de proteínas** (compra VMarket × usado em produção).
- **Troca de código renomeia em cascata** (cadastro, fichas, de-para VMarket, unidade) via `fn_renomear_insumo_codigo`. Não pode colidir com código já existente.
- **Exclusão é protegida:** só é possível se o insumo não estiver em ficha nem tiver compra vinculada. Ao excluir, as compras do VMarket são apenas **desvinculadas** (o bronze não é apagado).
- **CMV teórico recalculado na hora:** toda edição/criação/exclusão/sync roda `recalcCmvTeorico` para o bar, para a tela refletir sem depender do botão de recálculo.
- **Materiais fora da variação:** limpeza, descartáveis e "outros" (tabaco, impostos, frete) são excluídos da aba Variação por não serem insumos.
- **Estados vazios:** "Nenhum insumo." (tabela filtrada vazia); "Sem consumo teórico no período (precisa de ficha + vendas)." (ABC); "Nenhuma variação de preço relevante." (Impacto); "Tudo cadastrado 🎉" (sem itens sem cadastro).

## Dúvidas frequentes

**Por que o preço aparece com o selo "cadastro" e não "VMarket"?**
Porque ainda não houve nenhuma compra desse insumo no VMarket. O preço mostrado é o custo inicial do cadastro. Assim que uma compra entrar (e você sincronizar), passa a exibir o preço real com o selo "VMarket".

**Comprei um item, mas ele não aparece na lista de insumos. Onde está?**
Ele provavelmente está na faixa roxa **"comprado no VMarket sem cadastro no Zykor"**. Clique na faixa e escolha **vincular** (se o insumo já existe) ou **cadastrar** (se é novo).

**Qual a diferença entre "Local de Contagem" e "Seção VMarket"?**
Local de Contagem é a categoria da planilha de contagem de estoque (só serve para contar). Seção VMarket é a categoria de compra, que vem do VMarket. Um item pode ser contado em um lugar e comprado em outra seção.

**O que significa o ícone de talher vermelho ao lado do nome?**
Que o insumo **não está em nenhuma ficha técnica** do bar. Pode ser um item parado (que não precisa de ficha) ou um insumo que ainda falta cadastrar em alguma receita.

**Marquei Curva A. O que muda?**
O insumo passa a entrar na **contagem diária** de estoque (além da semanal e mensal), o que é usado para acompanhar de perto itens de maior peso/risco.

**Editei o preço/embalagem e o CMV não muda?**
Ele muda: toda edição de insumo dispara o recálculo do CMV teórico automaticamente. Se não refletiu na hora, recarregue a tela de CMV — a origem do cálculo já foi atualizada.

## Fonte dos dados

- **`silver.insumo_catalogo`** — view que junta o cadastro (`operations.insumos`) com o último preço de compra (`gold.vmarket_insumo_preco`), a unidade (`public.insumo_unidade`) e a seção VMarket derivada do de-para (`bronze_vmarket_produtos`). É a fonte da tabela principal.
- **`operations.insumos`** — cadastro mestre (código, nome, categoria, FC, curva A/proteína, frequência, unidade_contagem/fator_contagem).
- **`silver.insumo_sem_cadastro`** — itens comprados no VMarket sem cadastro Zykor.
- **`operations.fn_insumos_em_ficha`** / **`fn_insumo_fichas`** — quais insumos estão em fichas e quais fichas usam um insumo.
- **`gold.insumo_preco_serie`** / **`gold.insumo_preco_variacao`** — série histórica e variação de preço (compra 0 = planilha; demais = VMarket).
- **`gold.fn_curva_abc_insumos`** — curva ABC sobre `silver.consumo_teorico_insumo_dia` × `gold.insumo_custo_un`.
- **`gold.fn_impacto_variacao`** — impacto da variação de preço, cruzando `silver.insumo_por_produto`, `public.produto_cardapio`, `gold.insumo_custo_un` e `gold.produto_cmv`.
- **`gold.vmarket_pedido`** / **`gold.vmarket_pedido_item`** — detalhe das compras (pedidos VMarket).
- **`bronze_vmarket_produtos`** / **`bronze_vmarket_secoes`** — dados brutos de produtos e seções do VMarket.
- **Ações de escrita** (criar/editar/vincular/excluir/sync) via `POST /api/operacional/insumos`, com `fn_renomear_insumo_codigo`, `fn_vmarket_sync`, `fn_vmarket_seed_unidades` e `fn_vmarket_reconciliar_codigos`.

**Integração de origem dos preços/compras:** **VMarket** (sistema de cotação/compras). O preço inicial de cada insumo vem da planilha mestre de cadastro; a partir daí, as compras reais do VMarket assumem o preço.
