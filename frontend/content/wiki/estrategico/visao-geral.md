---
title: Visão Geral
area: estrategico
slug: visao-geral
route: /estrategico/visao-geral
description: Painel executivo que reúne os principais indicadores anuais (faturamento, pessoas, reputação) e as metas trimestrais de clientes, retenção, CMV, CMO e custo artístico do bar.
order: 10
icon: TrendingUp
---

# Visão Geral

## Visão geral

A **Visão Geral** é o painel executivo do Zykor. Em uma única tela ela mostra, de um lado, a **performance anual** do bar (faturamento total, número de pessoas atendidas e reputação no Google) e, do outro, os **indicadores estratégicos do trimestre** (clientes ativos, clientes totais, retenção, CMV limpo, CMO e percentual gasto com atração artística), cada um comparado com a sua meta.

É a tela pensada para o dono e a gestão olharem "de cima": responde rapidamente às perguntas "estamos batendo a meta de faturamento do ano?", "quantos clientes ativos temos agora?" e "o custo de mercadoria e de mão de obra estão dentro do planejado?". Cada indicador aparece em um cartão com o valor atual, a meta, uma barra de progresso e a variação em relação ao período anterior.

Os dados são recalculados e cacheados a cada 1 hora, já que agregam o ano/trimestre inteiro e não mudam de minuto em minuto.

## Como acessar

No menu lateral: **Estratégico → Visão Geral** (`/estrategico/visao-geral`).

- O grupo **Estratégico** exige a permissão de módulo `gestao`.
- O item **Visão Geral** exige a permissão `home` — ou seja, praticamente todo usuário com acesso ao sistema consegue abrir esta tela.

A tela sempre respeita o **bar selecionado** no seletor de bar. Se nenhum bar estiver definido/sincronizado, aparece a checagem de sincronização (`BarSyncCheck`) no lugar dos indicadores.

## Passo a passo

**1. Escolher o bar**
No topo do sistema, selecione o bar desejado (Ordinário, Deboche etc.). Todos os números da tela são filtrados por esse bar.

**2. Ler os indicadores anuais**
O primeiro bloco ("Visão Geral • Performance Anual") traz três cartões referentes ao ano corrente inteiro. Clique no cabeçalho (ou na setinha à direita) para recolher/expandir o bloco.

**3. Navegar entre trimestres**
No segundo bloco (indicadores trimestrais), use as setas **◀ / ▶** ao lado do rótulo "Xº Tri" para trocar de trimestre. A navegação muda o parâmetro `?trimestre=` na URL e recarrega os dados daquele trimestre. Não é possível ir além do 1º nem do 4º trimestre (as setas ficam desabilitadas nos extremos).

**4. Ver o detalhamento de um cartão**
Os cartões de **Faturamento** e **Pessoas** trazem, na parte de baixo, o detalhamento por fonte (ContaHub, Yuzer, Sympla). Passe o mouse sobre o ícone de informação (ℹ️) de cada cartão para ler a explicação do indicador.

**5. Editar o CMV Limpo manualmente**
Passe o mouse sobre o cartão **CMV Limpo**: aparece um botão de lápis no canto superior direito. Clique nele para abrir o modal "Atualizar CMV Limpo", digite o percentual (ex.: `32,5`) e clique em **Salvar CMV**. O valor é gravado como CMV manual do trimestre e a tela recarrega. Use isso apenas quando o CMV real ainda não veio automático — o CMV correto é calculado nas planilhas "CMV Semanal" / "CMV Mensal".

**6. Ir para o Organizador**
No canto superior direito do bloco anual há o botão **Organizador**, que leva à tela `/estrategico/organizador`.

## Abas e seções

A tela não tem abas, e sim **dois blocos recolhíveis**:

- **Performance Anual** — três cartões do ano corrente (faturamento, pessoas, reputação).
- **Trimestre (Xº Trimestre do ano)** — sete cartões operacionais do trimestre selecionado, com navegação entre trimestres.

Cada bloco pode ser expandido ou recolhido clicando no seu cabeçalho.

## Colunas e cálculos

### Bloco Anual

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Faturamento (ano)** | Receita líquida total do ano corrente, em R$ | Soma do faturamento líquido ContaHub + Yuzer no ano. Detalhado por fonte: ContaHub (`SUM(valor_liquido)` de `faturamento_pagamentos`), Yuzer (`SUM(valor_liquido)` de `yuzer_pagamento`). Sympla aparece no detalhamento mas hoje entra como 0 no faturamento. Meta fixa: R$ 18.000.000. | `view_visao_geral_anual` (mv) via RPC `calcular_visao_geral_anual` |
| **Pessoas (ano)** | Total de pessoas atendidas no ano | Soma de: pessoas ContaHub (`SUM(pessoas)` de `visitas`) + pessoas Yuzer (quantidade de itens cujo produto contém "ingresso"/"entrada") + pessoas Sympla (participantes com check-in). Meta fixa: 78.000. | `view_visao_geral_anual` (mv) |
| **Reputação** | Nota média de avaliações Google no ano, com 2 casas | Média de `stars` das avaliações do Google (`google_reviews`) do ano, ignorando notas nulas ou zero. Meta fixa: 4,9 ⭐. | `view_visao_geral_anual` (mv) → `google_reviews` |

