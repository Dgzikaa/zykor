---
title: Análises Avançadas
area: ferramentas
slug: analises-avancadas
route: /ferramentas/analises
description: Central de análises operacionais e de cardápio — quality score semanal, engenharia de cardápio, combos, ranking de garçons, mapa de calor, previsão de demanda, detector de anomalias e relatório de IA.
order: 30
icon: BarChart3
---

# Análises Avançadas

## Visão geral

A **Análises Avançadas** é uma central que reúne, em abas, um conjunto de análises mais profundas sobre a operação do bar — coisas que não cabem no dia a dia dos dashboards, mas que ajudam a tomar decisão de gestão: onde está o dinheiro no cardápio, quem são os garçons que mais vendem, quais horários lotam, quanto o próximo fim de semana deve faturar, e onde há sinais de desconto ou remoção de itens fora da curva.

É uma tela de leitura para dono, sócio e gestão. Não é operacional de caixa nem de estoque; é uma camada de inteligência que cruza vendas do ContaHub, custos de ficha/planilha, NPS, Instagram e reservas para transformar dado bruto em recomendação.

Ao abrir `/ferramentas/analises`, o sistema redireciona automaticamente para a primeira aba, **Quality Score**.

## Como acessar

- No menu lateral: **Ferramentas → Análises Avançadas**.
- Rota: `/ferramentas/analises` (abre direto no Quality Score).
- Permissão necessária: módulo **`gestao`** (o item de menu exige `gestao`; a área Ferramentas exige `ferramentas`). Ou seja, é uma tela de gestão — usuários operacionais comuns não a enxergam.
- Duas ações de escrita têm regra própria mais restrita:
  - **Editar custo de produto** (aba Engenharia de Cardápio → Custos): só **admin ou financeiro**.
  - Recalcular previsão, rodar o detector de anomalias e gerar relatório de IA: exigem usuário autenticado (as duas últimas confirmam antes por serem ações que custam processamento/tokens).

## Passo a passo

### Navegar entre as análises
1. Abra **Ferramentas → Análises Avançadas**.
2. Use a barra de abas no topo (fica fixa ao rolar) para trocar entre: Quality Score, Engenharia Cardápio, Combos, Garçons, Mapa de Calor, Previsão, Integridade e Relatório IA.
3. Cada aba tem seu próprio seletor de período/filtros — eles não são compartilhados entre abas.

### Acompanhar o Quality Score da semana
1. Entre na aba **Quality Score**.
2. Leia o número grande (0 a 100): é a nota da semana mais recente. Verde ≥ 85, amarelo ≥ 70, vermelho abaixo.
3. Veja a **Variação WoW** (contra a semana anterior) e a **Média 12 semanas** ao lado.
4. Role até o **Breakdown do score** para ver cada componente (NPS, tempos, stockout etc.) com seu peso e nota individual — é onde você descobre o que puxou a nota para baixo.

### Analisar a engenharia de cardápio
1. Entre na aba **Engenharia Cardápio**.
2. Escolha o período no seletor (7, 30, 60 ou 90 dias).
3. Na sub-aba **Engenharia**, clique num dos 4 cards (Stars, Plowhorses, Puzzles, Dogs) para filtrar a tabela por aquela classe.
4. Use a **Matriz de classificação** (gráfico de dispersão) para ver visualmente onde cada produto cai; a linha tracejada é a mediana.
5. Na sub-aba **Encalhados**, veja os produtos menos vendidos — candidatos a sair do cardápio.
6. Na sub-aba **Custos**, preencha custo unitário de produtos que estão sem custo (só admin/financeiro). Você pode clicar em **Atualizar agora** para puxar da planilha de engenharia de cardápio.
7. Na sub-aba **Histórico de preços**, veja o que subiu/caiu e clique numa linha para abrir a curva de evolução de 180 dias.

### Descobrir combos para treinar upsell
1. Entre na aba **Combos**.
2. Escolha o período (30/60/90/180 dias) e, se quiser, marque **Incluir [Banda]**.
3. Leia o **Top 20 combos mais prováveis** (ordenado por confidence).
4. No **drilldown por produto**, busque um produto à esquerda e clique nele para ver o que mais sai junto — é o script de sugestão para o garçom.

