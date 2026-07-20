---
title: Planejamento Comercial
area: estrategico
slug: planejamento-comercial
route: /estrategico/planejamento-comercial
description: Grade mês a mês, dia por dia, que junta a meta de faturamento (M1) com o realizado, os custos e a operação de cada evento do bar.
order: 30
icon: Calendar
---

# Planejamento Comercial

## Visão geral

O **Planejamento Comercial** é a grade central de gestão do mês. Cada linha é um dia (evento) do bar, do dia 1 ao último dia do mês, e mostra lado a lado o que foi **planejado** (Meta M1, custos previstos) e o que foi **realizado** (faturamento, clientes, tickets, custos reais, mix de vendas, atrasos e stockout).

Serve para o dono e o time comercial:

- Definir a **meta de faturamento (M1)** de cada dia e distribuí-la pela semana.
- Cadastrar a atração/label e os artistas de cada dia.
- Acompanhar, dia a dia, se a receita real está batendo a meta (verde/vermelho).
- Ver os custos artístico e de produção previstos e, quando o Conta Azul lança, os reais.
- Enxergar num só lugar o **empilhamento** do mês (quanto o mês deve fechar) e o **GAP** contra a meta.

A maior parte dos números é **automática** (vem do ETL das integrações). O que é **manual** é pouco: Meta M1, label/atração, artistas, observação, flag de urgente, custos de previsão e — só no Deboche — as reservas.

## Como acessar

- Menu lateral: **Estratégico → Planejamento**.
- Rota: `/estrategico/planejamento-comercial`.
- Permissão necessária: módulo **`planejamento`**. Sem ele, o item não aparece no menu e a rota é bloqueada.
- A tela sempre respeita o **bar selecionado** no topo. Trocar de bar recarrega toda a grade daquele estabelecimento.

## Passo a passo

### Trocar o mês/ano exibido
1. Na barra lateral **Controles** (direita, no desktop), use os seletores de **mês** e **ano**.
2. A URL muda para `?mes=..&ano=..` e a grade recarrega. No mobile os seletores aparecem no card no topo.

### Cadastrar ou gerenciar os dias do mês
1. Clique em **Gerenciar dias do mês** (botão na lateral, ou no topo no mobile).
2. Use **Preencher dias faltantes do mês** para gerar automaticamente todas as datas, ou **Adicionar linha** para incluir dias avulsos.
3. Em cada linha, informe **Data**, **Artista / Atração** (label) e a **Meta M1** (opcional).
4. Para **excluir** um dia que já existe, remova a linha dele (X vermelho). Ao salvar, o sistema pede **confirmação** — a exclusão é definitiva e apaga receita, custos, artistas e reservas daquele dia.
5. Clique em **Salvar**.

### Editar um dia (Meta M1, custos, artistas, label)
1. Clique na **data**, no **título** do dia, ou no botão de **lápis (Editar)** na coluna Ações.
2. No modal, edite:
   - **Título do Evento** — texto livre mostrado na tabela (label + artistas).
   - **Label do Evento** — a marca do dia usada para agrupar/analisar (ex.: "Feijuca do Ordi").
   - **🚩 Marcar como urgente** — pinta a linha de vermelho (ex.: artista ainda não definido).
   - **📊 Marcar como outlier** — evento esporádico (ex.: jogo do Brasil no sábado) que não reflete a operação normal. Marcado aqui, ele pode ser **excluído da média** no gráfico *Faturamento por dia da semana* (Receitas › Análise) via o toggle **"Sem outliers"**. Por enquanto afeta só esse gráfico, não a projeção do planejamento.
   - **Observação** — contexto extra (ex.: jogo da Copa), aparece no 📌 da tabela.
   - **Receita M1** — a meta do dia. Ao mudá-la, o Custo Artístico/Produção de previsão **reescala** mantendo a mesma % sobre o M1.
   - **Custo Artístico (Previsão)** e **Custo Produção (Previsão)** — ficam em amarelo (⚠️) até o Conta Azul lançar o real.
   - **Artistas** — nome + horário de início/fim de cada artista. É o que alimenta as análises por artista.
3. Clique em **Salvar Alterações**. O realizado (receita, clientes, custos reais) **não** é editado aqui — vem automático.

