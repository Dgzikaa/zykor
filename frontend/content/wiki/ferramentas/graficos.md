---
title: Gráficos
area: ferramentas
slug: graficos
route: /graficos
description: Painel visual único que reúne, em oito abas, todos os indicadores que o Zykor enxerga do bar — do financeiro ao artístico, CMV, equipe e clientes.
order: 10
icon: LineChart
---

# Gráficos

## Visão geral

A tela **Gráficos** é o painel visual central do Zykor. Ela junta, em um só lugar e num formato de gráficos e cartões, praticamente tudo que o sistema mede sobre o bar: resultado financeiro, vendas e salão, desempenho por dia da semana, retorno das atrações, CMV e produção, equipe (RH) e clientes (CRM).

Diferente das telas operacionais (onde você lança, edita ou aprova algo), aqui **não se cadastra nem altera nada** — é uma tela de leitura, feita para o dono e a gestão baterem o olho e entenderem o pulso do negócio ao longo do tempo. Todos os números vêm de camadas já calculadas do sistema (DRE, desempenho semanal, RFM, etc.), então o que aparece aqui é o mesmo dado das telas específicas, só que consolidado visualmente.

Cada aba puxa seus dados de forma independente e mostra um spinner enquanto carrega. Se o bar não tem dado para aquele recorte, a aba mostra uma mensagem de "sem dados" em vez de gráficos vazios.

## Como acessar

- **Menu lateral:** item **Gráficos** (ícone de linha/gráfico), leva direto para `/graficos`.
- **Permissão:** a rota é protegida. É preciso ter o módulo **`gestao`** ou **`home`** liberado no seu perfil. Sem um desses módulos, o sistema devolve você para a home.
- **Seleção de bar obrigatória:** a tela sempre filtra por `bar_id`. Se nenhum bar estiver selecionado, aparece "Selecione um bar." no lugar dos gráficos.

## Passo a passo

### Escolher o recorte de tempo (ano/janela × mês específico)

No topo direito da tela existem dois controles que se excluem:

1. **Janela de meses (6m / 12m / 24m):** clique em `6m`, `12m` ou `24m` para definir quantos meses para trás as abas consideram. Vale para as abas que trabalham com janela móvel (Vendas, Por dia da semana, Artístico, CMV, Equipe, Clientes).
2. **Mês específico (zoom no mês):** no seletor à direita, escolha um mês (ex.: `jul/26`). Isso liga a **visão mensal** — as abas passam a mostrar o detalhe *dentro* daquele mês (semana a semana ou dia a dia) e desligam a janela de meses (os botões 6/12/24m ficam esmaecidos). Para voltar ao normal, selecione **"Ano inteiro"**.

> Regra de ouro do seletor: **"Ano inteiro" + 6/12/24m** = visão de tendência ao longo do tempo. **Escolher um mês** = mergulho detalhado naquele mês.

### Trocar de aba

3. Clique em uma das oito abas (Visão Geral, Financeiro, Vendas & Salão, Por dia da semana, Artístico, CMV & Produção, Equipe, Clientes). Cada troca carrega os dados daquela área. O recorte de tempo escolhido no topo continua valendo.

### Escolher o ano (abas Visão Geral, Financeiro e CMV)

4. Nas abas **Visão Geral**, **Financeiro** e **CMV & Produção**, quando você está em "Ano inteiro", aparece um seletor de **Ano** (ano atual, ano-1, ano-2). Ele define de qual ano vêm a DRE, o DFC e o CMV semanal. Ao escolher um mês específico, esse seletor some (o ano passa a ser o do mês escolhido).

### Ler os gráficos

5. Passe o mouse sobre qualquer ponto/barra para ver o valor exato (tooltip). Os cartões de KPI no topo de cada aba resumem os números-chave; alguns mostram a variação (delta) em relação ao período anterior.

## Abas e seções

