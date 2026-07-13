---
title: Eventos
area: receitas
slug: eventos
route: /analitico/eventos
description: Raio-X de um evento (ou de uma semana/mês inteiro) — faturamento, custo artístico, público, mix de consumo, planejado vs realizado, NPS e um diagnóstico automático que compara com datas equivalentes.
order: 50
icon: BarChart3
---

# Eventos

## Visão geral

A tela **Eventos** (Análise de Eventos) é o raio-X de uma noite do bar. Você escolhe uma data e a tela mostra, para aquele evento: quanto faturou, quanto a atração custou, qual foi o resultado (faturamento menos custos), quantas pessoas vieram, como foi o mix de consumo (comida / bebida / drink), como estava a operação (stockout, atrasos, reservas) e a qualidade percebida (NPS e comentários). Além disso, um **diagnóstico automático** compara o evento com a média das datas equivalentes anteriores e escreve, em texto, o que puxou o resultado para cima ou para baixo.

A mesma tela também trabalha em três granularidades: **dia**, **semana** e **mês**. Em semana ou mês ela soma/consolida todos os eventos do período e passa a comparar com o período anterior, virando um resumo executivo de programação.

Quem usa no dia a dia: dono, sócios e gestão de programação/marketing, para responder "esse show valeu a pena?", "por que a sexta faturou menos?" e "batemos a meta que planejamos para essa semana?".

## Como acessar

No menu lateral: área **Receitas → Eventos** (ícone de gráfico de barras), rota `/analitico/eventos`.

A tela exige a permissão de módulo **`relatorios`** (mesma família das telas de Receitas/Clientes). Sem essa permissão o item nem aparece no menu.

Você também pode chegar aqui por link direto vindo do **Planejamento** — nesse caso a data já vem preenchida na URL (`?data=AAAA-MM-DD`).

## Passo a passo

**1. Ver a análise de uma noite específica**
1. Abra **Receitas → Eventos**.
2. Confirme que o bar certo está selecionado no seletor de bar (topo do sistema). Toda a tela é filtrada pelo bar ativo.
3. Deixe a granularidade em **dia** (é o padrão).
4. No seletor de **Data**, escolha o dia do evento. Por padrão a tela abre em **ontem**.
5. A tela recarrega e mostra o cabeçalho do evento (atração, faturamento e resultado) e as abas de detalhe.

**2. Analisar uma semana ou um mês inteiro**
1. No grupo de botões **dia / semana / mês**, clique em **semana** ou **mês**.
2. Em **semana**, escolha qualquer dia da semana desejada — a tela monta a semana de segunda a domingo que contém aquela data.
3. Em **mês**, o seletor vira um seletor de mês; escolha o mês.
4. A tela passa a somar todos os eventos do período e a comparar com o período anterior (semana anterior / mês anterior).

**3. Ler o diagnóstico automático**
1. Na aba **Visão Geral** (e também na **Qualidade**), o primeiro cartão é o **Diagnóstico**.
2. O selo colorido (verde/âmbar/vermelho) resume o veredito: **bom**, **dentro do esperado** ou **abaixo do esperado**.
3. Os quadros abaixo explicam em texto o que mudou (faturamento, público, ticket, custo artístico, mix, stockout, atrasos, resultado) em relação ao comparativo.

**4. Auditar o mix de consumo**
1. Na aba **Visão Geral**, seção **Operação & Mix**, clique no cartão **Mix de consumo** (só disponível na visão de dia).
2. Abre um modal com **todos os produtos** que entraram em cada categoria, com origem (ContaHub / Yuzer), grupo, quantidade e valor.
3. Eco copos, ingressos e itens "fora da cesta" aparecem separados e **não** contam no percentual do mix.

**5. Comparar planejado com realizado**
1. Abra a aba **Planejado vs Real**.
2. Veja os cartões Faturamento (meta M1), Custo artístico, Custo produção e % Artístico/Faturamento, cada um com Planejado | Realizado | variação.
3. Na visão de dia, role até **Histórico do plano (fotos)** para ver a evolução do plano inicial → revisões → realizado final.
4. Na visão de semana/mês, veja o gráfico e a tabela por evento.

**6. Comparativo entre eventos**
- No topo direito, o botão **Comparativo** leva para `/analitico/eventos/comparativo`, uma tela separada para confrontar eventos lado a lado.

## Abas e seções

