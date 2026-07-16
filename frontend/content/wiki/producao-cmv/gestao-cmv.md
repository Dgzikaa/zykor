---
title: Gestão CMV
area: producao-cmv
slug: gestao-cmv
route: /ferramentas/cmv-semanal/tabela
description: Planilha estilo Excel que consolida o CMV (Custo da Mercadoria Vendida) do bar semana a semana e mês a mês, cruzando faturamento, estoque, compras, consumações internas e bonificações.
order: 10
icon: TrendingUp
---

# Gestão CMV

## Visão geral

A tela **Gestão CMV** é o painel central de acompanhamento do **CMV — Custo da Mercadoria Vendida** do bar. Ela funciona como uma grande planilha estilo Excel: a primeira coluna lista os indicadores (faturamento, estoque, compras, consumações, resultados) e cada coluna seguinte é uma **semana** (ou um **mês**, conforme a visão escolhida), da mais antiga à mais recente.

O objetivo é mostrar, para cada período, **quanto custou de fato a mercadoria que o bar vendeu** e comparar esse custo com o faturamento — chegando aos três indicadores que o sócio acompanha: **CMV Real (%)**, **CMV Limpo (%)** e **CMV Teórico (%)**. A tela junta automaticamente dados de várias fontes (ContaHub, Conta Azul, contagem de estoque, fichas técnicas) e ainda permite ajustes manuais em campos específicos (estoque final, bonificações, CMV teórico do passado).

Quem usa no dia a dia: **sócios, gestão e financeiro/CMV**, tanto para conferir se o custo está dentro da meta quanto para investigar (drill-down) o que compõe cada número.

## Como acessar

No menu lateral: **Produção - CMV → Gestão CMV**.

- **Rota:** `/ferramentas/cmv-semanal/tabela`
- **Permissão necessária:** módulo **`gestao`**. Todas as rotas de API da tela (`/api/cmv-semanal/*`) são protegidas por esse módulo; quem não o tiver é bloqueado ao carregar ou salvar dados.
- É obrigatório ter um **bar selecionado** no seletor superior. Sem bar escolhido, a tela mostra apenas a mensagem "Selecione um Bar".

## Passo a passo

### 1. Escolher a visão (Semanal ou Mensal)
No topo, use o botão de abas **Semanal / Mensal**:
- **Semanal** carrega cada semana ISO fechada do bar (esconde semanas futuras e semanas totalmente zeradas).
- **Mensal** carrega os meses de janeiro/2025 até o mês atual.

A tela rola automaticamente até o período atual, que aparece destacado em verde com o selo **ATUAL**.

### 2. Filtrar por ano
Ao lado das abas há o seletor de **Ano** (Todos / 2025 / 2026). Ele limita quais semanas ou meses aparecem.

### 3. Ler os números e abrir os tooltips
Cada célula com valor mostra o número formatado. Passar o mouse sobre valores **sublinhados com pontilhado** abre um tooltip com a composição (ex.: Faturamento Limpo mostra Bruto menos gorjeta, couvert e ingressos). O tooltip do label (coluna esquerda) explica a fonte e o cálculo daquele indicador.

### 4. Ver o detalhamento (drill-down)
Indicadores com o ícone de **olho** (👁) têm drill-down. **Na visão Semanal**, clique na célula para abrir um modal listando **cada lançamento** que compõe aquele valor (cada compra do Conta Azul, cada consumação do ContaHub, cada item de estoque contado etc.), com data, fornecedor/motivo, quantidade e valor, além do TOTAL no rodapé. O drill-down funciona apenas na visão semanal.

### 5. Editar um campo manual
Indicadores com o ícone de **lápis** (✏️) são editáveis (estoque final, estoque final de funcionários, bonificações e CMV teórico). Passe o mouse na célula, clique no lápis que aparece à direita, digite o valor (aceita vírgula ou ponto) e confirme no **✓** (ou tecle Enter). O **✗** (ou Escape) cancela.

- Na **visão Semanal** todos os campos editáveis podem ser alterados diretamente na célula.
- Na **visão Mensal** só é possível editar **Bonificações, CMV Teórico (%), Estoque Final e Estoque Final (F)** — os demais editáveis pedem que você troque para a visão Semanal (o tooltip avisa isso).

