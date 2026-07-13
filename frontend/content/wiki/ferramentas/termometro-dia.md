---
title: Termômetro do Dia
area: ferramentas
slug: termometro-dia
route: /operacional/termometro
description: Compara os principais números de um dia contra o padrão normal do mesmo dia da semana, sinalizando o que fugiu da média.
order: 140
icon: Activity
---

# Termômetro do Dia

## Visão geral

O **Termômetro do Dia** responde a uma pergunta simples que todo dono e gestor faz depois de fechar o caixa: *"esse dia foi bom ou ruim?"*. A resposta honesta não vem de comparar com o dia anterior — um bar tem sazonalidade forte por dia da semana, então comparar uma sexta com a terça de véspera engana.

Por isso a tela pega um dia (por padrão, ontem) e compara cada indicador contra o **padrão normal daquele mesmo dia da semana**: uma sexta é comparada com as últimas sextas, um sábado com os últimos sábados, e assim por diante. Cada indicador vira um cartão colorido que mostra o valor do dia, quanto ele variou em relação ao normal e se isso é bom ou ruim.

É uma ferramenta de leitura rápida — pensada para bater o olho de manhã e saber, em segundos, onde o dia anterior brilhou e onde ficou abaixo do esperado.

## Como acessar

No menu lateral, entre em **Ferramentas → Termômetro do Dia** (rota `/operacional/termometro`).

A tela exige a permissão de módulo **gestao**. Usuários sem esse acesso não veem o item no menu nem conseguem abrir a página.

Os dados são sempre filtrados pelo **bar selecionado** no seletor de bar. Se nenhum bar estiver selecionado, a tela pede para escolher um.

## Passo a passo

1. Abra **Ferramentas → Termômetro do Dia**.
2. Confirme no topo o bar selecionado (o seletor de bar do sistema controla qual casa está sendo analisada).
3. A tela já carrega **ontem** por padrão. Ao lado da data aparece o dia da semana e a frase "comparado com as últimas N [dia da semana]s", indicando o tamanho da amostra usada como padrão.
4. Para analisar outro dia, use o **seletor de data** no topo. Ele só permite escolher datas até ontem (não dá para termometrar o dia de hoje, que ainda está em andamento).
5. Leia os cartões: cada um é um indicador. O **número grande** é o valor do dia; abaixo dele, a variação percentual e o valor "normal" com o qual foi comparado.
6. Use a **cor da borda** para priorizar o olhar — verde é bom, âmbar é atenção, vermelho é alerta.

Não há botões de exportação, edição ou cadastro. É uma tela apenas de leitura.

## Colunas e cálculos

Cada indicador é um cartão. O valor do dia (**valor**) vem do dia selecionado; a **base** ("normal") é a **mediana** das últimas 6 ocorrências do mesmo dia da semana; a **variação** é quanto o dia se afastou dessa base.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Faturamento** | Faturamento real do dia (R$) | Valor do dia = `real_r` do evento. Melhor quando maior. | `operations.eventos_base.real_r` |
| **Clientes** | Número de clientes reais no dia | Valor do dia = `cl_real` do evento. Melhor quando maior. | `operations.eventos_base.cl_real` |
| **Ticket** | Ticket médio por cliente (R$) | `real_r ÷ cl_real` do dia (nulo se não houve clientes). Melhor quando maior. | `operations.eventos_base` (calculado) |
| **Desconto %** | Percentual do faturamento dado em desconto | `100 × soma(desconto) ÷ (soma(valorfinal) + soma(desconto))`, considerando apenas itens com `valorfinal > 0`. Melhor quando **menor**. | `gold.gold_contahub_avendas_porproduto_analitico` |
| **Ruptura (itens)** | Quantos produtos distintos ficaram em ruptura (fora de estoque/indisponíveis) no dia | Contagem de produtos distintos (`prd`) na base de stockout do dia. Melhor quando **menor**. | `gold.gold_contahub_operacional_stockout_filtrado` |

**Como cada cartão é montado:**

| Elemento do cartão | O que mostra | Como é calculado |
|---|---|---|
| Título | Nome do indicador | Fixo (Faturamento, Clientes, Ticket, Desconto %, Ruptura). |
| Valor grande | Número do dia selecionado | Formatado como R$ (Faturamento, Ticket), inteiro (Clientes, Ruptura) ou % (Desconto). Faturamento/Clientes/Ruptura/Ticket sem casas; Desconto com 1 casa. |
| Variação % | Quanto o dia se afastou do normal | `arredondar(100 × (valor − base) ÷ base, 0)`. Fica "s/ base" quando não há histórico suficiente (base nula ou zero). |
| "vs X normal" | O valor de referência do dia da semana | Mediana (`percentile_cont 0.5`) das últimas 6 ocorrências do mesmo dia da semana. |
| Cor / ícone | Se o resultado é bom ou ruim | Ver regra de cores abaixo. |

**Regra de cores (status do cartão):**

O sistema primeiro checa se a variação está no lado bom. Para Faturamento, Clientes e Ticket, "bom" é variação **maior ou igual a zero**. Para Desconto % e Ruptura, "bom" é variação **menor ou igual a zero**.