Acima das abas, sempre aparece o **cabeçalho do evento**: nome da atração (ou "N eventos no período"), a data/rótulo do período, o **Faturamento** com a variação vs comparativo, e o **Resultado** (faturamento − custos, verde se positivo e vermelho se negativo).

| Aba | O que traz |
|---|---|
| **Visão Geral** | Diagnóstico automático + KPIs em blocos: Resultado do evento, Receita & Tickets, Ritmo até 19h/20h (só no dia), Operação & Mix, Clientes & Atração, Cancelamentos & Conta Assinada, e observações. |
| **Planejado vs Real** | Comparação da "foto" congelada do plano (meta M1 + custos previstos) contra o realizado (faturamento + custos do Conta Azul). Histórico de snapshots no dia; gráfico e tabela por evento na semana/mês; contexto de datas especiais. |
| **Relatórios** | Gráficos: faturamento por hora e consumo por horário (só no dia), faturamento vs público/reservas, custo artístico, evolução do mix, ticket médio; no período, leituras por dia da semana e NPS por dia; tabela de produtos mais vendidos do dia. |
| **Público** | Total de clientes, novos, recorrentes e ativos (via base de clientes), composição do público, e bloco de reservas (totais, presentes, quebra e mesas). |
| **Qualidade** | NPS geral e por categoria, stockout por categoria, tempos e atrasos (cozinha/bar) e comentários/reclamações. |

## Colunas e cálculos

### Cabeçalho e cartões da Visão Geral

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Atração / Nome do evento | Título do show/evento | `artista` → senão `nome` → senão `nome_evento`; em período vira "N eventos no período" | gold.planejamento |
| Faturamento | Receita total do evento/período | `faturamento_total_consolidado`; se 0, cai em `real_r`. No período (semana/mês) vem de `gold.desempenho.faturamento_total`, ou da soma dos eventos se a linha de desempenho ainda não existir | gold.planejamento / gold.desempenho |
| Custo Artístico | Cachê da atração | Campo `c_art`. No período, é substituído pelo **total do Conta Azul** da categoria "Atrações Programação" | gold.planejamento / bronze_contaazul_lancamentos |
| Custo Produção | Custos de produção do evento | Campo `c_prod`. No período, total do Conta Azul da categoria "Produção Eventos" | gold.planejamento / bronze_contaazul_lancamentos |
| Resultado | Sobra do evento | `faturamento − (c_art + c_prod)`. Verde se ≥ 0, vermelho se < 0 | cálculo na API |
| % do faturamento (sub do Custo Artístico) | Peso do cachê na receita | `c_art / faturamento × 100` | cálculo na API |
| Margem (sub do Resultado) | Margem do resultado | `resultado / faturamento × 100` | cálculo na API |
| Entrada (Couvert) | Receita de entrada/couvert | `faturamento_couvert_manual` (se houver) senão `faturamento_couvert`. No período, `couvert_atracoes` do desempenho | gold.planejamento / gold.desempenho |
| Bar | Receita de consumo no bar | `faturamento_bar_manual`/`faturamento_bar`; se 0, vira `faturamento − couvert` (o "resto") | gold.planejamento / gold.desempenho |
| Ticket Médio | Consumo médio por pessoa | `t_medio`; se 0, `faturamento / público` | gold.planejamento |
| Público | Pessoas no evento | `publico_real_consolidado` → `publico_real` → `cl_real`. No período, `clientes_atendidos` do desempenho | gold.planejamento / gold.desempenho |
| Faturamento até 19h / 20h | Receita acumulada até o corte | `fat_19h` / `fat_20h` (com `fat_19h_percent`/`fat_20h_percent` = % do dia) | operations.eventos_base (ao vivo) |
| Pessoas até 19h / 20h | Comandas abertas até o corte | `pessoas_ate_19h` / `pessoas_ate_20h`; sub = % do público total | operations.eventos_base (ao vivo) |
| % Stockout | Percentual de ruptura de estoque | Campo `percent_stockout`; fica vermelho a partir de 15% | gold.planejamento / gold.desempenho |
| Atrasos | Atrasos de atendimento | `atrasao_cozinha + atrasao_bar`; sub detalha coz e bar; vermelho a partir de 10 | gold.planejamento / gold.desempenho |
| Reservas | Reservas totais | Campo `res_tot` (no período, `reservas_totais_quantidade`) | gold.planejamento / gold.desempenho |
| Mix de consumo (Comida/Bebida/Drink) | Divisão % do consumo | No dia, recalculado da mesma fonte do modal (cesta ContaHub por grupo + Yuzer): `valor da categoria / total da cesta × 100`. No período, média ponderada por faturamento de `percent_c/b/d` | RPC `evento_cesta_detalhe` / gold |
| Clientes novos | Clientes sem visita anterior | `novos` do perfil; sub = % dos identificados | RPC `evento_clientes_perfil` (silver.cliente_visitas) |
| Recorrentes | Clientes que já vieram antes | `recorrentes` do perfil | RPC `evento_clientes_perfil` |
| Taxa de retorno | Quem voltou em 30 dias | `retornaram_30d / total × 100`; sub mostra também 60d | RPC `evento_clientes_perfil` |
| ROI da atração | Retorno do cachê | `(faturamento − faturamento médio do baseline) / c_art` — faturamento incremental sobre a média do mesmo dia da semana, por R$ de cachê. Aparece em "x" | cálculo na API |
| Cancelamentos | Valor cancelado | Soma de `custototal` dos cancelamentos do dia/período (o gold vem 0, por isso busca direto) | bronze_contahub_avendas_cancelamentos |
| Conta Assinada | Valor em conta assinada | Soma de `valor` dos pagamentos com meio = "Conta Assinada"; sub = % do faturamento | bronze_contahub_financeiro_pagamentosrecebidos |
| Descontos | Descontos concedidos | Campo `descontos` | gold.planejamento / gold.desempenho |
| Eco Copos | Valor/quantidade de eco copos | `eco_copo_valor` / `eco_copo_qtd` (só eventos Yuzer) | RPC `yuzer_cesta_evento` |
| Consumação Artistas | Comp de consumo dos artistas | Soma de `valor` da consumação de artistas do dia (descontos ContaHub motivo "Artistas") | silver.consumacao_artistas |