### 6. Definir as metas de CMV
Clique no botão **Metas** (topo direito) para abrir o modal e definir os alvos de **CMV Teórico (%)**, **CMV Limpo (%)** e **CMV Real (%)**. O operador é sempre **≤** (menor é melhor). O CMV R$ não tem campo próprio: ele é derivado como *CMV Real % × Faturamento Bruto* da semana. Também é possível editar uma meta individual clicando direto na célula da coluna **META** (exceto a de CMV R$).

### 7. Forçar atualização (visão Mensal)
Os dados são **100% automáticos** — crons sincronizam ContaHub, Conta Azul, contagem de estoque e fichas técnicas ao longo do dia. Não existe mais o botão "Atualizar dados".

Na visão **Mensal** existe o botão **Forçar atualização (mês atual)**, útil quando você **acabou de lançar ou excluir** consumação/compra no Conta Azul e quer ver o mês na hora, sem esperar o cron. Ele faz duas coisas: (1) sincroniza o Conta Azul do mês corrente — pegando tanto **inclusões quanto exclusões** (o sync automático diário só traz o que mudou nos últimos dias e não detecta exclusões); e (2) re-agrega o CMV mensal a partir dos dados atualizados.

## Abas e seções

A tela tem duas **visões** (abas no topo): **Semanal** e **Mensal**. O conteúdo é o mesmo conjunto de indicadores; muda a granularidade do período e algumas regras de agregação (ver "Regras e detalhes importantes").

Os indicadores são organizados em **4 seções coloridas** (todas colapsáveis clicando no cabeçalho):

- **VENDAS** — faturamento do período.
- **CÁLCULO CMV** — a "conta do CMV": estoque inicial, compras, estoque final, consumações e bonificações.
- **RESULTADOS** — os indicadores de CMV em R$ e em % e o GAP.
- **CMA — Alimentação Funcionários** — custo da alimentação da equipe (conta separada do CMV).

Dentro do Cálculo CMV, os grupos **Compras** e **Consumações** são expansíveis: o cabeçalho mostra o TOTAL e, ao expandir, aparecem as linhas detalhadas.

## Colunas e cálculos

> Legenda de status usada na tela: **verde** = automático ou calculado (dado verificado); **azul** = manual (inserido à mão). As **consumações internas usam o CUSTO REAL da ficha** (o quanto o insumo daquele consumo custou de fato). O fator antigo (`fatorCmv`, padrão **0,35**) só é usado como **fallback** para semanas antigas ainda não reprocessadas.

### Seção VENDAS

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Faturamento Bruto | Venda bruta do período | `SUM(valor)` das vendas do ContaHub, excluindo Conta Assinada | ContaHub (via `cmv_semanal.vendas_brutas`) |
| Faturamento Limpo | Faturamento que "gera CMV" | Fat. Bruto − Gorjeta (`vd_vrrepique`) − Couvert (`vd_vrcouvert`) − Ingressos Yuzer − Ingressos Sympla (bilheteria) | Calculado; componentes de `gold.desempenho` e `gold.planejamento` |

