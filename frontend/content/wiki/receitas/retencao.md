---
title: Retenção
area: receitas
slug: retencao
route: /analitico/clientes/retencao
description: Matriz de coorte que mostra, mês a mês, quantos clientes voltaram ao bar depois da primeira visita.
order: 100
icon: TrendingUp
---

# Retenção

## Visão geral

A tela **Retenção** responde a uma pergunta simples e valiosa: **dos clientes que vieram pela primeira vez em um determinado mês, quantos voltaram nos meses seguintes?**

Ela monta uma **matriz de coorte** (análise por safra de clientes). Cada linha é um mês de "estreia" — o mês em que um grupo de clientes fez a **primeira visita** ao bar. As colunas mostram quanto desse grupo continuou aparecendo 1, 2, 3... meses depois, sempre em **percentual**.

É a ferramenta certa pra enxergar **fidelização** ao longo do tempo: se o percentual do mês seguinte está subindo safra após safra, o bar está retendo melhor; se está caindo, os clientes novos estão vindo uma vez e sumindo. Serve principalmente para dono, sócios e time de marketing/CRM acompanharem a saúde da base de clientes recorrentes.

Os clientes são identificados por **telefone** (não por nome nem CPF), o que evita contar a mesma pessoa duas vezes quando ela volta.

## Como acessar

No menu lateral, abra **Receitas → Retenção** (ícone de tendência de alta).

- **Permissão necessária:** módulo **`relatorios`**. Quem tem acesso aos relatórios de Receitas (Dashboard, Clientes, Segmentos, Win-back) também vê a Retenção.
- A tela sempre mostra os dados do **bar selecionado** no seletor de bar do topo. Trocar de bar recarrega a matriz.

## Passo a passo

**Ler a matriz de retenção:**

1. Entre em **Receitas → Retenção**.
2. Confira no topo qual **bar** está selecionado — a matriz é sempre daquele bar.
3. Cada **linha** é uma coorte (safra), rotulada pelo mês da primeira visita, no formato `Mês/Ano` (ex.: `Jan/26`).
4. A coluna **Clientes** mostra o tamanho daquela safra — quantos clientes novos estreiaram naquele mês.
5. As colunas **M+1, M+2, ...** mostram o **percentual** daquela safra que voltou 1 mês depois, 2 meses depois, e assim por diante.
6. Use as **cores** como leitura rápida: quanto mais verde, melhor a retenção; amarelo é intermediário; vermelho é baixo; célula em branco (`—`) significa que ainda não há mês para comparar.

**Comparar safras (fidelização ao longo do tempo):**

1. Escolha uma coluna, por exemplo **M+1**.
2. Percorra as linhas de cima pra baixo e compare o percentual de M+1 entre as safras.
3. Se o M+1 vem **crescendo** nas safras mais recentes, as ações de retenção estão funcionando; se vem **caindo**, vale investigar (experiência, motivo de não retornar, campanhas de recompra).

> A tela não tem filtro de período na interface nem botão de exportar. Ela carrega automaticamente as **safras dos últimos 12 meses** e mostra a evolução de até **6 meses** após cada estreia.

## Colunas e cálculos

A matriz é montada a partir da view materializada `gold.cliente_coorte_mensal`, que roda sobre o histórico de visitas dos clientes (`silver.cliente_visitas`). Toda a lógica agrupa clientes por **telefone normalizado**.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Coorte (1ª visita) | O mês de estreia da safra, no formato `Mês/Ano` (ex.: `Fev/26`) | Para cada cliente (telefone), pega-se a **menor data de visita** e trunca-se para o primeiro dia do mês (`date_trunc('month', min(data_visita))`). Esse mês é a coorte do cliente. A tela exibe as safras cuja estreia caiu nos **últimos 12 meses**. | `gold.cliente_coorte_mensal.coorte` |
| Clientes | Tamanho da safra: quantos clientes distintos estreiaram naquele mês | É o valor da própria coorte no mês de estreia (offset 0): contagem de telefones distintos que fizeram a primeira visita naquele mês. Serve de **base (100%)** para os percentuais das colunas seguintes. | `gold.cliente_coorte_mensal.clientes` (linha `mes_offset = 0`) |
| M+1, M+2, ... M+6 | Percentual da safra que **voltou** N meses depois da estreia | Para cada mês de atividade da safra, calcula-se `mes_offset` = diferença em meses entre o mês de atividade e o mês da coorte. A célula é `(clientes_no_offset_N ÷ clientes_base) × 100`, formatado com 1 casa decimal. Se não houver dado para aquele offset, mostra `—`. A tela limita a exibição a **6 colunas** (M+1 até M+6). | `gold.cliente_coorte_mensal.clientes` por `mes_offset` |

**Como o "voltou" é contado:** um cliente conta para o offset N se ele teve **pelo menos uma visita** naquele mês (a atividade é `DISTINCT` por mês — várias visitas no mesmo mês contam uma vez). A contagem em cada célula é de **telefones distintos**, então não há dupla contagem dentro do mês.