Nota sobre os deltas (setinhas ▲/▼): quase todo cartão mostra a variação percentual `(atual − base) / base × 100`. No **dia**, a base é a **média das últimas 4 datas do mesmo dia da semana** (com faturamento e público > 0). Em **semana/mês**, a base é o **período anterior**.

### Aba Planejado vs Real

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Faturamento (meta M1) — Planejado | Meta congelada no lançamento | `fat_planejado` somado dos eventos | operations.v_evento_plano_vs_real |
| Faturamento — Realizado | Faturamento real | `fat_realizado` somado dos eventos | operations.v_evento_plano_vs_real |
| Custo artístico Plan/Real | Cachê previsto vs real | `c_art_planejado` vs `c_art_realizado` (real do Conta Azul; pode subir conforme liquida) | operations.v_evento_plano_vs_real |
| Custo produção Plan/Real | Produção prevista vs real | `c_prod_planejado` vs `c_prod_realizado` | operations.v_evento_plano_vs_real |
| % Artístico / Faturamento | Peso do cachê, plano vs real | `c_art / faturamento × 100` de cada lado; delta em pontos percentuais | cálculo na API |
| Δ% (resumo) | Desvio do faturamento | `(realizado − planejado) / planejado × 100` | cálculo na API |
| Tabela por evento: Meta M1 / Faturou / Δ% / %Art plan / %Art real / revisões | Linha por evento do período | Campos da view por evento; `n_revisoes` marca quantas vezes o plano foi revisado | operations.v_evento_plano_vs_real |
| Histórico do plano (fotos) | Linha do tempo inicial → revisões → final | Snapshots (`tipo`, `versao`, faturamento, c_art, c_prod, %art) | operations.evento_plano_snapshots |
| Contexto de datas | Feriado/data especial + fator histórico | `ajuste_ord`/`ajuste_deb` (bar 3/4): % do faturamento normal esperado para a data (< 90% = alerta de meta otimista) | operations.feriados_eventos |

### Aba Público

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total de Clientes | Clientes no período | `totalClientes` da API de clientes ativos | /api/clientes-ativos |
| Novos Clientes | Primeira visita | `novosClientes`; sub = % do total | /api/clientes-ativos |
| Recorrentes | Já visitaram antes | `clientesRetornantes`; sub = % do total | /api/clientes-ativos |
| Clientes Ativos | Base ativa do bar | `clientesAtivos` | /api/clientes-ativos |
| Composição do público | Barra novos × recorrentes | `percentualNovos` e `percentualRetornantes` | /api/clientes-ativos |
| Reservas | Reservas totais | `res_tot` | gold.planejamento / gold.desempenho |
| Reservas presentes | Reservas que sentaram | `res_p` | gold.planejamento / gold.desempenho |
| Quebra de reserva | No-show + canceladas | `reservas_quebra_pct` | gold.desempenho |
| Mesas | Presentes / total | `mesas_presentes` / `mesas_totais` | gold.desempenho |