### Marcar bilheteria externa (Yuzer / Sympla)
1. Na célula do **Título** de um dia, use os botões pequenos **YZ** (Yuzer) e **SY** (Sympla).
2. Marcado, o cálculo de métricas passa a puxar o faturamento daquela bilheteria para o dia. Clicar de novo desmarca.

### Editar reservas (apenas Deboche, bar_id 4)
1. Com o grupo **CLIENTES** expandido, clique no valor de **Reservas Total** ou **Reservas Presentes**.
2. Digite o número e pressione **Enter** (ou o ✓). No Ordinário essas colunas são somente leitura.

### Recalcular custos do mês a partir do Conta Azul
1. Na lateral **Controles**, clique em **Recalcular custos do mês (CA)**.
2. Isso reexecuta o cálculo de todos os dias do mês com os lançamentos atuais do Conta Azul — atalho para não esperar o cron diário (11:45).

### Distribuir a meta pela semana (Calculadora)
1. Abra a **Calculadora de Distribuição** (lateral/card).
2. Informe a **Meta M1 mensal (Target)**, os **dias de venda** e um **peso** por dia da semana; opcionalmente as **% de custo** artístico/produção projetadas.
3. A calculadora distribui a meta pelos dias respeitando os pesos e gera cenários **M2/M3** (multiplicadores % sobre o M1).
4. **Aplicar** grava a Meta M1 de cada dia da semana na grade do mês. Há opção de **preservar** os dias já editados manualmente.

### Abrir a análise completa de um dia
- Clique no ícone de **gráfico (BarChart)** na coluna Ações — abre `/analitico/eventos` filtrado naquela data.

## Abas e seções

A tela não tem abas no topo, mas organiza as colunas em **quatro grupos colapsáveis** no cabeçalho. Clique no título do grupo para expandir/recolher; os botões **Expandir** / **Recolher** na lateral abrem/fecham todos.

| Grupo | Ícone | O que traz |
|---|---|---|
| **CLIENTES** | 👥 | Clientes reais e reservas |
| **TICKET** | 💲 | Ticket de entrada, de bar e médio |
| **ARTÍSTICO** | 🎯 | Custos artístico/produção, couvert, % artístico e consumação |
| **PRODUÇÃO** | 👨‍🍳 | Mix de vendas, atrasões, stockout e CMV teórico |

Além da grade, há a **barra lateral de Controles/Estatísticas** (resumo do mês) e três **modais**: edição do dia, gerenciar dias do mês, e a composição de custo (debug de onde vem cada valor de custo/consumação).

## Colunas e cálculos

### Colunas fixas (sempre visíveis)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Data** | Dia do evento (dd/mm) | `data_evento` | `gold.planejamento` |
| **Dia** | Dia da semana (3 letras) | Derivado da data | `gold.planejamento` |
| **Título** | Texto livre do dia (label + artistas), com 🚩 se urgente e o 📌 da observação | Campo manual `titulo`; label vem de `nome` | `operations.eventos_base` |
| **Artistas** | Artistas taggeados no dia | Lista de `artista_nome` do evento | `operations.evento_artistas` |
| **Receita Real** | Faturamento total consolidado do dia. Verde se ≥ Meta M1, vermelho se abaixo | `faturamento_total_consolidado` = ContaHub líquido + Yuzer + Sympla. Tooltip abre o detalhe (bruto ContaHub, conta assinada, líquido, Yuzer entrada/bar/descontos, Sympla) | `gold.planejamento` (ContaHub, Yuzer, Sympla) |
| **Meta M1** | Meta de faturamento do dia. 🔔 = editada manualmente | `eventos_base.m1_r` (manual) senão `gold.planejamento.m1_r` | `operations.eventos_base` / `gold.planejamento` |

### Grupo CLIENTES

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Clientes Reais** | Público real do dia — **só quem pagou** (comandas com pagamento > 0) + bilheteria externa. Verde se ≥ clientes planejados (`cl_plan`) | `publico_real_consolidado` (pessoas pagantes do ContaHub + Yuzer/Sympla) | `gold.planejamento` |
| **Reservas Total** | Total de reservas do dia | `res_tot`. No Deboche é editável inline; no Ordinário, automático | `gold.planejamento` / `eventos_base` |
| **Reservas Presentes** | Reservas que compareceram | `res_p`. Editável inline só no Deboche | `gold.planejamento` / `eventos_base` |

### Grupo TICKET

