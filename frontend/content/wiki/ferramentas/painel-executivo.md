---
title: Painel Executivo
area: ferramentas
slug: painel-executivo
route: /ferramentas/painel-executivo
description: Painel de uma tela só com o pulso do negócio — resultado do ano, CMV, projeção de caixa e saúde da base de clientes — reunindo DRE, fluxo de caixa e RFM.
order: 20
icon: Activity
---

# Painel Executivo

## Visão geral

O Painel Executivo é a tela de "pulso do negócio": em uma única página, sem precisar abrir vários relatórios, o dono ou gestor vê os quatro sinais mais importantes do bar naquele momento — **quanto o bar está faturando e lucrando no ano**, **como está o CMV**, **se o caixa pode apertar nos próximos meses** e **como está a base de clientes** (quem são os campeões e quem está em risco de sumir).

A tela não faz nenhum cálculo novo: ela **junta números que já existem** em outras áreas do sistema (DRE, CMV, Fluxo de Caixa e Segmentos RFM) e os apresenta de forma resumida, mais um bloco de **Pontos de atenção** que só aparece quando algo precisa ser olhado. É uma tela de leitura rápida — pensada para abrir de manhã, bater o olho e decidir onde vale a pena aprofundar.

Cada bloco é montado de forma independente e "defensiva": se uma fonte falhar (por exemplo, o CMV do mês ainda não fechou), os outros cards continuam aparecendo normalmente.

## Como acessar

No menu lateral: **Ferramentas → Painel Executivo**.

- **Permissão necessária:** módulo `home` (a mesma permissão da tela inicial). É a permissão mais aberta do sistema, então praticamente todo usuário com acesso ao bar consegue ver o painel.
- A tela sempre mostra os dados do **bar selecionado** no seletor de bar. Para ver outro bar, troque o bar no topo — os números são recarregados automaticamente.

## Passo a passo

### Ver o resumo do bar
1. Abra **Ferramentas → Painel Executivo**.
2. Confira no topo se o bar selecionado é o que você quer analisar. Se não for, troque o bar no seletor.
3. Leia de cima para baixo: primeiro o bloco **Pontos de atenção** (se aparecer), depois **Resultado** e por fim **Caixa & Clientes**.

### Trocar de bar
1. Use o seletor de bar no cabeçalho do sistema.
2. O painel recarrega sozinho com os números do novo bar (cada bar tem cache próprio de 30 segundos).

### Aprofundar em um indicador
No rodapé da tela há atalhos para as telas de origem de cada número. Clique para ver o detalhe completo:
1. **Ver DRE completa** → abre a DRE em `/financeiro/dre`.
2. **Orçamentação** → abre `/estrategico/orcamentacao`.
3. **Fluxo de caixa** → abre `/financeiro/fluxo-caixa`.
4. **Segmentos (RFM)** → abre a análise de clientes em `/analitico/clientes/segmentos`.

## Abas e seções

A tela **não tem abas**. É uma página única, dividida em blocos empilhados:

- **Pontos de atenção** (opcional): faixa amarela no topo, só aparece quando há algum alerta.
- **Resultado (ano):** quatro cards com faturamento do mês, receita e lucro do ano, e CMV.
- **Caixa & Clientes:** quatro cards com projeção de caixa e segmentos de clientes.
- **Atalhos:** linha de links para as telas detalhadas.

## Colunas e cálculos

Todos os valores monetários são exibidos em Reais, **arredondados para o inteiro** (sem centavos). Percentuais aparecem com uma casa decimal.

### Bloco "Pontos de atenção" (alertas)

Só aparece quando pelo menos uma das condições abaixo é verdadeira. Cada linha é um alerta:

| Alerta | Quando aparece | Como é calculado | Fonte |
|---|---|---|---|
| CMV acima da meta | CMV realizado maior que a meta **+ 1 ponto percentual** | `cmv.pct > cmv.meta + 1` — a folga de 1 ponto evita alarme por diferenças pequenas | `financial.cmv_mensal` / `cmv_semanal` |
| Caixa pode apertar | Existe uma data, dentro do horizonte projetado, em que o saldo acumulado no **cenário pessimista** fica negativo | Primeira data em que o saldo acumulado pessimista `< 0` | `financial.fluxo_caixa_previsto` |
| Clientes valiosos em risco | Há clientes no segmento "Em risco" com valor associado maior que zero | `rfm.em_risco_valor > 0` | RPC `get_rfm_resumo` → `crm.cliente_rfm` |

