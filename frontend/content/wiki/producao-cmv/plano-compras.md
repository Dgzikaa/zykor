---
title: Planejamento de Compras
area: producao-cmv
slug: plano-compras
route: /operacional/plano-compras
description: Gera a sugestão semanal de compra por insumo cruzando ponto de ressuprimento, estoque contado e necessidade da produção planejada.
order: 110
icon: ShoppingCart
---

# Planejamento de Compras

## Visão geral

A tela de **Planejamento de Compras** transforma o histórico de consumo, o estoque contado e o que foi decidido no Planejamento da Produção em uma **lista de compra pronta por insumo**, já convertida em número de embalagens (latas, garrafas, pacotes) — que é como se compra de fato no fornecedor.

A ideia central, validada com o sócio, é simples: para cada insumo o sistema calcula um **Ponto de Ressuprimento (PR)** — o nível de estoque que a operação precisa manter para não faltar — e compara com o que já existe em estoque e com o que a produção planejada vai consumir. A conta final é:

> **Sugestão de Compra = Ponto de Ressuprimento − Estoque + Necessidade da Produção**

O resultado é arredondado para cima em número de embalagens. Se der zero ou negativo (já tem estoque suficiente), o item entra como "Não comprar".

Quem usa: sócios e gestores de compras/estoque, tipicamente uma vez por semana, logo após a contagem de estoque e depois de fechar o Planejamento da Produção da semana.

## Como acessar

No menu lateral: **Operacional → Planejamento de Compras** (ícone de carrinho).

Rota direta: `/operacional/plano-compras`.

**Permissão necessária:** módulo `gestao`. Sem essa permissão a página não aparece no menu e o acesso é bloqueado. A tela sempre trabalha sobre o bar selecionado no topo (filtragem por `bar_id`).

## Passo a passo

**1. Escolher a semana de planejamento**

No topo, a etiqueta verde "Semana" abre um seletor. Cada opção mostra o intervalo (segunda a domingo). O sistema lista as semanas que **já têm contagem de estoque**; a semana seguinte aparece marcada como "(aguardando contagem)" e fica bloqueada até você contar o estoque daquela semana. Ao trocar de semana, toda a lista recalcula.

**2. Conferir o resumo**

Logo abaixo, três cartões dão o panorama: quantos insumos precisam ser comprados, o custo estimado total e quantos insumos estão na lista filtrada.

**3. Verificar se a produção está encerrada**

Se aparecer o aviso âmbar "Produção não encerrada nesta semana", significa que a coluna **p/ Produção** virá zerada — o elo com o Planejamento da Produção só é preenchido depois que você **encerra** o plano de produção daquela mesma semana. Encerre o plano de produção primeiro para a compra considerar os preparos.

**4. Filtrar a lista**

Use a busca por nome/código, o seletor de **Seção (VMarket)**, o selo **Só Curva A** e os botões **Todos / Comprar / Não comprar** para focar no que interessa (ver "Filtros e opções").

**5. Ajustar o nível de serviço de um insumo (opcional)**

Na coluna **Nível de Serviço** de cada linha há um seletor de percentual (50% a 99,9%). Quanto maior o nível, maior a margem de segurança e, portanto, maior o Ponto de Ressuprimento e a sugestão de compra. Ao trocar o valor, a linha recalcula na hora (PR, sugestão, comprar/não comprar) e a escolha fica **salva** para aquele insumo daquele bar — vale para as próximas semanas até você mudar de novo. O padrão de quem nunca configurou é **95%**.

**6. Abrir o detalhe das 6 semanas (opcional)**

Clique na seta ao lado do número em **Média 6s** para expandir a linha e ver o uso direto semana a semana, com o peso de cada semana (×1 a ×6), e conferir como a média foi formada.

**7. Comprar e conferir a finalização**

Leve a lista para o fornecedor / VMarket. A coluna **Comprado** mostra o que já entrou de compra no VMarket naquela semana — serve para você acompanhar a "finalização" do planejamento (o que já foi efetivamente pedido).

O botão **Atualizar** (canto superior direito) recarrega os dados a qualquer momento.

## Colunas e cálculos

