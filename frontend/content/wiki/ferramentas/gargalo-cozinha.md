---
title: Gargalo de Cozinha
area: ferramentas
slug: gargalo-cozinha
route: /operacional/gargalo-cozinha
description: Diagnóstico de tempos de produção — mostra onde, quando e em quais itens a cozinha (ou o bar) trava e atrasa a entrega ao cliente.
order: 90
icon: Clock
---

# Gargalo de Cozinha

## Visão geral

A tela **Gargalo de Cozinha** transforma os horários de cada pedido registrados no ContaHub em um diagnóstico de tempo de produção. Ela responde três perguntas práticas:

- **Onde trava?** Qual praça (Cozinha, Bar, etc.) mais atrasa.
- **Quando trava?** Em quais horas do dia o atraso dispara.
- **O que trava?** Quais itens do cardápio saem mais devagar.

Além disso, decompõe o tempo total em três etapas — **fila**, **preparo** e **expedição** — para separar o que é problema da cozinha do que é problema de saída (runner/garçom pegando o prato pronto).

É uma ferramenta de leitura (não há cadastro nem edição aqui). O público típico é o dono, o gerente operacional e o chef/coordenador de cozinha, que a usam para achar gargalos e cobrar melhorias. Os números batem com o indicador de **% de atraso da cozinha** que aparece na Home, porque ambos leem a mesma configuração por bar.

## Como acessar

- No menu lateral, abra **Ferramentas** e clique em **Gargalo de Cozinha** (ícone de relógio).
- Rota direta: `/operacional/gargalo-cozinha`.
- **Permissão necessária:** módulo `gestao`. Quem não tiver esse acesso não vê o item no menu.
- É preciso ter um **bar selecionado** no seletor. Sem bar, a tela mostra "Selecione um bar".

## Passo a passo

1. **Escolha a praça** no primeiro grupo de botões: **Cozinha** (padrão), **Bar** ou **Todos**. Isso define quais setores entram no cálculo.
2. **Escolha o período** no segundo grupo: **7d**, **30d** (padrão) ou **90d**. A janela conta a partir de hoje para trás.
3. **Leia os 4 cartões do topo** (KPIs): total de pedidos, tempo mediano, P90 e % de atraso. O tempo mediano traz, embaixo, o limite configurado para aquela praça.
4. **Veja "Onde trava"** — o gráfico de barras horizontais ordena as praças da pior para a melhor por % de atraso (vermelho = ruim, amarelo = atenção, verde = ok).
5. **Veja a "Decomposição do tempo"** — quanto do tempo médio é fila, preparo e expedição. Expedição alta indica prato pronto parado esperando quem leva à mesa.
6. **Veja "Quando trava"** — o gráfico por hora do dia cruza volume de pedidos (barras) com % de atraso (linha vermelha). Serve para achar o horário-pico problemático.
7. **Analise "Itens que mais atrasam"** — a tabela lista os produtos com maior % de atraso (só itens com volume suficiente no período).

> Não há botão de exportação nesta tela. A leitura é toda visual.

## Abas e seções

A tela não tem abas de navegação — é uma página única. Os dois filtros de topo (praça e período) reconfiguram todos os blocos ao mesmo tempo. Os blocos são:

- **KPIs (topo):** 4 cartões-resumo.
- **Onde trava:** barras horizontais por praça.
- **Decomposição do tempo:** barras horizontais por etapa.
- **Quando trava:** barras + linha por hora do dia.
- **Itens que mais atrasam:** tabela.

## Colunas e cálculos

A base de tudo é a métrica de tempo do pedido, em segundos, convertida para minutos na tela. Por padrão o bar usa **t0→t3 (pedido → entrega)**; se o bar não rastreia a entrega, usa **t0→t2 (pedido → pronto)** e um aviso aparece no topo. Os marcos são: **t0** = lançamento do pedido, **t1** = início da produção, **t2** = fim da produção (prato pronto), **t3** = entrega ao cliente.

Só entram no cálculo pedidos cuja métrica está entre **1 e 3.600 segundos** (corte de outlier, `p_cap_seg`). Um pedido é considerado **atrasado** quando seu tempo passa do **limite** da praça (cozinha ou bar), definido na configuração do bar.