Os cartões de reservas comparam com o período anterior (delta); os de clientes comparam com a data/semana/mês anterior conforme a granularidade.

### Aba Qualidade

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| NPS geral | Nota de recomendação | No dia, agregado do dia; na semana/mês, `nps_geral` do desempenho | silver.nps_diario (dia) / gold.desempenho (período) |
| Respostas | Quantidade de respostas de NPS | `respostas` da fonte de NPS | silver.nps_diario / gold.desempenho |
| NPS por categoria | Atendimento, Comida, Drink, Ambiente, Música, Preço | Campos `nps_*` da fonte | silver.nps_diario / gold.desempenho |
| Stockout por categoria | Ruptura Geral/Bebidas/Comidas/Drinks | `percent_stockout`, `stockout_bebidas_perc`, `stockout_comidas_perc`, `stockout_drinks_perc` (verde < 10%, âmbar 10–25%, vermelho ≥ 25%) | gold.planejamento / gold.desempenho |
| Atrasos cozinha / bar | Quantidade de atrasos | `atrasao_cozinha` / `atrasao_bar`; sub mostra os "atrasinhos" | gold |
| Tempo médio cozinha / bar | Tempo de preparo | `t_coz` / `t_bar`, convertido de **segundos** para minutos (÷ 60) | gold |
| Comentários do dia | Reclamações/elogios do NPS | Lista de comentários | /api/nps |

### Aba Relatórios (gráficos)

| Gráfico | O que mostra | Base |
|---|---|---|
| Faturamento por hora | Curva de venda ao longo da noite (só no dia) | HorarioPicoChart (ContaHub) |
| Consumo por horário | Top produtos por hora (só no dia) | ConsumoPorHorarioChart |
| Faturamento vs público/reservas | Barra (faturamento) + linhas (público, reservas) por data | baseline/eventos do período |
| Custo artístico | Cachê por data/evento | baseline/eventos |
| Evolução do mix (%) | Comida/bebida/drink 100% empilhado por data | baseline/eventos |
| Ticket médio | Consumo por pessoa por data/evento | baseline/eventos |
| Por dia da semana (período) | Faturamento médio, público médio, cancelamentos e conta assinada agregados por dia da semana | eventos do período |
| NPS por dia (período) | Score (linha, −100 a 100) + respostas (barra) | silver.nps_diario |
| Produtos mais vendidos (dia) | Tabela de produtos do dia | ProdutosDoDiaDataTable |

## Filtros e opções

- **Bar**: sempre o bar selecionado no topo do sistema. Toda query filtra por `bar_id`; a tela não mistura bares.
- **Data**: seletor de dia (padrão = ontem). Em granularidade mês vira seletor de mês.
- **Granularidade (dia / semana / mês)**: muda o recorte e a base de comparação. No dia compara com as 4 datas equivalentes; na semana/mês compara com o período anterior e troca a fonte principal para `gold.desempenho`.
- **Comparativo**: botão que abre a tela dedicada de comparação entre eventos.
- Alguns cartões só aparecem quando fazem sentido: **Ritmo até 19h/20h**, **Mix clicável**, **Produtos do dia** e **Faturamento por hora** só na visão de **dia**; **NPS por dia** e **Por dia da semana** só em **período**; **Eco Copos** só em eventos Yuzer; **Consumação Artistas** só quando há valor.

## Regras e detalhes importantes