> Observação: existe também um indicador de **EBITDA** previsto no código (meta R$ 1.800.000), porém hoje ele não é exibido na tela — o valor está zerado até ser implementado.

### Bloco Trimestral

As metas deste bloco variam por trimestre (ver seção "Regras e detalhes importantes"). A barra de progresso de CMV, CMO e % Artística é **invertida** ("menos é melhor").

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Clientes Ativos** | Média de clientes ativos nos meses do trimestre | Para cada mês do trimestre, conta clientes (por telefone normalizado) com **≥ 2 visitas nos últimos 90 dias** contados até o fim daquele mês; depois tira a média dos meses. A variação compara com a média do trimestre anterior. | RPC `get_clientes_ativos_media_trimestre` → `silver.cliente_visitas` |
| **Clientes Totais** | Clientes únicos que visitaram no trimestre | Contagem de telefones distintos (`cliente_fone` com 8+ dígitos) com visita no trimestre. | `view_visao_geral_trimestral` (mv) → `visitas`, via RPC `calcular_visao_geral_trimestral` |
| **Retornantes (Retenção)** | % dos clientes do trimestre que já tinham visitado o bar antes | `retornantes ÷ total de clientes do período × 100`, onde "retornante" é o cliente do período cujo telefone já aparece em visitas anteriores ao início do período. | RPC `calcular_metricas_clientes` → `visitas` |
| **Retenção Real** | % dos clientes do período anterior que voltaram no período atual | `clientes que voltaram ÷ total do período anterior × 100`. Compara telefones distintos do trimestre anterior que reaparecem no trimestre atual. Variação vs. o cruzamento anterior. | RPC `calcular_retencao_real_visao_geral` → `visitas` |
| **CMV Limpo** | Custo de mercadoria vendida (%) no trimestre | Média do `cmv_limpo_percentual` dos meses do trimestre. Se não houver valor real, cai no CMV teórico manual médio do ano. Editável manualmente (ver passo a passo). Menos é melhor. | `financial.cmv_mensal` (real) / `meta.desempenho_manual` (teórico/fallback) |
| **CMO** | Custo de mão de obra (%) no trimestre | Média do `cmo_pct` dos meses do trimestre. Se não houver valor real, cai no CMO manual médio do ano (`meta.desempenho_manual.cmo`). Menos é melhor. | `gold.cmo_produtividade_mensal` (real) / `meta.desempenho_manual` (fallback) |
| **% Artística** | Quanto do faturamento do trimestre foi gasto com atração/produção artística | `(soma de c_art + c_prod dos eventos do trimestre) ÷ faturamento do trimestre × 100`. Considera eventos ativos com data no trimestre. Menos é melhor. | `operations.eventos_base` (custos) + `faturamento_trimestre` da `view_visao_geral_trimestral` |

Em cada cartão trimestral também aparece:
- **Barra de progresso / badge de %**: quanto do "atingimento" da meta. Para indicadores normais é `valor ÷ meta`; para CMV/CMO/% Artística é invertido (`(2×meta − valor) ÷ meta`), refletindo que ficar abaixo da meta é bom.
- **Variação vs. período anterior**: seta e percentual. Nos indicadores "menos é melhor", uma queda é destacada em verde (bom).

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| **Seletor de bar** (topo do sistema) | Define o `bar_id` de todos os cálculos. A tela não mistura bares. |
| **Setas de trimestre (◀ ▶)** | Trocam o trimestre analisado no bloco trimestral (parâmetro `?trimestre=` na URL). O bloco anual não muda. |
| **Recolher/expandir blocos** | Ocultam ou mostram os cartões de cada bloco; não alteram cálculo. |
| **Editar CMV (lápis no cartão CMV Limpo)** | Abre o modal para gravar um CMV manual do trimestre. |
| **Botão Organizador** | Atalho para `/estrategico/organizador`. |

O ano é sempre o **ano corrente** (não há seletor de ano). Ao abrir a tela sem parâmetro, o trimestre padrão é o trimestre em que estamos hoje.

## Regras e detalhes importantes