Todos os números da tabela são exibidos em **número de embalagens** (unidade de compra). Internamente o cálculo é feito na unidade-base do insumo (ml, g ou unidade) e dividido pelo tamanho da embalagem só na exibição. O tamanho da embalagem aparece abaixo do nome do insumo.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Insumo** | Nome, código, selo "A" se for Curva A, seção VMarket e tamanho da embalagem | Cadastro do insumo + catálogo de unidade | `operations.insumos`, `silver.insumo_catalogo` (fallback pelo nome via `insumo-unidade.ts`) |
| **Uso Direto** | Uso direto do insumo na **última** das 6 semanas, em nº de embalagens | Última posição do vetor de saídas ÷ embalagem. Saída = vendas × ficha do produto | `silver.vendas_consolidada_dia` (qtd_consumo) × `public.producao_ficha_item` |
| **Média 6s** | Média ponderada do uso direto nas 6 semanas anteriores (expansível) | Média ponderada: cada semana `i` pesa `i` (a mais recente pesa mais); só entram semanas com uso > 0. `Σ(saída×i) ÷ Σ(i)` | Calculado na rota a partir das saídas |
| **Desv. Pad.** | Desvio-padrão do uso direto entre as 6 semanas | Desvio-padrão amostral das saídas (divisor n−1); com menos de 2 semanas = 0 | Calculado na rota |
| **Nível de Serviço** | Percentual de segurança escolhido (editável por insumo) | Converte-se no fator de serviço z (ex.: 95%→1,645; 90%→1,282; 99%→2,325). Padrão 95% | `operations.compras_plano_config` (senão 95%) |
| **PR** (Ponto de Ressuprimento) | Nível-alvo de estoque para o insumo, em nº de embalagens | `PR = Média 6s + Desvio-padrão × z` | Calculado na rota |
| **Estoque** | Estoque atual do insumo, em nº de embalagens | Contagem mais antiga do início da semana × embalagem (a contagem vem em pacotes/embalagens) | `silver.estoque_contagem` (estoque_final) |
| **p/ Produção** (AB) | Necessidade dos preparos da produção planejada e **encerrada** da semana | `Σ(receitas decididas × quantidade do insumo na ficha do preparo)`; zero se não há plano encerrado | `operations.producao_plano` + `producao_plano_item` × `producao_ficha_item` |
| **Sugestão** | Quanto comprar: nº de embalagens (e a medida aproximada abaixo) | Base = `PR − Estoque + p/ Produção`. Se ≤ 0 → "Não comprar". Senão, embalagens = `arredonda p/ cima (base ÷ embalagem)` | Calculado na rota |
| **Comprado** | O que entrou de compra no VMarket naquela semana | Soma das quantidades compradas no VMarket por código interno, na semana | `gold.vmarket_pedido_item` + `gold.vmarket_pedido` |

### Cartões de resumo

| Indicador | O que mostra | Como é calculado |
|---|---|---|
| **Insumos a comprar** | Quantos itens da lista filtrada têm sugestão de compra | Contagem de linhas com "Não comprar" = falso |
| **Custo estimado** | Custo total aproximado da compra sugerida | `Σ (nº de embalagens sugeridas × custo do insumo)` sobre a lista filtrada |
| **Insumos na lista** | Total de itens exibidos após os filtros | Contagem de linhas filtradas |

### Detalhe expandido (Média 6s)

Ao expandir, cada semana aparece como um "chip": data da semana, uso direto em embalagens e o peso (×1 a ×6). Semanas sem uso ficam riscadas. No fim, o chip "= média" repete a Média 6s. Serve só para conferência — não altera nenhum cálculo.

## Filtros e opções

- **Semana** — define o período de referência de todo o cálculo (contagem de início, 6 semanas de saída anteriores, produção encerrada e compras VMarket daquela semana). Só semanas com contagem ficam habilitadas.
- **Busca** — filtra por nome ou código do insumo.
- **Seção (VMarket)** — filtra pela categoria de compra do VMarket (ex.: bebidas, carnes, hortifruti). "Todas as seções" mostra tudo.
- **Só Curva A** — mostra apenas os insumos marcados como Curva A no cadastro (os de maior peso no custo).
- **Todos / Comprar / Não comprar** — alterna entre ver a lista inteira, só o que precisa comprar ou só o que não precisa.

Os filtros são aplicados no navegador sobre a lista já carregada; trocar filtro é instantâneo. Só a troca de **semana** e o botão **Atualizar** disparam nova consulta ao servidor.

## Regras e detalhes importantes

