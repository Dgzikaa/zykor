---
title: Dashboard de Receitas
area: receitas
slug: dashboard-receitas
route: /receitas
description: Visão unificada de receita do bar — crescimento, ticket, lotação, satisfação (NPS), base de clientes e faturamento por dia da semana em um único painel.
order: 10
icon: BarChart3
---

# Dashboard de Receitas

## Visão geral

O **Dashboard de Receitas** reúne, numa só tela, os principais termômetros de receita do bar: quanto o faturamento por dia aberto está crescendo, o comportamento de reservas/clientes e ticket médio, a taxa de lotação, a satisfação dos clientes (NPS), a evolução da base de clientes (novos × retornantes) e o faturamento médio de cada dia da semana mês a mês.

É a "primeira olhada" da reunião de marketing e da rotina do dono/gestor: em vez de abrir várias telas, o painel concentra volume (pessoas), valor (R$) e qualidade (satisfação) sob um **seletor de período compartilhado** — todos os gráficos respondem ao mesmo intervalo e à mesma granularidade escolhida no topo.

Quem usa: dono, gestão e time de marketing, principalmente em reuniões de acompanhamento semanal/mensal.

## Como acessar

- **Menu lateral:** `Receitas → Dashboard de Receitas`.
- **Rota:** `/receitas`.
- **Permissão:** o item de menu exige o módulo **`relatorios`**. O acesso à área também é liberado por qualquer um dos módulos: `receitas_dashboard_de_receitas`, `receitas`, `relatorios`, `analitico` ou `gestao` (o guard da área expande esses genéricos).
- **Seleção de bar obrigatória:** todos os números são filtrados pelo bar ativo (seletor no topo). Sem um bar selecionado, a tela mostra "Selecione um bar para ver o dashboard".

## Passo a passo

### Escolher o período de análise
1. No topo da tela, use o primeiro grupo de botões (**Granularidade**) para definir como os dados são agrupados: **Dia da semana**, **Semanal** ou **Mensal**.
2. No segundo grupo (**Range/janela**), escolha um atalho: **7 dias, 14 dias, Mensal, Trimestral, Semestral** ou **Anual**. Cada atalho é uma janela rolante que termina hoje (ex.: "7 dias" = últimos 7 dias até hoje).
3. Para um intervalo específico, use os campos de **data** (De … até) ao lado do calendário. Ao editar uma data, o período vira "personalizado" (custom) e ignora o atalho.
4. Todos os cards recarregam automaticamente ao mudar granularidade ou datas. O padrão de abertura é **granularidade Mensal + janela Trimestral**.

### Ler o crescimento e a variação
1. Observe o card **Taxa de Crescimento**: as barras mostram o faturamento por dia aberto de cada período; a linha mostra a variação percentual em relação ao período anterior.
2. O canto superior direito do card destaca a variação do último período vs o anterior (verde = subiu, vermelho = caiu).

### Editar o benchmark de NPS dos concorrentes
1. No card **Satisfação / NPS**, na faixa "Benchmark do segmento", clique no ícone de **lápis** para editar.
2. Use o **+** para adicionar um concorrente; preencha o nome e o valor de NPS.
3. Clique no **✓** (verde) para salvar ou no **✗** para cancelar. A lista salva substitui inteiramente a anterior. Use a lixeira para remover um item durante a edição.

### Ver a análise de dia da semana em tela cheia
1. No card **Faturamento por Dia da Semana**, clique em **"Ver mês a mês em tela cheia (médias + %)"** no rodapé do card para abrir a análise detalhada em `/receitas/analise`.

## Abas e seções

A tela **não tem abas**: é um painel único com seis cards dispostos em grade (1 coluna no mobile, 2 colunas no desktop). Alguns cards ocupam a largura inteira. A ordem exibida é:

1. Taxa de Crescimento
2. Satisfação / NPS (com benchmark manual)
3. Inputs de Crescimento (largura total)
4. Taxa de Lotação (largura total)
5. Clientes Ativos e Novos × Retornantes (dois cards lado a lado)
6. Faturamento por Dia da Semana (largura total)

> As telas irmãs **Análise (IA)** (`/receitas/analise`) e **Comunicação** (`/receitas/comunicacao`) fazem parte da mesma área Receitas, mas têm páginas próprias e não são cobertas por este artigo.

## Colunas e cálculos

### Card: Taxa de Crescimento (faturamento por dia aberto)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Faturamento | Receita total do período (bucket) | `SUM(real_r)` das datas do bucket | `eventos_base` |
| Dias abertos | Nº de dias que operaram no bucket | `COUNT` de dias com `real_r > 0` (exclui dias fechados, ex.: 2ª do Deboche) | `eventos_base` |
| Fat/dia aberto (barra) | Faturamento médio por dia aberto | `faturamento / dias_abertos` | `eventos_base` |
| Variação % (linha) | Crescimento vs período anterior | `(fat_por_dia − fat_por_dia_anterior) / fat_por_dia_anterior × 100` (arredondado a 1 casa) | cálculo na API |
| Selo (topo direito) | Variação do último período | Mesma variação % do último bucket vs o anterior | cálculo na API |

