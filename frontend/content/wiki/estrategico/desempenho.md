---
title: Desempenho
area: estrategico
slug: desempenho
route: /estrategico/desempenho
description: Painel-placar do bar que reúne, semana a semana (ou mês a mês), os indicadores estratégicos, operacionais, de qualidade e de marketing em uma única tabela.
order: 20
icon: BarChart3
---

# Desempenho

## Visão geral

A tela **Desempenho** é o grande "placar" do bar. Ela junta, em uma única tabela, os indicadores que o dono e os gestores acompanham de perto: faturamento, CMV, CMO, ticket médio, clientes, reservas, qualidade (Google e NPS), operação de cozinha e bar, vendas e marketing.

A leitura é feita **período a período**: cada **coluna** é uma semana (ou um mês, na visão Mensal) e cada **linha** é um indicador. Assim dá para bater o olho e ver a evolução ao longo do tempo — o que está melhorando, o que travou e o que ainda depende de preenchimento manual.

Boa parte dos números é **automática** (vem das integrações e do processamento de dados). Alguns são **manuais** (digitados aqui ou em outras telas). Cada indicador tem um pontinho colorido indicando a origem:

- **Verde (Automático):** calculado pelo sistema a partir das integrações.
- **Azul (Manual):** digitado por alguém (aqui ou em outra tela).
- **Âmbar (Verificar):** dado que precisa de conferência antes de confiar.

Quando existe **meta** definida para o indicador, a célula fica **verde** (bateu a meta) ou **vermelha** (não bateu).

## Como acessar

No menu lateral: **Estratégico → Desempenho**.

- **Rota:** `/estrategico/desempenho`
- **Permissão necessária:** módulo **Gestão** (`gestao`). Sem essa permissão o item não aparece no menu e a página não abre.

A tela sempre reflete o **bar selecionado** no topo. Ao trocar de bar, todos os números são recarregados para aquele bar.

## Passo a passo

### Alternar entre visão Semanal e Mensal
1. No canto superior esquerdo, use as abas **Semanal** e **Mensal**.
2. **Semanal** mostra uma coluna por semana ISO do ano; **Mensal** mostra uma coluna por mês (a partir de Março/2025).
3. A tabela recarrega e rola automaticamente até o período atual.

### Ler a tabela e navegar no tempo
1. A primeira coluna (fixa à esquerda) lista os **indicadores**, agrupados por seção.
2. Role a tabela **para os lados** para ver semanas/meses anteriores e o período atual.
3. Clique no **cabeçalho colorido de uma seção** para recolher ou expandir aquele bloco.
4. Alguns grupos (ex.: Faturamento, CMV, CMO) têm uma seta que **abre sub-linhas** com o detalhamento.

### Ver detalhes de um indicador (modais e tooltips)
1. Indicadores com detalhamento têm um ícone/gatilho de detalhe.
2. **Avaliações e Média Google:** abre o modal de **Google Reviews** com distribuição por estrelas, por dia e os comentários (elogios/críticas).
3. **NPS Digital / NPS Salão:** abre o modal do **Falaê** com promotores/neutros/detratores, médias por critério e comentários.
4. **Atração/Fat.:** abre o modal com o custo artístico e de produção **dia a dia** e o percentual sobre o faturamento.
5. **Descontos** e **Cancelamentos:** mostram o detalhamento por motivo e por dia da semana.

### Definir metas
1. Clique no botão **Metas** (canto superior direito).
2. No modal, preencha o valor de meta para cada indicador que quiser acompanhar.
3. Cada indicador tem um operador (por exemplo, faturamento é "≥ meta", CMV é "≤ meta" — indicadores "inversos" quanto menor melhor).
4. Salve. As células passam a ficar **verdes** (meta atingida) ou **vermelhas** (não atingida).
5. Na **visão Semanal**, a meta é vinculada à **semana selecionada** (com herança da última meta definida quando a semana não tem meta própria). Na **visão Mensal**, a meta é do período mensal.

### Editar valores manuais
1. Indicadores **manuais** (azuis) podem ser editados diretamente na célula do período (ex.: números de marketing, Equipe Fixa na visão semanal, Pro Labore, NPS Reservas, NPS Felicidade e reservas quando o bar não tem API GetIn).
2. Clique na célula, digite o valor (aceita vírgula ou ponto) e confirme.
3. Reservas manuais pedem dois valores: **mesas** e **pessoas**.