| Aba | O que mostra |
|---|---|
| **Visão Geral** | Retrato executivo: Receita × Resultado por mês, público, composição do faturamento e faturamento semanal contra a meta. |
| **Financeiro** | DRE em cascata (da receita ao resultado), composição de custos, indicadores % da receita, fluxo de caixa (DFC) e recebimentos por meio de pagamento (Stone). |
| **Vendas & Salão** | Faturamento semanal × meta, ticket médio, composição e mix de vendas, heatmap dia × hora, stockout, reservas, público e NPS. |
| **Por dia da semana** | Médias por dia da semana (faturamento, público, ticket) a partir dos eventos realizados. |
| **Artístico** | Retorno das atrações: lift, "vale o cachê", retorno × cachê, aquisição de clientes, ranking e composição por label, público médio e NPS por label. |
| **CMV & Produção** | CMV limpo × teórico, valor de estoque, desvios (perda/sobra), top insumos em perda, gasto por fornecedor e nota/desvio das produções. |
| **Equipe (RH)** | Headcount, admissões/demissões, turnover, absenteísmo, custo de mão de obra, clima/felicidade, eNPS e produtividade. |
| **Clientes (CRM)** | Novos × retornantes, segmentação RFM, retenção por coorte, base ativa, engajamento, risco de churn e clube de fidelidade. |

## Colunas e cálculos

### Aba Visão Geral

| Indicador / Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Receita YTD | Receita acumulada no ano | Vem pronto do painel executivo (`dre.receita_ytd`) | painel-executivo |
| Resultado YTD | Lucro/prejuízo acumulado no ano | `dre.lucro_ytd` (fica vermelho se negativo) | painel-executivo |
| Margem YTD | Margem sobre a receita no ano | `dre.margem_ytd`; se vier como fração (≤1,5) é multiplicada por 100 | painel-executivo |
| Faturamento do mês | Faturamento do mês corrente + resultado | `dre.faturamento_mes` e `dre.lucro_mes` | painel-executivo |
| CMV | % de CMV vs meta | `cmv.pct` e `cmv.meta` (normalizados p/ %) | painel-executivo |
| Caixa projetado 90d | Saldo de caixa projetado p/ 90 dias | `fluxo.saldo90_base` (fica âmbar se `fluxo.aperta`) | painel-executivo |
| Receita × Resultado por mês | Linha de receita e resultado operacional por mês | Soma de `valor_com_sinal` por mês, só linhas com `ordem_macro ≤ 9`; receita = `ordem_macro = 1` | dre-excel (gold DRE) |
| Público por mês/semana | Clientes atendidos | `clientes_atendidos` do desempenho semanal, agregado por mês (ou por semana no zoom) | gold.desempenho semanal |
| Composição do faturamento | Couvert · Bar · Comível empilhados | `faturamento_entrada`, `faturamento_bar`, `faturamento_cmvivel` | gold.desempenho semanal |
| Faturamento semanal | Faturamento realizado × meta | `faturamento_total` por semana; meta fixa **R$ 263.000** | gold.desempenho semanal |

No modo mês, os KPIs mudam para: Receita, Resultado, Margem, Público, Fat. operacional e CMV, todos referentes **apenas ao mês escolhido**.

### Aba Financeiro

| Indicador / Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Receita YTD / Resultado YTD / Margem YTD | Totais do ano (meses fechados) | Soma de `valor_com_sinal` por bloco: receita = `ordem_macro 1`; resultado = soma de `ordem_macro 1..9` | dre-excel |
| Receita / Resultado (últ. mês) | Números do último mês fechado | Último mês da série de meses fechados | dre-excel |
| CMV / Receita | CMV como % da receita | `abs(ordem_macro 3) / receita × 100` (por mês) | dre-excel |
| Custos variáveis (%) | Custos variáveis como % da receita | `abs(ordem_macro 2) / receita × 100` | dre-excel |
| Mão de obra (%) | Mão de obra como % da receita | `abs(ordem_macro 4) / receita × 100` | dre-excel |
| DRE em cascata (waterfall) | Da Receita ao Resultado, descontando CMV, custos variáveis, mão de obra e despesas | Receita (`om 1`) → deltas de `om 3, 2, 4`, despesas (`om 5+6+7+8`), não operacional (`om 9`) → Resultado | dre-excel |
| Composição de custos (rosca) | Peso de cada bloco de custo | `abs` da soma por `ordem_macro` 2..8 (Custos Var., CMV, Mão de Obra, Desp. Comerciais/Admin./Operacionais, Ocupação) | dre-excel |
| Receita × Resultado por mês | Linha por mês | Igual à Visão Geral | dre-excel |
| Indicadores % da receita | CMV, Variáveis e Mão de obra em % por mês | Percentuais mensais acima | dre-excel |
| Fluxo de caixa por grupo | Net mensal Operacional/Investimento/Financiamento | Soma de `net` por mês, classificando `grupo_dfc` (operac./invest./financ.) | financeiro/dfc |
| Caixa acumulado | Variação de caixa somada ao longo do ano | Acúmulo mês a mês de (operacional + investimento + financiamento) | financeiro/dfc |
| Recebido por meio de pagamento (rosca) | Bruto por Crédito/Débito/Pix | Soma de `bruto` por `account_type` (1=Crédito, 2=Débito, 99=Pix) | conciliação Stone |
| Custo da maquininha (MDR) por tipo | % de taxa sobre o bruto | `taxa / bruto × 100` por tipo | conciliação Stone |