Em dias dominados por bilheteria externa (Yuzer/Sympla), o ContaHub vem ~zero e os tickets do gold ficariam errados; nesses casos a tela recalcula com o consolidado.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Entrada Real** (te_real) | Ticket de entrada/couvert por cliente. Verde se ≥ `te_plan` | Consolidado: (couvert ContaHub + entrada Yuzer + Sympla) ÷ público consolidado. Dia sem bilheteria externa usa `te_real_calculado` do gold | `gold.planejamento` |
| **Bar Real** (tb_real) | Ticket de consumo de bar por cliente. Verde se ≥ `tb_plan` | Consolidado: (receita ContaHub − couvert + bar Yuzer) ÷ público consolidado. Sem bilheteria externa usa `tb_real_calculado` | `gold.planejamento` |
| **Ticket Médio** (t_medio) | Gasto médio por cliente. Verde se ≥ meta (padrão R$ 93) | Faturamento consolidado ÷ público consolidado (senão `t_medio` do gold). Por construção, te_real + tb_real = t_medio | `gold.planejamento` + `config_metas_planejamento` |

### Grupo ARTÍSTICO

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Custo Artístico** (c_art) | Cachê artístico do dia. ⚠️ amarelo = ainda é previsão/projeção | Prioridade: real do Conta Azul (`c_art`) > override manual (`c_artistico_plan`) > projeção automática (`c_art_projecao`, média de ~4 semanas). Clicável abre a composição | `operations.eventos_base` (real do Conta Azul) |
| **Custo Produção** (c_prod) | Custo de produção do dia. ⚠️ = previsão | Mesma cascata: real CA > `c_prod_plan` > `c_prod_projecao` | `operations.eventos_base` (Conta Azul) |
| **$ Couvert** | Valor de couvert arrecadado no ContaHub | Soma de `vr_couvert` das vendas do dia (`couvert_vr_contahub`) | `gold.planejamento` (ContaHub) |
| **% Art/Fat** | Custo artístico como % do faturamento. Verde se ≤ meta (padrão 15%) | `percent_art_fat` do gold | `gold.planejamento` + `config_metas_planejamento` |
| **Couv/A+P** | Quanto o couvert cobre do **custo total do show** (artístico + produção). Verde se ≥ ratio meta (padrão 1,0) | (`couvert_vr_contahub` ÷ (`c_art` + `c_prod`)) × 100 — ambos com a cascata real CA > manual > projeção | `gold.planejamento` + `eventos_base` |
| **Consumação** | Consumação de artistas — **custo real** do dia. Clicável abre os lançamentos | Custo da ficha técnica quando o produto tem ficha; senão desconto × fator de CMV (padrão 0,35). Mesma conta da tela `/operacional/consumacao` | RPC `get_consumos_9_detalhes_custo_semana` (categoria `artistas`) |

### Grupo PRODUÇÃO

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **% Bebidas** | % do faturamento em bebidas (Chopp, Bar, Pegue e Pague, Venda Volante, Baldes) | `percent_b` do ContaHub; se o mix vier zerado (dia dominado por Yuzer), usa o mix consolidado ContaHub+Yuzer | `gold.planejamento` / RPC `get_mix_consolidado_periodo` |
| **% Drinks** | % em drinks (Preshh, Montados, Mexido, Drinks, Autorais, Shot e Dose, Batidos) | `percent_d`, mesmo fallback de mix consolidado | `gold.planejamento` / RPC de mix |
| **% Cozinha** | % em comida (Cozinha, Cozinha 1, Cozinha 2) | `percent_c`, mesmo fallback | `gold.planejamento` / RPC de mix |
| **Atrasão Coz** | Quantidade de atrasos graves na cozinha. Verde se ≤ meta (padrão 10) | `atrasao_cozinha` | `gold.planejamento` + `config_metas_planejamento` |
| **Atrasão Drinks** | Atrasos graves no bar. Verde se ≤ meta (padrão 50) | `atrasao_bar` | `gold.planejamento` + `config_metas_planejamento` |
| **Stockout Drinks** | % de ruptura em drinks. Verde/amarelo/vermelho por faixa (padrão ≤10 / ≤25) | `stockout_drinks_perc` | `gold.planejamento` + `config_metas_planejamento` |
| **Stockout Comidas** | % de ruptura em comidas. Mesmas faixas | `stockout_comidas_perc` | `gold.planejamento` + `config_metas_planejamento` |
| **CMV Teórico** | CMV teórico do dia (%). Verde <33%, amarelo <45%, vermelho acima | Custo da ficha técnica × vendas do ContaHub ÷ faturamento do dia | `gold.cmv_teorico_dia` |