### Seção CÁLCULO CMV

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Estoque Inicial | Estoque no começo do período | Estoque final da semana/mês anterior, propagado automaticamente | `cmv_semanal.estoque_inicial` |
| Compras — TOTAL | Total comprado no período | Soma de Custo Cozinha + Custo Drinks + Custo Bebidas (se houver detalhado); senão o total da planilha | Conta Azul (`bronze_contaazul_lancamentos`) |
| Custo Cozinha | Compras de comida | Lançamentos com `categoria_nome = CUSTO COMIDA` (valor pago se >0, senão bruto; RECEITA subtrai) | Conta Azul |
| Custo Drinks | Compras de drinks | Lançamentos com `categoria_nome = CUSTO DRINKS` | Conta Azul |
| Custo Bebidas | Compras de bebidas | `CUSTO BEBIDAS` **+ Custo Outros** (agrupados juntos) | Conta Azul |
| (-) Estoque Final | Estoque no fim do período (abate o CMV) | Automático: contagem de estoque valorizada (mesma base do Desvios). Editável para ajuste manual | `silver.estoque_contagem` / `operations.contagem_estoque_insumos` |
| Consumações — TOTAL (custo real) | Consumo interno que sai do CMV | Custo real da ficha (`consumo_socios + consumo_beneficios + consumo_artista + consumo_rh`); senão soma dos brutos × fator (fallback histórico). O tooltip do CMV R$ usa **esse mesmo valor** (fecha com o CMV exibido) | Calculado (edge `cmv-semanal-auto`) |
| Funcionário Operação | Consumação da operação | `motivo = Funcionário Operação` (custo real da ficha) | ContaHub (JSONB `consumacoes_9`) |
| Funcionário Escritório | Consumação do escritório | `motivo = Funcionário Escritório` (custo real da ficha) | ContaHub |
| Aniversário | Cortesias de aniversário | `motivo = Aniversário` (custo real da ficha) | ContaHub |
| Programa de Pontos | Resgates de pontos | `motivo = Programa de Pontos` (custo real da ficha) | ContaHub |
| Benefício Cliente | Benefícios a clientes | `motivo = Benefício Cliente` (custo real da ficha) | ContaHub |
| Influencer | Cortesias a influencers | `motivo = Influencer` (custo real da ficha) | ContaHub |
| Artistas | Consumo de artistas/banda | `motivo = Artistas` (custo real da ficha) | ContaHub |
| Sócios | Consumo dos sócios | `motivo = Sócios` (custo real da ficha) | ContaHub |
| Relacionamento | Cortesias de relacionamento | `motivo = Relacionamento` (custo real da ficha) | ContaHub |
| Outros | Motivos não mapeados nas 9 + pré-corte | **Semanal:** custo real dos motivos não mapeados nas 9 categorias + lançamentos pré-12/06 (mesma base da tela *Controle de Consumação*). **Mensal / semanas antigas:** residual (TOTAL − as 9) | Calculado |
| (+) Bonificações | Bonificações de fornecedores | Valor inserido manualmente (campo único `bonificacoes`; para legados, soma de Contrato Anual + Cashback Mensal) | Manual |

### Seção RESULTADOS

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| CMV R$ | Custo da mercadoria vendida em reais | Est. Inicial + Compras − Est. Final − Consumações + Bonificações | Calculado |
| CMV Real (%) | CMV sobre o faturamento bruto | CMV R$ ÷ Faturamento Bruto × 100 | Calculado |
| CMV Limpo (%) | CMV sobre o faturamento limpo | CMV R$ ÷ Faturamento Limpo × 100 | Calculado (`cmv_semanal.cmv_limpo_percentual`) |
| GAP CMV | Distância entre o real e o teórico | CMV Limpo (%) − CMV Teórico (%), em pontos percentuais (vazio se teórico não preenchido) | Calculado |
| CMV Teórico (%) | Custo que "deveria" ter, pelas fichas | Automático (semana/mês atual pra frente): custo da ficha × vendas ÷ faturamento (`gold.cmv_teorico_dia`). Passado: valor manual preenchido na célula (`cmv_teorico_percentual_manual`) | Automático (fichas) / Manual |

### Seção CMA — Alimentação Funcionários

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Estoque Inicial (F) | Estoque de alimentação da equipe no início | Estoque final (F) do período anterior, propagado | `cmv_semanal.estoque_inicial_funcionarios` |
| (+) Compras | Compras de alimentação da equipe | Lançamentos com `categoria_nome = Alimentação` | Conta Azul |
| (-) Estoque Final (F) | Estoque de alimentação no fim | Automático: contagem valorizada (mesma base do Desvios). Editável | `silver.estoque_contagem` |
| CMA Total | Custo da alimentação da equipe | Est. Inicial (F) + Compras Alimentação − Est. Final (F) | Calculado |

### Coluna META (fixa, à esquerda das semanas)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Meta de cada KPI | Alvo do bar para CMV Real, Limpo, Teórico e R$ | Valor salvo pelo usuário (padrões: Real 26%, Limpo 33%, Teórico sem default = manual). CMV R$ mostra "26% × Fat" (derivado) | `meta.metas_desempenho` (período `cmv`) |

**Cores dos resultados:** os KPIs de CMV ficam **verdes** quando estão **≤ meta** e **vermelhos** quando ultrapassam. O GAP tem cores próprias: negativo = amarelo, até 5 pontos = verde, acima de 5 = vermelho.

## Filtros e opções