### Prever o próximo fim de semana
1. Entre na aba **Previsão**.
2. Veja o card destacado do **próximo fim de semana** (faturamento e público previstos + intervalo de confiança 80%).
3. Analise o gráfico e a tabela de detalhe dos próximos 14 dias.
4. Se quiser recalcular com os dados mais recentes, clique em **Recalcular**.

### Tratar alertas de integridade
1. Entre na aba **Integridade**.
2. Filtre por bar, status (Abertos/Revisados/etc.) e período.
3. Clique em **Detalhes** num alerta para ver o JSON com o que foi detectado.
4. Marque **Tratei** (confirma que agiu, pede a ação tomada) ou **Ignorar** (falso positivo, pede o motivo).
5. Para rodar o detector manualmente em D-1, clique em **Detectar agora**.

### Gerar o relatório executivo de IA
1. Entre na aba **Relatório IA**.
2. Filtre por bar, se quiser.
3. Clique num relatório para expandir e ler o resumo.
4. Para criar o da última semana, clique em **Gerar agora** (confirma antes, pois consome tokens da Anthropic).

## Abas e seções

| Aba | O que faz |
|---|---|
| **Quality Score** | Nota única de qualidade da operação por semana (0–100), com evolução de 12 semanas e o peso de cada componente. |
| **Engenharia Cardápio** | Classifica produtos em Star/Plowhorse/Puzzle/Dog por popularidade × margem. Tem sub-abas: Engenharia, Encalhados, Custos e Histórico de preços. |
| **Combos** | Market basket: para cada produto, quais outros aparecem na mesma comanda (confidence e lift). |
| **Garçons** | Ranking 360 dos garçons por faturamento, ticket, mix e upsell (dados por `usr_lancou`). |
| **Mapa de Calor** | Faturamento por dia da semana × hora nos últimos 90 dias. |
| **Previsão** | Previsão de faturamento e público para os próximos 14 dias. |
| **Integridade** | Detector de anomalias em vendas (descontos, itens removidos, mesas longas). |
| **Relatório IA** | Resumo executivo cross-área gerado por IA (vendas, CMV, IG, NPS, alertas, previsões). |

## Colunas e cálculos

### Aba Quality Score

O score é lido da view `gold.quality_scorecard`, que parte da `gold.desempenho` (granularidade semanal). Cada componente é normalizado para 0–100 e o score final é a **média ponderada apenas dos componentes que têm dado na semana** (pesos dos componentes ausentes são descartados do denominador, então NULL não zera a nota).

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Score (número grande) | Nota de qualidade da semana (0–100) | Soma ponderada dos componentes ÷ soma dos pesos presentes, arredondada a 1 casa | `gold.quality_scorecard.score` |
| Variação WoW | Diferença contra a semana anterior | `score_atual − score_anterior` (calculado na API) | `/api/qualidade` |
| Média 12 semanas | Média do score no período carregado | Média aritmética dos scores das semanas retornadas | `/api/qualidade` |
| NPS Digital (peso 25%) | Satisfação nas plataformas digitais | `(nps_digital + 100) / 2` (converte NPS −100..100 para 0..100) | `gold.desempenho.nps_digital` |
| Stockout (peso 15%) | Disponibilidade de produtos | `100 − stockout_total_perc` (piso 0) | `gold.desempenho.stockout_total_perc` |
| NPS Salão (peso 10%) | Satisfação no salão | `(nps_salao + 100) / 2` | `gold.desempenho.nps_salao` |
| Atrasos (peso 10%) | Pontualidade de entrega | `100 − (atrasos_comida_perc + atrasos_drinks_perc) / 2` | `gold.desempenho` |
| Reservas cumpridas (peso 10%) | Reservas honradas | `100 − reservas_quebra_pct` | `gold.desempenho.reservas_quebra_pct` |
| Tempo cozinha (peso 10%) | Velocidade da cozinha | `100 − max(0, tempo_cozinha − 600s) / 6` (600s = alvo; cada 6s acima tira 1 ponto) | `gold.desempenho.tempo_cozinha` |
| Tempo drinks (peso 10%) | Velocidade do bar | `100 − max(0, tempo_drinks − 180s) / 1.8` (180s = alvo) | `gold.desempenho.tempo_drinks` |
| NPS Reservas (peso 5%) | Satisfação de quem reservou | `(nps_reservas + 100) / 2` | `gold.desempenho.nps_reservas` |
| IG engagement (peso 5%) | Engajamento no Instagram | `(likes + comentários) / seguidores × 100 × 20`, média da semana (limitado a 0–100) | `integrations.instagram_posts` + `instagram_conta_metricas` |