### Card: Satisfação / NPS

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| NPS (linha) | NPS do período/bucket | `100 × (promotores − detratores) / respostas` — soma promotores/detratores/respostas do bucket e calcula o NPS agregado (não é média de scores diários) | `silver.nps_diario` (Falae) |
| Respostas | Volume de respostas do bucket | `SUM(total_respostas)` | `silver.nps_diario` |
| NPS do período (topo direito) | NPS de todas as respostas do intervalo | `100 × (Σ promotores − Σ detratores) / Σ respostas` de todo o período | `silver.nps_diario` |
| Benchmark do segmento | NPS de concorrentes (comparação) | Entrada **manual** (nome + valor), sem cálculo | `meta.nps_benchmark` |

> Buckets com menos de **5 respostas** não plotam NPS (amostra pequena vira ruído — 1 detrator já jogaria para −100).

### Card: Inputs de Crescimento

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Reservas/dia (barra) | Pessoas em reservas por dia aberto | `SUM(total_pessoas) / dias_abertos` — "Reservas" aqui é o nº de **pessoas** das reservas | `silver.getin_reservas_diarias` (GetIn) |
| Clientes/dia (barra) | Clientes atendidos por dia aberto | `SUM(cl_real) / dias_abertos` | `eventos_base` |
| Ticket médio (linha) | Gasto médio por cliente | `SUM(real_r) / SUM(cl_real)` | `eventos_base` |
| Dias abertos | Base do "por dia" | `COUNT` de dias com `real_r > 0` | `eventos_base` |

### Card: Taxa de Lotação

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Capacidade (barra) | Capacidade máxima do período | `dias_abertos × capacidade_dia` (ex.: 650/dia no Ordinário) | `operations.bares.config.capacidade_dia` |
| Atendidos (barra) | Clientes reais atendidos | `SUM(cl_real)` | `eventos_base` |
| Ocupação % (linha) | Taxa de ocupação | `atendidos / capacidade × 100` (1 casa) | cálculo na API |
| Selo (topo direito) | Classificação da ocupação do último período | Régua: <50% "Sinal de alerta" · 50–70% "OK" · 70–90% "Boa taxa" · >90% "Excelente" | cálculo na API |

> Se o bar não tem `capacidade_dia` configurada, o card não mostra números — exibe aviso para configurar em Configurações → Bares.

### Cards: Clientes Ativos e Novos × Retornantes

Ambos vêm do mesmo endpoint de evolução mensal (sempre **mensal**, um ponto por mês).

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Base ativa (linha — "Clientes Ativos") | Tamanho da base de clientes ativos no mês | Último snapshot de `total_ativos` até o fim do mês (para mês corrente usa o snapshot mais recente até hoje) | `gold.clientes_diario` |
| Novos (barra) | Clientes novos no mês | Clientes distintos (por telefone) que visitaram no mês e **nunca** visitaram antes do início do mês | `calcular_metricas_clientes` sobre `visitas` |
| Retornantes (barra) | Clientes que voltaram | Clientes distintos que visitaram no mês **e** já tinham histórico anterior | `calcular_metricas_clientes` sobre `visitas` |
| % retornantes (linha) | Fatia de retorno | `retornantes / total_do_mês × 100` | cálculo na API |
| Total (base do %) | Clientes únicos no mês | Contagem distinta de `cliente_fone` (com ≥ 8 dígitos, não nulo) | `visitas` |
| Selo (topo direito — "Clientes Ativos") | Base ativa mais recente | Valor de `baseAtiva` do último mês | `gold.clientes_diario` |

### Card: Faturamento por Dia da Semana

Barras horizontais: cada linha é um dia da semana (Seg…Dom), agrupado por mês do período.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Faturamento médio (barra por mês) | Quanto rende, em média, aquele dia da semana no mês | Para cada dia da semana × mês: `SUM(real_r) / nº de ocorrências` (média por ocorrência, não soma — permite comparar meses com nº diferente de sábados) | `eventos_base` (`real_r > 0`) |
| Variação (%) | Evolução do mesmo dia da semana vs mês anterior | `(média_mês − média_mês_anterior) / média_mês_anterior × 100` | cálculo na API |

## Filtros e opções

| Filtro / opção | Onde | Efeito |
|---|---|---|
| **Bar** | Seletor global no topo | Filtra todos os cards por `bar_id`. Sem bar, a tela fica vazia. |
| **Granularidade** | Botões "Dia da semana / Semanal / Mensal" | Muda como os cards de Crescimento, NPS, Inputs e Lotação agrupam os dados. "Dia da semana" agrega todas as segundas num balde, todas as terças em outro, etc. (não é dia corrido). |
| **Range (atalhos)** | Botões "7d / 14d / Mensal / Trimestral / Semestral / Anual" | Define a janela de tempo (rolante, terminando hoje). |
| **Datas De/Até** | Campos de calendário | Define intervalo personalizado; sobrepõe o atalho. |
| **Editar benchmark NPS** | Ícone de lápis no card NPS | Abre a edição manual da lista de concorrentes. |

