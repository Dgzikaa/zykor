---
title: Beneficiários
area: ferramentas-financeiro
slug: beneficiarios
route: /financeiro/beneficiarios
description: Controle por pessoa (fornecedor, freela, sócio, atração) que unifica os cadastros duplicados do Conta Azul e mostra quanto cada um recebeu, em que categoria e com que histórico.
order: 30
icon: Users
---

# Beneficiários

## Visão geral

A tela **Beneficiários** responde uma pergunta simples que o Conta Azul (CA) sozinho tem dificuldade de responder: **quem recebe dinheiro do bar e quanto?**

O problema que ela resolve é o **cadastro repetido**. No Conta Azul, a mesma pessoa costuma aparecer várias vezes — "AMBEV", "Ambev SA", "Ambev S.A." — cada uma com um histórico separado. Beneficiários junta esses cadastros num único "quem" (uma pessoa canônica) e mostra o total consolidado de pagamentos, o histórico completo e a categoria em que aquele dinheiro cai.

Importante: a tela **não altera o Conta Azul**. Ela apenas agrupa a leitura. Valores, categorias e lançamentos continuam intactos — o que muda é só a forma de olhar ("essas 3 fichas são a mesma pessoa"). Toda unificação é **reversível**, porque é só um de-para (mapeamento), não uma edição do dado contábil.

Quem usa no dia a dia: dono e gestores financeiros que querem entender para onde o dinheiro está indo por fornecedor, por tipo de despesa e — na aba Atrações — quanto cada artista custa e rende.

## Como acessar

No menu lateral: **Financeiro → Beneficiários**.

- **Rota:** `/financeiro/beneficiarios`
- **Permissão necessária:** `ferramentas financeiro_beneficiarios`. Sem essa permissão o item não aparece no menu e a página não abre.

A tela sempre reflete o **bar selecionado** no topo. Ao trocar de bar, todos os números são recarregados — cada bar tem sua própria base de beneficiários.

> As ações de **unificar** e de **cadastrar** um beneficiário exigem permissão de aprovação no financeiro (perfil que "pode aprovar"). Um usuário só de leitura consegue navegar e consultar, mas o botão **Unificar** retorna erro de permissão.

## Passo a passo

### Consultar uma pessoa e ver o histórico
1. Abra a aba **Lista** (é a inicial).
2. Use a busca **"Buscar por nome…"** para filtrar por parte do nome.
3. Clique na linha da pessoa. A linha expande e mostra:
   - **Saídas** e **Entradas** (quando houver) somadas.
   - A quebra por **categoria** (onde o dinheiro dela cai).
   - A lista dos lançamentos (data, categoria, descrição, valor), até 300 itens.
4. Clique de novo na linha para fechar.

### Ver só quem tem cadastro duplicado no CA
1. Na aba **Lista**, clique no botão **"Só duplicados"**.
2. A lista passa a mostrar apenas pessoas cujo `qtd_cadastros_ca` é maior que 1 (ou seja, mais de uma ficha do Conta Azul já foi fundida naquela pessoa).
3. Clique de novo para voltar a ver todos.

### Unificar duas pessoas que são a mesma
1. Abra a aba **Prováveis duplicados**.
2. O sistema lista pares de nome parecido que ainda **não** foram unificados, com o percentual de semelhança.
3. Confira que os dois cartões são realmente a mesma pessoa.
4. Clique em **Unificar**. Os históricos se juntam, o par some da lista e o Conta Azul não é tocado.
   - O nome que prevalece é o do lado com **maior total pago**.
   - A operação é reversível (é só o de-para).

### Entender para onde o dinheiro vai por tipo
1. Abra a aba **Por categoria**.
2. Veja a lista de categorias (classes de despesa) com fornecedores, pagamentos, média/mês e total.
3. Clique numa categoria para ver **os fornecedores** daquela classe, cada um com quantidade de pagamentos e total.

### Analisar as atrações (artistas)
1. Abra a aba **Atrações**.
2. Ordene a tabela clicando nos cabeçalhos (shows, custo total, custo/show, faturamento médio, público, ticket, % faturamento).
3. Clique numa linha para abrir o **perfil completo** do artista.
4. Para comparar, marque a caixinha de até **3 atrações** e clique em **Comparar**.

