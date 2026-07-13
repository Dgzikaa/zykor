---
title: Raio-x por Garçom
area: ferramentas
slug: raio-x-garcom
route: /operacional/raio-x-garcom
description: Compara o desempenho de cada garçom pelo que ele lançou — vendas, ticket por mesa, itens por mesa, desconto aplicado e o quanto puxa bebida.
order: 100
icon: UserCheck
---

# Raio-x por Garçom

## Visão geral

O **Raio-x por Garçom** mostra, lado a lado, como cada garçom (vendedor) da casa está performando no salão. Em vez de olhar só o faturamento total, a tela quebra os números **por quem lançou o item** no ContaHub: quanto cada pessoa vendeu, o ticket médio por mesa que atendeu, quantos itens colocou por mesa, o desconto que aplicou e o quanto ela consegue "puxar" bebida (o item de maior margem).

É uma ferramenta de gestão de equipe de salão. Serve para:

- Identificar quem vende mais e quem tem mais espaço para melhorar.
- Ver quem está sugerindo bebida de forma consistente (attach) e quem deixa dinheiro na mesa.
- Flagrar desconto acima do normal — que pode ser generosidade excessiva ou vazamento.

Quem usa no dia a dia: **dono, gerente e coordenador de salão**, tipicamente em reuniões de acompanhamento da equipe ou na hora de premiar/treinar garçons.

> Observação importante de leitura: a mesa é **compartilhada** entre garçons (mais de uma pessoa pode lançar na mesma mesa). Por isso os números devem ser usados para **comparar garçons entre si**, e não para bater exatamente com o total da casa.

## Como acessar

- Menu lateral: seção de ferramentas operacionais, item **"Raio-x por Garçom"** (ícone `UserCheck`), que leva à rota `/operacional/raio-x-garcom`.
- Permissão necessária: módulo **`gestao`**. Sem essa permissão o item não aparece no menu e a rota fica bloqueada.
- É preciso ter um **bar selecionado**. Se nenhum bar estiver ativo, a tela mostra "Selecione um bar."

## Passo a passo

**Ver o raio-x da equipe no período padrão**

1. Abra o menu lateral e clique em **Raio-x por Garçom**.
2. Confirme, no seletor de bar do topo do sistema, que o bar certo está selecionado.
3. A tela carrega automaticamente os últimos **30 dias** (período padrão).
4. Leia os 4 cards do topo (visão da casa) e, abaixo, os gráficos e o ranking da equipe.

**Trocar o período de análise**

1. No topo da tela, use o botão de períodos: **7d**, **30d** ou **90d**.
2. Clique no período desejado. O botão ativo fica destacado.
3. Todos os números (cards, gráficos e tabela) recalculam para a nova janela de dias.

**Comparar quem puxa mais bebida**

1. Olhe o gráfico **"Quem puxa bebida"** (barras horizontais), já ordenado do maior para o menor attach.
2. Cruze com a coluna **Bebida (attach)** e **% venda bebida** na tabela de ranking para entender se o garçom leva bebida para muitas mesas e se isso pesa no faturamento dele.

**Encontrar desconto fora da curva**

1. Vá até a tabela **Ranking da equipe**.
2. Procure valores na coluna **Desconto** destacados em **vermelho** — são os garçons cujo desconto passou do limite (o dobro do desconto médio da casa, com piso de 3%).
3. Use isso como ponto de conversa/investigação com o time.

> A tela é **somente leitura** (visualização). Não há cadastro, edição, aprovação nem exportação nesta página.

## Abas e seções

A tela não tem abas. Ela é composta por três blocos, de cima para baixo:

1. **Cards da casa (HeroRow)** — 4 indicadores da equipe inteira no período.
2. **Gráficos** — dois gráficos de barras horizontais lado a lado: "Vendas por garçom" e "Quem puxa bebida (attach)".
3. **Ranking da equipe** — tabela com uma linha por garçom, ordenada por vendas (maior primeiro).

## Colunas e cálculos