| Situação | Cor | Significado |
|---|---|---|
| Do lado bom (na direção certa) | Verde | Melhor ou igual ao padrão do dia |
| Do lado ruim, desvio abaixo de 10% | Cinza/neutro (ok) | Ligeiramente abaixo, sem alarme |
| Do lado ruim, desvio de 10% a 25% | Âmbar (atenção) | Abaixo do padrão, merece olhar |
| Do lado ruim, desvio de 25% ou mais | Vermelho (ruim) | Bem abaixo do padrão |
| Sem base de comparação | Neutro | Histórico insuficiente |

O ícone acompanha o sinal da variação: seta para cima (positiva), seta para baixo (negativa) ou traço (nula).

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| **Bar** | Controlado pelo seletor de bar do sistema. Todos os cálculos são filtrados por `bar_id`. |
| **Data** | Seletor de data no topo. Escolhe o dia a ser termometrado. Limitado a datas até ontem. Ao mudar a data, o dia da semana e a amostra de comparação são recalculados automaticamente. |

Não há outros filtros, toggles ou categorias na tela.

## Regras e detalhes importantes

- **Comparação por dia da semana, não por data corrida.** A base de comparação são as 6 ocorrências mais recentes do **mesmo dia da semana**, anteriores ao dia analisado, em que houve faturamento (`real_r > 0`). Isso evita comparar uma sexta com uma terça.
- **Baseline é mediana, não média.** Usar a mediana das últimas 6 ocorrências reduz o efeito de um dia atípico (um feriado, um show gigante) puxar a referência.
- **Amostra (N).** O texto "últimas N [dia]s" mostra quantos dias de base realmente entraram na conta (dias com faturamento válido). Se o bar é novo ou o histórico daquele dia é curto, N pode ser menor que 6.
- **Dia padrão = ontem.** A tela abre em ontem. O cálculo de "ontem" na tela usa um deslocamento de fuso para não pular o dia perto da meia-noite; a função no banco, quando não recebe data, usa `CURRENT_DATE − 1`.
- **Filtro por bar sempre presente.** Todas as fontes (eventos, descontos, ruptura) são filtradas pelo bar selecionado.
- **Desconto considera apenas itens vendidos.** O percentual de desconto só entra em linhas com `valorfinal > 0`.
- **Ticket pode ficar vazio.** Se o dia não teve clientes reais (`cl_real = 0`), o ticket fica nulo.
- **Estado vazio.** Se o dia não tem dados (bar fechado naquele dia, ou histórico insuficiente do mesmo dia da semana), a tela mostra a mensagem "Sem dados para esse dia (bar fechado ou histórico insuficiente do mesmo dia da semana)".
- **"s/ base".** Quando um indicador não tem base de comparação (mediana nula ou zero), o cartão exibe "s/ base" no lugar da variação e fica neutro.
- **Tela só de leitura.** Nada aqui é manual nem editável; todos os números vêm do pipeline de dados do ContaHub, já processado nas camadas do sistema.

## Dúvidas frequentes

**Por que ele compara com o mesmo dia da semana e não com ontem?**
Porque bar tem ritmo semanal: sexta e sábado faturam muito mais que terça. Comparar dias diferentes daria um retrato falso. A tela compara sexta com sextas e sábado com sábados.

**O que significa a cor vermelha?**
Que o indicador ficou **bem abaixo** do padrão daquele dia da semana — variação de 25% ou mais no lado ruim. Âmbar é uma variação intermediária (10% a 25%). Verde é estar na direção certa.

**Por que aparece "s/ base" em um cartão?**
Porque não há histórico suficiente do mesmo dia da semana para calcular um valor de referência (por exemplo, bar novo, ou aquele dia raramente abre). Sem base, não dá para dizer se o dia foi bom ou ruim.

**Por que o número da amostra (N) às vezes é menor que 6?**
A tela busca até 6 ocorrências anteriores do mesmo dia da semana com faturamento válido. Se ainda não existem 6 no histórico, ela usa quantas houver.

**Posso ver o dia de hoje?**
Não. O seletor limita a escolha até ontem, porque o dia de hoje ainda está em andamento e o resultado seria parcial.

**Desconto % subindo é bom ou ruim?**
Ruim. Para Desconto % e Ruptura, o desejável é ficar **abaixo** do normal — por isso a cor considera "menor é melhor" nesses dois indicadores.

## Fonte dos dados

A tela consome a função de banco `operations.fn_termometro_dia(p_bar_id, p_data)` através da rota interna `/api/operacional/termometro`. Essa função lê:

- **`operations.eventos_base`** — faturamento (`real_r`), clientes (`cl_real`) e ticket (derivado) por evento/dia. Base do módulo operacional, alimentada pelo pipeline de eventos.
- **`gold.gold_contahub_avendas_porproduto_analitico`** — vendas por produto (campos `desconto` e `valorfinal`), usada para o percentual de desconto. Origem: **ContaHub**.
- **`gold.gold_contahub_operacional_stockout_filtrado`** — produtos em ruptura por dia (`prd`, `data_consulta`). Origem: **ContaHub** (snapshot de disponibilidade).

Todas as fontes são filtradas por `bar_id` e derivam da ingestão do **ContaHub**, já tratada nas camadas do pipeline de dados do Zykor.