## Abas e seções

A tela tem quatro abas:

- **Lista** — controle por pessoa. Cada linha é um beneficiário canônico (fornecedor/freela/sócio) com total pago e histórico. É onde ficam os três cards de resumo e a busca.
- **Atrações** — dashboard de artistas, derivado dos **eventos** (não dos pagamentos do CA). Mostra custo e retorno de cada atração.
- **Por categoria** — cruzamento "classe de despesa → fornecedores". Onde o dinheiro vai, por tipo.
- **Prováveis duplicados** — curadoria: pares de nome parecido sugeridos para unificação.

## Colunas e cálculos

### Aba Lista — cards de resumo

Calculados sobre **todo o conjunto filtrado** (não só a página atual), via função `financial.beneficiarios_resumo`.

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Pessoas | Quantidade de beneficiários distintos | `count(*)` das linhas que atendem ao filtro | `gold.pagamentos_por_beneficiario` |
| Total pago | Soma paga a todos os beneficiários do filtro | `sum(total_pago)` | `gold.pagamentos_por_beneficiario` |
| Com cadastros duplicados no CA | Quantas pessoas têm mais de uma ficha do CA fundida | `count(*)` onde `qtd_cadastros_ca > 1` | `gold.pagamentos_por_beneficiario` |

### Aba Lista — tabela de pessoas

Cada linha vem da matview `gold.pagamentos_por_beneficiario`, que considera **apenas lançamentos do tipo DESPESA, não excluídos e com valor pago > 0**.

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Pessoa | Nome do beneficiário (com aviso se houver fichas fundidas) | `max(pessoa_nome)` do grupo canônico; o selo "⚠ N cadastros no CA unificados" aparece quando `qtd_cadastros_ca > 1` | `bronze.bronze_contaazul_lancamentos` |
| Documento | CPF/CNPJ (só dígitos), quando existe | `max(documento)` da pessoa (vem de `bronze_contaazul_pessoas`) | `bronze.bronze_contaazul_pessoas` |
| Pagamentos | Quantos lançamentos com valor pago | `count(*)` onde `valor_pago > 0` | `bronze.bronze_contaazul_lancamentos` |
| Total pago | Soma dos pagamentos daquela pessoa | `sum(valor_pago)` onde `valor_pago > 0` | `bronze.bronze_contaazul_lancamentos` |
| Último | Data do último pagamento | `max(data_pagamento)` onde `valor_pago > 0` | `bronze.bronze_contaazul_lancamentos` |

> A ordenação da lista é por **total pago (maior primeiro)**.

### Aba Lista — detalhe expandido (ao clicar na pessoa)

Vem da função `financial.beneficiario_detalhe`, que lista **todos** os lançamentos daquela pessoa (entradas e saídas, não excluídos).

| Item | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Saídas | Total de despesas da pessoa | Soma dos itens com `tipo = DESPESA` | `bronze.bronze_contaazul_lancamentos` |
| Entradas | Total de receitas (só aparece se > 0) | Soma dos itens com `tipo = RECEITA` | `bronze.bronze_contaazul_lancamentos` |
| Qtd / categoria principal | Nº de lançamentos e a maior categoria | Contagem dos itens; categoria de maior valor absoluto | `bronze.bronze_contaazul_lancamentos` |
| Chips de categoria | Top 10 categorias com valor | Soma por `categoria_nome`, ordenado por valor absoluto | `bronze.bronze_contaazul_lancamentos` |
| Linhas (Data / Categoria / Descrição / Valor) | Cada lançamento | Valor = `valor_pago` se ≠ 0, senão `valor_bruto`; até 300 linhas | `bronze.bronze_contaazul_lancamentos` |

### Aba Por categoria — tabela de categorias

Via `financial.beneficiarios_categoria_resumo` (só DESPESA, não excluído, `valor_pago > 0`).

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Categoria | Nome da classe de despesa | `categoria_nome` do CA; vazio vira "(sem categoria)" | `bronze.bronze_contaazul_lancamentos` |
| Fornecedores | Quantos beneficiários distintos naquela classe | `count(distinct canonical_key)` | `silver.beneficiario_canonico` |
| Pagamentos | Nº de lançamentos na classe | `count(*)` | `bronze.bronze_contaazul_lancamentos` |
| Média/mês | Gasto médio mensal na classe | `total ÷ nº de meses distintos` com pagamento | calculado na API |
| Total | Soma paga na classe | `sum(valor_pago, ou valor_bruto se 0)` | `bronze.bronze_contaazul_lancamentos` |