- **Sempre por bar.** Toda a consulta é filtrada pelo bar selecionado; a tela nunca mistura dados de bares diferentes.
- **Semana = segunda a domingo.** O planejamento da semana W usa a **contagem da segunda-feira** (início de W) como estoque e a **saída das 6 semanas anteriores** a W. A semana futura só libera quando há contagem dela.
- **Tudo em número de embalagens.** O cálculo roda na unidade-base (ml/g/un) e só a exibição converte para embalagens. Por isso os totais podem ter casas fracionárias na medida (ex.: "≈ 2.331 latas") enquanto a sugestão em embalagens é sempre arredondada **para cima**.
- **Elo com a Produção.** A coluna "p/ Produção" só é preenchida quando existe um plano de produção com status **encerrado** naquela semana. Enquanto o plano não é encerrado, a compra considera só o uso direto (vendas) e ignora os preparos — daí o aviso âmbar.
- **Só aparece quem tem movimento.** A lista só traz insumos que tiveram alguma saída nas 6 semanas, ou necessidade de produção, ou compra na semana. Insumo sem nenhum desses três não aparece.
- **Uso direto vem de vendas × ficha.** A saída é o consumo do insumo **diretamente** em produtos vendidos (quantidade vendida × quantidade do insumo na ficha técnica). O consumo em preparos (produção) entra separado, pela coluna "p/ Produção".
- **Nível de serviço é manual e persistente.** É a única configuração editável da tela. Fica gravada por insumo e por bar; se a gravação no servidor falhar, o valor continua aplicado localmente e o próximo refresh corrige.
- **Unidade/embalagem espelham a tela de Insumos.** A base e o tamanho da embalagem vêm do catálogo de insumos (com fallback derivado do nome), a mesma fonte da tela de Insumos, para os números baterem. Insumos com unidade mal cadastrada podem exibir conversões estranhas — o ajuste é feito no cadastro/catálogo.
- **Comprado é acompanhamento, não entra na conta.** A coluna Comprado mostra o que já foi pedido no VMarket na semana; ela não altera a sugestão, serve para conferir a execução do plano.

## Dúvidas frequentes

**Por que a coluna "p/ Produção" está toda zerada?**
Porque o Planejamento da Produção daquela semana ainda não foi **encerrado**. Feche o plano de produção e recarregue: as necessidades dos preparos vão aparecer.

**Por que um insumo que eu uso não está na lista?**
A lista só mostra insumos com saída nas últimas 6 semanas, necessidade de produção ou compra na semana. Se não teve nenhum dos três, ele não entra. Verifique também se o insumo está ativo e com ficha técnica vinculada.

**O que muda quando altero o Nível de Serviço?**
Ele define a margem de segurança (fator z) somada ao Ponto de Ressuprimento. Subir o nível aumenta o PR e, portanto, a sugestão de compra (protege mais contra ruptura); baixar reduz. O padrão é 95%.

**Por que o número aparece em embalagens e não em kg/litros?**
Porque a compra é feita em embalagens (latas, garrafas, pacotes). O sistema calcula por baixo em ml/g/un e converte para embalagens na exibição; a medida aproximada aparece em cinza abaixo da quantidade.

**A semana que eu quero está bloqueada. Por quê?**
Ela ainda não tem contagem de estoque. Faça a contagem daquela semana e ela passa a ficar disponível no seletor.

**A sugestão já desconta o que eu tenho em estoque?**
Sim. A conta é Ponto de Ressuprimento − Estoque + necessidade da produção. Se o estoque já cobre tudo, o item aparece como "Não comprar".

## Fonte dos dados

Função principal: **`gold.fn_plano_compras(p_bar, p_semana)`** — monta a grade de insumos, saídas das 6 semanas, estoque, necessidade da produção (AB) e comprado. A rota `/api/operacional/plano-compras` complementa com o cálculo de média ponderada, desvio-padrão, PR, sugestão e conversão de unidade.

Tabelas e views envolvidas:

- **`operations.insumos`** — cadastro do insumo (nome, custo, Curva A, ativo).
- **`silver.insumo_catalogo`** — base e tamanho da embalagem (unidade de compra) e seção VMarket; complementado pelo fallback em `src/lib/insumo-unidade.ts`.
- **`silver.vendas_consolidada_dia`** — vendas por dia/produto (qtd_consumo), origem **ContaHub**.
- **`public.producao_ficha_item`** — fichas técnicas (insumo por produto/preparo).
- **`public.produto_cardapio`** — vínculo produto × código interno.
- **`silver.estoque_contagem`** — contagens de estoque (estoque de início de semana).
- **`operations.producao_plano`** e **`operations.producao_plano_item`** — Planejamento da Produção encerrado da semana (necessidade dos preparos).
- **`gold.vmarket_pedido`** e **`gold.vmarket_pedido_item`** — compras do período, integração **VMarket**.
- **`operations.compras_plano_config`** — nível de serviço salvo por insumo/bar.
- **`gold.fn_semanas_com_contagem(p_bar)`** — semanas disponíveis no seletor.