### Bloco "Resultado (ano)"

| Card | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Faturamento do mês** | Receita reconhecida no **mês corrente** (mês ainda aberto) | Soma de `valor_com_sinal` das linhas de categoria macro **Receita** cujo mês é o mês atual | `gold.mv_dre_ano` |
| **Receita YTD (fechado)** | Receita acumulada no ano, **só dos meses já fechados** (exclui o mês corrente) | Soma de `valor_com_sinal` das linhas macro **Receita** com mês **menor** que o mês atual | `gold.mv_dre_ano` |
| **Lucro YTD (fechado)** | Resultado (lucro/prejuízo) acumulado no ano, só meses fechados | Soma de `valor_com_sinal` das linhas com `ordem_macro ≤ 9` (resultado operacional — exclui Investimentos, Dividendos e Não Mapeado) nos meses fechados. Verde se ≥ 0, vermelho se negativo | `gold.mv_dre_ano` |
| **Margem** (subtítulo do Lucro) | Margem do lucro sobre a receita, no acumulado fechado | `lucro_ytd ÷ receita_ytd × 100` | `gold.mv_dre_ano` |
| **CMV** | Percentual de CMV mais recente (custo da mercadoria vendida) | Ver detalhamento abaixo. Verde se dentro da meta, vermelho se acima | `financial.cmv_mensal` / `cmv_semanal` |
| **Meta / referência** (subtítulo do CMV) | Meta de CMV e o período de referência | Meta = CMV teórico (usa o manual se preenchido, senão o calculado). Referência = mês (`MM/AAAA`) ou semana (`Sxx/AAAA`) | `financial.cmv_mensal` / `cmv_semanal` |

**Como o CMV é escolhido:** o painel busca primeiro o **último mês fechado** (mês anterior ao atual) na tabela `cmv_mensal`. Se esse mês tiver um CMV limpo válido (maior que zero), usa ele. Se não houver mês fechado válido, cai para a **última semana** com CMV preenchido em `cmv_semanal`. A meta usada é o CMV teórico manual quando existe; caso contrário, o CMV teórico calculado.

### Bloco "Caixa & Clientes"

| Card | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Saldo projetado 90d** | Saldo de caixa acumulado até o fim do horizonte projetado, no **cenário base** | Soma acumulada de `saldo_dia` do cenário `base`, dia a dia, até o último dia projetado. Verde se ≥ 0, vermelho se negativo | `financial.fluxo_caixa_previsto` |
| **Caixa aperta?** | A primeira data em que o caixa fica negativo no cenário pessimista, ou "não em 90d" | Primeira data em que o saldo acumulado do cenário `pessimista` fica `< 0`. Se nunca fica negativo, mostra "não em 90d" | `financial.fluxo_caixa_previsto` |
| **Campeões** | Quantidade de clientes no segmento "Campeões" | Contagem de clientes com segmento `Campeões` (visitaram nos últimos 30 dias **e** têm 5+ visitas) | RPC `get_rfm_resumo` → `crm.cliente_rfm` |
| **Valor dos Campeões** (subtítulo) | Valor total consumido pelos campeões | Soma do valor monetário (consumo total) dos clientes campeões | `crm.cliente_rfm` |
| **Clientes em risco** | Quantidade de clientes no segmento "Em risco" | Contagem de clientes com segmento `Em risco` (frequência 3+ mas sem visitar entre 61 e 180 dias) | RPC `get_rfm_resumo` → `crm.cliente_rfm` |
| **Valor em jogo** (subtítulo) | Valor total consumido pelos clientes em risco | Soma do valor monetário dos clientes em risco — é o quanto de receita está "em jogo" se eles não voltarem | `crm.cliente_rfm` |

> **Nota sobre "90d":** os cards de caixa acumulam o saldo até o **último dia disponível** na projeção de fluxo de caixa. O rótulo "90d" reflete o horizonte usual dessa projeção; o alcance real depende de quantos dias `fluxo_caixa_previsto` tiver preenchidos para o bar.

## Filtros e opções

O Painel Executivo é intencionalmente enxuto — **não tem filtros de período, categoria nem toggles na própria tela**. O único "filtro" é o bar:

- **Seletor de bar:** define qual bar é analisado. Todos os cards são recalculados por `bar_id`.
- **Ano/mês:** são automáticos, baseados na data de hoje. O ano usado é o ano corrente; o "mês fechado" é sempre o mês anterior ao atual.