> A página se atualiza sozinha quando você volta para a aba do navegador (com um intervalo mínimo de 30 segundos), sempre buscando o estado mais recente do servidor.

## Abas e seções

A tela tem uma alternância de **visão** (Semanal / Mensal) e organiza os indicadores em **seções** coloridas, cada uma com grupos:

- **GUARDRAIL – Estratégicos** (verde): Faturamento, CMV Teórico, Ticket Médio, CMO e Atração/Faturamento. São os indicadores de "trava" do negócio.
- **OVT – Clientes** (azul): Volume de clientes/visitas e Reservas.
- **Qualidade** (índigo): Avaliações Google e NPS.
- **Cockpit Produtos** (laranja): Stockout, Mix de Vendas (% e quantidade), Tempos de preparo e Atrasos.
- **Vendas** (roxo): recortes de faturamento por horário, Conta Assinada, Descontos, Cancelamentos, Couvert e Atrações.
- **Marketing** (rosa): Orgânico (Instagram), Meta Ads, Google Meu Negócio e Google Ads.

Algumas linhas variam conforme o bar. No **Deboche (bar_id=4)**, por exemplo, "Clientes Ativos" e "% Novos Clientes" ficam ocultos (aguardam integração Zig) e existem recortes próprios de dias da semana (TER+QUA+QUI e SEX+SÁB) e "% PROMO HH".

## Colunas e cálculos

> Nesta tela as "colunas" são os períodos e as "linhas" são os indicadores. A tabela abaixo descreve **cada indicador (linha)**.

### GUARDRAIL – Estratégicos

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Faturamento Total | Faturamento bruto do período, sem a conta assinada | Faturamento bruto − Conta Assinada | `gold.desempenho` / `eventos_base` (consolidado) |
| Fat. Couvert | Couvert pago no período | Soma do couvert pago (todo o couvert, não só Yuzer) | `gold.planejamento.faturamento_couvert` |
| Fat. Bar | Faturamento de produtos vendidos no bar | Soma de `real_r` dos eventos, subtraindo o couvert (real_r inclui couvert) | `eventos_base` (consolidado) |
| Fat. CMVível | Faturamento base para o CMV limpo | Fat. Bar − Repique | Calculado |
| CMV Teórico % | Custo teórico de mercadoria sobre venda | Puxado da aba **CMV Semanal/Mensal**; usa o valor manual do sócio (`cmv_teorico_percentual_manual`) ou, na falta, o cálculo ao vivo Σcusto/Σfaturamento por período | `financial.cmv_semanal` / `financial.cmv_mensal` / `gold.cmv_teorico_dia` |
| CMV Global % | CMV real sobre o faturamento total | CMV R$ ÷ Fat. Total × 100 | Calculado a partir de `financial.cmv_semanal` |
| CMV Limpo % | CMV real sobre o faturamento CMVível | CMV R$ ÷ Fat. CMVível × 100 | CMV Semanal (`financial.cmv_semanal`) |
| CMV R$ | Custo real de mercadoria no período | Estoque Inicial + Compras − Estoque Final − Consumos + Bonificações | CMV Semanal (`financial.cmv_semanal.cmv_real`) |
| CMO % | Custo de mão de obra sobre o faturamento | (Freelas + Alimentação + Equipe Fixa + Pro Labore) ÷ Faturamento × 100 | Calculado (API `cmo-detalhe`) |
| Freelas | Custo com freelancers | Soma de 6 categorias do Conta Azul: FREELA ATENDIMENTO + COZINHA + BAR + LIMPEZA + SEGURANÇA + BRIGADISTA | Conta Azul |
| Alimentação | Custo da alimentação da equipe (CMA) | Estoque Inicial (F) + Compras Alimentação − Estoque Final (F) | CMA Total |
| Equipe Fixa | Folha da equipe fixa | **Mensal:** soma de categorias do Conta Azul (Salário/Provisão trabalhista/Vale transporte/Adicionais). **Semanal:** manual, digitado semana a semana (a folha mensal não rateia linear) | Conta Azul (mensal) / `meta.cmo_equipe_fixa_semanal` (semanal) |
| Pro Labore | Pró-labore dos sócios | Manual mensal por bar (Ordinário R$64k, Deboche R$15k); na visão semanal é rateado dia a dia | `meta.cmo_manual` |
| Atração/Fat. | Custo de atração/produção sobre o faturamento | **Semanal:** Σ `c_art` dos eventos ÷ Faturamento × 100. **Mensal:** (Atrações + Consumação de artistas + Produção de eventos + Produção mensal fixa) ÷ Faturamento × 100, espelhando os blocos Artístico+Produção da Orçamentação | `eventos_base` (`c_art`) / Orçamentação (Conta Azul) |