### Aba Vendas & Salão

| Indicador / Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Fat. última semana | Faturamento da última semana fechada | `faturamento_total`; delta vs semana anterior | gold.desempenho semanal |
| Ticket médio | Gasto médio por pessoa | `ticket_medio` | gold.desempenho semanal |
| Público | Clientes atendidos | `clientes_atendidos` | gold.desempenho semanal |
| % clientes novos | Fatia de clientes novos | `perc_clientes_novos` | gold.desempenho semanal |
| Reservas presentes | Pessoas presentes × reservadas | `reservas_presentes_pessoas` / `reservas_totais_pessoas` | gold.desempenho semanal |
| Quebra de reservas | % de no-show | `reservas_quebra_pct` | gold.desempenho semanal |
| Faturamento semanal | Realizado × meta (R$ 263k) | `faturamento_total` vs meta fixa | gold.desempenho semanal |
| Ticket médio decomposto | Couvert + Bar por semana | `tm_entrada` + `tm_bar` | gold.desempenho semanal |
| Composição do faturamento | Couvert · Bar · Comível | `faturamento_entrada`, `faturamento_bar`, `faturamento_cmvivel` | gold.desempenho semanal |
| Mix de vendas | % Bebidas · Drinks · Comida | `perc_bebidas`, `perc_drinks`, `perc_comida` | gold.desempenho semanal |
| Heatmap dia × hora | Onde/quando a receita se concentra | `faturamento_medio` por dia da semana × hora | insights/curva-horaria |
| Stockout por área | % de ruptura Bar/Comidas/Drinks | `stockout_bar_perc`, `stockout_comidas_perc`, `stockout_drinks_perc` (só aparece se houver dado) | gold.desempenho semanal |
| Reservas — reservadas × presentes | Pessoas por semana | `reservas_totais_pessoas` × `reservas_presentes_pessoas` | gold.desempenho semanal |
| Público — atendidos × ativos | Público vs base ativa | `clientes_atendidos` × `clientes_ativos` | gold.desempenho semanal |
| Antecipação da receita | % Happy Hour · % até 19h | `perc_happy_hour`, `perc_faturamento_ate_19h` | gold.desempenho semanal |
| NPS geral por semana | Satisfação do público | `nps_geral` (só aparece se houver NPS ≠ 0) | gold.desempenho semanal |

### Aba Por dia da semana

Considera apenas eventos realizados com faturamento (`real_r`) **acima de R$ 1.000**. Agrupa por dia da semana (segunda a domingo).

| Indicador / Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Melhor / Pior dia (faturamento) | Dia com maior/menor faturamento médio | `fat_medio` = média de `real_r` por evento naquele dia da semana | eventos_base |
| Maior público médio | Dia com mais gente por evento | `publico_medio` = média de `max(cl_real, publico_real)` por evento | eventos_base |
| Maior ticket médio | Dia com maior gasto por pessoa | `ticket_medio` = média de `t_medio` (só eventos com ticket > 0) | eventos_base |
| Eventos analisados | Quantos eventos entraram na conta | Contagem de eventos válidos no período | eventos_base |
| Faturamento médio por dia (barras) | Média de faturamento por evento em cada dia | `fat_medio` | eventos_base |
| Público médio por dia (barras) | Média de pessoas por evento | `publico_medio` | eventos_base |
| Ticket médio por dia (barras) | Gasto médio por pessoa | `ticket_medio` | eventos_base |

### Aba Artístico

