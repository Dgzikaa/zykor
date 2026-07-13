---
title: Stockout
area: producao-cmv
slug: stockout
route: /ferramentas/stockout
description: Mede quantos produtos do cardápio estavam fora de venda (indisponíveis) por dia, local e categoria, usando a foto diária de produtos coletada do ContaHub.
order: 130
icon: AlertTriangle
---

# Stockout

## Visão geral

A tela de **Stockout** mostra quantos produtos do cardápio estavam **fora de venda** (indisponíveis) em cada dia de operação. "Stockout" aqui significa um produto que existe no cadastro, está ativo, mas naquele momento estava com a venda desligada no PDV (não podia ser vendido) — normalmente por falta de estoque, item em falta na cozinha/bar ou desligamento manual.

Todo dia, de madrugada, o sistema tira uma "foto" da lista de produtos do ContaHub referente às **20:00 (horário de Brasília)** do dia anterior. Cada produto vem marcado como disponível (`prd_venda = 'S'`) ou indisponível (`prd_venda = 'N'`). A tela transforma essa foto em indicadores: **percentual de stockout do dia, quebra por local de produção (Bar, Drinks, Comidas) e histórico ao longo do tempo**.

Serve para o dono, gerente e equipe de operação/compras responderem perguntas como: "Quanto do meu cardápio ficou indisponível ontem?", "Qual praça mais some produto (cozinha, bar, drinks)?", "Que dia da semana costuma ter mais furo?" e "Estou melhorando ou piorando ao longo das semanas?".

## Como acessar

No menu lateral: área **Operacional → Stockout** (ícone de alerta ⚠️).

- Rota: `/ferramentas/stockout`
- **Permissão necessária:** módulo **`gestao`** (Gestão). Quem não tem esse acesso não vê o item no menu nem abre a página.

A tela sempre respeita o **bar selecionado** no seletor de bar do topo. Trocar de bar recarrega os números daquele bar.

## Passo a passo

### 1. Ver o stockout de um dia específico (Data Única)

1. Abra **Operacional → Stockout**. A aba **Análise Diária** já vem selecionada.
2. Confirme que o **Modo de análise** está em **Data Única** (botão azul).
3. No campo **Data**, escolha o dia. O padrão é **ontem (D-1)**, porque a coleta roda de madrugada e o dia de hoje ainda não tem foto.
4. Clique em **Buscar** (ele também recarrega sozinho ao trocar a data ou o bar).
5. Os cards do topo mostram Total, Ativos, Inativos (em stockout) e % Stockout.
6. Role até **Análise por Local** e **clique em um local** (Bar, Drinks, Comidas…) para ver, lado a lado, os **produtos em stockout** (vermelho) e os **disponíveis** (verde) daquela praça.

### 2. Ver a média de um intervalo de dias (Período)

1. Na aba **Análise Diária**, clique no botão **Período**.
2. Preencha **De:** e **Até:** com o intervalo desejado.
3. Clique em **Buscar Período**.
4. Os cards passam a mostrar **médias** ("Média de Produtos", "Média Ativos", "Média Inativos") e o % médio de stockout do intervalo.
5. Na **Análise por Local**, clique em um local e depois em um **dia** da régua de datas para ver os produtos que ficaram em stockout naquele dia específico daquela praça.

### 3. Ver o histórico e tendências

1. Clique na aba **Histórico**.
2. Preencha **De:** e **Até:** (padrão: últimos 7 dias até ontem) e clique em **Buscar**.
3. A tela traz: resumo do período, **Análise por Dia da Semana** (com selo de melhor e pior dia), **Histórico Diário** (régua de dias coloridos), **Análise Semanal** (barra de progresso por semana) e a **tabela de Histórico Detalhado** dia a dia.

### 4. Forçar uma coleta manual (sincronizar)

A coleta é automática, mas se um dia não tiver dados você pode reprocessar. A ação de sincronização dispara a função `contahub-stockout-sync` para a data selecionada e o bar atual (respeitando os dias em que o bar opera). Após concluir, os dados do dia são recarregados. *Obs.: nesta versão da tela o disparo manual acontece via a integração de sincronização; a auditoria (item 5) ajuda a entender por que um produto entrou ou não.*

### 5. Auditar por que um produto entrou ou saiu do cálculo

