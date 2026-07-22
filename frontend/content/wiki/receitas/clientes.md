---
title: Clientes
area: receitas
slug: clientes
route: /analitico/clientes
description: Base de clientes do bar consolidada a partir do ContaHub, com ranking de visitas, ticket, reservas, aniversariantes, consumo por categoria e construtor de segmentos para campanhas.
order: 40
icon: Users
---

# Clientes

## Visão geral

A tela **Clientes** é a central de inteligência sobre quem frequenta o bar. Ela junta, num só lugar, todo o histórico de quem já passou pela casa: quantas vezes veio, quanto gastou em entrada (couvert) e em consumo, o ticket médio, o tempo médio de permanência, os produtos favoritos e a data da última visita.

A base principal vem do **ContaHub** (identificada pelo telefone do cliente). A partir dela, a tela oferece vários recortes: ranking dos melhores clientes, quem mais reserva (dados do **GetIn**), aniversariantes do mês, top consumidores por categoria de produto e um construtor de segmentos para montar listas de disparo (a "Lista Quente").

No dia a dia é usada por sócios, gerentes e pelo time de marketing/CRM para: identificar clientes fiéis, montar campanhas de WhatsApp, encontrar aniversariantes, entender o perfil do público (idade, origem, gasto) e exportar listas para ações de relacionamento.

## Como acessar

No menu lateral, dentro da área **Receitas**, clique em **Clientes** (ícone de pessoas). A rota é `/analitico/clientes`.

- **Permissão necessária:** módulo `relatorios`. Quem não tiver esse acesso não vê o item no menu.
- É obrigatório ter um **bar selecionado** no seletor do topo. Sem bar, a tela mostra o aviso "Selecione um Bar" e não carrega dados.

No mesmo grupo de menu existem telas irmãs que aprofundam a análise de clientes: **Segmentos (RFM)**, **Win-back** e **Retenção** — todas também sob a permissão `relatorios`.

## Passo a passo

### 1. Ver o ranking de clientes
1. Acesse a tela; a aba **Clientes** já abre selecionada.
2. No topo aparecem 5 cartões-resumo (clientes únicos, total de visitas e os três tickets médios).
3. A tabela lista os clientes ordenados por número de visitas (do maior para o menor).
4. Use os botões de página (setas) no rodapé da tabela para avançar. Cada página traz 50 clientes.

### 2. Buscar um cliente específico
1. No campo **"Buscar cliente..."** (no cabeçalho do card), digite parte do nome ou do telefone.
2. Pressione **Enter** ou clique no botão de lupa.
3. A tabela recarrega já filtrada. Para limpar, apague o texto e busque de novo.

### 3. Filtrar por dia da semana
1. Abra o seletor **"Todos os dias"** no cabeçalho.
2. Escolha um dia (ex.: Sábado). O ranking passa a considerar só as visitas naquele dia da semana.
3. Com um dia selecionado, a coluna **Visitas** mostra `visitas no dia / visitas totais`.

### 4. Ver o detalhe de um cliente
1. Clique em qualquer linha da tabela de clientes.
2. Abre um modal com: cartões de resumo (visitas, total gasto, ticket médio, tempo médio de estadia, última visita, dia destaque), o **Perfil de Consumo** (tags, top 5 produtos, categorias favoritas, dias preferidos), o **Histórico de Visitas** detalhado e a lista de **Tempos de Estadia** por visita.
3. Se o cliente tiver telefone, o botão **Enviar WhatsApp** abre uma conversa pronta.

### 5. Exportar a lista (aba Clientes ou Reservantes)
1. Estando na aba desejada, clique no botão de **download** (ícone de seta) no cabeçalho.
2. É gerado um CSV com os dados da página atual, nomeado conforme o dia da semana filtrado.

### 6. Montar um segmento na Lista Quente
1. Vá até a aba **Lista Quente**.
2. No **Construtor de Segmentos**, combine os critérios (janela de dias ou semana específica, mínimo de visitas, faixa de ticket, gasto total, recência, contato, mês de aniversário etc.).
3. Clique em **Aplicar Filtros**. Aparecem os cartões de estatística do segmento e um resumo por dia da semana.
4. Clique num cartão de dia para ver a lista de clientes daquele dia.
5. Use **Exportar Lista** / **CSV Completo** para baixar, ou dê um nome no campo e clique em **Salvar** para guardar o segmento e reutilizá-lo depois.