### OVT – Clientes

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Clientes Ativos | Base fiel recente (oculto no Deboche) | Clientes únicos com 2+ visitas nos últimos 90 dias (até o último dia do período) | ContaHub |
| Visitas | Total de clientes atendidos no período | Soma de `clientes_real` de todos os eventos (Sympla + Yuzer + ContaHub) | `eventos_base` (consolidado) |
| % Novos Clientes | Fatia de clientes novos (oculto no Deboche) | Clientes novos ÷ Total de visitas | Stored procedure (ContaHub) |
| Reservas Realizadas | Reservas feitas (mesas / pessoas) | **Com API:** mesas reservadas / pessoas reservadas (GetIn). **Sem API:** digitado manualmente | GetIn ou manual |
| Reservas Presentes | Reservas que compareceram | **Com API:** mesas presentes / pessoas presentes. **Sem API:** manual | GetIn ou manual |
| Quebra de Reservas | % de no-show | (Pessoas Total − Pessoas Presentes) ÷ Pessoas Total × 100 | Calculado |

### Qualidade

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Avaliações 5★ Google | Quantas notas 5 no período | Contagem de avaliações 5 estrelas no período (com total de avaliações no tooltip) | Google Reviews (Apify) |
| Média Google | Nota média no período | Média das estrelas das avaliações do período | Google Reviews (Apify) |
| NPS Digital | NPS da pesquisa digital pós-visita | % Promotores − % Detratores (link randômico pós-visita) | Falaê (pesquisa = NPS Digital) |
| NPS Salão | NPS da pesquisa presencial no salão | % Promotores − % Detratores | Falaê (pesquisa = Salão) |
| NPS Reservas | NPS sobre reservas | % Promotores − % Detratores — **manual** (aguardando API GetIn) | Manual (`meta.desempenho_manual`) |
| NPS Felicidade | Felicidade da equipe | Pesquisa de felicidade da equipe — **manual** | Planilha da equipe |

> O NPS de Falaê (Digital/Salão) é reconstruído aqui a partir das respostas do período: promotores (nota ≥ 9), neutros (7–8) e detratores (≤ 6), agregados por semana/mês.

### Cockpit Produtos

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| % Stockout Comidas | Ruptura média de itens de cozinha | Média da semana: Cozinha 1 + Cozinha 2 | ContaHub Stockout |
| % Stockout Drinks | Ruptura média de drinks | Média da semana: Batidos + Montados + Mexido + Preshh | ContaHub Stockout |
| % Stockout Bar | Ruptura média do bar | Média da semana: Bar + Baldes + Shot e Dose + Chopp | ContaHub Stockout |
| % Bebidas | Fatia de bebidas nas vendas (por valor) | % por valor da categoria BEBIDA; inclui Yuzer nos dias de evento (substitui o ContaHub naquele dia) | ContaHub + Yuzer (RPC `get_mix_por_semana`/`get_mix_por_mes`) |
| % Drinks | Fatia de drinks (por valor) | % por valor da categoria DRINK; inclui Yuzer nos dias de evento | ContaHub + Yuzer |
| % Comida | Fatia de comida (por valor) | % por valor da categoria COMIDA; inclui Yuzer nos dias de evento | ContaHub + Yuzer |
| Qtd Bebidas / Drinks / Comida | Itens vendidos por categoria | Contagem de itens vendidos (BEBIDA/DRINK/COMIDA), ContaHub + Yuzer nos dias de evento | ContaHub + Yuzer |
| Tempo Drinks | Tempo médio de saída de drinks | Média do tempo de saída (pedido → entrega) **só de pedidos entre 1s e 3.600s** — pedidos acima de 1h (comanda esquecida aberta) são descartados. Segundos → minutos | `silver.tempos_producao` |
| Tempo Comida | Tempo médio de saída da cozinha | Média do tempo de cozinha, mesmo corte de 1s a 3.600s. O marco depende do bar: Ordinário usa `t0_t2` (pedido → pronto); Deboche usa `t0_t2` até mar/2026 e `t0_t3` (pedido → entrega) a partir da virada de processo | `silver.tempos_producao` |
| Atrasinho Drinks | Nº de drinks levemente atrasados | Drinks entre **5 e 10 min** (300–600s). Tem % e detalhe por dia | `silver.tempos_producao` |
| Atrasinho Comida | Nº de comidas levemente atrasadas | Comidas entre **15 e 20 min** (900–1200s) | `silver.tempos_producao` |
| Atrasão Drinks | Nº de drinks muito atrasados | Drinks **acima de 10 min e até 1h** (600–3.600s). Acima de 1h é outlier e **não** conta como atraso | `silver.tempos_producao` |
| Atrasão Comida | Nº de comidas muito atrasadas | Comidas **acima de 20 min e até 1h** (1200–3.600s). Acima de 1h não conta como atraso | `silver.tempos_producao` |
| % Atraso Drinks / Comida | Fração de pedidos atrasados | Atrasão ÷ total de pedidos válidos. **Numerador e denominador excluem os >1h** (ambos na faixa 1–3.600s), então o outlier não infla o percentual | `silver.tempos_producao` |