- **Visão Semanal / Mensal:** troca a granularidade das colunas. Semanal usa a semana ISO; mensal agrega por mês.
- **Ano (Todos / 2025 / 2026):** filtra os períodos exibidos.
- **Botão Metas:** abre o modal para definir os três alvos de CMV do bar.
- **Botão Forçar atualização (mês atual)** *(só na visão Mensal):* sincroniza o Conta Azul do mês corrente (inclusões **e** exclusões) e re-agrega o CMV mensal na hora.
- **Colapsar seções e grupos:** clique nos cabeçalhos coloridos (seções) ou nos cabeçalhos cinza (grupos Compras/Consumações) para esconder/mostrar as linhas detalhadas.
- **Aviso de compras zeradas:** quando as Compras de uma semana ficam em R$ 0, aparece um triângulo de alerta âmbar sugerindo que faltam lançamentos no Conta Azul.

## Regras e detalhes importantes

- **Sempre filtra por `bar_id`:** todos os números são do bar selecionado. A tela nunca mistura bares.
- **Consumação = custo real da ficha:** as consumações internas entram no CMV pelo **custo real** dos insumos daquele consumo (ficha técnica), não pelo valor de venda cortesiado. O fator antigo (padrão **0,35**, `cmv_fator_consumo` nas regras do bar) só é usado como **fallback** quando o produto não tem ficha ou em semanas antigas ainda não reprocessadas.
- **Consumação: semanal (ContaHub) × mensal (Conta Azul):** na visão **Semanal** a consumação vem do **ContaHub** (custo real, ao vivo — espelha 100% a tela *Controle de Consumação*, inclusive as reclassificações de mesa/vínculos). Na **Mensal** vem do **Conta Azul** (o número contábil, que casa com a DRE): o fechamento lança as categorias `[Consumação] X` com o **mesmo custo real da ficha + vínculos**, então as duas visões batem. Se o mês parecer defasado (ex.: acabou de lançar/excluir no CA), use **Forçar atualização**.
- **Estoque propagado:** o estoque inicial de um período é sempre o estoque final do período anterior — não se digita estoque inicial.
- **Semana ISO / fechamento no domingo:** a semana segue o padrão ISO (segunda a domingo). Na visão **mensal do mês corrente**, o faturamento e as compras vão do dia 01 até o **último domingo fechado** — meses passados usam o mês inteiro.
- **Mês em andamento sem estoque final:** se o estoque final ainda não foi contado, os resultados calculados (CMV R$ e %) são **zerados** para não exibir número inflado.
- **CMV Teórico — automático vs. manual:** para a semana/mês **atual em diante**, o automático (fichas técnicas) sempre manda. No **passado**, o valor manual tem prioridade; se não houver manual, usa o automático do `gold.cmv_teorico_dia`. Sem nenhum dos dois, a célula mostra "—".
- **Onde o manual é salvo:** o CMV Teórico manual vai para a coluna separada `cmv_teorico_percentual_manual` (o ETL não a sobrescreve). Na visão mensal, os campos manuais são gravados em `financial.cmv_mensal` (upsert por bar/ano/mês) e disparam a reagregação `agregar_cmv_mensal_auto`.
- **Compras — valor efetivo:** usa `valor_pago` quando maior que zero, senão `valor_bruto`; lançamentos de RECEITA (devoluções/créditos) **subtraem**. "Custo Outros" é somado dentro de "Custo Bebidas".
- **Estoque valorizado com preço congelado:** o valor de cada item de estoque no drill-down usa o custo unitário **da própria contagem** (preço do momento), não o preço atual do insumo.
- **Consumações padronizadas a partir de 12/06:** as 9 categorias vêm do motivo do desconto no ContaHub. Lançamentos anteriores ao corte caem em "Outros" para não zerar o histórico; por isso as 9 linhas + Outros sempre fecham com o TOTAL.
- **Campos manuais x automáticos:** editáveis (azul/lápis) = Estoque Final, Estoque Final (F), Bonificações e CMV Teórico do passado. O restante é automático/calculado e não deve ser digitado.
- **Auditoria:** criações, edições e exclusões de registros de CMV são registradas na trilha de auditoria (`system.audit_trail`).

## Dúvidas frequentes