### 7. Consultar aniversariantes
1. Vá até a aba **Aniversariantes**.
2. Escolha o **mês** no seletor (por padrão, o mês atual).
3. Veja os cartões-resumo (total, ativos, VIPs, mostrando) e a tabela ordenada por dia do mês. Filtre por nome/telefone ou exporte em CSV.

### 8. Ver top consumidores por categoria
1. Vá até a aba **Top por Categoria**.
2. Selecione a **categoria** de produto e o tamanho do ranking (Top 50 a Top 500).
3. A tabela mostra quem mais consumiu aquela categoria. Filtre por nome/telefone ou exporte.

## Abas e seções

A tela é organizada em abas dentro do card principal, além dos cartões-resumo fixos no topo.

| Aba | O que traz | Origem dos dados |
|---|---|---|
| **Clientes** | Ranking dos clientes por número de visitas, com ticket, tempo de estadia e produtos favoritos. É a aba padrão. | ContaHub (silver `cliente_estatisticas`) |
| **Reservantes** | Top 100 de quem mais fez reservas, com status das reservas e taxa de presença. | GetIn (`bronze_getin_reservations`) cruzado com visitas |
| **Lista Quente** | Construtor de segmentos: combina dezenas de critérios para gerar listas de disparo, com resumo por dia da semana e exportação. | ContaHub (silver `cliente_visitas`), via `/api/crm/lista-quente` |
| **Aniversariantes** | Aniversariantes do mês escolhido, com status de relacionamento e produtos favoritos. | ContaHub (`cliente_estatisticas`, campo `cliente_dtnasc`) |
| **Top por Categoria** | Ranking de clientes que mais consumiram uma categoria de produto (ex.: cerveja, drink). | ContaHub (`cliente_estatisticas`, campo `produtos_favoritos`) |
| **Filtros Avançados** | Análise de público por período: idade média, faixa etária, origem (dentro/fora de Brasília), ticket e visitas. | ContaHub, via `/api/analitico/clientes/filtros-avancados` |
| **Clientes Ativos** | Atalho (link) para o relatório `/relatorios/clientes-ativos`. Não é uma aba interna. | — |

## Colunas e cálculos

### Cartões-resumo (topo, sempre visíveis)

Alimentados pela função de agregação `get_cliente_stats_agregado` sobre toda a base de clientes do bar (não só a página atual).

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Clientes únicos | Total de clientes distintos com telefone no bar | Contagem de clientes únicos | `get_cliente_stats_agregado` |
| Total de visitas | Soma de todas as visitas registradas | Soma de `total_visitas` de todos os clientes | `get_cliente_stats_agregado` |
| Ticket médio geral | Gasto médio por visita paga | (entrada total + consumo total) ÷ total de visitas | `get_cliente_stats_agregado` |
| 🎫 Ticket entrada | Couvert médio por visita | entrada total ÷ total de visitas | `get_cliente_stats_agregado` |
| 🍺 Ticket consumo | Consumação média por visita | consumo total ÷ total de visitas | `get_cliente_stats_agregado` |

### Aba Clientes (tabela)