### Aba Engenharia Cardápio — Matriz (sub-aba Engenharia)

Vem da função `gold.menu_engineering`, que agrega vendas do período (mínimo de **5 unidades vendidas** por produto para entrar) e usa **custo planilha-first**: se existe custo manual em `operations.produto_custo_manual`, ele manda; senão usa o custo do ContaHub (ficha/CMV). Produtos **sem custo efetivo (≤ 0) ficam de fora da matriz** e aparecem só na sub-aba Custos.

Classificação = comparação de cada produto contra a **mediana** de quantidade e a **mediana** de margem unitária do próprio período:

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cards Stars/Plowhorses/Puzzles/Dogs | Qtd de produtos, receita e margem por classe | Contagem e soma por classificação | `gold.menu_engineering` |
| Classificação | Star / Plowhorse / Puzzle / Dog | Star = qtd ≥ mediana **e** margem ≥ mediana; Plowhorse = qtd ≥ mediana, margem < mediana; Puzzle = qtd < mediana, margem ≥ mediana; Dog = ambos abaixo | `classificacao` |
| Produto / Grupo | Nome e grupo do produto | `MAX(produto_desc)`, `MAX(grupo_desc)` | `silver.vendas_item` |
| Qtd | Unidades vendidas no período | `SUM(quantidade)` | `silver.vendas_item` |
| Preço méd. | Preço médio praticado | `receita_total / qtd_vendida` | `silver.vendas_item` |
| Custo méd. | Custo médio unitário | `custo_total / qtd_vendida` (custo_total = custo_manual×qtd ou custo ContaHub) | `menu_engineering` + `produto_custo_manual` |
| Margem unit. | Margem por unidade | `(receita_total − custo_total) / qtd_vendida` | `menu_engineering` |
| Margem % | Margem sobre a receita | `(receita_total − custo_total) / receita_total × 100` | `menu_engineering` |
| Receita | Faturamento do produto | `SUM(valor)` | `silver.vendas_item` |
| Margem total | Lucro bruto do produto | `receita_total − custo_total` | `menu_engineering` |
| Popularidade (×mediana) | Eixo X da matriz | `qtd_vendida / mediana(qtd)` (1 = na mediana) | `menu_engineering` |
| Margem (×mediana) | Eixo Y da matriz | `margem_unitaria / mediana(margem)` | `menu_engineering` |

### Aba Engenharia Cardápio — Encalhados

Mesma base da matriz, mas achatando as 4 classes numa lista **ordenada do menos vendido** (até 40 itens). Colunas: Produto, Grupo, Classe (ícone), Qtd vendida, Preço méd., Margem % (vermelho se < 30%) e Receita. Fonte: `gold.menu_engineering`.

### Aba Engenharia Cardápio — Custos (editor de custo manual)

Vem da função `public.cardapio_produtos_custo`. Lista produtos vendidos no período (sem o filtro de 5 unidades da matriz) com o custo efetivo e uma flag.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Custo efetivo / tem_custo | Custo usado e se existe | `custo_manual × qtd` se houver manual, senão custo ContaHub; `tem_custo` = efetivo > 0 | `cardapio_produtos_custo` |
| Fonte | De onde veio o custo | `manual` (custo manual), `contahub` (custo ContaHub > 0) ou vazio (sem custo) | `produto_custo_manual` / `silver.vendas_item` |
| Produtos sem custo | Itens sem nenhum custo cadastrado | Filtra `tem_custo = false`, soma a receita afetada | `cardapio_produtos_custo` |
| Margem negativa | Custo total acima da receita | `custo_efetivo > receita_total` (provável erro de cadastro) | cálculo no front |
| Custo unitário (input) | Campo editável | Salvo em `operations.produto_custo_manual` via `set_produto_custo_manual` (só admin/financeiro) | `/api/cardapio/custo-manual` |

