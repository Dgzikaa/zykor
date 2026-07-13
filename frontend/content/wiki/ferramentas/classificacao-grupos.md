---
title: Classificação de Grupos (Mix)
area: ferramentas
slug: classificacao-grupos
route: /ferramentas/consumos-classificacao
description: Tela onde você define se cada grupo do cardápio conta como Bebida, Drink, Comida ou Outros — é o que monta a cesta/mix de vendas do bar.
order: 50
icon: Tag
---

# Classificação de Grupos (Mix)

## Visão geral

A tela **Classificação de Grupos (Mix)** é onde você diz ao Zykor **em qual categoria da cesta cada grupo do cardápio se encaixa**: **Bebida**, **Drink**, **Comida** ou **Outros**.

No ContaHub, todo produto vendido pertence a um **grupo** (por exemplo "Cervejas", "Drinks Clássicos", "Petiscos", "Pegue e Pague"). O Zykor precisa saber a que categoria cada grupo pertence para montar o **mix de vendas** — a divisão do faturamento entre bebida, drink e comida que aparece em telas de desempenho, planejamento e cesta por evento. Sem essa classificação, o grupo simplesmente **não entra na cesta**.

O modelo é um **de-para simples por bar**: um grupo → uma categoria. A tela lista todos os grupos que o bar vendeu nos **últimos 180 dias**, mostra os que ainda estão **sem classificação** no topo (para você resolver primeiro) e os já **classificados** logo abaixo (para conferir ou trocar). Cada clique já grava — não há botão "salvar em lote".

Quem usa no dia a dia: dono e gestão, geralmente quando a operação cria um grupo novo no cardápio ou quando um grupo aparece marcado como pendente.

## Como acessar

- Menu lateral: **Ferramentas → Classificação de Grupos (Mix)** (ícone de etiqueta / `Tag`).
- Rota: `/ferramentas/consumos-classificacao`.
- Permissão necessária: módulo **`gestao`**. Sem essa permissão o item não aparece no menu e a rota é bloqueada. A gravação (POST) também exige usuário autenticado.

## Passo a passo

### Classificar um grupo pendente

1. Selecione o **bar** no seletor do topo. A tela sempre trabalha com um bar por vez — a classificação de um bar não afeta o outro.
2. Aguarde a lista carregar. O cartão **"Sem classificação"** (borda âmbar, no topo) reúne os grupos que ainda não entram na cesta.
3. Localize o grupo. Abaixo do nome aparecem o **volume em R$** e a **quantidade de itens** vendidos nos últimos 180 dias — isso ajuda a priorizar (grupos com mais volume aparecem primeiro).
4. Clique em um dos quatro botões à direita: **Bebida**, **Drink**, **Comida** ou **Outros**.
5. Pronto: o Zykor grava na hora, mostra uma confirmação ("Grupo → Categoria") e o grupo **sai do bloco pendente e desce para "Classificados"**.

### Reclassificar (corrigir) um grupo já classificado

1. No cartão **"Classificados"**, encontre o grupo.
2. O botão da categoria atual aparece **destacado com cor cheia**.
3. Clique em outra categoria. A troca é imediata e sobrescreve a anterior.

### Atualizar a lista

- Clique em **Atualizar** (ícone de seta circular) no canto superior direito para recarregar os grupos e os volumes do bar selecionado. Útil depois que a operação cadastra um grupo novo no ContaHub ou quando você acabou de trocar de bar.

## Abas e seções

A tela não tem abas. Ela é dividida em **dois blocos** (cartões), sempre visíveis:

| Bloco | O que reúne |
|---|---|
| **Sem classificação** | Grupos vendidos nos últimos 180 dias que ainda **não têm categoria**. Contam com o número entre parênteses no título. **Não entram na cesta/mix** até serem classificados. Quando não há nenhum pendente, aparece "Tudo classificado 🎉". |
| **Classificados** | Grupos que já têm categoria (Bebida / Drink / Comida / Outros). O botão da categoria atual fica destacado. Clicável a qualquer momento para reclassificar. |

## Colunas e cálculos

Cada linha da tela representa um **grupo do cardápio** do bar. Os números vêm da função `get_grupos_classificacao(bar)`, que soma as vendas de `silver.vendas_item` dos últimos 180 dias e cruza com a tabela de-para de categorias.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Grupo** | Nome do grupo do cardápio (ex.: "Cervejas", "Drinks", "Petiscos") | Valor de `grupo_desc` das vendas, agrupado por nome | `silver.vendas_item.grupo_desc` |
| **Volume (R$)** | Faturamento do grupo nos últimos 180 dias, exibido como moeda arredondada (sem centavos) | `SUM(valor)` das vendas do grupo com `data_venda >= hoje − 180 dias`, filtrado por `bar_id` | `silver.vendas_item.valor` |
| **Itens** | Quantidade de itens/registros de venda do grupo no mesmo período | `COUNT(*)` das linhas de venda do grupo (rótulo "itens (180d)") | `silver.vendas_item` |
| **Categoria atual** | Qual categoria da cesta o grupo tem hoje (botão destacado): Bebida, Drink, Comida ou Outros | Vem do de-para `grupo_categoria_classificacao` (join por `bar_id` + `grupo_desc`). Se não houver registro, fica **NULL** | `grupo_categoria_classificacao.categoria` |
| **Pendente** | Se o grupo está sem classificação (vai para o bloco âmbar do topo) | `categoria IS NULL` — ou seja, não existe linha no de-para para aquele grupo naquele bar | derivado de `grupo_categoria_classificacao` |

**Ordenação da lista:** pendentes primeiro (`categoria IS NULL` em ordem decrescente) e, dentro de cada bloco, do **maior para o menor volume**. Assim os grupos sem classificação e com mais peso no faturamento aparecem no topo.