Cada cliente vem da view `silver.cliente_estatisticas`. O consumo de cada visita é sempre **pagamentos − couvert**.

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome | Nome principal do cliente | `cliente_nome` | `cliente_estatisticas` |
| Telefone | Telefone normalizado | `cliente_fone_norm` | `cliente_estatisticas` |
| Visitas | Nº de visitas (ou `visitas no dia / total` quando há filtro de dia) | `total_visitas` | `cliente_estatisticas` |
| 🎫 Entrada | Valor total gasto em couvert | `valor_total_entrada` | `cliente_estatisticas` |
| 🍺 Consumo | Valor total gasto em consumação | `valor_total_consumo` | `cliente_estatisticas` |
| Tickets | Ticket geral + ticket entrada + ticket consumo (badges) | geral = (entrada+consumo) ÷ visitas; entrada = `ticket_medio_entrada`; consumo = `ticket_medio_consumo` | `cliente_estatisticas` |
| ⏱️ Tempo Médio | Tempo médio de permanência, formatado (ex.: `1h 45min`), com quantas visitas têm tempo medido | `tempo_medio_estadia_min` convertido para horas/min | `cliente_estatisticas` |
| 🍺 Bebida fav | Bebida mais consumida (com quantidade) | `bebida_favorita` (produto + quantidade + vezes pediu) | `cliente_estatisticas` |
| 🍴 Comida fav | Comida mais consumida (com quantidade) | `comida_favorita` | `cliente_estatisticas` |
| Última visita | Data da última visita | `ultima_visita` | `cliente_estatisticas` |

> Observação: no **modo de fallback** (quando o filtro por dia da semana é usado ou o cache está vazio), os mesmos números são recalculados na hora a partir de `silver.cliente_visitas`, agregando por telefone. Nesse caso a lista traz o **Top 100** por visitas, o telefone é normalizado para 11 dígitos (DDD + 9) e o tempo de estadia considera apenas visitas entre 0 e 720 minutos.

### Modal de detalhes do cliente

| Bloco / Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total de Visitas | Visitas do cliente | `total_visitas` | `cliente_estatisticas` |
| Total Gasto | Entrada + consumo somados | `valor_total_gasto` | `cliente_estatisticas` |
| Ticket Médio | Gasto médio por visita | `ticket_medio_geral` | `cliente_estatisticas` |
| Tempo Médio de Estadia | Permanência média formatada | `tempo_medio_estadia_min` | `cliente_estatisticas` |
| Última Visita | Data da visita mais recente | `ultima_visita` | `cliente_estatisticas` |
| Dia Destaque | Dia da semana em que o cliente mais aparece | Dia da semana mais frequente nas visitas válidas | `cliente_visitas` (rota `detalhes`) |
| Perfil de Consumo → Tags | Rótulos como VIP, frequente, cervejeiro, prefere X | `tags` | `cliente_estatisticas` |
| Perfil → Top 5 Produtos | Produtos mais pedidos (qtd e nº de pedidos) | `produtos_favoritos` (ou recalculado de `vendas_item`) | `cliente_estatisticas` / `vendas_item` |
| Perfil → Categorias Favoritas | Categorias mais consumidas (qtd e valor) | `categorias_favoritas` | `cliente_estatisticas` |
| Perfil → Dias Preferidos | Dias da semana preferidos | `dias_preferidos` | `cliente_estatisticas` |
| Histórico de Visitas | Cada visita com Couvert, Consumo, Total e Tempo | Couvert = `valor_couvert`; Consumo = pagamentos − couvert; Total = `valor_pagamentos` | `cliente_visitas` |
| Tempos de Estadia | Duração de cada visita + menor/médio/maior | tempos individuais em minutos | `cliente_visitas` |

> O histórico e o dia destaque descartam dias em que o bar estava **fechado** (calendário operacional), para não distorcer as médias.

### Aba Reservantes (tabela)

Vem do GetIn (`bronze_getin_reservations`), cruzado com as visitas para calcular percentuais. Traz o **Top 100** por total de reservas.

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Posição | Ranking (1 a 100) | Ordenado por total de reservas (desc) | — |
| Nome do Reservante | Nome de quem reservou | `customer_name` | `bronze_getin_reservations` |
| Contato | Telefone normalizado | `customer_phone` normalizado | `bronze_getin_reservations` |
| Total Reservas | Nº de reservas feitas | Contagem de reservas do telefone | `bronze_getin_reservations` |
| Visitas | Nº de visitas efetivas ao bar | Match do telefone com `cliente_visitas` | GetIn × `cliente_visitas` |
| % Reservas | Quanto das visitas veio de reserva | (total reservas ÷ total visitas) × 100 | cálculo |
| Seated | Reservas efetivadas (cliente sentou) | Contagem de status `seated` | `bronze_getin_reservations` |
| Status Reservas | Confirmadas (C), Pendentes (P), Canceladas (X), No-show (NS) | Contagem por status; `canceled-user`/`canceled-agent` = cancelada; `no_show=true` = no-show | `bronze_getin_reservations` |
| % Presença | Taxa de comparecimento | (seated ÷ total reservas) × 100 | cálculo |
| Última Reserva | Data da reserva mais recente | maior `reservation_date` | `bronze_getin_reservations` |
| Contato (botão) | Abre WhatsApp com o cliente | link `wa.me` | — |