1. Clique no botão **Auditoria v2.0** (canto superior direito). Ele abre `/ferramentas/stockout/auditoria`.
2. Escolha **Bar**, **Data** e, opcionalmente, o **Código do Produto**.
3. Clique em **Buscar**. A tela mostra o caminho **RAW → PROCESSADO → AUDIT**: total coletado, incluídos, excluídos e o **motivo da exclusão** de cada produto (ex.: "Grupo: Baldes", "Contém 'Combo' no nome").

## Abas e seções

### Aba Análise Diária

Tem dois modos de operação:

- **Data Única** — foto de um único dia. Cards de estatística + Análise por Local com detalhamento de produtos disponíveis/indisponíveis.
- **Período** — média de um intervalo. Mesmos cards, mas com valores médios, mais uma régua de datas por local para navegar dia a dia.

### Aba Histórico

Visão de tendência do período escolhido:

- **Resumo** (Total de Dias, Média Stockout, Média Disponível).
- **Análise por Dia da Semana** — média de stockout por dia da semana, destacando **melhor** e **pior** dia.
- **Histórico Diário** — régua com um cartão por dia, colorido pelo nível de stockout.
- **Análise Semanal** — média por semana (ISO) com barra de progresso (aparece quando há mais de uma semana).
- **Histórico Detalhado** — tabela dia a dia.

### Auditoria v2.0 (página separada)

Ferramenta de rastreabilidade que mostra, produto a produto, se ele foi **incluído** ou **excluído** do cálculo e por qual regra — útil quando um número parece estranho.

## Colunas e cálculos

### Cards de estatística (aba Análise Diária)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total / Média de Produtos | Total de produtos ativos e válidos no dia (ou média por dia no modo Período) | Contagem de linhas incluídas do dia; no Período é a média por dia | `silver_contahub_operacional_stockout_processado` (Data Única) |
| Ativos / Média Ativos | Produtos disponíveis para venda | Contagem de `prd_venda = 'S'` | idem |
| Inativos / Média Inativos | Produtos em stockout (fora de venda) | Contagem de `prd_venda = 'N'` | idem |
| % Stockout | Percentual do cardápio que estava indisponível | `(produtos com prd_venda='N') ÷ (total de produtos ativos) × 100` | idem |
| % Disponibilidade (subtítulo) | Percentual disponível | `100 − % stockout` | idem |
| Selo Excelente/Atenção/Crítico | Classificação de severidade | ≤10% = Excelente; ≤25% = Atenção; >25% = Crítico | cálculo na tela |

### Análise por Local (cards por praça)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome do local | Categoria de produção normalizada (Bar, Drinks, Comidas ou o local original) | `categoria_local`: `BEBIDA→Bar`, `DRINK→Drinks`, `COMIDA→Comidas`, senão o `loc_desc` | view/tabela processada (coluna `categoria_local`) |
| % (grande) | Stockout daquela praça | `(indisponíveis do local ÷ total do local) × 100` | agrupamento por `categoria_local` |
| Nº de produtos | Total de produtos daquela praça | Contagem por local | idem |
| ✓ (verde) | Disponíveis no local | Contagem `prd_venda='S'` no local | idem |
| ✗ (vermelho) | Em stockout no local | Contagem `prd_venda='N'` no local | idem |

Ao clicar no local, aparecem duas listas: **Produtos em Stockout** e **Produtos Disponíveis**, cada item com o nome (`prd_desc`) e o local de produção original (`loc_desc`).

### Aba Histórico — resumo e análises

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total de Dias | Quantos dias com dados no período | Contagem de dias distintos com foto | `gold_contahub_operacional_stockout_filtrado` |
| Média Stockout | Stockout médio do período (agregado) | `(soma de todos os stockouts ÷ soma de todos os produtos do período) × 100` — ponderado, não média simples de percentuais | idem |
| Média Disponível | Disponibilidade média | `100 − Média Stockout` | idem |
| Dia da Semana / Média Stockout | Média de stockout por dia da semana | Média simples dos percentuais dos dias daquele dia-da-semana | idem |
| Melhor / Pior dia | Dia da semana com menor / maior média | Menor e maior `media_stockout` entre os dias da semana | cálculo na API |
| Semana / Média Stockout | Média de stockout por semana ISO | Média simples dos percentuais diários da semana | idem |
| Barra de progresso (semanal) | Nível visual do stockout da semana | Largura = % de stockout (limitado a 100) | cálculo na tela |