**Ação de classificar (botão):** grava via `set_grupo_categoria(bar, grupo, categoria)`, que faz um **upsert** na tabela `grupo_categoria_classificacao` (chave única `bar_id` + `grupo_desc`). Se o grupo já tinha categoria, ela é **sobrescrita**; guarda também quem alterou e a data/hora. As únicas categorias aceitas são `BEBIDA`, `DRINK`, `COMIDA` e `OUTROS` — qualquer outro valor é rejeitado.

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| **Seletor de bar** (topo) | Define de qual bar são os grupos e volumes. A classificação é **por bar** — o mesmo nome de grupo pode ter categorias diferentes em bares diferentes. |
| **Janela de 180 dias** | Fixa (não editável). Só aparecem grupos que tiveram alguma venda nos últimos 180 dias. Grupos "mortos" há mais tempo somem da lista. |
| **Botões de categoria** (Bebida / Drink / Comida / Outros) | Cada clique grava a categoria do grupo na hora. Não existe filtro por categoria nem seleção múltipla. |
| **Atualizar** | Recarrega a lista e recalcula volumes/itens. |

## Regras e detalhes importantes

- **Sempre por `bar_id`.** Toda leitura e gravação é filtrada pelo bar selecionado. Classificar um grupo no Ordinário não muda o Deboche, e vice-versa.
- **"Outros" não entra na cesta.** Classificar um grupo como **Outros** é uma forma explícita de deixá-lo **fora do mix** (ex.: taxas, ingressos, itens que não são consumo). É diferente de "pendente": Outros é uma decisão registrada; pendente é falta de decisão.
- **Pendente = fora da cesta.** Enquanto um grupo estiver sem classificação, o volume dele **não é contabilizado** na divisão bebida/drink/comida das telas de mix/cesta.
- **Grupos mistos ficam pendentes de propósito.** Grupos que misturam categorias (ex.: "Pegue e Pague", "Happy Hour", "Grupo Adicional") **não** foram pré-classificados. A decisão de negócio é a operação **separá-los no ContaHub** (ex.: "Pegue e Pague Drinks", "HH Comidas") para cada pedaço cair na categoria certa. Até isso acontecer, eles aparecem como pendentes e não entram na cesta — não há "chute" por local.
- **Data de corte (passado × futuro).** A classificação por grupo vale para vendas a partir da **data de corte** do mix (padrão **16/06/2026**). Vendas **anteriores** ao corte continuam classificadas pelo modelo antigo (por **local** de venda), e o histórico já gravado **não é reprocessado**. Ou seja: esta tela influencia o mix **daqui pra frente**; correções pontuais do passado são feitas fora da tela, direto no dado.
- **Onde a classificação é usada.** O de-para alimenta `silver.contahub_produto_hora.categoria_mix` e a cesta por evento (`evento_cesta_detalhe`) — grupos pendentes entram lá como "sem_classificacao". As telas de desempenho e planejamento leem a cesta a partir daí.
- **Gravação é imediata e manual.** Não há automação que classifique grupos sozinha — a categoria é sempre uma escolha humana. Cada clique é uma gravação independente; não há desfazer além de reclassificar.
- **Volumes arredondados.** O valor exibido é formatado como moeda **sem centavos** (só para leitura/priorização); o cálculo interno usa o valor cheio.

## Dúvidas frequentes

**Um grupo novo apareceu no topo, em "Sem classificação". O que faço?**
Clique na categoria correta (Bebida, Drink, Comida ou Outros). Ele desce para "Classificados" e passa a contar no mix a partir das vendas após a data de corte.

**Classifiquei errado. Dá para corrigir?**
Sim. Encontre o grupo em "Classificados" e clique em outra categoria — a troca sobrescreve na hora.

**Por que "Pegue e Pague" (ou "Happy Hour") continua pendente?**
Porque é um grupo misto (tem bebida, drink e comida juntos). A recomendação é a operação separar esse grupo em subgrupos no ContaHub. Classificá-lo inteiro em uma só categoria distorceria o mix.

**Classifiquei o grupo, mas o mix de um evento antigo não mudou. É bug?**
Não. A classificação por grupo vale a partir da data de corte (padrão 16/06/2026). Vendas anteriores mantêm a classificação antiga (por local) e não são reprocessadas.

**Qual a diferença entre "Outros" e deixar pendente?**
"Outros" é uma decisão registrada de que o grupo **não é consumo** e fica fora da cesta. Pendente é a **ausência** de decisão — o grupo também fica fora, mas continua pedindo classificação no topo da tela.

**Por que só aparecem alguns grupos?**
A lista mostra apenas grupos com vendas nos **últimos 180 dias** no bar selecionado. Grupos sem movimento recente não aparecem.

## Fonte dos dados

- **`silver.vendas_item`** — base de vendas (origem **ContaHub**), usada para somar volume (`valor`), contar itens e listar os grupos (`grupo_desc`) dos últimos 180 dias.
- **`public.grupo_categoria_classificacao`** — tabela de-para (`bar_id`, `grupo_desc`) → categoria (BEBIDA / DRINK / COMIDA / OUTROS), com quem alterou e quando. É o que a tela lê e grava.
- **`get_grupos_classificacao(bar)`** — função SQL que junta vendas + de-para e devolve a lista com volume, itens e flag de pendente.
- **`set_grupo_categoria(bar, grupo, categoria, por)`** — função SQL de upsert acionada a cada clique.
- **`map_categoria_mix_grupo(bar, grupo)`** — função que resolve a categoria de um grupo; usada pelo pipeline do mix (`silver.contahub_produto_hora.categoria_mix`, `evento_cesta_detalhe`) a partir da data de corte.
- **API:** `GET`/`POST` em `/api/grupos-classificacao`.