Todos os números vêm da função SQL `operations.fn_raio_x_garcom`, que agrega a tabela `gold.gold_contahub_avendas_porproduto_analitico` (ContaHub, camada gold) por `usr_lancou` (o garçom que lançou o item). A base considera **apenas vendas reais** (`valorfinal > 0`, o que exclui consumo interno/insumos) e apenas registros com garçom preenchido. Uma "comanda"/"mesa" é definida como a combinação **dia (`trn_dtgerencial`) + mesa (`vd_mesadesc`)**.

**Cards da casa (topo)**

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Vendas (equipe) | Faturamento total lançado pela equipe no período | Soma de `valorfinal` de toda a base, arredondada | `gold_contahub_avendas_porproduto_analitico` |
| Ticket médio / mesa | Valor médio por mesa atendida na casa | Soma de `valorfinal` ÷ nº de mesas distintas (dia+mesa), 2 casas | mesma |
| Itens / mesa | Média de itens por mesa na casa | Soma de `qtd` ÷ nº de mesas distintas, 1 casa | mesma |
| Desconto médio | % de desconto médio da casa | 100 × soma(`desconto`) ÷ (soma(`valorfinal`) + soma(`desconto`)), 1 casa | mesma |

**Gráficos**

| Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Vendas por garçom | Barras horizontais de R$ lançado por garçom no período (até 20) | Coluna `vendas` de cada garçom (soma de `valorfinal`) | `fn_raio_x_garcom` → `garcons[].vendas` |
| Quem puxa bebida | Barras horizontais de % de mesas com bebida, ordenado do maior para o menor (até 20) | Coluna `bebida_attach_pct` de cada garçom | `fn_raio_x_garcom` → `garcons[].bebida_attach_pct` |

**Ranking da equipe (tabela, uma linha por garçom)**

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Garçom | Nome de quem lançou o item | `usr_lancou` | `gold_contahub_avendas_porproduto_analitico` |
| Vendas | Total faturado pelo garçom no período | Soma de `valorfinal` dos itens que ele lançou, arredondado | mesma |
| Mesas | Quantas mesas distintas ele atendeu | Contagem de comandas distintas (dia + `vd_mesadesc`) | mesma |
| R$/mesa | Ticket médio por mesa do garçom | `vendas` ÷ `mesas`, 2 casas | mesma |
| Itens/mesa | Média de itens que ele coloca por mesa | soma(`qtd`) ÷ `mesas`, 1 casa | mesma |
| Desconto | % de desconto que ele aplicou | 100 × soma(`desconto`) ÷ (`vendas` + soma(`desconto`)), 1 casa; fica **vermelho** quando passa do limite | mesma |
| Bebida (attach) | % das mesas dele que tiveram pelo menos uma bebida | 100 × (mesas com bebida) ÷ (`mesas`), arredondado a inteiro | mesma |
| % venda bebida | Quanto do faturamento dele veio de bebida | 100 × soma(`valorfinal` de bebida) ÷ `vendas`, arredondado a inteiro | mesma |

**O que conta como "bebida"**: o item é classificado como bebida quando o grupo do produto (`grp_desc`) casa com um destes termos (sem diferenciar maiúsculas): cerveja, bebida, drink, dose, balde, chopp, happy, shot, preshh, montado, mexido, batido. Todo o resto (comida, etc.) não entra no attach de bebida.

## Filtros e opções

| Filtro / opção | Onde | Efeito |
|---|---|---|
| Bar | Seletor global de bar do sistema | Filtra tudo por `bar_id`. Cada bar tem seus próprios garçons e vendas. |
| Período | Botões **7d / 30d / 90d** no topo | Define a janela de dias contada a partir de hoje. Recalcula todos os números. Padrão: 30d. |
| Mínimo de mesas (min_comandas) | Não exposto na tela (fixo em 20) | Só entram no ranking garçons com pelo menos 20 mesas atendidas no período, para evitar ruído de quem lançou pouquíssimo. |

> O parâmetro de **mínimo de mesas** existe na API (aceita 1 a 500, padrão 20) e no SQL, mas a página não oferece controle para o usuário mudá-lo — na prática ele fica travado em 20.

## Regras e detalhes importantes