- **Filtragem por bar**: todos os indicadores filtram por `bar_id`; nunca há soma entre bares.
- **Cache de 1 hora**: a página é renderizada no servidor e revalidada a cada 3.600 segundos. Alterações muito recentes (ex.: um CMV recém-salvo) aparecem após o `router.refresh` do modal ou na próxima revalidação.
- **Metas trimestrais dinâmicas** (mudam por trimestre):
  - Clientes Ativos: T1 5.100 · T2 5.500 · T3 6.000 · T4 6.500
  - Clientes Totais: T1 30.000 · T2 35.000 · T3 38.000 · T4 40.000
  - Retenção: 40% · Retenção Real: 5% · CMV Limpo: 34% · CMO: 20% em todos os trimestres
  - % Artística: T1 20% · T2/T3/T4 19%
- **Metas anuais fixas**: Faturamento R$ 18.000.000 · Pessoas 78.000 · Reputação 4,9.
- **Cliente identificado por telefone**: as métricas de clientes/retenção usam o telefone (`cliente_fone`) com 8+ dígitos como chave. Visitas sem telefone válido ficam de fora dessas contagens.
- **"Ativo" = 2 visitas em 90 dias**: clientes ativos exigem pelo menos 2 dias de visita distintos nos últimos 90 dias (por isso o número é bem menor que o total de clientes únicos).
- **Período não ultrapassa hoje**: para trimestres em andamento, o fim do período é limitado à data atual, evitando comparar contra dias que ainda não aconteceram.
- **Menos é melhor** em CMV Limpo, CMO e % Artística: a barra de progresso e a cor da variação são invertidas nesses cartões.
- **Manual vs. automático**: CMV Limpo pode ser preenchido manualmente pelo lápis (fonte `manual`), mas o ideal é ele vir automático de `financial.cmv_mensal`; CMO e CMV também têm fallback nos valores manuais de `meta.desempenho_manual`.
- **Sympla no faturamento**: aparece no detalhamento de Pessoas (check-ins) e Faturamento, mas o valor de faturamento Sympla está zerado na view atual — só ContaHub e Yuzer somam receita.

## Dúvidas frequentes

**Por que "Clientes Ativos" é bem menor que "Clientes Totais"?**
Porque "ativo" é um cliente fiel: precisa ter ido ao bar pelo menos 2 vezes nos últimos 90 dias. "Clientes Totais" conta qualquer telefone que visitou uma única vez no trimestre.

**Qual a diferença entre "Retornantes" e "Retenção Real"?**
Retornantes olha para os clientes do trimestre e mede quantos já tinham vindo antes. Retenção Real olha para os clientes do trimestre anterior e mede quantos voltaram no trimestre atual — é a taxa de "volta" da base.

**Editei o CMV e nada mudou. Por quê?**
A tela tem cache de 1 hora. O modal já dispara um refresh ao salvar; se ainda não atualizou, recarregue a página. Confira também se o bar e o trimestre selecionados são os que você quis editar.

**Posso escolher um ano diferente?**
Não. A tela sempre usa o ano corrente. Só é possível navegar entre os trimestres desse ano.

**Por que o EBITDA não aparece?**
O indicador está previsto no sistema, mas o cálculo ainda não foi implementado, então ele não é exibido.

**A meta de faturamento é a mesma para os dois bares?**
As metas anuais (18M, 78 mil pessoas, 4,9) e trimestrais são fixas no código e hoje não variam por bar; apenas os valores realizados mudam conforme o bar selecionado.

## Fonte dos dados

**Views materializadas e funções (schema `public`, salvo indicado):**
- `view_visao_geral_anual` (mv) — via RPC `calcular_visao_geral_anual`
- `view_visao_geral_trimestral` (mv) — via RPC `calcular_visao_geral_trimestral`
- `get_clientes_ativos_media_trimestre` — clientes ativos por média do trimestre
- `calcular_metricas_clientes` — retornantes/retenção
- `calcular_retencao_real_visao_geral` — retenção real

**Tabelas/origens que alimentam as views:**
- `faturamento_pagamentos` e `visitas` — faturamento e pessoas ContaHub (integração **ContaHub**)
- `silver.cliente_visitas` — base de clientes ativos
- `yuzer_pagamento` e `yuzer_produtos` — faturamento e pessoas (integração **Yuzer**)
- `sympla_participantes` — pessoas por check-in (integração **Sympla**)
- `google_reviews` — reputação (integração **Google Reviews**)
- `nibo_agendamentos` — base de CMO na view trimestral (integração **NIBO**)
- `financial.cmv_mensal` — CMV limpo real
- `gold.cmo_produtividade_mensal` — CMO real
- `meta.desempenho_manual` — CMV teórico e CMO manuais (fallback)
- `operations.eventos_base` / `view_eventos` — custos artísticos (`c_art`, `c_prod`, `percent_art_fat`)

A gravação manual de CMV usa o endpoint `POST /api/cmv`.