### Rodapé (linha de TOTAIS)

O rodapé fixo consolida o mês. Regra geral: **soma** para valores em R$ e contagens; **média** (só dos dias com resultado > 0) para tickets, percentuais e stockout.

| Total | Como é calculado |
|---|---|
| **Realizado** | Soma de `real_receita` de todos os dias |
| **Meta M1** | Soma de `m1_receita` |
| **Clientes / Reservas** | Soma de clientes reais, reservas total e presentes |
| **Entrada / Bar / Ticket Médio** | Média dos dias com valor > 0 |
| **Custo Artístico / Produção / $ Couvert / Consumação** | Somas |
| **% Art/Fat / Couv/A+P** | Médias |
| **% Bebidas / Drinks / Cozinha / Stockout** | Médias |
| **Atrasão Coz / Drinks** | Somas |
| **CMV Teórico** | Ponderado do período = Σ custo teórico ÷ Σ faturamento (só dos dias que têm CMV) |

### Barra lateral (Estatísticas do mês)

| Indicador | O que mostra | Como é calculado |
|---|---|---|
| **Meta M1** | Meta total do mês | Soma de `m1_receita` |
| **Realizado** | Receita real acumulada | Soma de `real_receita` |
| **Atingido** | % da meta já batido | Realizado ÷ Meta M1 × 100 |
| **Falta faturar** | Quanto falta para a meta | Meta M1 − Realizado |
| **Empilhamento M1** | Projeção de fechamento do mês | Para dias já passados usa a receita real (se > 0); para dias de hoje em diante usa a Meta M1 |
| **GAP** | Diferença projeção × meta | Empilhamento − Meta M1 (com % ao lado) |
| **Dias (faturado / com evento)** | Cobertura do mês | Dias únicos com receita > 0 / dias únicos com evento |
| **Eventos (linhas)** | Nº de linhas | Linhas com faturamento / total de linhas |
| **Lucro Líquido Projetado** e **Margem (proj.)** | Projeção de lucro do mês | Vem da tela de **Orçamentação** (`lucro_projecao` / `margem_projecao`), mesma fórmula do `/estrategico/orcamentacao` |

## Filtros e opções