### Aba Histórico — tabela Histórico Detalhado

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Data | Dia da foto | `data_consulta` | `gold_contahub_operacional_stockout_filtrado` |
| Dia da Semana | Nome do dia | Derivado da data | cálculo na API |
| Produtos Ativos | Total de produtos válidos no dia | Contagem de linhas do dia | idem |
| Disponíveis | Em venda | Contagem `prd_venda='S'` | idem |
| Stockout | Fora de venda | Contagem `prd_venda='N'` | idem |
| % Stockout | Percentual do dia | `(stockout ÷ ativos) × 100` | idem |
| % Disponibilidade | Percentual disponível | `100 − % stockout` | idem |

### Página Auditoria v2.0 — principais colunas

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total RAW | Produtos coletados do ContaHub no dia | Contagem bruta antes das regras | camada RAW/processada de stockout |
| Processados | Produtos analisados pelas regras | Contagem processada | idem |
| Incluídos | Válidos para o cálculo de stockout | `incluido = true` | idem |
| Excluídos | Filtrados por regra | `incluido = false` | idem |
| Não Processados | Aguardando processamento | Coletados mas ainda sem análise | idem |
| % Stockout / % Excluído | Indicadores do processamento | Vêm do registro de auditoria (`audit`) | registro de auditoria |
| Motivo da Exclusão | Por que o produto saiu | Regra aplicada (ex.: grupo Baldes, prefixo [HH], "Combo") | `motivo_exclusao` / `regra_aplicada` |
| Categoria Mix / Categoria Local | Como o produto foi classificado | `categoria_mix` (BEBIDA/DRINK/COMIDA) e `categoria_local` (Bar/Drinks/Comidas) | processamento |

## Filtros e opções

| Filtro / Opção | Onde aparece | Efeito |
|---|---|---|
| Bar | Seletor global do topo | Todos os números são sempre filtrados pelo `bar_id` selecionado. Cada bar tem seus próprios locais (ex.: Ordinário tem Preshh, Batidos, Chopp, Cozinha 1 e 2; Deboche tem Bar, Cozinha, Salão). |
| Modo de análise | Aba Análise Diária | Alterna entre **Data Única** (um dia) e **Período** (média de um intervalo). |
| Data | Data Única | Escolhe o dia da foto. Padrão = ontem. |
| De / Até | Período e Histórico | Delimitam o intervalo analisado. |
| Local (clique no card) | Análise por Local | Abre o detalhamento de produtos disponíveis/indisponíveis da praça. |
| Dia (régua) | Período / detalhe do local | No modo Período, seleciona um dia específico dentro da praça. |
| Auditoria: Status | Página de auditoria | Filtra Todos / Incluídos / Excluídos. |
| Auditoria: Categoria | Página de auditoria | Filtra por Bar, Drinks, Comidas ou Outro. |
| Auditoria: Código Produto | Página de auditoria | Busca um produto específico pelo código. |

## Regras e detalhes importantes