- **Filtro por bar**: obrigatório em toda consulta. A tela usa o bar ativo; para eventos Yuzer/Sympla o breakdown de entrada/couvert/bar é sobreposto por `operations.eventos_base` para os gráficos fecharem em 100%.
- **Fonte muda com a granularidade**: no **dia**, a fonte é `gold.planejamento`. Na **semana/mês**, a fonte canônica é `gold.desempenho` (a mesma da tela de Desempenho) — só cai para a soma do planejamento se a linha de desempenho ainda não existir (período em aberto).
- **Custos em período são do Conta Azul, por competência**: em semana/mês, `c_art` e `c_prod` são substituídos pelo total do Conta Azul (categorias "Atrações Programação" e "Produção Eventos"), por `data_competencia`, ignorando lançamentos excluídos. É a fonte autoritativa do P&L, e pode divergir do gold por-evento.
- **Cancelamentos e Conta Assinada vêm direto do bronze**: `gold.planejamento` não popula esses campos (vinham 0), então a tela lê ContaHub direto por `dt_gerencial`.
- **Baseline do dia**: só entram no comparativo as até 4 datas anteriores do mesmo dia da semana **com faturamento e público > 0**. Sem histórico suficiente, o diagnóstico avisa "Sem histórico comparável".
- **Veredito do diagnóstico**: baseado na variação de faturamento vs base — **bom** se ≥ +8%, **ruim** se ≤ −10%, senão **regular**. Os insights disparam por limiares (público ±10%, ticket ±8%, custo artístico ±15%, stockout ≥ 15%, atrasos ≥ 5, etc.).
- **Tempos em segundos**: `t_coz`/`t_bar` são gravados em segundos e a tela converte para minutos (ex.: 546s ≈ 9,1 min).
- **Mix não inclui tudo**: no detalhe do mix, eco copos, ingressos e itens "fora da cesta" aparecem separados e **não** entram no percentual comida/bebida/drink.
- **Estados vazios**: se não houver evento na data, a tela mostra "Nenhum evento encontrado para esta data" (verifique se o bar abriu). Sem plano congelado, a aba Planejado avisa que a foto passa a ser registrada a partir de agora.

## Dúvidas frequentes

**Por que o faturamento aqui é diferente da tela de Desempenho?**
No dia, os números vêm de `gold.planejamento`; na semana/mês a fonte passa a ser exatamente `gold.desempenho`, a mesma do Desempenho, para bater. Custos no período vêm do Conta Azul, o que pode explicar diferenças de custo.

**O que significa "Resultado"?**
É o faturamento menos o custo artístico e o custo de produção do evento. Não é o lucro final do bar (não desconta CMV, folha, etc.), e sim o resultado direto da atração/produção.

**O ROI da atração de "2,5x" quer dizer o quê?**
Que, para cada R$ 1 de cachê, o evento faturou R$ 2,50 **a mais** do que a média das datas equivalentes. É faturamento incremental sobre o cachê, não o retorno absoluto.

**Por que o custo artístico "Realizado" está menor que o planejado e pode mudar depois?**
O realizado vem do Conta Azul conforme os lançamentos são liquidados. Enquanto nem tudo foi pago/lançado, o valor pode subir. A tela avisa isso.

**Cadê a análise por hora quando escolho a semana?**
Faturamento por hora e produtos do dia só fazem sentido para uma noite específica, então aparecem apenas na granularidade **dia**.

**O NPS está vazio, e agora?**
Significa que não houve respostas de NPS registradas para aquela data/período. O NPS diário vem de `silver.nps_diario` e o agregado do período de `gold.desempenho`.

## Fonte dos dados

- **gold.planejamento** — snapshot por evento (dia): faturamento, público, couvert, custos, mix, stockout, atrasos, reservas.
- **gold.desempenho** — agregado semanal/mensal (mesma fonte da tela de Desempenho), incluindo NPS agregado.
- **operations.eventos_base** — cortes por hora (fat/pessoas até 19h/20h) e breakdown consolidado de eventos Yuzer/Sympla.
- **operations.v_evento_plano_vs_real** e **operations.evento_plano_snapshots** — planejado vs realizado e fotos do plano.
- **operations.feriados_eventos** — contexto de datas especiais e fator de ajuste histórico por bar.
- **bronze_contaazul_lancamentos** (Conta Azul) — custo artístico e de produção por competência.
- **bronze_contahub_avendas_cancelamentos** e **bronze_contahub_financeiro_pagamentosrecebidos** (ContaHub) — cancelamentos e conta assinada por dia.
- **silver.nps_diario** e **/api/nps** — NPS por dia e comentários.
- **silver.consumacao_artistas** — consumação/comp dos artistas.
- **silver.cliente_visitas** (via RPC `evento_clientes_perfil`) e **/api/clientes-ativos** — perfil de clientes (novos/recorrentes/retorno/ativos).
- **RPCs**: `evento_cesta_detalhe` e `/api/analitico/evento/cesta` (mix e detalhamento da cesta, ContaHub + Yuzer), `yuzer_cesta_evento` (eco copos).

Integrações de origem envolvidas: **ContaHub** (vendas, pagamentos, cancelamentos, tempos), **Conta Azul** (custos), **Yuzer** e **Sympla** (eventos de ingresso), além do NPS.