- **Bar** — definido pelo seletor global no topo; tudo é filtrado por `bar_id`.
- **Mês / Ano** — seletores na lateral (ou card mobile). Anos disponíveis: 2025 e 2026.
- **Grupos colapsáveis** — CLIENTES, TICKET, ARTÍSTICO, PRODUÇÃO. Recolhidos mostram "•••" para poupar espaço. Botões **Expandir**/**Recolher** afetam todos.
- **Toggles YZ / SY** por dia — ligam/desligam a leitura de bilheteria Yuzer/Sympla naquele dia.
- **Realce** — clicar numa célula/linha destaca a linha e a coluna (só visual, ajuda a ler a grade larga).

## Regras e detalhes importantes

- **Sempre por bar.** A grade é montada com `bar_id`. Sem bar sincronizado, aparece a tela "Sincronizando estabelecimento…" e recarrega sozinha.
- **Manual vs automático.** Manuais: Meta M1, título/label, artistas, observação, flag urgente, custos de previsão e (só Deboche) reservas. Automático (ETL das integrações): receita, clientes, tickets, mix, atrasos, stockout, CMV teórico, couvert e custos reais do Conta Azul.
- **Cascata de custo.** O custo mostrado é o **real do Conta Azul** se já existe; senão o **override manual** de previsão; senão a **projeção automática** (média de ~4 semanas, atualizada por cron às 11:45). Enquanto for previsão, fica **amarelo com ⚠️**; o real do CA sempre substitui.
- **Reescala do M1.** Ao editar a Meta M1 no modal, os custos de previsão escalam junto, mantendo a mesma % sobre o M1 (só quando havia M1 base).
- **Empilhamento não é soma de tudo.** Dias futuros usam a Meta M1 (não o real parcial de pré-venda), para não subestimar a projeção.
- **Consolidação evita dupla contagem.** A receita já vem consolidada do gold (ContaHub + Yuzer + Sympla); a tela não soma manualmente as bilheterias.
- **Mês vazio.** Se não há dias cadastrados, a tela mostra "Nenhum evento encontrado" com botão para cadastrar os dias do mês.
- **Exclusão é definitiva.** Remover um dia em "Gerenciar dias do mês" apaga receita, custos, artistas, reservas e planejamento daquele dia, sem volta.
- **Thresholds configuráveis.** As metas que definem verde/vermelho (ticket médio, % art/fat, atrasões, stockout, couvert/art) vêm de `config_metas_planejamento` por bar e ano; se a configuração não existir, a tela usa um fallback padrão.
- **Recálculo em background.** Ao abrir o mês, dias marcados como "precisa recálculo" e ainda sem receita real disparam recálculo automático das métricas.

## Dúvidas frequentes

**Por que o custo aparece em amarelo com ⚠️?**
Porque ainda é uma **previsão** (override manual ou projeção automática). Quando o Conta Azul lança o valor real, ele substitui e o amarelo some.

**A Meta M1 tem um 🔔 do lado. O que significa?**
Que aquela meta foi **editada manualmente**, e não veio da Calculadora de Distribuição.

**Por que não consigo editar as reservas no Ordinário?**
A edição inline de reservas está habilitada **apenas para o Deboche** (bar_id 4). No Ordinário, elas são preenchidas automaticamente.

**Editei o realizado e nada mudou. Por quê?**
O realizado (receita, clientes, tickets, custos reais, atrasos) **não é editável** nesta tela — vem automático do Conta Azul/ContaHub. Só planejamento, artistas e campos manuais são editáveis.

**Os clientes/ticket não batem com o relatório do ContaHub. Está errado?**
Não — é **diferença de definição**, não bug. O Zykor conta como cliente **só quem pagou** (comanda com pagamento > 0). O relatório de **períodos** do ContaHub mostra o total incluindo **comandas abertas que não pagaram** (cartão sem consumo, itens transferidos). Por isso o número do ContaHub é maior e o **ticket médio do Zykor fica um pouco mais alto** (mesmo faturamento ÷ menos gente). Se você **filtrar o relatório do ContaHub por pagamento > 0**, ele cai para o mesmo número do Zykor. Em resumo: o Zykor mede o **gasto real por cliente pagante**; o headline bruto do ContaHub dilui com cartão vazio.

**Qual a diferença entre "Título" e "Label"?**
O **Título** é o texto livre que aparece na tabela (ex.: "Feijuca do Ordi - STZ (20h)"). O **Label** é a marca do dia usada para agrupar e analisar (ex.: "Feijuca do Ordi"). Um label pode se repetir em vários dias.

**O que é o "Empilhamento M1"?**
É a projeção de fechamento do mês: soma a receita real dos dias que já aconteceram com a Meta M1 dos dias que ainda vão acontecer. O **GAP** compara essa projeção com a meta total.

## Fonte dos dados

- **`gold.planejamento`** — consolidação principal por dia (ContaHub + Yuzer + Sympla): receita, público, tickets, couvert, mix, atrasos, stockout e reservas.
- **`operations.eventos_base`** — campos manuais editáveis: Meta M1, título, label, observação, flag urgente, flag outlier, custos de previsão (`c_artistico_plan` / `c_prod_plan`), projeções (`c_art_projecao` / `c_prod_projecao`), custos reais do Conta Azul (`c_art` / `c_prod`), toggles Yuzer/Sympla e reservas.
- **`operations.evento_artistas`** — artistas taggeados por evento (coluna Artistas).
- **`operations.config_metas_planejamento`** — thresholds (metas) por bar/ano que definem verde/amarelo/vermelho.
- **`gold.cmv_teorico_dia`** — CMV teórico do dia (custo de ficha técnica × vendas ÷ faturamento).
- **RPC `get_consumos_9_detalhes_custo_semana`** — custo real da consumação de artistas (categoria `artistas`).
- **RPC `get_mix_consolidado_periodo`** — mix de vendas consolidado (ContaHub + Yuzer), usado como fallback quando o mix do gold vem zerado.
- **Orçamentação** (`getOrcamentacaoCompleta`) — Lucro Líquido e Margem projetados do mês, exibidos na lateral.

**Integrações de origem:** ContaHub (vendas, público, mix, couvert, atrasos, stockout), Conta Azul (custos artístico/produção reais), Yuzer e Sympla (bilheteria externa de eventos específicos).