## Regras e detalhes importantes

- **Sempre filtra por `bar_id`.** Cada card consulta apenas o bar selecionado; nunca mistura bares.
- **Ano corrente e mês fechado são automáticos.** "YTD (fechado)" exclui o mês atual porque ele ainda está aberto e incompleto. O "Faturamento do mês" mostra justamente esse mês corrente, ainda parcial.
- **Lucro exclui linhas fora do resultado operacional.** No cálculo do Lucro YTD, entram só as macros com `ordem_macro ≤ 9` — ficam de fora Investimentos, Dividendos e categorias Não Mapeadas.
- **Folga de 1 ponto no alerta de CMV.** O aviso de "CMV acima da meta" só dispara quando o realizado passa a meta em mais de 1 ponto percentual, para evitar alarme por variações pequenas.
- **Falha isolada não derruba a tela.** Se uma fonte não responder, aquele bloco vem vazio (exibindo "—") e os demais continuam funcionando.
- **Estado vazio:** cards sem dado mostram "—" (valores monetários e percentuais) ou zero (contagens de clientes). Se não houver bar selecionado ao abrir, a tela mostra um esqueleto de carregamento até os dados chegarem.
- **Performance / cache-first.** A página é renderizada no servidor já com os dados (lê o bar do cookie), então o primeiro carregamento normalmente aparece com os números prontos, sem esqueleto. Navegar para fora e voltar reaproveita o cache (dedupe de 30 segundos por bar). A rota de API revalida a cada 5 minutos.
- **DRE materializada.** O resultado do ano vem da view materializada `gold.mv_dre_ano`, com refresh horário — por isso é praticamente instantâneo, mas pode estar defasado em até ~1 hora em relação à DRE ao vivo.
- **RFM atualiza uma vez por dia.** Os segmentos de clientes vêm de uma matview de RFM com refresh diário (por volta de 06:30 BRT). Os números de campeões e em risco refletem a foto do dia anterior.

## Dúvidas frequentes

**Por que a Receita YTD não bate com o faturamento total do ano?**
Porque a Receita YTD só soma **meses já fechados**. O mês corrente, ainda aberto, aparece separado no card "Faturamento do mês" e não entra no acumulado.

**O CMV mostrado é de qual período?**
Do último **mês fechado** (mês anterior ao atual). Se esse mês ainda não tiver CMV calculado, a tela mostra a última **semana** disponível — nesse caso a referência aparece como "Sxx/AAAA".

**O que significa "Caixa aperta em [data]"?**
É a primeira data em que o saldo de caixa projetado ficaria negativo no **cenário pessimista** (o mais conservador). É um aviso preventivo, não uma certeza — vale abrir o Fluxo de Caixa para investigar.

**Quem são os "Clientes em risco" e por que o valor importa?**
São clientes que costumavam vir com frequência (3+ visitas) mas estão sem aparecer há 61 a 180 dias. O "valor em jogo" é quanto eles já consumiram no histórico — é a receita que você pode perder se eles não voltarem (e é justamente esse grupo que a ferramenta de Win-back mira).

**Consigo mudar o período ou filtrar por categoria?**
Não nesta tela. O painel é um resumo de leitura rápida. Para analisar períodos e detalhes, use os atalhos no rodapé (DRE, Orçamentação, Fluxo de Caixa, Segmentos).

**Os números atualizam em tempo real?**
Quase. A DRE é atualizada de hora em hora, o RFM uma vez por dia e a API revalida a cada 5 minutos. Para o dia a dia executivo isso é suficiente; para o número exato do momento, abra a tela de origem.

## Fonte dos dados

A tela consome dados já processados por outras áreas do Zykor:

- **`gold.mv_dre_ano`** — DRE materializada por bar/ano (receita, lucro, margem, faturamento do mês). Alimentada pela pipeline financeira a partir do Conta Azul / NIBO.
- **`financial.cmv_mensal` e `financial.cmv_semanal`** — CMV realizado e teórico, por mês e por semana. Alimentados pela pipeline de CMV (compras, estoque, contagem).
- **`financial.fluxo_caixa_previsto`** — projeção de fluxo de caixa por dia e por cenário (base e pessimista).
- **`crm.cliente_rfm`** (via RPC `public.get_rfm_resumo`) — matview de segmentação RFM por telefone, construída a partir de `silver.cliente_visitas` (visitas e consumo dos clientes, origem ContaHub). Refresh diário.