| Indicador / Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Artistas / Shows | Total de atrações e de shows no período | `stats.total_atracoes`, `stats.total_shows` | analitico/atracoes |
| Faturamento / Cachê pago | Total faturado e total de cachê | `stats.fat_total`, `stats.custo_total` | analitico/atracoes |
| ROI médio | Retorno médio das atrações | `stats.roi_medio` (%) | analitico/atracoes |
| Maior lift | Artista com maior faturamento incremental | `stats.top_lift` | analitico/atracoes |
| Lift de faturamento por artista | Quanto o artista rende acima da média do mesmo dia-da-semana sem ele | `lift_fat` por artista (barra divergente) | analitico/atracoes |
| Vale o cachê? | Lift por show menos o cachê médio | `saldo_cachet`, ou `lift_fat − custo_medio` | analitico/atracoes |
| Retorno × cachê (bolhas) | Cachê médio (x) × retorno (y), bolha = público | `custo_medio`, `retorno`, `publico_medio` | analitico/atracoes |
| Quem traz e fixa cliente | Novos clientes (x) × % que fidelizou (y), bolha = faturamento | `novos`, `pct_fideliza`, `fat_total` | analitico/atracoes |
| Faturamento por label | Ranking das noites recorrentes | `fat_total` por label | analitico/labels |
| Composição por label | Bar · Couvert · Bilheteria (top 8 labels) | `composicao.bar/couvert/bilheteria` | analitico/labels |
| Público médio por artista | Média de pessoas por noite quando o artista foi o principal | `publico_medio` | analitico/atracoes |
| NPS por label | Satisfação (promotores − detratores) por noite | `nps_score` por label | analitico/labels |

### Aba CMV & Produção

| Indicador / Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| CMV limpo | % de CMV real (dado limpo) da última semana com dado | `cmv_limpo_percentual` | cmv-semanal |
| CMV teórico | % que a ficha técnica prevê | `cmv_teorico_percentual` | cmv-semanal |
| Gap (limpo−teórico) | Distância entre real e teórico | `cmv_limpo − cmv_teorico` (na última semana com ambos) | cmv-semanal |
| Valor em estoque | R$ parado em estoque | `estoque_final_cozinha + bebidas + drinks` na última semana com estoque | cmv-semanal |
| Perda (últ. contagem) | Perda valorizada da última contagem | Soma dos desvios negativos por área | operacional/desvios |
| Compras no período | Total gasto com fornecedores | Soma do valor dos top fornecedores | operacional/compras |
| CMV limpo × teórico (linha) | % por semana | `cmv_limpo_percentual` × `cmv_teorico_percentual` (a linha para onde o dado acaba; 0 vira nulo) | cmv-semanal |
| Valor de estoque por categoria | R$ de estoque Cozinha/Bebidas/Drinks | `estoque_final_*` empilhado por semana | cmv-semanal |
| Desvios — perda × sobra por área | R$ da última contagem semanal | Desvio (`desvio_rs`) < 0 = perda, > 0 = sobra, agrupado por área (exclui produção) | operacional/desvios |
| Top insumos em perda | Maiores perdas valorizadas | `abs(desvio_rs)` dos itens com desvio negativo e dado limpo, top 14 | operacional/desvios |
| Gasto por fornecedor | Top fornecedores | `valor` por fornecedor, top 14 | operacional/compras |
| Nota das produções | % dentro do rendimento esperado (±5%) | Fração de execuções com `rendimento_real/esperado` dentro de ±5%, por semana | producoes/execucao |
| Desvio de custo das produções | Real − planejado por semana | `custo_real − custo_planejado` somado por semana | producoes/execucao |

### Aba Equipe (RH)

| Indicador / Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Headcount ativo | Pessoas ativas hoje | `headcount.ativos` (sub: inativos) | rh/funcionarios/dashboard |
| Tempo de casa médio | Meses médios de casa | `headcount.tempo_casa_medio_meses` | rh/funcionarios/dashboard |
| Turnover 12m | % de rotatividade em 12 meses | `resumo.turnover_12m` | rh/indicadores |
| Admissões 12m | Contratações no ano | `resumo.admissoes_12m` | rh/indicadores |
| Felicidade | % de satisfação interna | `felicidade.pct` (sub: nº de respostas) | rh/funcionarios/dashboard |
| eNPS | Índice de recomendação da equipe | `enps.enps` (sub: nº de pulsos) | rh/enps |
| Admissões × Demissões | Movimentação de pessoas por mês | `admissoes` × `demissoes` (por mês) | rh/indicadores |
| Headcount por tipo de contrato | CLT · PJ · Freela ativos | `headcount.por_tipo` | rh/funcionarios/dashboard |
| Evolução do headcount | Pessoas ativas ao fim de cada mês | `headcount` mensal | rh/indicadores |
| Turnover mensal | % de rotatividade por mês | `turnover` mensal | rh/indicadores |
| Headcount por área | Pessoas por setor | `headcount.por_area` | rh/funcionarios/dashboard |
| Absenteísmo | Faltas e atestados por mês | `faltas`, `atestados` mensais | rh/indicadores |
| Custo de mão de obra | Freelas × fixo estimado por semana | `freelas_custo` + `fixo_estimado`, agregado por semana | rh/custo-mo |
| Clima — dimensões (radar) | Média por dimensão da pesquisa | `felicidade.dimensoes` | rh/funcionarios/dashboard |
| Felicidade ao longo do tempo | % por pesquisa | `felicidade.trend` | rh/funcionarios/dashboard |
| eNPS — composição | Promotores/Neutros/Detratores | `promotores`, `neutros`, `detratores` | rh/enps |
| Produtividade da equipe | % de conclusão de checklists por pessoa (90d) | `taxa_conclusao` do ranking de funcionários | exploracao/equipe |