Ao expandir uma categoria (`financial.fornecedores_de_categoria`): **nome do fornecedor**, **quantidade de pagamentos** e **total** naquela classe.

### Aba Atrações — cards e tabela

Tudo derivado de `operations.eventos_base` (campo **artista**, texto livre) via `gold.artistas_resumo`. O nome é normalizado (minúsculas, sem acento, espaço único) para juntar grafias diferentes. "Realizado" = evento com data **hoje ou no passado**; "previsto" = data futura.

**Cards (somados no navegador sobre a lista carregada):**

| Card | O que mostra | Como é calculado |
|---|---|---|
| Atrações | Quantas atrações distintas | Nº de linhas da lista |
| Shows realizados | Total de shows já feitos | Soma de `shows_feitos` |
| Custo de atração (total) | Custo somado de todas as atrações | Soma de `custo_total` |

**Tabela de atrações:**

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Atração | Nome (grafia mais frequente) + gênero e nº de previstos | `mode()` do rótulo por chave normalizada | `operations.eventos_base` |
| Shows | Shows já realizados | `count(*)` onde não é futuro | `operations.eventos_base` |
| Custo total | Custo de artista + produção acumulado | `sum(c_art + c_prod)` | `operations.eventos_base` |
| Custo/show | Custo médio por show | `avg(c_art + c_prod)` ignorando custo zero | `operations.eventos_base` |
| Fat. médio | Faturamento médio por show realizado | `avg(real_r)` ignorando zero, só realizados | `operations.eventos_base` |
| Público | Público médio por show | `avg(cl_real)` ignorando zero, só realizados | `operations.eventos_base` |
| Ticket | Ticket médio ponderado | `sum(real_r) ÷ sum(cl_real)` dos shows com público (não usa a coluna `t_medio` por ter outliers) | `operations.eventos_base` |
| % Fat. | Peso do custo de atração sobre o faturamento | `100 × sum(custo) ÷ sum(real_r)`, só realizados. Fica âmbar quando passa de 25% | `operations.eventos_base` |

### Aba Prováveis duplicados

Via `financial.beneficiarios_duplicados_sugeridos`, que usa similaridade de texto (extensão `pg_trgm`).

| Item | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome A / Nome B + totais | Os dois candidatos e o total pago de cada | Pares onde `similaridade ≥ 0,5`, ordenados pela maior semelhança (até 80 pares) | `gold.pagamentos_por_beneficiario` |
| Semelhança | Quão parecidos são os nomes | `similarity(nome_a, nome_b)` × 100 | função `pg_trgm` |

## Filtros e opções

- **Bar (topo do sistema):** filtro obrigatório e implícito. Todas as consultas são escopadas ao `bar_id` do bar selecionado.
- **Busca por nome (aba Lista):** filtra a lista e recalcula os cards de resumo sobre o conjunto filtrado. Tem debounce de ~300 ms.
- **"Só duplicados" (aba Lista):** mostra apenas quem tem mais de um cadastro do CA fundido.
- **Paginação (aba Lista):** 100 pessoas por página, com contagem total exata.
- **Ordenação (aba Atrações):** clique nos cabeçalhos para reordenar por qualquer métrica.
- **Busca por atração (aba Atrações):** filtro por nome, feito no navegador sobre a lista já carregada.

> Não há filtro de período nesta tela. Os totais são **acumulados** por toda a base de lançamentos disponível do bar.

## Regras e detalhes importantes

- **Filtragem por bar:** toda query filtra por `bar_id`. A base de beneficiários é independente por bar.
- **Como o "quem" é definido (chave canônica):** cada ficha do CA vira uma pessoa canônica seguindo esta ordem de confiança (em `silver.beneficiario_canonico`):
  1. **De-para manual** (curadoria humana — o que a unificação grava);
  2. **Documento** (CPF/CNPJ igual);
  3. **Nome normalizado** igual (junta os duplicados óbvios automaticamente).
