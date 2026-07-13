---
title: Segmentos (RFM)
area: receitas
slug: segmentos-rfm
route: /analitico/clientes/segmentos
description: Agrupa os clientes do bar em 7 segmentos (Campeões, Leais, Em risco, Perdidos etc.) a partir de Recência, Frequência e Valor, para direcionar campanhas de relacionamento.
order: 80
icon: PieChart
---

# Segmentos (RFM)

## Visão geral

A tela **Segmentos (RFM)** organiza toda a base de clientes identificados (aqueles com telefone) em **7 grupos de comportamento**, usando a metodologia clássica de marketing **RFM**:

- **R — Recência**: há quantos dias o cliente veio pela última vez.
- **F — Frequência**: em quantos dias diferentes ele já visitou o bar.
- **M — Monetário (Valor)**: quanto ele já gastou no total.

Cruzando esses três eixos, cada cliente cai automaticamente em um segmento: **Campeões, Leais, Promissores, Novos, Em risco, Hibernando ou Perdidos**. Serve para o time de marketing/relacionamento saber **quem premiar, quem fidelizar e quem reativar antes de perder de vez** — e exportar a lista de cada grupo para uma campanha (WhatsApp, ligação, oferta).

No dia a dia é usada pelo dono, pelo marketing e por quem cuida de CRM/relacionamento.

## Como acessar

No menu lateral: **Receitas → Segmentos (RFM)** (`/analitico/clientes/segmentos`).

A tela exige a permissão de módulo **`relatorios`** (Relatórios/Receitas). Quem não tem esse módulo liberado não vê o item no menu nem acessa a rota.

Os dados são sempre do **bar selecionado** no seletor de bar do topo — trocar de bar recarrega os segmentos daquele bar.

## Passo a passo

**1. Ver a distribuição geral**
Ao abrir, a tela mostra 7 cartões (um por segmento) com a quantidade de clientes e o valor total gasto de cada grupo, além do total de clientes identificados no cabeçalho.

**2. Filtrar por um segmento**
Clique em qualquer cartão (ex.: **Em risco**). O cartão fica destacado e a tabela abaixo passa a listar **somente** os clientes daquele segmento, ordenados do que mais gastou para o que menos gastou. A frase acima da tabela mostra qual segmento está ativo e uma dica de ação.

**3. Limpar o filtro**
Clique de novo no mesmo cartão, ou no link **"limpar filtro"**, para voltar a ver o top de clientes de todos os segmentos juntos.

**4. Exportar para campanha**
Com ou sem filtro aplicado, clique em **Exportar CSV**. O sistema baixa um arquivo com os clientes atualmente listados (nome, telefone, segmento, visitas, dias sem vir, ticket médio, total gasto e última visita). O nome do arquivo indica o segmento (`segmentos-em-risco`, `segmentos-todos` etc.). Esse CSV é a lista que você usa para disparar a campanha.

**5. Ler a dica de cada segmento**
Passe o mouse sobre um cartão para ver a descrição/ação recomendada do grupo (ex.: "Eram frequentes, sumindo — reativar JÁ").

## Colunas e cálculos

### Cartões de segmento (resumo)

Cada cartão vem da função `get_rfm_resumo`, que agrega a matview `crm.cliente_rfm` por segmento no banco.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome do segmento | Rótulo do grupo (Campeões, Leais, Promissores, Novos, Em risco, Hibernando, Perdidos) | Classificação por regra RFM (ver "Regras" abaixo) | `crm.cliente_rfm.segmento` |
| Clientes (número grande) | Quantos clientes caem no segmento | `count(*)` dos clientes do bar naquele segmento | `get_rfm_resumo` |
| Valor total (linha pequena, em R$) | Soma gasta por todos os clientes do segmento | `SUM(monetario)` arredondado sem centavos | `get_rfm_resumo` |
| Total de clientes (cabeçalho) | Total de clientes identificados no bar | Soma da coluna "clientes" de todos os segmentos | calculado na tela |

### Tabela de clientes

Lista lida direto da matview `crm.cliente_rfm`, filtrada por `bar_id`, ordenada por **maior valor gasto** e limitada a 100 clientes (máximo 500).

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cliente | Nome do cliente; se não houver, mostra "sem nome". Abaixo, a data da última visita | Nome = maior valor não-vazio de `cliente_nome` entre as visitas | `crm.cliente_rfm.cliente_nome` / `ultima_visita` |
| Segmento | Grupo RFM do cliente | Classificação por regra RFM | `crm.cliente_rfm.segmento` |
| Visitas | Frequência: em quantos dias diferentes o cliente veio | `count(DISTINCT data_visita)` | `crm.cliente_rfm.frequencia` |
| Dias sem vir | Recência: dias desde a última visita | `CURRENT_DATE − ultima_visita` (recalculado no refresh diário) | `crm.cliente_rfm.recencia_dias` |
| Ticket médio | Gasto médio por visita | `AVG(valor_consumo)` ignorando zeros, arredondado a 2 casas | `crm.cliente_rfm.ticket_medio` |
| Total gasto | Valor: soma histórica gasta pelo cliente | `SUM(valor_consumo)` arredondado a 2 casas | `crm.cliente_rfm.monetario` |
| Tel | Telefone normalizado (chave do cliente) | Telefone padronizado a partir do ContaHub | `crm.cliente_rfm.cliente_fone_norm` |

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| **Seletor de bar** (topo) | Todos os números passam a ser do bar selecionado. Cada bar tem sua própria base RFM. |
| **Clique no cartão de segmento** | Filtra a tabela para mostrar só os clientes daquele grupo. Clicar de novo desliga o filtro. |
| **"limpar filtro"** | Remove o filtro de segmento e volta ao top geral. |
| **Exportar CSV** | Baixa exatamente a lista que está na tabela no momento (respeita o filtro de segmento). Fica desabilitado quando não há clientes. |