### Aba Clientes (CRM)

| Indicador / Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Base ativa | Clientes ativos no último mês | `baseAtiva`; delta vs mês anterior | clientes-ativos/evolucao |
| Novos no mês | Clientes novos | `novosClientes` (sub: % do total) | clientes-ativos/evolucao |
| Retornantes no mês | Clientes que voltaram | `clientesRetornantes` | clientes-ativos/evolucao |
| Campeões (RFM) | Clientes no segmento "campeões" | Nº e valor do segmento que casa com "campe..." | analitico/clientes/rfm |
| Em risco (RFM) | Clientes no segmento "em risco" | Nº e valor do segmento que casa com "risco" | analitico/clientes/rfm |
| LTV médio | Valor médio do cliente ao longo da vida | `ltv_medio_atual` (sub: clientes confiáveis) | crm/ltv-engajamento |
| Novos × Retornantes por mês | Composição da base atendida | `novosClientes` × `clientesRetornantes` empilhados | clientes-ativos/evolucao |
| Segmentação RFM (barras) | Clientes por segmento | `clientes` por segmento | analitico/clientes/rfm |
| Mapa de comportamento RFM (bolhas) | Recência × Frequência, bolha = nº de clientes | `recencia_media`, `frequencia_media`, `clientes` | analitico/clientes/rfm |
| Valor por segmento | R$ acumulado por segmento | `valor_total` por segmento | analitico/clientes/rfm |
| Retenção por coorte (heatmap) | % que voltou X meses após a 1ª visita | `clientes` do mês-offset ÷ base da coorte (offset 0) × 100 | analitico/clientes/retencao |
| Base ativa por mês | Clientes ativos ao longo do tempo | `baseAtiva` mensal | clientes-ativos/evolucao |
| Engajamento da base | Distribuição por nível de engajamento | `engajamento_muito_alto/alto/medio/baixo` | crm/ltv-engajamento |
| Risco de churn | Clientes por nível de risco | `critico/alto/medio/baixo` (centro: valor em risco) | crm/churn-prediction |
| Clube — membros por nível | Fidelização por tier (bronze→platina) | `por_nivel` (exclui sem nível) | crm/clube |
| Clube — por segmento | Membros por estágio de relacionamento | `por_segmento` (centro: total de membros) | crm/clube |

## Filtros e opções

| Filtro | Onde | Efeito |
|---|---|---|
| **Bar** | Seletor global (header) | Todo dado é filtrado por `bar_id`. Sem bar selecionado, a tela não carrega. |
| **Janela de meses (6/12/24m)** | Topo direito | Define o alcance para trás das abas com janela móvel. Fica desativado no modo mês. |
| **Mês específico** | Topo direito | Liga o zoom no mês: as abas passam a mostrar o detalhe interno (semana/dia). "Ano inteiro" desliga. |
| **Ano** | Abas Visão Geral, Financeiro e CMV (só em "Ano inteiro") | Escolhe de qual ano vêm DRE, DFC e CMV semanal. |
| **Meta fixa** | Gráficos de faturamento | A linha de meta é **fixa em R$ 263.000** por semana (valor codificado, não configurável na tela). |

## Regras e detalhes importantes