### Cartões do topo (KPIs)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Pedidos no período | Quantos pedidos entraram na análise | `count(*)` dos pedidos válidos (métrica entre 1s e 3600s, dentro da praça e período) | `silver.tempos_producao` via `operations.fn_gargalo_cozinha` |
| Tempo mediano | Tempo típico de saída (metade sai antes disso) | Mediana da métrica: `percentile_cont(0.5)` dos tempos ÷ 60. O subtítulo mostra o limite da praça | idem |
| P90 (9 em 10 saem até) | Tempo do pior décimo — 90% dos pedidos saem até esse tempo | `percentile_cont(0.9)` dos tempos ÷ 60 | idem |
| % de atraso | Fração de pedidos que passaram do limite | `100 × pedidos com tempo > limite ÷ total`. Fica vermelho quando ≥ 25% | idem |

### Onde trava — % de atraso por praça

Barras horizontais, uma por praça (`local_desc`), ordenadas do maior para o menor % de atraso.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Setor (praça) | Nome do local de produção | `local_desc` do pedido | `silver.tempos_producao` |
| % de atraso (barra) | % de pedidos daquela praça acima do limite | `100 × pedidos > limite ÷ total da praça`. Cor: ≥25% vermelho, ≥15% amarelo, senão verde | `fn_gargalo_cozinha` (corte `por_praca`) |

> O bloco também calcula pedidos, mediana e P90 por praça (disponíveis nos dados), mas a barra exibida é o **% de atraso**.

### Decomposição do tempo

Barras horizontais mostrando onde o tempo médio é gasto, em três etapas.

| Etapa | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Fila (pediu → começou) | Espera até a produção iniciar | Média de `t0_t1` (só valores entre 0 e 3600s) ÷ 60 | `fn_gargalo_cozinha` (corte `decomposicao`) |
| Preparo (começou → pronto) | Tempo de mão na massa | Média de `t1_t2` ÷ 60 | idem |
| Expedição (pronto → entregue) | Prato pronto esperando quem leva | Média de `t2_t3` ÷ 60. **Nulo (não aparece) se o bar usa métrica t0→t2** | idem |

### Quando trava — por hora do dia

Gráfico combinado: barras = volume, linha vermelha = % de atraso, agrupado pela hora do lançamento do pedido (0–23).

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Hora | Hora do dia em que o pedido foi lançado | `EXTRACT(hour FROM t0_lancamento)` | `silver.tempos_producao` |
| Pedidos (barra) | Volume de pedidos naquela hora | `count(*)` por hora | `fn_gargalo_cozinha` (corte `por_hora`) |
| % atraso (linha) | % de pedidos daquela hora acima do limite | `100 × pedidos > limite ÷ total da hora` | idem |

### Itens que mais atrasam (tabela)

Lista dos produtos que mais atrasam, ordenada por % de atraso (desempate pela mediana), limitada aos **15 piores**. Só entram itens com **10 ou mais pedidos** no período.

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Item | Nome do produto | `produto_desc` | `silver.tempos_producao` |
| Pedidos | Quantas vezes o item foi produzido no período | `count(*)` por produto (`HAVING count(*) >= 10`) | `fn_gargalo_cozinha` (corte `itens`) |
| Tempo mediano | Tempo típico de saída do item | `percentile_cont(0.5)` da métrica ÷ 60 | idem |
| % atraso | % das vezes que o item passou do limite | `100 × produções > limite ÷ total do item`. ≥25% vermelho, ≥15% amarelo | idem |

## Filtros e opções

| Filtro | Opções | Efeito |
|---|---|---|
| Praça (categoria) | **Cozinha** (padrão), **Bar**, **Todos** | Seleciona os locais que entram no cálculo. "Cozinha" usa os locais mapeados como comidas; "Bar" usa drinks + bebidas; "Todos" usa tudo, menos os locais excluídos |
| Período (dias) | **7d**, **30d** (padrão), **90d** | Janela contada a partir de hoje para trás. A API aceita de 1 a 180 dias |
| Bar | Seletor global | Toda a tela é filtrada pelo `bar_id` do bar selecionado; a configuração de métrica, limites e locais também é a daquele bar |