**Cores da célula (M+N):**

| Faixa do percentual | Cor | Leitura |
|---|---|---|
| ≥ 15% | Verde forte | Retenção muito boa |
| 8% a 14,9% | Verde claro | Retenção boa |
| 4% a 7,9% | Âmbar | Retenção mediana |
| > 0% e < 4% | Vermelho claro | Retenção baixa |
| 0% ou sem dado | Sem cor / `—` | Ninguém voltou ou mês ainda não comparável |

## Filtros e opções

Esta tela é enxuta e **não tem controles manuais** de filtro na interface. O que define o recorte:

- **Bar:** vem do seletor de bar no topo do sistema. A consulta filtra por `bar_id` do bar selecionado — cada bar tem sua própria matriz.
- **Janela de safras (fixa):** a página pede `meses=12`, ou seja, mostra as coortes cuja **primeira visita** caiu nos últimos 12 meses. A API aceita esse parâmetro entre 1 e 24, mas a tela usa 12 fixo.
- **Colunas exibidas (fixa):** até **M+6** (6 meses após a estreia), mesmo que os dados existam para offsets maiores.

## Regras e detalhes importantes

- **Identificação por telefone:** clientes são agrupados pelo **telefone normalizado** (`cliente_fone_norm`). Visitas **sem telefone** ficam de fora da matriz — não entram na base nem na retenção. Isso significa que a matriz cobre a parcela de clientes identificados, não 100% do movimento.
- **Filtragem por bar:** a matriz é sempre de um único bar (`bar_id`), respeitando o padrão do sistema. A retenção de um bar nunca mistura clientes de outro.
- **Dado atualizado 1x por dia:** a fonte é uma **view materializada** que é recalculada por rotina automática todo dia (por volta de 08:30, horário de Brasília). Portanto, visitas de hoje só aparecem na matriz **a partir do próximo refresh** — a tela não é em tempo real.
- **Mês, não dia:** tudo é agregado por **mês de calendário**. O "offset" é a diferença de meses entre a atividade e a estreia, então uma visita no dia 30 e outra no dia 1 do mês seguinte já contam como offset diferente.
- **Base = mês de estreia:** o denominador de cada percentual é o tamanho da safra no offset 0. Safras mais recentes têm **menos colunas preenchidas** (ainda não passaram tantos meses), por isso aparecem células `—` à direita.
- **Efeito do modelo cartão (a partir de 06/07/2026):** desde a mudança do ContaHub para o modelo de cartão, o telefone do cliente passou a vir pelo relatório de **pagamentos** (e não mais pelo de período). O ETL de visitas já faz esse *fallback* para continuar capturando o telefone, mas variações na cobertura de telefone entre períodos podem influenciar o tamanho das safras.
- **Tudo automático:** não há nenhum campo manual nesta tela. Todos os números vêm do pipeline de dados; não é possível editar a matriz.

## Dúvidas frequentes

**O que significa "M+1", "M+2"?**
É quantos meses se passaram desde a primeira visita da safra. M+1 = um mês depois da estreia, M+2 = dois meses depois, e assim por diante. O valor é o percentual da safra que voltou naquele mês.

**Por que algumas células mostram "—"?**
Porque ainda não há mês para comparar. Uma safra que estreou no mês passado só tem M+1; os offsets maiores ficam em branco até o tempo passar.

**Por que a coluna "Clientes" é menor do que o movimento real do bar?**
Porque só entram na conta os clientes com **telefone identificado**. Mesas sem telefone informado não aparecem na matriz.

**Se o mesmo cliente voltou 5 vezes no mês, ele conta 5?**
Não. Dentro de um mês, cada telefone conta **uma vez**. A célula mostra clientes distintos que voltaram, não número de visitas.

**Consigo ver mais de 6 meses de retenção?**
Na tela, não — ela mostra até M+6. Os dados existem para além disso na fonte, mas a interface limita a 6 colunas.

**Com que frequência os números atualizam?**
Uma vez por dia (refresh automático da view materializada, por volta das 08:30 BRT). Não é tempo real.

## Fonte dos dados

- **`gold.cliente_coorte_mensal`** — view materializada que a API consulta diretamente. Guarda, por bar, coorte e `mes_offset`, a contagem de clientes distintos. É recalculada diariamente por `pg_cron` (`refresh-cliente-coorte-mensal`).
- **`silver.cliente_visitas`** — base de visitas por cliente (uma linha por venda/comanda), com telefone normalizado (`cliente_fone_norm`) e data da visita. É a matéria-prima da coorte.
- **API:** `GET /api/analitico/clientes/retencao?meses=12`, que filtra por `bar_id` do usuário autenticado e retorna as linhas `(coorte, mes_offset, clientes)` para o front pivotar em matriz.
- **Origem dos dados:** **ContaHub** — as visitas vêm do pipeline de ingestão do ContaHub (relatórios de período e de pagamentos), processados nas camadas bronze → silver → gold.