- **Filtragem por bar**: obrigatória. A função sempre recebe `p_bar_id` e nunca mistura bares.
- **Só vendas reais**: registros com `valorfinal <= 0` (consumo interno, insumos) são excluídos da base — não contam nem para a casa nem para o garçom.
- **Definição de "mesa/comanda"**: é a combinação **dia + descrição da mesa (`vd_mesadesc`)**. O campo `comandaorigem` foi descartado porque está vazio em cerca de 93% dos casos, e o `trn` agruparia demais. Se a mesa vier vazia, aquela combinação vira nula.
- **Mesa compartilhada**: como vários garçons podem lançar na mesma mesa, a soma dos números individuais não bate exatamente com o total da casa. A leitura correta é **comparar garçons entre si**.
- **Garçom obrigatório**: só entram lançamentos com `usr_lancou` preenchido e não vazio.
- **Corte de volume**: garçons com menos de 20 mesas no período ficam de fora do ranking.
- **Destaque de desconto**: uma célula de desconto fica vermelha quando o valor do garçom passa de `máx(2 × desconto médio da casa, 3%)`. É um sinal visual de atenção, não uma regra de bloqueio.
- **Ordenação**: o ranking e o gráfico de vendas vêm ordenados por vendas (maior primeiro); o gráfico de bebida é reordenado por attach na própria tela.
- **Arredondamentos**: vendas/itens/desconto em R$ sem casas; ticket com 2 casas; itens/mesa e percentuais de desconto com 1 casa; attach e % venda bebida como inteiros.
- **Estado vazio**: se não houver venda para o bar/período (ou nenhum garçom bater o mínimo de mesas), a tela mostra "Sem dados de venda para este bar/período."
- **Dados automáticos**: tudo vem do pipeline ContaHub → camada gold. Não há entrada manual nesta tela.

## Dúvidas frequentes

**Por que a soma das vendas dos garçons não bate com o card "Vendas (equipe)"?**
Porque a mesma mesa pode ter itens lançados por garçons diferentes. A visão da casa conta cada mesa uma vez; a visão individual atribui cada item a quem o lançou. Use os números para comparar pessoas, não para fechar o total.

**O que exatamente é "attach de bebida"?**
É a fatia das mesas do garçom em que apareceu pelo menos um item de bebida (cerveja, drink, dose, chopp, etc.). Quanto maior, mais consistente ele é em oferecer bebida — o item de maior margem.

**Por que um garçom que trabalhou não aparece no ranking?**
Provavelmente ele atendeu menos de 20 mesas no período escolhido, ou os lançamentos não tinham o nome dele preenchido no ContaHub. Aumentar o período (para 90d) pode fazê-lo aparecer.

**O desconto em vermelho significa que houve fraude?**
Não necessariamente. É apenas um alerta de que o desconto daquele garçom ficou acima do dobro da média da casa. Pode ser generosidade, política de cortesia ou algo a investigar — a tela só sinaliza.

**Qual período devo usar?**
7d para acompanhamento recente/semanal, 30d para a visão do mês corrente e 90d para tendência mais estável (e para incluir quem tem pouco volume).

**A tela considera consumo interno ou cortesias sem valor?**
Não. Só entram itens com valor final positivo. Consumo interno e insumos (valor zero ou negativo) ficam de fora.

## Fonte dos dados

- **Função SQL**: `operations.fn_raio_x_garcom(p_bar_id, p_dias, p_min_comandas)` (definida em `database/migrations/20260711_fn_raio_x_garcom.sql`), executada via `service_role`.
- **Tabela base**: `gold.gold_contahub_avendas_porproduto_analitico` — camada gold do analítico de vendas por produto do **ContaHub** (campos usados: `usr_lancou`, `trn_dtgerencial`, `vd_mesadesc`, `valorfinal`, `desconto`, `qtd`, `grp_desc`, `bar_id`).
- **API**: `frontend/src/app/api/operacional/raio-x-garcom/route.ts` (GET, autenticada).
- **Página**: `frontend/src/app/operacional/raio-x-garcom/page.tsx`.
- **Integração de origem**: ContaHub (ingestão → processamento → camada gold).