Quando o bar usa a métrica **t0→t2** (não rastreia entrega), aparece o aviso *"métrica: pedido → pronto (entrega não rastreada neste bar)"* e a etapa de Expedição some da decomposição.

## Regras e detalhes importantes

- **Sempre por bar.** Todos os números respeitam o `bar_id` selecionado, e a configuração (métrica, limites, mapeamento de praças) é lida da tabela `operations.bar_regras_negocio` e `operations.bar_local_mapeamento` daquele bar.
- **Métrica t0→t3 vs t0→t2.** Padrão é o tempo até a entrega (t0→t3). Se o bar não rastreia entrega, cai para tempo até ficar pronto (t0→t2). Isso muda o "% de atraso" e zera a etapa de Expedição.
- **Limites diferentes por praça.** Locais de comida usam o **limite de cozinha** (padrão 1.200s = 20 min); os demais usam o **limite de bar** (padrão 600s = 10 min). Um pedido só conta como atraso se passar do limite da sua praça.
- **Corte de outlier.** Pedidos com tempo fora da faixa de 1s a 3.600s (1 hora) são descartados, para evitar que comandas esquecidas abertas por horas distorçam a mediana. As etapas da decomposição usam a faixa de 0 a 3.600s.
- **Mediana e P90, não média.** Os tempos de saída usam mediana e percentil 90 (mais robustos a extremos). A decomposição por etapa usa média, mas com o mesmo corte de outlier.
- **Amostra baixa.** Se houver menos de **50 pedidos** no período, aparece um aviso de que os números podem oscilar (rastreio parcial).
- **Estado vazio.** Se não houver produção para o bar/período (ou 0 pedidos válidos), a tela mostra "Sem dados de produção para este bar/período".
- **Itens exigem volume.** Só produtos com 10+ pedidos entram na tabela de itens; abaixo disso o item é omitido para não gerar conclusão em cima de pouca amostra.
- **Tudo automático.** Não há campos manuais nesta tela. Os tempos vêm do ContaHub via ETL; a configuração de praças e limites é ajustada fora desta página.

## Dúvidas frequentes

**O tempo é do pedido pronto ou da entrega na mesa?**
Depende da configuração do bar. Por padrão é até a entrega na mesa (t0→t3). Bares que não registram a entrega usam o tempo até ficar pronto (t0→t2) — e aí um aviso aparece no topo.

**Por que a "Expedição" não aparece no meu bar?**
Porque o bar usa a métrica t0→t2 (pedido → pronto). Sem o marco de entrega (t3), não dá para medir o tempo de expedição.

**O que significa expedição alta?**
Prato pronto parado esperando o runner/garçom levar à mesa. É problema de saída/salão, não da cozinha.

**Por que um item que sempre atrasa não aparece na tabela?**
A tabela só lista itens com 10 ou mais pedidos no período e mostra os 15 piores. Itens de baixo volume ficam de fora para evitar conclusões precipitadas.

**Por que o % de atraso aqui bate com o da Home?**
Porque as duas leituras usam a mesma função e a mesma configuração por bar (métrica, limites e praças). São a mesma regra de negócio.

**A que se refere a "hora" do gráfico por hora?**
À hora em que o pedido foi lançado (t0), de 0 a 23. Serve para achar o horário-pico onde o atraso dispara.

## Fonte dos dados

- **Função SQL:** `operations.fn_gargalo_cozinha(p_bar_id, p_dias, p_categoria, p_cap_seg)` — monta os cinco cortes (KPIs, por praça, por hora, itens, decomposição) em um único JSON.
- **Tabela de fatos:** `silver.tempos_producao` (marcos t0/t1/t2/t3 e intervalos t0_t1, t0_t2, t0_t3, t1_t2, t2_t3 por pedido).
- **Configuração por bar:** `operations.bar_regras_negocio` (métrica, limites de cozinha e bar) e `operations.bar_local_mapeamento` (quais locais são comidas, drinks, bebidas ou excluídos).
- **Origem dos tempos:** **ContaHub** — a tabela `contahub_tempo` é adaptada para `tempos_producao` pelo ETL (`adapter_contahub_to_tempos_producao`).
- **Rota de API:** `/api/operacional/gargalo-cozinha` (chama a função via service_role, autenticando o usuário).