### Aba Engenharia Cardápio — Histórico de preços

Vem de `public.cardapio_custo_mudancas` (snapshot diário de custo/preço por produto). Colunas: Produto, Custo (valor anterior → novo com % de variação), Preço, Quem editou e Quando. Ao clicar, carrega a série de 180 dias via `cardapio_custo_serie`. Chips no topo: total de mudanças, subiram, caíram, novos.

### Aba Combos

Vem da função `gold.produto_combos` (market basket). Comanda = `data_gerencial + mesa`. Exclui grupos Insumos e Pegue e Pague; exige no mínimo `p_min_pares` = **25** ocorrências por produto e por par.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Produto A → Produto B | O par sugerido | Pares de produtos que aparecem na mesma comanda | `gold.produto_combos` |
| Confidence % | Chance de pedir B dado que pediu A | `comandas_com_ambos / comandas_com_A × 100` | `produto_combos` |
| Lift | Força da associação além do acaso | `(comandas_ambos / comandas_A) ÷ (comandas_B / total_comandas)`; lift > 5 = muito associado | `produto_combos` |
| Comandas | Quantas comandas tiveram os dois | `comandas_com_ambos` | `produto_combos` |
| Drilldown por produto | O que sai junto de um produto | Filtra os pares onde `produto_a` = selecionado (top 10) | `produto_combos` |

Fonte de vendas: `gold.gold_contahub_avendas_porproduto_analitico` (ContaHub).

### Aba Garçons

Vem da função `gold.garcom_performance`, agrupada por `usr_lancou` (quem lançou no ContaHub). Comanda = `data_gerencial + mesa`. Só entra garçom com **≥ 20 comandas** no período.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cards de topo | Garçons ativos, faturamento total, comandas, ticket médio geral | Somatórios da lista; ticket = fat_total / comandas_total | `/api/garcons` |
| Faturamento | Quanto o garçom vendeu | `SUM(valorfinal)` | `garcom_performance` |
| Ticket médio (comanda) | Média por comanda | `faturamento / qtd_comandas` | `garcom_performance` |
| Drinks / Bebidas / Comida % | Mix de venda | `faturamento_categoria / faturamento × 100` (drinks, bebida e comida por regra de grupo) | `garcom_performance` |
| Desconto % | Peso do desconto que dá | `desconto_total / |faturamento| × 100` (amarelo se > 8%) | `garcom_performance` |
| Upsell bebida | % de comandas que saíram com bebida | `comandas_com_bebida / (com + sem) × 100` | `garcom_performance` |
| Dias trabalhados / Itens | Dias distintos e itens lançados | `COUNT(DISTINCT dia)`, `COUNT(*)` | `garcom_performance` |

### Aba Mapa de Calor

Vem da view `gold.heatmap_vendas_dow_hora` (últimos 90 dias). Cada célula é um cruzamento dia-da-semana × hora.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Célula (cor/valor) | Faturamento naquele dia+hora | `fat_medio` = média do valor por hora, ou `fat_total` = soma dos 90 dias (escolhido no seletor) | `heatmap_vendas_dow_hora` |
| Total (linha) | Total por dia da semana | Soma das células do dia | cálculo no front |
| Dias observados | Quantos dias entraram na média | `COUNT(DISTINCT data_gerencial)` | `heatmap_vendas_dow_hora.dias_obs` |
| Top 10 momentos | Horários mais quentes | Top 10 células pela métrica escolhida | cálculo no front |

Fonte de vendas: `bronze.bronze_contahub_avendas_vendasdiahoraanalitico` (ContaHub). Horas > 24 representam a madrugada (ex.: 25 = 1h).

### Aba Previsão

Lida da tabela `gold.demanda_previsoes`, preenchida pela função `prever-demanda`. O modelo é a **mediana das últimas 8 ocorrências do mesmo dia da semana** (baseado em eventos reais dos últimos 90 dias), ajustada por atração e por feriado.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Fat. previsto | Faturamento estimado do dia | `mediana(fat últimas 8 ocorrências do DOW) × ajuste_atração × ajuste_feriado` | `gold.demanda_previsoes.fat_previsto` |
| Público | Público estimado | `mediana(público últimas 8) × ajustes` | `publico_previsto` |
| IC 80% (– / +) | Intervalo de confiança 80% | `previsto ± 1,28 × desvio-padrão` das últimas ocorrências | `ic_inferior` / `ic_superior` |
| Base (n) | Quantas ocorrências sustentam a previsão | Nº de ocorrências usadas (até 8) | `base_n_ocorrencias` |
| Ajuste atração | Fator aplicado por evento/feriado | `c_art do evento futuro / c_art mediano do DOW` × ajuste de feriado | `ajuste_atracao` |