### Vendas

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| % Fat. até 19h | Fatia do faturamento até 19h | Média de `fat_19h_percent` | `eventos_base` |
| % Fat. após 22h | Fatia do faturamento após 22h | Soma do faturamento após 22h sobre o total | `bronze_contahub_operacional_fatporhora` |
| TER+QUA+QUI (só Deboche) | Faturamento das terças/quartas/quintas | Soma de `real_r` desses dias | `eventos_base` |
| SEX+SÁB (só Deboche) | Faturamento de sextas/sábados | Soma de `real_r` desses dias | `eventos_base` |
| % PROMO HH (só Deboche) | Fatia do Happy Hour | Vendas com `grp_desc = Happy Hour` ÷ Total de vendas | `bronze_contahub_vendas_analitico` |
| Conta Assinada | Valor em conta assinada (com %) | Soma dos pagamentos com `meio = Conta Assinada` (líquido) e % sobre o faturamento total | `bronze_contahub_financeiro_pagamentosrecebidos` |
| Descontos | Total de descontos (com % e detalhe) | Soma de `vd_vrdescontos`, agrupado por motivo (Banda/DJ, Sócio, Aniversário, etc.) e por dia | `bronze_contahub_avendas_vendasperiodo` |
| Cancelamentos | Valor cancelado (com detalhe por dia) | Soma de `custototal` dos cancelamentos | `bronze_contahub_vendas_cancelamentos` |
| Couvert Total R$ | Couvert arrecadado | Soma de `valor_couvert` | ContaHub (vendas/visitas) |
| Atrações/Eventos R$ | Gasto com atrações | Soma dos lançamentos da categoria de atração | Conta Azul |

### Marketing

**[O] Orgânico e [M] Meta Ads agora são AUTOMÁTICOS** — um cron diário preenche a `meta.marketing_semanal` a partir das fontes reais (Instagram orgânico + Meta Ads API), com a mesma lógica das abas Orgânico/Mídia da tela de Comunicação. A **tela não mudou**, só a origem do dado. As colunas de **stories continuam manuais** (Nº Stories, Visu Stories, Retenção) até a captação de reposts ser resolvida. Google Meu Negócio e Google Ads seguem manuais (no Mensal, agregam as semanas).