> **Cards que ignoram a granularidade:** "Clientes Ativos", "Novos × Retornantes" e "Faturamento por Dia da Semana" usam apenas o intervalo (início/fim) — os dois primeiros são sempre mensais; o de dia da semana sempre quebra por mês.

## Regras e detalhes importantes

- **Filtro por bar_id:** obrigatório em todas as consultas; nenhum número mistura bares.
- **Dias abertos, não dias corridos:** as médias "por dia" (fat/dia, reservas/dia, clientes/dia) e a capacidade usam apenas dias com faturamento (`real_r > 0`). Isso evita distorção por dias em que o bar não abre (ex.: segundas do Deboche).
- **Fonte de faturamento:** o campo `real_r` de `eventos_base` (faturamento real do evento/dia); `cl_real` são os clientes reais.
- **NPS agregado corretamente:** o NPS do período soma promotores e detratores de todos os dias e só então calcula — não é a média dos NPS diários. Buckets com menos de 5 respostas não aparecem.
- **Benchmark de NPS é manual:** os concorrentes são digitados à mão e servem só de comparação; salvar substitui a lista inteira.
- **Reservas = pessoas:** no card Inputs, "Reservas" é o total de pessoas das reservas (GetIn), não o número de reservas.
- **Capacidade configurável por bar:** vem de `operations.bares.config.capacidade_dia`. Sem esse valor, o card de Lotação some e pede configuração.
- **Base ativa vem de snapshot:** o card "Clientes Ativos" lê o último snapshot da camada Gold até o fim do mês; para o mês corrente usa o snapshot mais recente até hoje (evita mostrar zero em mês parcial).
- **Novos × Retornantes por telefone:** a classificação usa `cliente_fone` distinto com ao menos 8 dígitos; quem já apareceu antes do mês é "retornante", quem nunca apareceu é "novo".
- **Arredondamentos:** faturamentos são inteiros (R$ sem centavos nos rótulos), ticket médio com 2 casas, percentuais com 1 casa.
- **Estados vazios:** cada card mostra "Sem dados no período selecionado" (ou variação) quando não há registros; o de NPS mostra "Sem respostas de NPS no período".

## Dúvidas frequentes

**Por que o faturamento é "por dia aberto" e não o total?**
Para comparar períodos de forma justa. Um mês com mais dias abertos naturalmente fatura mais; dividir pelo número de dias que realmente operaram mostra a performance real por dia.

**O NPS de um dia está estranho / não aparece. Por quê?**
Buckets com menos de 5 respostas não são plotados, porque com poucas respostas o NPS oscila demais (um único detrator já derruba tudo).

**A Taxa de Lotação está vazia pedindo para configurar. O que fazer?**
O bar não tem capacidade diária cadastrada. Defina a capacidade por dia em Configurações → Bares para o card passar a calcular a ocupação.

**"Reservas/dia" é o número de reservas?**
Não — é o total de **pessoas** das reservas (GetIn) dividido pelos dias abertos.

**Por que "Clientes Ativos" e "Novos × Retornantes" não mudam quando escolho granularidade semanal?**
Esses dois cards são sempre mensais (base histórica de clientes). A granularidade afeta os cards de Crescimento, NPS, Inputs e Lotação.

**O benchmark de NPS é automático?**
Não. É digitado manualmente no próprio card e serve apenas como referência de comparação.

## Fonte dos dados

| Card | Endpoint | Tabelas / views / funções | Integração de origem |
|---|---|---|---|
| Taxa de Crescimento | `/api/receitas/crescimento` | `public.eventos_base` (view de `operations.eventos_base`) | ContaHub (faturamento) |
| Inputs de Crescimento | `/api/receitas/inputs` | `eventos_base`, `silver.getin_reservas_diarias` | ContaHub + GetIn |
| Taxa de Lotação | `/api/receitas/lotacao` | `eventos_base`, `operations.bares` (config `capacidade_dia`) | ContaHub + config do bar |
| Satisfação / NPS | `/api/receitas/nps` | `silver.nps_diario` | Falae |
| Benchmark NPS | `/api/receitas/nps-benchmark` | `meta.nps_benchmark` | Entrada manual |
| Clientes Ativos / Novos × Retornantes | `/api/clientes-ativos/evolucao` | `calcular_metricas_clientes` sobre `public.visitas`, `gold.clientes_diario` | ContaHub (visitas de clientes) |
| Faturamento por Dia da Semana | `/api/receitas/dia-semana-mensal` | `eventos_base` | ContaHub |