- **Sempre por bar (`bar_id`).** Nenhum número mistura bares diferentes.
- **A coleta é uma foto das 20:00 (Brasília)** do dia. O padrão da tela é D-1 porque a coleta automática roda de madrugada — o dia corrente ainda não tem snapshot.
- **Status é texto, não booleano:** `prd_venda = 'S'` é disponível; `prd_venda = 'N'` é stockout.
- **Dia sem operação = tela zerada com aviso.** Se o bar estava fechado naquela data, a tela mostra um aviso ("dia tratado como fechado") e retorna tudo zerado, sem contar como stockout.
- **Bares operam em dias diferentes.** O Deboche fecha às segundas e o Ordinário abre todos os dias; a sincronização respeita a configuração de dias de operação (`bares_config`), então dias fechados não geram coleta.
- **Muitos produtos são excluídos de propósito** para o percentual refletir só o cardápio "real". São filtrados, entre outros: produtos inativos, sem local definido, Happy Hour, Dose Dupla, Baldes (como grupo), Combos, Adicionais, Embalagem, Garrafa, Insumos, Pegue e Pague, Venda Volante e Uso Interno. A lista completa de regras fica visível na Auditoria v2.0.
- **Regra da Feijoada (só Ordinário):** o produto "Feijoada + Sobremesa" só entra no cálculo aos **sábados**. Nos outros dias ele é excluído do total e do stockout. O Deboche não tem essa regra.
- **Normalização de local em 3 categorias:** os vários locais de produção do PDV são resumidos em **Bar** (bebidas), **Drinks** e **Comidas**; o que não se encaixa mantém o nome original do local.
- **Percentual do período é ponderado.** No Histórico e no modo Período, a "Média Stockout" soma todos os stockouts e divide pela soma de todos os produtos do período (não é a média aritmética dos percentuais diários) — o que dá o mesmo resultado usado no Desempenho Semanal.
- **Fontes diferentes por visão:** a **Data Única** lê a camada **silver** (`silver_contahub_operacional_stockout_processado`, com o filtro `incluido = true`); o **Período** e o **Histórico** leem a view **gold** (`gold_contahub_operacional_stockout_filtrado`). As duas aplicam o mesmo conjunto de regras de exclusão.
- **Gravação por UPSERT:** os dados são salvos com chave `(bar_id, data_consulta, prd)`, evitando duplicações ao reprocessar um dia.
- **Cores de severidade** (cards e réguas): verde ≤10%, amarelo ≤25%, laranja ≤50% (em alguns cards), vermelho acima disso.

## Dúvidas frequentes

**Por que o padrão é ontem e não hoje?**
Porque a foto de produtos é coletada de madrugada, referente às 20h do dia anterior. O dia de hoje ainda não tem snapshot.

**O que exatamente conta como "stockout"?**
Um produto ativo e válido do cardápio que, na hora da foto, estava com a venda desligada no PDV (`prd_venda = 'N'`). Ele existe, mas não podia ser vendido.

**Por que o total de produtos é menor do que o meu cardápio inteiro?**
Porque a tela remove itens que não deveriam contar: Happy Hour, Dose Dupla, Baldes, Combos, Adicionais, Insumos, Uso Interno, Pegue e Pague, etc. O objetivo é medir só o cardápio "de verdade". Veja o detalhe na Auditoria v2.0.

**A média do período é a média dos percentuais de cada dia?**
Não. É um agregado ponderado: soma de todos os produtos em stockout dividida pela soma de todos os produtos do período. Isso evita distorção quando um dia tem muito menos produtos que outro.

**Apareceu "dia fechado" — perdi dados?**
Não necessariamente. Significa que aquela data foi tratada como um dia em que o bar não operou, então não há stockout a medir. Confirme se o bar realmente abriu naquele dia.

**Um produto ficou de fora e eu acho que não deveria. Como confiro?**
Abra a **Auditoria v2.0**, busque pela data e pelo código do produto, e veja em "Motivo da Exclusão" qual regra o retirou do cálculo.

## Fonte dos dados

- **Integração de origem:** **ContaHub** — endpoint de produtos (`ProdutoCmd/getProdutos`), coletado diariamente às 20:00 (Brasília) com os parâmetros `grp=-29`, `nfe=1`.
- **Tabela bruta:** `contahub_stockout` (schema `gold`: `gold_contahub_operacional_stockout`) — foto diária dos produtos, gravada por UPSERT em `(bar_id, data_consulta, prd)`.
- **View de filtro/categorização:** `contahub_stockout_filtrado` / `gold_contahub_operacional_stockout_filtrado` — aplica as exclusões e cria a coluna `categoria_local` (Bar/Drinks/Comidas).
- **Tabela processada (silver):** `silver_contahub_operacional_stockout_processado` — usada pela Análise Diária (Data Única), com `incluido`, `categoria_mix` e `categoria_local`.
- **Sincronização:** função Edge `contahub-stockout-sync`, orquestrada pela rota `/api/contahub/stockout-sync` respeitando `operations.bares` e `operations.bares_config` (dias de operação).
- **APIs da tela:** `/api/analitico/stockout` (Data Única), `/api/analitico/stockout-historico` (Período e Histórico), `/api/contahub/stockout/audit` (Auditoria v2.0).
- **RPC relacionada:** `calcular_stockout_semanal` — usada pelo Desempenho Semanal, com a mesma view e as mesmas categorias (Bebidas, Drinks, Comidas).