**Qual a diferença entre CMV Real, CMV Limpo e CMV Teórico?**
O **Real (%)** divide o CMV pelo faturamento **bruto**. O **Limpo (%)** divide pelo faturamento **limpo** (sem gorjeta, couvert e bilheteria) — costuma ser um pouco maior e é o mais comparável à meta operacional. O **Teórico (%)** é quanto o custo *deveria* ser segundo as fichas técnicas. O **GAP** mostra o quanto o real está acima do teórico.

**Por que as Compras aparecem R$ 0 (com triângulo âmbar)?**
Porque não há lançamentos de compra no Conta Azul para aquela semana nas categorias Custo Comida/Bebida/Drink. Verifique se a equipe lançou as notas no Conta Azul e clique em "Atualizar dados".

**Cliquei numa célula e não abriu o detalhamento — por quê?**
O drill-down só funciona na **visão Semanal** e apenas em indicadores com o ícone de olho (Compras, Consumações, Estoques e Vendas). Na visão Mensal ele fica desabilitado.

**Editei o CMV Teórico de uma semana antiga e ele não mudou nas semanas seguintes. É esperado?**
Sim. O CMV Teórico é preenchido semana a semana. O manual só vale para o passado; do período atual em diante o valor vem automaticamente das fichas técnicas.

**Alterei um campo manual mas o CMV R$ não atualizou na hora?**
Na visão semanal o valor é salvo e a tela recarrega. Na visão mensal, o salvamento dispara a reagregação (`agregar_cmv_mensal_auto`) para recompor o CMV R$. Se ainda assim algo parecer defasado, na visão mensal use **Forçar atualização (mês atual)**.

**Lancei/excluí uma consumação no Conta Azul e o CMV mensal não mudou. Por quê?**
O CMV mensal lê do Conta Azul, e o sync automático diário só traz o que mudou nos últimos dias — e **não detecta exclusões** feitas direto no site do Conta Azul. Abra a visão **Mensal** e clique em **Forçar atualização (mês atual)**: ele faz um sync completo do mês (pegando inclusões e exclusões) e re-agrega na hora. *Obs.:* o Conta Azul não permite excluir lançamento pela integração — exclusões precisam ser feitas manualmente no site do Conta Azul; depois use o botão para refletir aqui.

**O que é o CMA e por que está separado do CMV?**
CMA é o **Custo da Alimentação dos Funcionários** — comida da equipe. É acompanhado à parte porque não é mercadoria vendida ao cliente; entra na categoria "Alimentação" do Conta Azul e tem estoque próprio (F).

## Fonte dos dados

- **`financial.cmv_semanal`** — tabela principal da visão semanal (vendas, estoques, compras, consumos, bonificações, percentuais).
- **`financial.cmv_mensal`** — tabela da visão mensal (alimentada por `sync-cmv-mensal` + `agregar_cmv_mensal_auto`).
- **ContaHub** — faturamento bruto e consumações internas (motivo do desconto → 9 categorias, JSONB `consumacoes_9`); base também em `silver.cliente_visitas`.
- **Conta Azul** (`bronze.bronze_contaazul_lancamentos`) — compras por categoria (Custo Comida/Bebidas/Drinks/Outros) e Alimentação da equipe.
- **Contagem de estoque** (`operations.contagem_estoque_insumos` / `silver.estoque_contagem`, `operations.insumos`) — estoque final valorizado (mesma base do Desvios), com preço congelado.
- **`gold.cmv_teorico_dia`** — CMV teórico automático a partir das fichas técnicas.
- **`gold.desempenho`** — comissão/gorjeta, couvert e faturamento de entrada usados no Faturamento Limpo.
- **`gold.planejamento`** — bilheteria (ingressos **Yuzer** e **Sympla**) e faturamento consolidado por evento.
- **`meta.metas_desempenho`** (período `cmv`) — metas de CMV Real, Limpo e Teórico.
- **Edge Functions / RPCs:** `cmv-semanal-auto` (grava o CMV semanal + `consumacoes_9` em custo real), `sync-cmv-mensal` e `agregar_cmv_mensal_auto` (visão mensal, também disparada pelo botão *Forçar atualização*); `contaazul-sync` (sincroniza o Conta Azul, com soft-delete no sweep mensal). Detalhamentos usam `get_consumos_9_detalhes_custo_semana` (custo real da ficha) e `get_comissao_couvert_periodo`.