| Grupo | Indicadores | Como é preenchido | Fonte |
|---|---|---|---|
| [O] Orgânico | Nº de Posts, Alcance, Interação, Compartilhamento, Engajamento | **Automático** (cron) nos bares com Instagram conectado (Ordinário): Feed + Reels somados, por post. Deboche ainda sem Instagram → segue **manual**. | Instagram (`instagram_posts`+`instagram_post_insights` → `meta.marketing_semanal`) |
| [O] Stories | Nº Stories, Visu Stories, Retenção | **Manual** nos 2 bares (cron não sobrescreve) | Digitado (`meta.marketing_semanal`) |
| [M] Meta Ads | Valor Investido, Impressões, Alcance, Frequência, CPM, Cliques, CTR, Custo por Clique, Conversas Iniciadas | **Automático** (cron) nos 2 bares (Ordinário e Deboche têm conta de anúncio): CTR/CPC por clique no link | Meta Ads API (`meta.marketing_semanal`) |
| [GMN] Google Meu Negócio | Total de Visualizações, Total de Ações, Rotas | Manual (mensal agrega as semanas) | Google Meu Negócio (`meta.marketing_semanal`) |
| [GADs] Google Ads | Valor Investido, Impressões, Cliques, CTR | Manual (mensal agrega as semanas; CTR é média) | Google Ads (`meta.marketing_semanal`) |

## Filtros e opções

- **Bar selecionado (topo):** define de qual bar são todos os números. Trocar o bar recarrega a tela inteira.
- **Visão Semanal / Mensal:** alterna a granularidade das colunas. A Mensal cobre de Março/2025 até o mês atual; a Semanal, o ano em curso (aceita `?ano=` na URL).
- **Recolher seções:** clique no cabeçalho colorido de uma seção para ocultá-la.
- **Expandir grupos:** grupos com sub-linhas (Faturamento, CMV, CMO) têm seta de detalhamento.
- **Metas:** botão que abre o modal para definir/editar metas por indicador (colorem as células).
- **Rolagem horizontal:** o eixo do tempo. A coluna de indicadores fica fixa à esquerda.

## Regras e detalhes importantes

- **Sempre por bar:** toda a tabela é filtrada pelo `bar_id` do bar selecionado. Nunca mistura bares.
- **Semanas/meses futuros ficam ocultos:** só aparecem períodos até a semana/mês em andamento — colunas futuras (zeradas) não são exibidas e surgem sozinhas com o passar do tempo.
- **Automático × Manual:** o pontinho verde/azul/âmbar indica a origem. Campos manuais (stories de marketing, Pro Labore, Equipe Fixa no semanal, NPS Reservas/Felicidade, reservas sem API) nunca são sobrescritos pelo cálculo automático. Marketing [M] Meta Ads é automático nos 2 bares e [O] Orgânico é automático onde há Instagram conectado (Ordinário; Deboche segue manual até conectar). As colunas de stories seguem manuais nos 2 bares.
- **Freshness monitorado:** o sync diário de marketing é vigiado pelo watchdog de saúde do pipeline (`system.data_freshness_config` → tela Saúde do Pipeline). Se o cron parar de atualizar a `meta.marketing_semanal` além do SLA (36h), o pipeline acende alerta em vez de falhar silenciosamente.
- **CMV Teórico ao vivo:** para não ficar defasado, o CMV teórico prioriza o valor manual da tela CMV; na falta, calcula ao vivo Σcusto/Σfaturamento do período a partir de `gold.cmv_teorico_dia`. Valores 0 ou negativos são tratados como "não informado".
- **Fat. Bar sem couvert:** como o `real_r` do ContaHub já inclui o couvert, a tela subtrai o couvert para mostrar apenas produtos vendidos no bar.
- **Tempos e atrasos com corte de 1h:** os tempos de cozinha/bar vêm em segundos e são convertidos para minutos. Só entram pedidos entre **1s e 3.600s (1 hora)** — pedidos acima de 1h (comanda esquecida aberta por horas) são **descartados da média, da contagem de atraso e do total**. Assim o outlier não distorce nem o tempo médio nem o % de atraso. Esse corte é **idêntico** nas visões Semanal, Mensal e por evento (padronizado em jul/2026).
- **Deboche mudou o marco em mar/2026:** até então a cozinha/bar do Deboche eram medidos por `t0_t2` (pedido → pronto); a partir da virada de processo passaram a `t0_t3` (pedido → entrega). As três visões respeitam essa data de corte, então o histórico do Deboche bate entre elas.
- **Mix com Yuzer:** nos dias de evento processados no Yuzer (ex.: jogos, festas), o mix e as quantidades usam o Yuzer no lugar do ContaHub; em períodos sem Yuzer o resultado é idêntico ao ContaHub.
- **Reservas dependem da integração:** com API GetIn ativa são automáticas; sem API, são manuais (o Deboche, por padrão, usa manual até integrar).
- **Metas por semana (visão semanal):** a meta é vinculada à semana selecionada, com herança da última meta definida quando a semana não tem meta própria.
- **Conta Assinada e Descontos por data gerencial:** são somados pelo `dt_gerencial`/`vd_dtgerencial` dentro do intervalo da semana/mês (não pela data-calendário pura).