Fontes do modelo: `operations.eventos` (real_r, cl_real, c_art), `operations.feriados_eventos` e `gold.desempenho`.

### Aba Integridade

Lida de `integridade.alertas`, gerados pela função `detector-fraude` (roda para D-1 por bar).

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cards de topo | Críticos, Alta, Média, Valor envolvido | Contagem por severidade e soma de `valor_envolvido` | cálculo no front |
| Severidade | Gravidade do alerta | `critica` / `alta` / `media` / `baixa` conforme o valor/frequência | `alertas.severidade` |
| Tipo | Categoria da anomalia | `desconto_alto`, `desconto_funcionario`, `item_negativo`, `mesa_longa` (e rótulo `comanda_anulada`) | `alertas.tipo` |
| Valor envolvido | Dinheiro em jogo no alerta | Valor do desconto/item detectado | `alertas.valor_envolvido` |
| Status | Situação do tratamento | `aberto` → `confirmado_acao` (Tratei) ou `falso_positivo` (Ignorar) | `alertas.status` |

Regras do detector (limiares confirmados no código):
- **Desconto alto**: item com desconto > 30% do valor final (alta se desconto > R$ 200).
- **Desconto funcionário**: garçom com desconto/venda > 8% (crítica se > 15%, senão alta; média típica < 3%).
- **Item negativo**: itens com quantidade < 0 = remoção tardia (alta se > 30 itens ou valor > R$ 1.000).
- **Mesa longa**: mesa com último lançamento > 12h após o primeiro.

Os alertas críticos (alta/crítica) também são enviados ao Discord. Fonte de vendas: ContaHub.

### Aba Relatório IA

Lida de uma tabela de relatórios executivos, gerada pela função `relatorio-executivo` com a IA da Anthropic.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Resumo executivo | Texto cross-área da semana | Gerado por IA a partir dos dados brutos coletados | `resumo_executivo` |
| Cabeçalho (faturamento/NPS) | Números-chave da semana | Lidos de `dados_brutos.desempenho_atual` | tabela de relatórios |
| Modelo / tokens | Modelo usado e custo em tokens | Registrados na geração | `modelo_usado`, `tokens_input`, `tokens_output` |
| Período | Semana coberta | `periodo_ini`–`periodo_fim` | tabela de relatórios |

## Filtros e opções

- **Bar (selectedBar)**: todas as abas filtram pelo bar selecionado no topo do sistema. Integridade e Relatório IA têm seletor próprio (Todos / Ordinário / Deboche).
- **Período**: cada aba tem o seu — Engenharia e Garçons (7/30/60/90 dias), Combos (30/60/90/180 dias), Integridade (7/30/90 dias). Quality Score é sempre 12 semanas; Mapa de Calor e Previsão são fixos (90 dias e 14 dias à frente).
- **Métrica do Mapa de Calor**: alterna entre faturamento médio/hora e faturamento total de 90 dias.
- **Incluir [Banda] (Combos)**: por padrão remove pares que envolvem itens de banda; marque para incluí-los.
- **Ordenação (Garçons)**: reordena o ranking por faturamento, ticket médio, upsell de bebida ou desconto %.
- **Status (Integridade)**: filtra alertas por Abertos/Revisados/Falso positivo/Confirmado/Todos.
- **Classe ativa (Engenharia)**: clicar num dos 4 cards filtra a tabela por Stars/Plowhorses/Puzzles/Dogs.

## Regras e detalhes importantes