Não há filtro de período nesta tela: o RFM considera **todo o histórico** de visitas do cliente (não uma janela de datas escolhida).

## Regras e detalhes importantes

**Como cada segmento é definido** (avaliado em ordem, o primeiro que bate vence — `R` = dias desde a última visita, `F` = frequência):

| Segmento | Regra |
|---|---|
| **Campeões** | Veio nos últimos 30 dias **e** frequência ≥ 5 |
| **Leais** | Veio nos últimos 60 dias **e** frequência ≥ 3 |
| **Novos** | Frequência = 1 **e** veio nos últimos 30 dias |
| **Promissores** | Frequência ≤ 2 **e** veio nos últimos 60 dias |
| **Em risco** | Frequência ≥ 3 **e** última visita entre 61 e 180 dias atrás |
| **Hibernando** | Última visita entre 61 e 180 dias atrás (frequência baixa) |
| **Perdidos** | Todos os demais (em geral +180 dias sem vir) |

- **Só clientes com telefone entram.** A base é construída apenas para visitas com telefone preenchido e normalizado (`tem_telefone`). Cliente sem telefone identificado não aparece no RFM.
- **Chave do cliente = telefone normalizado.** Todas as visitas do mesmo telefone (no mesmo bar) são agrupadas em um único cliente. O nome exibido é o melhor nome não-vazio encontrado entre as visitas.
- **Sempre por bar.** A matview tem `bar_id` na chave; um mesmo telefone em bares diferentes vira registros separados.
- **Atualização diária.** Os números vêm de uma matview (`crm.cliente_rfm`) atualizada por um refresh **diário (por volta de 06:30 BRT)**. Recência e segmento são recalculados nesse refresh — durante o dia os "dias sem vir" não mudam em tempo real.
- **Ticket médio ignora zeros.** Visitas com consumo zerado não entram na média (mas entram na contagem de visitas/frequência).
- **Valores arredondados.** Nos cartões o valor total do segmento aparece **sem centavos**; na tabela, ticket e total gasto usam 2 casas internamente e são exibidos sem centavos (formato R$).
- **Origem do consumo (modelo cartão).** Desde 06/07/2026 o telefone/nome do cliente passou a vir do relatório de **pagamentos** do ContaHub (campos `cht_fonea`/`cht_nome`), e não mais só do relatório de período. O ETL de `silver.cliente_visitas` usa isso como fallback para não perder clientes do modelo cartão.

## Dúvidas frequentes

**Por que o total de clientes aqui é menor do que o número de clientes que atendo?**
Porque o RFM só conta clientes **identificados por telefone**. Quem pagou sem deixar telefone não é contabilizado.

**Os números atualizam na hora que o cliente vem?**
Não. A base é recalculada uma vez por dia (madrugada/manhã). A visita de hoje costuma refletir só no dia seguinte.

**O que faço com o segmento "Em risco"?**
São clientes que eram frequentes (≥3 visitas) e sumiram há 2–6 meses. É o grupo com maior retorno de reativação — exporte e dispare uma campanha de win-back o quanto antes.

**Qual a diferença entre "Em risco" e "Hibernando"?**
Os dois estão 61–180 dias sem vir, mas **Em risco** tinha frequência alta (≥3 visitas — vale mais a pena recuperar) e **Hibernando** tinha frequência baixa.

**O CSV exporta todos os clientes do segmento?**
Exporta os que estão carregados na tabela (top por valor, até 100 por padrão). Para grupos muito grandes, os primeiros já são os mais valiosos.

**Um cliente pode estar em dois segmentos?**
Não. Cada cliente cai em exatamente um segmento, pela primeira regra que ele satisfizer na ordem acima.

## Fonte dos dados

- **`crm.cliente_rfm`** — matview que calcula Recência, Frequência, Monetário, ticket médio e o segmento de cada cliente (por `bar_id` + telefone). Atualizada por refresh diário (`crm.refresh_cliente_rfm`).
- **`public.get_rfm_resumo(bar_id)`** — função que agrega a matview por segmento (contagem e valor total) para os cartões.
- **`silver.cliente_visitas`** — tabela-base das visitas por cliente (data da visita, valor de consumo, telefone/nome), alimentada pelo ETL `etl_silver_cliente_visitas_dia`.
- **Integração de origem: ContaHub** — relatórios de vendas por período e de pagamentos (modelo cartão: telefone/nome vêm de `cht_fonea`/`cht_nome`).
- **API interna:** `GET /api/analitico/clientes/rfm?bar_id=...[&segmento=...]`.