## Dúvidas frequentes

**Por que uma célula está verde ou vermelha?**
Porque existe uma **meta** definida para aquele indicador. Verde = meta atingida; vermelho = não atingida. Sem meta, a célula fica neutra (cinza).

**O que significam os pontinhos verde, azul e âmbar?**
Origem do dado: verde = automático (integração), azul = manual (digitado), âmbar = precisa verificar antes de confiar.

**Por que o Deboche não mostra "Clientes Ativos" nem "% Novos Clientes"?**
Esses indicadores dependem de identificação de clientes que ainda não está disponível para o Deboche (aguarda integração Zig). Por isso ficam ocultos nesse bar.

**Editei o CMV na tela de CMV Semanal — por que mudou aqui também?**
Porque o CMV Teórico da tela Desempenho é **puxado** da aba CMV (Semanal/Mensal). O valor manual do sócio reflete automaticamente aqui.

**As últimas semanas aparecem com CMV zerado. É bug?**
Não. O sistema calcula o CMV teórico ao vivo do gold quando o valor persistido ainda não foi consolidado; valores 0 são tratados como "ainda não informado" para não esconder o número correto.

**Não vejo semanas futuras para planejar. Por quê?**
A tela mostra apenas até a semana/mês em andamento — colunas futuras (vazias) ficam ocultas e aparecem naturalmente com o passar do tempo.

## Fonte dos dados

- **`gold.desempenho`** (granularidade `semanal` e `mensal`) — base consolidada dos indicadores automáticos.
- **`meta.desempenho_manual`** — campos manuais (NPS Reservas, felicidade, RH/checklists, overrides).
- **`meta.marketing_semanal`** — indicadores de marketing. [M] Meta Ads preenchido automaticamente nos 2 bares e [O] Orgânico nos bares com Instagram conectado, por cron diário (`/api/estrategico/desempenho/sync-marketing`, semana atual + anterior); stories, Google Ads e Google Meu Negócio manuais. O cron só escreve onde a fonte existe (bar sem Instagram, como o Deboche hoje, mantém o [O] manual intacto). Todo upsert carimba `updated_at` (trigger), e a frescura é vigiada pelo watchdog `system.data_freshness_config`.
- **`meta.cmo_manual` / `meta.cmo_equipe_fixa_semanal`** — Pro Labore e Equipe Fixa manuais.
- **`financial.cmv_semanal` / `financial.cmv_mensal`** e **`gold.cmv_teorico_dia`** — CMV real, limpo e teórico.
- **`eventos_base` (consolidado)** e **`gold.planejamento`** — faturamento, público, ticket, couvert, atração (`c_art`).
- **`bronze_contahub_financeiro_pagamentosrecebidos`** — Conta Assinada.
- **`bronze_contahub_avendas_vendasperiodo`** — Descontos.
- **`bronze_contahub_vendas_cancelamentos`** — Cancelamentos.
- **`silver.tempos_producao`** — tempos de preparo e atrasos (cozinha e bar), com os marcos t0/t1/t2/t3 e o corte de outlier de 1h.
- **`bronze_contahub_operacional_fatporhora`** e **`bronze_contahub_vendas_analitico`** — faturamento por hora e Happy Hour.
- **ContaHub Stockout** — rupturas de estoque por área.
- **RPC `get_mix_por_semana` / `get_mix_por_mes`** — Mix de vendas (ContaHub + Yuzer).
- **`crm.nps_falae_diario` / `bronze_falae_respostas`** — NPS Digital e Salão (Falaê).
- **Google Reviews (Apify)** — avaliações e média Google.
- **Conta Azul** — Freelas, Equipe Fixa (mensal), Pro Labore e Atrações/Eventos.
- **GetIn** — reservas (quando a API está ativa).

**Integrações de origem envolvidas:** ContaHub, Yuzer, Sympla, Conta Azul, GetIn, Falaê, Google Reviews (Apify), Instagram/Meta Ads, Google Ads e Google Meu Negócio.