### Aba Lista Quente

Cartões de estatística do segmento (após "Aplicar Filtros"), servidos por `/api/crm/lista-quente`:

| Indicador | O que mostra |
|---|---|
| Clientes Filtrados | Quantos clientes atendem a todos os critérios |
| Ticket Médio | Ticket médio do segmento |
| Visitas Médias | Média de visitas por cliente do segmento |
| Com Email | Quantos têm e-mail cadastrado |
| Com Telefone | Quantos têm telefone cadastrado |

Cada **cartão de dia da semana** mostra: total de clientes, ticket médio do dia, gasto total do dia e exemplos de clientes. Ao abrir um dia, a tabela lista Nome, Telefone, Email, Visitas no Dia, Total Visitas, Ticket Médio e Gasto Total de cada cliente.

> **Fonte (importante):** desde o modelo cartão do ContaHub (06/07/2026), o telefone/nome do cliente deixou de vir no relatório de PERÍODO e passou a vir só no de PAGAMENTOS (campos `cht_fonea`/`cht_nome`). A Lista Quente lê de `silver.cliente_visitas`, que já aplica esse fallback — por isso identifica os clientes recentes corretamente. A antiga `public.visitas` **não** tem esse fallback e não deve mais ser usada por telas de cliente.
>
> **Filtro "Mês de Aniversário":** depende da data de nascimento, que **não** está em `cliente_visitas`. Para segmentar por aniversário, use a aba **Aniversariantes** (que lê `cliente_estatisticas`, onde o dtnasc é populado por ETL próprio do cadastro ContaHub).

### Aba Aniversariantes (tabela)

Filtra `cliente_estatisticas` pelo mês de nascimento (`cliente_dtnasc`).

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Dia/mês do aniversário | dia extraído de `cliente_dtnasc` | `cliente_estatisticas` |
| Nome | Nome (⭐ se VIP) | `cliente_nome` / `eh_vip` | `cliente_estatisticas` |
| Telefone | Telefone formatado | `cliente_fone_norm` | `cliente_estatisticas` |
| Visitas | Total de visitas | `total_visitas` | `cliente_estatisticas` |
| Última visita | Data e dias desde a última visita | `ultima_visita` / `dias_desde_ultima_visita` | `cliente_estatisticas` |
| Status | Novo / Ativo / Dormente / Churn | campo `status` (por recência de visita) | `cliente_estatisticas` |
| Ticket médio | Ticket de consumo médio | `ticket_medio_consumo` | `cliente_estatisticas` |
| Top produtos | Produtos favoritos (tooltip com a lista completa) | `produtos_favoritos` | `cliente_estatisticas` |

Cartões-resumo da aba: **Total aniversariantes** (do mês), **Ativos** (status `ativo`), **VIPs** (`eh_vip = true`) e **Mostrando** (linhas após a busca).

### Aba Top por Categoria (tabela)

Ranking calculado pela função SQL `top_clientes_por_categoria` (descompacta o JSON de produtos favoritos por categoria).

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| # | Posição no ranking | ordem retornada pela função | `top_clientes_por_categoria` |
| Nome | Nome (⭐ se VIP) | `nome` / `eh_vip` | função SQL |
| Telefone | Telefone formatado | `telefone` | função SQL |
| Qtd | Quantidade consumida da categoria | `qtd_categoria` | função SQL |
| Vezes | Nº de pedidos na categoria | `vezes_pediu` | função SQL |
| Top produto | Produto mais pedido dentro da categoria | `top_produto_categoria` | função SQL |
| Visitas | Total de visitas do cliente | `total_visitas` | função SQL |
| Última visita | Data da última visita | `ultima_visita` | função SQL |
| Status | Novo / Ativo / Dormente / Churn | `status` | função SQL |
| Ticket médio | Ticket médio do cliente | `ticket_medio` | função SQL |