- **Sempre por `bar_id`**: todas as consultas filtram pelo bar. Bares atendidos: Ordinário (3) e Deboche (4).
- **Cortes de amostra**: engenharia exige ≥ 5 unidades vendidas por produto; ranking de garçons exige ≥ 20 comandas; combos exige ≥ 25 ocorrências por produto/par. Itens abaixo do corte não aparecem — não é bug, é para não gerar ruído estatístico.
- **Custo planilha-first**: custo manual (planilha de engenharia de cardápio ou edição na tela) sempre vence o custo do ContaHub. Produtos sem custo ficam fora da matriz e entram na lista "Produtos sem custo".
- **Margem negativa** (custo > preço) é sinalizada como provável erro de cadastro, não como prejuízo real.
- **Quality Score robusto a lacuna**: componente sem dado na semana (NULL) sai do cálculo em vez de zerar a nota — o peso dele é retirado do denominador.
- **Manual vs. automático**: preencher custo, tratar alerta e ignorar são ações manuais. Score, heatmap, combos e ranking são recalculados automaticamente pelas funções/views. Previsão, detector e relatório rodam por rotina, mas podem ser disparados manualmente na tela.
- **Estados vazios**: cada aba mostra mensagem própria quando não há dado (ex.: "Sem alertas — operação tranquila", "Todos os produtos do período têm custo").
- **Datas de vendas**: heatmap e combos usam `data/dt_gerencial` do ContaHub (a operação, com virada de madrugada), coerente com o resto do sistema.

## Dúvidas frequentes

**Por que um produto que eu vendo não aparece na matriz de engenharia?**
Ou vendeu menos de 5 unidades no período, ou está sem custo cadastrado. Sem custo, ele vai para a lista "Produtos sem custo" na sub-aba Custos — preencha lá para ele entrar na classificação.

**O que significa "Plowhorse" e "Dog"?**
Plowhorse é o produto muito vendido mas de margem baixa (popular, pouco lucro). Dog vende pouco e tem margem baixa — forte candidato a sair do cardápio. Stars vendem muito com boa margem; Puzzles têm boa margem mas vendem pouco (dá para promover).

**Confidence e lift são a mesma coisa nos combos?**
Não. Confidence é a chance de o cliente pedir B tendo pedido A. Lift mede se essa associação é maior do que o acaso — lift acima de 5 indica um combo realmente forte, não coincidência.

**A previsão de faturamento é garantida?**
Não. É a mediana das últimas 8 ocorrências do mesmo dia da semana, ajustada por atração e feriado, com um intervalo de confiança de 80%. Serve para planejar escala e compra, não como meta contratual.

**Quem pode editar o custo dos produtos?**
Só usuários admin ou financeiro. Os demais visualizam, mas o campo fica bloqueado.

**Gerar o Relatório IA custa alguma coisa?**
Consome tokens da Anthropic (por isso a tela pede confirmação). O consumo de tokens de cada relatório fica registrado no rodapé de cada card.

## Fonte dos dados

- **Quality Score**: view `gold.quality_scorecard` sobre `gold.desempenho`, `integrations.instagram_posts` e `integrations.instagram_conta_metricas` — origem ContaHub, Instagram, NPS (Falae/NPS digital) e reservas.
- **Engenharia de Cardápio**: função `gold.menu_engineering` e `public.cardapio_produtos_custo` sobre `silver.vendas_item` (ContaHub) + `operations.produto_custo_manual` (planilha/edição). Histórico via `cardapio_custo_mudancas` / `cardapio_custo_serie`.
- **Combos**: função `gold.produto_combos` sobre `gold.gold_contahub_avendas_porproduto_analitico` (ContaHub).
- **Garçons**: função `gold.garcom_performance` sobre `gold.gold_contahub_avendas_porproduto_analitico` (ContaHub, por `usr_lancou`).
- **Mapa de Calor**: view `gold.heatmap_vendas_dow_hora` sobre `bronze.bronze_contahub_avendas_vendasdiahoraanalitico` (ContaHub).
- **Previsão**: tabela `gold.demanda_previsoes`, preenchida pela função `prever-demanda` a partir de `operations.eventos`, `operations.feriados_eventos` e `gold.desempenho`.
- **Integridade**: schema `integridade.alertas`, gerado pela função `detector-fraude` (ContaHub).
- **Relatório IA**: tabela de relatórios executivos, gerada pela função `relatorio-executivo` (IA Anthropic) sobre dados de vendas, CMV, Instagram, NPS, alertas, clube e previsões.