- **Lista vs. detalhe/categoria — o que entra:** os cards e a lista da aba **Lista**, e a aba **Por categoria**, consideram só **DESPESA com valor pago > 0**. O **detalhe** expandido de uma pessoa mostra também **entradas (RECEITA)** e lançamentos sem baixa (usa `valor_bruto` quando `valor_pago` é 0).
- **Pagamento, não competência:** o "Total pago" e o "Último" usam a **data de pagamento** (baixa), não a competência.
- **Excluídos ficam de fora:** lançamentos marcados como excluídos no CA são sempre ignorados.
- **Automático vs. manual:** o agrupamento por documento e nome é **automático**; a unificação de nomes parecidos é **manual** (curadoria na aba Prováveis duplicados). Unificar é reversível e não altera o Conta Azul.
- **Frescor dos dados:** a matview `gold.pagamentos_por_beneficiario` é atualizada **1× por dia** (cron às 09:25 UTC). Além disso, cada **unificação força um refresh** na hora. Pagamentos novos do CA só aparecem após esse refresh diário.
- **Aba Atrações é outra fonte:** ela **não** vem dos pagamentos do CA e sim dos **eventos** (`operations.eventos_base`, campo `artista`). Se o bar não preenche o artista dos eventos, a aba fica vazia — é o caso avisado na própria tela.
- **Ticket ponderado:** na aba Atrações o ticket é sempre `faturamento ÷ público` somados, para evitar distorção de médias simples.

## Dúvidas frequentes

**Unificar duas pessoas mexe no meu Conta Azul?**
Não. A unificação só grava um de-para interno do Zykor. Os lançamentos, valores e categorias do CA ficam exatamente como estão, e a ação é reversível.

**Cadastrei/paguei alguém agora e não aparece. Por quê?**
A lista por pessoa é uma matview atualizada uma vez por dia (09:25 UTC). O número entra no próximo refresh. Uma unificação, porém, atualiza na hora.

**Qual a diferença entre "Total pago" na Lista e "Saídas" no detalhe?**
"Total pago" na lista conta só DESPESA com valor efetivamente pago. No detalhe, "Saídas" soma todas as despesas da pessoa (incluindo lançamentos ainda sem baixa, pelo valor bruto), e ainda mostra "Entradas" separadas.

**O que significa o selo "⚠ N cadastros no CA unificados"?**
Que aquela pessoa tinha N fichas diferentes no Conta Azul e o Zykor as juntou numa só para você ver o histórico consolidado.

**Por que uma atração não aparece na aba Atrações?**
Porque a aba usa o campo **artista** dos eventos. Se o evento não tem artista preenchido, ele não entra. Bares que não preenchem esse campo veem a aba vazia.

**Consigo ver gastos de só um mês?**
Nesta tela não — os totais são acumulados por toda a base do bar. Para recortes por período, use as telas de Receitas/Despesas ou os dashboards financeiros.

## Fonte dos dados

Origem primária: **Conta Azul** (lançamentos e pessoas) e, na aba Atrações, os **eventos** do bar (que por sua vez cruzam com **ContaHub** para o mix de produtos).

- `bronze.bronze_contaazul_lancamentos` — lançamentos financeiros (base dos totais e do histórico).
- `bronze.bronze_contaazul_pessoas` — cadastro de pessoas do CA (documento).
- `silver.beneficiario_canonico` (view) — resolve a chave canônica de cada pessoa.
- `gold.pagamentos_por_beneficiario` (matview) — histórico consolidado por pessoa; refresh diário 09:25 UTC.
- `financial.beneficiarios` / `financial.beneficiario_contaazul_map` — base-mestre e de-para (PIX, CPF, vínculo com o fornecedor do CA).
- Funções SQL: `financial.beneficiarios_resumo`, `financial.beneficiario_detalhe`, `financial.beneficiarios_categoria_resumo`, `financial.fornecedores_de_categoria`, `financial.beneficiarios_duplicados_sugeridos`, `financial.unificar_beneficiarios`.
- Aba Atrações: `operations.eventos_base` (campo `artista`), `gold.eventos_artista` (view) e `gold.artistas_resumo`; o mix de produtos por show usa `bronze.bronze_contahub_avendas_porproduto_analitico` (**ContaHub**).