O seletor de categoria é preenchido pela função `listar_categorias_clientes_estatisticas`, que mostra cada categoria e quantos clientes a consomem.

### Aba Filtros Avançados

Envia os filtros a `/api/analitico/clientes/filtros-avancados` e devolve estatísticas de público + tabela de clientes.

| Cartão / Coluna | O que mostra | Como é calculado |
|---|---|---|
| Clientes Únicos | Clientes que atendem aos filtros (e % do período) | contagem no período/filtro |
| Total de Visitas | Visitas no recorte (+ visitas por cliente) | soma das visitas |
| Idade Média | Idade média (e % com data de nascimento) | média das idades calculadas de `dtnasc` |
| Ticket Médio | Ticket médio (+ total gasto) | gasto total ÷ visitas |
| Fora de Brasília | % de clientes com DDD diferente de 61 | share por DDD |
| Distribuição por Faixa Etária | Barras e cartões por faixa (% sobre visitas) | agrupamento das idades |
| Tabela | Nome, Telefone, Email, Idade, Visitas, Ticket Médio, Total Gasto, Última Visita | por cliente filtrado |

## Filtros e opções

- **Bar (topo da página):** obrigatório. Toda consulta é filtrada por `bar_id`; trocar de bar recarrega tudo.
- **Busca por cliente (abas Clientes/Reservantes):** filtra por nome ou telefone (busca aplicada ao pressionar Enter/lupa).
- **Dia da semana (abas Clientes/Reservantes):** restringe às visitas/reservas naquele dia; ativa a contagem `dia/total`.
- **Paginação (aba Clientes):** 50 clientes por página, ordenados por visitas.
- **Lista Quente — Construtor de Segmentos:** janela em dias (30 a 365) **ou** semana ISO específica; mínimo/máximo de visitas totais; mínimo de visitas no mesmo dia; dias diferentes; faixas de ticket médio, ticket entrada/consumo e gasto total; recência (última visita há mais/menos de X dias); cliente novo (1ª visita em X dias); tamanho do grupo; tem e-mail; tem telefone; mês de aniversário.
- **Aniversariantes:** seletor de mês (1-12) + busca por nome/telefone.
- **Top por Categoria:** seletor de categoria + tamanho do Top (50/100/200/500) + busca.
- **Filtros Avançados:** presets de período (7/30 dias, 3 meses, este mês, mês passado, mês específico, 3 domingos, fins de semana, personalizado); dias da semana; faixa etária; visitas mín/máx; ticket médio mín/máx; "Fora de Brasília" (DDD ≠ 61).

## Regras e detalhes importantes

- **Sempre filtrado por bar_id.** Nenhum número mistura bares diferentes.
- **Consumo = pagamentos − couvert.** Em toda a tela, "consumo/consumação" é o valor pago menos o couvert (entrada); "entrada" é o couvert.
- **Base ContaHub identificada por telefone.** Clientes sem telefone não entram no ranking principal (a query exige `tem_telefone`).
- **Normalização de telefone.** Números são reduzidos a dígitos e padronizados em 11 dígitos (DDD + 9 + número). Isso permite casar o mesmo cliente entre ContaHub e GetIn e juntar variações (com/sem o nono dígito).
- **Cache vs. cálculo ao vivo.** A aba Clientes lê primeiro a view `cliente_estatisticas` (rápida). Se o cache estiver vazio, dispara uma sincronização em segundo plano e cai para o cálculo direto de `cliente_visitas`. O filtro por dia da semana sempre usa o cálculo ao vivo (Top 100).
- **Tempo de estadia.** Só conta visitas com tempo entre 0 e 720 minutos (12h) — descarta registros sem hora de saída ou com outliers.
- **Dias fechados são ignorados** no histórico e no "dia destaque" do modal, usando o calendário operacional do bar.
- **Aniversariantes:** o mês é extraído diretamente do texto da data de nascimento (posição do mês na `YYYY-MM-DD`), sem conversão de fuso, para não trocar o dia por causa de timezone.
- **Status de relacionamento** (Novo/Ativo/Dormente/Churn) e **eh_vip** vêm prontos da view `cliente_estatisticas` (calculados por recência/frequência na camada silver), não são recalculados na tela.
- **Exportações são geradas no navegador** a partir dos dados já carregados; o "CSV Completo" da Lista Quente é montado no servidor com todos os clientes do segmento.