- **Sempre por bar:** cada requisição envia `bar_id`. A tela nunca mistura bares.
- **Meses/semanas fechados:** as abas Visão Geral e Financeiro descartam o mês corrente parcial e a semana corrente parcial, para não mostrar um período "pela metade" como se fosse fechado. No modo mês, porém, mostra-se exatamente o mês pedido (mesmo se corrente).
- **DRE por `ordem_macro`:** a lógica financeira classifica cada linha pelo bloco: 1 = Receita, 2 = Custos Variáveis, 3 = CMV, 4 = Mão de Obra, 5–8 = Despesas (Comerciais/Administrativas/Operacionais/Ocupação), 9 = Não operacional. Linhas com `ordem_macro > 9` (Investimentos, Dividendos, Não Mapeado) ficam **de fora** do resultado operacional.
- **Percentuais normalizados:** alguns indicadores (margem, CMV) podem chegar como fração (0–1,5) ou como número já em %. A tela detecta e multiplica por 100 quando necessário.
- **CMV teórico atrasado:** o CMV teórico depende de fichas e costuma "atrasar" ~3 semanas; por isso a linha para onde o dado acaba, em vez de mergulhar a zero.
- **Meta de faturamento fixa:** R$ 263k por semana é um valor codificado — vale como referência visual, não como meta configurável por bar.
- **Evento válido:** na aba Por dia da semana, só entram eventos com faturamento real acima de R$ 1.000 (mesma régua das demais análises artísticas).
- **Stone:** os dados de meio de pagamento e MDR vêm da conciliação Stone; no modo "Ano inteiro" a janela é dos **últimos 90 dias**, no modo mês é o mês escolhido.
- **Estados vazios:** cada aba tem sua própria mensagem de "sem dados" e vários gráficos só aparecem se houver dado (stockout, NPS, turnover, absenteísmo, custo de MO, engajamento, churn, clube).
- **Tudo automático:** nada nesta tela é preenchido à mão — todos os números derivam das camadas já calculadas do Zykor (DRE, desempenho semanal, RFM, etc.).

## Dúvidas frequentes

**Consigo editar ou lançar algo aqui?**
Não. Gráficos é uma tela só de leitura. Para corrigir um número, ajuste na origem (DRE/orçamentação, CMV, produções, etc.).

**Por que o mês atual não aparece em alguns gráficos?**
As abas de tendência descartam o período corrente parcial para não comparar um mês incompleto com meses fechados. Para ver o mês em andamento, selecione-o no seletor de mês (zoom).

**A meta de R$ 263 mil vale para o meu bar?**
Essa linha de meta é um valor de referência fixo no código, igual para todos. Use-a como baliza visual, não como meta oficial do bar.

**Por que a aba Artístico/CMV mostra "sem dados"?**
Ou não há eventos/atrações no período escolhido, ou o dado ainda não foi calculado (ex.: CMV teórico atrasa algumas semanas). Amplie a janela de meses ou escolha outro período.

**Qual a diferença entre CMV limpo e teórico?**
O **limpo** é o CMV real medido (com o dado já higienizado); o **teórico** é o que as fichas técnicas preveem. O **gap** entre eles indica perda, desperdício ou erro de ficha.

**Os números batem com as outras telas?**
Sim — esta tela reusa as mesmas fontes (DRE, desempenho semanal, RFM, Stone, etc.). Se divergir, geralmente é diferença de recorte de tempo (janela × mês, período parcial descartado).

## Fonte dos dados

A tela não tem base própria: ela consome APIs que já entregam dados calculados. Principais fontes por aba:

- **Visão Geral / Financeiro:** `gold` DRE (via `dre-excel`), painel executivo, DFC (`financeiro/dfc`), conciliação **Stone** (`financeiro/conciliacao/analise`).
- **Vendas & Salão / Visão Geral:** `gold.desempenho` (granularidade semanal, materializada) via `api/graficos/desempenho`; heatmap de `insights/curva-horaria`. Origem primária: **ContaHub** (vendas), reservas (GetIn), NPS.
- **Por dia da semana:** `public.eventos_base` (view de `operations.eventos_base`) via `api/graficos/por-dia-semana`. Origem: **ContaHub**.
- **Artístico:** `analitico/atracoes` e `analitico/labels`. Bilheteria de labels vem de **Yuzer/Sympla**.
- **CMV & Produção:** `cmv-semanal`, `operacional/compras` (**VMarket**), `operacional/desvios`, `producoes/execucao`.
- **Equipe (RH):** `rh/indicadores`, `rh/funcionarios/dashboard`, `rh/enps`, `rh/custo-mo`, `exploracao/equipe`.
- **Clientes (CRM):** `clientes-ativos/evolucao`, `analitico/clientes/retencao`, `analitico/clientes/rfm`, `crm/ltv-engajamento`, `crm/churn-prediction`, `crm/clube`. Base de clientes: **ContaHub**.