## Dúvidas frequentes

**Por que um cliente não aparece na lista?**
Provavelmente ele não tem telefone cadastrado no ContaHub — o ranking principal exige telefone. Sem telefone, também não há histórico de visitas no modal.

**A aba Clientes mostra só 50 (ou 100). Cadê o resto?**
A aba Clientes é paginada de 50 em 50 (use as setas). No modo de cálculo ao vivo (filtro por dia), o limite é o Top 100 por visitas. Para listas maiores e recortadas, use a **Lista Quente** ou os **Filtros Avançados** e exporte em CSV.

**Qual a diferença entre "entrada" e "consumo"?**
Entrada é o couvert (o valor de porta/ingresso). Consumo é tudo o que a pessoa gastou dentro (pagamentos menos o couvert). O ticket geral soma os dois.

**Os reservantes usam dados de onde?**
Das reservas do **GetIn**. A tela cruza o telefone da reserva com as visitas do ContaHub para calcular presença e % de reservas sobre visitas.

**Os aniversariantes cobrem os dois bares?**
Cada bar é consultado separadamente pelo seu `bar_id`, mas na prática **só o Ordinário (bar 3) tem aniversariantes** (~67 mil clientes com data). O **Deboche (bar 4) não coleta data de nascimento no PDV** — nem no relatório de vendas nem no de pagamentos do ContaHub existe campo de aniversário para o Deboche (verificado: 0 registros com `cli_dtnasc` em 2026). Por isso a aba Aniversariantes do Deboche fica praticamente vazia (só 3 clientes históricos), e isso **é esperado, não é bug** — dependeria de configurar a coleta de aniversário no cadastro de cliente do PDV do Deboche.

**Com que frequência os números atualizam?**
A base de clientes (`cliente_estatisticas`) é regenerada por sincronização e as respostas têm cache curto (alguns minutos). Mudanças recentes no ContaHub podem levar um pouco para refletir aqui.

## Fonte dos dados

- **`silver.cliente_estatisticas`** — view/base consolidada por cliente (visitas, entrada, consumo, tickets, tempo de estadia, produtos e categorias favoritas, tags, status, VIP, data de nascimento). Origem: **ContaHub**.
- **`silver.cliente_visitas`** — uma linha por visita (data, couvert, pagamentos, tempo de estadia, telefone/nome). Usada no cálculo ao vivo, no histórico do modal, no cruzamento com reservas e em **todas as rotas de CRM** (Lista Quente, segmentação, retenção, churn, LTV, padrões). Já aplica o fallback do modelo cartão (telefone/nome do relatório de pagamentos). Origem: **ContaHub**. Não confundir com a legada `public.visitas`, que não tem o fallback.
- **`silver.vendas_item`** — itens consumidos por visita; usada para montar o perfil de consumo em tempo real quando não há cache. Origem: **ContaHub**.
- **`bronze_getin_reservations`** — reservas (nome, telefone, data, status, no-show). Origem: **GetIn**.
- **Funções SQL:** `get_cliente_stats_agregado` (cartões-resumo), `top_clientes_por_categoria` e `listar_categorias_clientes_estatisticas` (aba Top por Categoria).
- **Rotas de API:** `/api/analitico/clientes`, `/api/analitico/clientes/detalhes`, `/api/analitico/clientes/perfil-consumo`, `/api/analitico/reservantes`, `/api/analitico/aniversariantes`, `/api/analitico/clientes-por-categoria`, `/api/analitico/clientes/filtros-avancados`, `/api/crm/lista-quente` e `/api/crm/segmentos`.
