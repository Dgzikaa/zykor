---
title: Desvios de Consumo
area: producao-cmv
slug: desvios-consumo
route: /operacional/desvios
description: Compara o estoque real (contagem) com o estoque teórico (entradas menos vendas × ficha) para revelar perdas, furos e sobras por insumo, produção e proteína.
order: 30
icon: Scale
---

# Desvios de Consumo

## Visão geral

A tela de **Desvios de Consumo** responde a uma pergunta simples: *"o que deveria ter sobrado no estoque bate com o que sobrou de fato?"*

Para cada item ela monta um balanço:

**Estoque teórico do fim** = estoque no início **+ compras + trocas recebidas + produzido − saída teórica (vendas × ficha) − desperdício**

Depois compara esse número com o **estoque real** (a contagem do fim do período). A diferença é o **desvio**:

- **Desvio negativo (perda / furo):** sobrou **menos** do que as vendas explicam. Faltou mercadoria — pode ser furo, quebra não lançada, erro de ficha ou de contagem.
- **Desvio positivo (sobra):** sobrou **mais** do que o esperado. Normalmente indica ficha "comendo" demais, produção não lançada ou contagem/erro de cadastro.

É a ferramenta que o time de CMV/Produção (Gonza e sócios) usa para caçar onde o dinheiro está vazando no estoque, separando **perda real** de **problema de cadastro** (item sem contagem final ou sem ficha técnica). Quem usa no dia a dia: gestor de CMV, produção e sócio.

## Como acessar

No menu lateral: **Produção - CMV › Desvios de Consumo** (ícone de balança), rota `/operacional/desvios`.

A permissão do item de menu é o módulo **`gestao`**. As ações de **escrita** (lançar produzido, desperdício, utilizado pelo lápis) passam pela autenticação do usuário e pelo guard de rota (`negarPorRota` sobre `/api/operacional/desvios`) — quem tem acesso só de leitura vê o selo **Somente leitura** e as células de edição ficam desabilitadas.

A tela sempre trabalha sobre o **bar selecionado** no topo. Se nenhum bar estiver escolhido, ela não carrega.

## Passo a passo

### Ver os desvios de um período
1. Escolha a **granularidade** nos botões **Diária / Semanal / Mensal**.
2. Selecione o **período** no seletor ao lado do calendário:
   - **Diária:** escolha um **dia**. A janela vai daquele dia até a próxima contagem (mostrado como "estoque dd/mm → dd/mm"). O dia mais recente ainda não tem contagem de fechamento, por isso não aparece como início.
   - **Semanal / Mensal:** escolha a **semana** ou o **mês**. Cada período é a janela entre duas contagens de fechamento consecutivas.
3. A tabela carrega já ordenada pelo **maior impacto em R$** (as maiores perdas/sobras no topo).
4. Leia os **3 cards** no topo: **Desvio total**, **Perdas** e **Sobras**.
5. Leia a **caixa de Análise** logo abaixo: ela resume a perda do período, compara com o período anterior e aponta o que está distorcendo o número (itens sem contagem, sem ficha, sem preço) e as maiores perdas reais.

### Prévia da semana em andamento
1. Selecione **Semanal**. Se existir uma contagem diária mais recente que o último fechamento semanal, aparece a opção **"🔴 Semana atual (em andamento)"**.
2. Ao escolhê-la, a tela mostra a prévia da semana até a última contagem diária disponível.
3. Atenção: a prévia considera **só itens de Curva A** (os únicos contados todo dia). O fechamento completo entra na contagem de segunda-feira. Um aviso âmbar deixa isso explícito.

### Lançar o "Produzido" de uma produção (aba Produções, granularidade Diária)
1. Vá na aba **Produções** e selecione o dia (**Diária**).
2. Na coluna **Produzido**, passe o mouse na célula, clique no **lápis** e digite a quantidade (nº de fornadas do dia, convertido pelo rendimento da ficha da produção).
3. Confirme no **✓** (ou Enter). A tabela recalcula sozinha, sem piscar.
4. Deixar em branco / 0 apaga o lançamento daquele dia.

### Lançar desperdício
1. Na coluna **Desperdício**, clique no lápis e informe a quantidade perdida (lata que estourou, item que deu problema etc.).
2. Regras de onde dá para lançar:
   - **Diária:** lança o desperdício do dia (Curva A).
   - **Semanal:** para itens **Curva A** o desperdício é **somente leitura** (é a soma dos diários). Para itens **não-Curva-A**, você lança direto o desperdício **da semana** (não há diário para somar).
   - **Mensal:** somente leitura (consolida as semanas).

### Ajustar o "Utilizado Produção" de uma proteína (aba Proteínas)
1. Vá na aba **Proteínas** e selecione o período.
2. Na coluna **Utilizado Produção**, clique no lápis e informe o quanto foi processado. Esse valor **manual** sobrescreve o valor automático vindo do Controle de Produção.

### Atualizar o estoque (puxar contagem nova)
1. Clique em **Atualizar estoque** (canto superior direito).
2. O sistema puxa a contagem da **planilha (aba INSUMOS, últimos 14 dias)** — a mesma sincronização da tela de Estoque — e recarrega os desvios sem trocar de tela. Útil logo depois de lançar uma contagem.

> **Contagem lançada com atraso entra normalmente.** Mesmo que a contagem de uma data (ex.: a semanal de segunda) só seja preenchida/sincronizada no dia seguinte, ela é incorporada ao estoque inicial do período — o sync reprocessa a janela inteira. Se algum item (ex.: cervejas Ambev) não estiver aparecendo no estoque inicial, clicar em **Atualizar estoque** resolve.

### Filtrar e buscar
1. Use a **busca** para achar um item por nome ou código.
2. Clique nos **chips** (total, Curva A, por área, sem contagem final, sem ficha) para filtrar rapidamente.
3. Clique no **funil** no cabeçalho de qualquer coluna numérica para filtrar por faixa (≥ mín / ≤ máx). Nas colunas de **Desvio** o filtro usa o **valor absoluto** (assim "≥ 1.000" pega tanto perda quanto sobra).

## Abas e seções

A tela tem três abas, cada uma com o mesmo modelo de balanço mas fonte de entrada diferente:

- **Insumos** — insumos "puros" (exclui produções e proteínas, que têm aba própria). Entrada = estoque inicial + **compras** (VMarket) + trocas. Na semanal/mensal, esconde itens **sem ficha** (Gonza: sem ficha não há saída teórica, então não entra no desvio).
- **Produções** — itens produzidos internamente (código de produção). A entrada não é "compra" e sim **Produzido** (fornadas lançadas na diária × rendimento). Tem filtro **Comida / Drinks** conforme a seção do cadastro da produção (Cozinha = Comida, Bar = Drinks).
- **Proteínas** — proteínas marcadas no cadastro (curva A proteína). Balanço próprio (função `fn_desvios_proteina`), tudo em **kg**: estoque inicial + **Compras** (VMarket) + trocas − **Utilizado Produção** − **Saída Direta** − desperdício.

Cada aba tem seus **3 cards** (Desvio total / Perdas / Sobras) e sua própria **caixa de Análise**. Os cards **acompanham os filtros ativos** — somam apenas as linhas visíveis (e ignoram linhas "pendentes").

## Colunas e cálculos

### Cards de topo (as 3 abas)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Desvio total | Saldo do período (perda ou sobra líquida) | Soma de `desvio_rs` das linhas visíveis (exclui pendentes) | `fn_desvios` / `fn_desvios_proteina` |
| Perdas | Quanto faltou de estoque | Soma só dos `desvio_rs` **negativos** | idem |
| Sobras | Quanto sobrou além do esperado | Soma só dos `desvio_rs` **positivos** | idem |

### Aba Insumos

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Insumo | Nome + código do item; "· unidade" = unidade de contagem | Cadastro do insumo | `operations.insumos` |
| Área | Cozinha / Salão / Drinks / Alimentação / Comidas | Derivada da categoria do insumo (marcadores `(F)`,`(C)`,`(S)`,`(B)` e palavras-chave de bebida) | `areaDe()` na API |
| Estoque ini | Contagem no início do período | `estoque_final` na data inicial (+ decomposição de pré-batch, quando aplicável) | `silver.estoque_contagem` |
| Compras | Compras que entraram no período | Soma das quantidades de pedidos VMarket **conferidos (status 6 = Entrega Confirmada)**, pela **data de entrega** (`dt_entrega`, senão `data`) dentro de [ini, fim) | `gold.vmarket_pedido` / `vmarket_pedido_item` |
| Troca | Troca entre bares (+ recebeu, − enviou) | Entradas (bar destino) − saídas (bar origem), por `data_competencia`, trocas não canceladas. A saída casa por `insumo_codigo` (catálogo de quem enviou) e a entrada por `insumo_codigo_destino` (catálogo de quem recebeu) — ver "De-para entre bares" | `financial.trocas` / `troca_itens` |
| Saída teórica | Consumo esperado pelas vendas | Vendas × ficha técnica no período (lido **ao vivo**: `vendas_consolidada_dia` × `insumo_por_produto`, mais o consumo via produções); convertido para a unidade de contagem pela embalagem | `silver.vendas_consolidada_dia`, `silver.insumo_por_produto` |
| Desperdício | Saída manual (quebra, item que deu problema) | Valor lançado manualmente no período (editável pelo lápis) | `operations.desvio_desperdicio_manual` |
| Estoque fim teórico | Quanto deveria ter sobrado | `ini + compras + troca + produzido − saída teórica − desperdício` | cálculo `fn_desvios` |
| Estoque real | Quanto sobrou de fato | `estoque_final` na contagem do fim do período (+ pré-batch) | `silver.estoque_contagem` |
| Desvio (qtd) | Diferença em quantidade | `estoque real − estoque fim teórico` (negativo = faltou) | `fn_desvios` |
| Desvio (R$) | Diferença valorizada | `desvio_qtd × preço unitário` do insumo | preço de `v_insumo_preco_atual` / custo da produção |

### Aba Produções

Mesmo balanço, com **Produzido** no lugar de Compras.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Produção | Nome + código da produção; badge "produção" | Cadastro da produção | `producao_base` |
| Estoque ini | Contagem no início | `estoque_final` na data inicial | `silver.estoque_contagem` |
| Produzido | Produção feita no período (editável) | Rendimento real das execuções (÷ fator de contagem) ou lançamento manual (nº de **fornadas** × rendimento ÷ fator). Na diária você digita as fornadas | `producao_execucao` / `producao_entrada_manual` |
| Saída teórica | Consumo esperado | Vendas × ficha técnica da produção ÷ fator de contagem | `silver.vendas_consolidada_dia` |
| Desperdício | Perda manual | Lançamento manual (editável) | `desvio_desperdicio_manual` |
| Estoque fim teórico | Quanto deveria sobrar | `ini + produzido − saída teórica − desperdício` | `fn_desvios` |
| Estoque real | Quanto sobrou de fato | Contagem do fim | `silver.estoque_contagem` |
| Desvio (qtd) | Diferença em quantidade | `real − teórico` | `fn_desvios` |
| Desvio (R$) | Diferença valorizada | `desvio_qtd × custo unitário da produção` | custo da ficha |

### Aba Proteínas (tudo em kg)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Proteína | Nome + código | Insumos marcados como proteína (Curva A proteína) | `operations.insumos` (`curva_a_proteina`) |
| Estoque ini | Contagem inicial (kg) | `estoque_final` na data inicial | `silver.estoque_contagem` |
| Compras | Compras VMarket no período (kg) | Pedidos conferidos (status 6), pela data de entrega | `gold.vmarket_pedido` |
| Troca | Troca entre bares (+ recebeu, − enviou) | Entradas − saídas por competência | `financial.trocas` |
| Utilizado Produção | Proteína processada em preparos | Prioridade: valor **manual** > Controle de Produção (peso bruto para a proteína mestre, senão qtd real) > automático (fornadas × ficha). Convertido g → kg | `producao_execucao_insumo`, `proteina_utilizado_manual` |
| Saída Direta | Proteína vendida direto no produto | Vendas × ficha direta do produto (`qtd_teorica ÷ 1000`, g → kg) | `silver.consumo_teorico_insumo_dia` |
| Desperdício | Perda manual (kg) | Lançamento manual | `desvio_desperdicio_manual` |
| Estoque fim teórico | Quanto deveria sobrar | `ini + compras + troca − utilizado produção − saída direta − desperdício` | `fn_desvios_proteina` |
| Estoque real | Quanto sobrou (contagem) | Contagem do fim | `silver.estoque_contagem` |
| Desvio (qtd) | Diferença em kg | `real − teórico` (negativo = furo) | `fn_desvios_proteina` |
| Desvio (R$) | Diferença valorizada | `desvio_qtd × preço da proteína` | `v_insumo_preco_atual` |

## Filtros e opções

- **Bar** — a tela sempre filtra pelo bar selecionado no topo; todas as consultas passam `bar_id`.
- **Tipo (Diária / Semanal / Mensal)** — define a granularidade da janela entre contagens.
- **Período** — seletor de dia / semana / mês; sempre a janela entre duas contagens consecutivas.
- **Semana em andamento** — prévia da semana atual, só Curva A (semanal).
- **Busca** — filtra por nome ou código do item.
- **Chips de filtro** (aba Insumos, e Produções no semanal/mensal):
  - **total** — limpa os filtros.
  - **curva A** — só itens de Curva A.
  - **por área** — filtra pela área (Cozinha, Salão, Drinks, etc.).
  - **⚠ sem contagem final** — itens cujo estoque real ficou zerado tendo tido estoque/compra (contagem provavelmente faltando).
  - **⚠ sem ficha** — itens consumidos sem ficha técnica que explique a venda.
- **Comida / Drinks** (aba Produções) — separa por seção da produção (Cozinha vs Bar).
- **Filtros por coluna (funil, estilo Excel)** — ≥ mín / ≤ máx em qualquer coluna numérica; nas colunas de Desvio o filtro é pelo **valor absoluto**. O botão "Limpar filtros" na barra de busca zera todos.

## Regras e detalhes importantes

- **Multi-bar:** cada consulta filtra por `bar_id`; nada é compartilhado entre bares (as trocas somam entrada em um bar e saída no outro).
- **De-para entre bares (trocas):** o código do insumo (`i0XXX`) é **independente por bar** — o mesmo `i0279` é "Pão Smash" no Deboche e "Espumante" no Ordinário (dos 283 códigos que existem nos dois, 281 são insumos diferentes). Por isso a troca guarda **dois códigos**: `insumo_codigo` (catálogo de quem enviou, usado na saída) e `insumo_codigo_destino` (catálogo de quem recebeu, usado na entrada). Quem registra a troca escolhe o equivalente no bar destino — a tela sugere pelo nome, mas a confirmação é humana. **Sem equivalente** (o insumo não existe no outro bar): a saída é registrada e a entrada **não** — o bar que recebeu vai acusar essa falta até cadastrarem o insumo lá. Antes de 16/07/2026 a entrada casava pelo código de origem e caía num insumo aleatório no destino.
- **Diária = só Curva A:** na diária (e na prévia da semana em andamento) a tela considera **apenas itens de Curva A**, porque só eles têm contagem todo dia. Os demais não têm estoque final novo e virariam "perda" falsa.
- **Compras entram pela data de ENTREGA e só quando conferidas:** uma compra só conta quando o pedido VMarket está com **status 6 (Entrega Confirmada)** e cai no período pela data de entrega. Pedido pendente não infla o teórico.
- **Saída teórica lida ao vivo:** o consumo esperado usa a ficha técnica **na hora** (não um retrato de hora em hora), então bate com a tela de Saídas mesmo logo após mudar uma ficha.
- **Manual × automático:** compras, saída teórica e produzido (via execução) são **automáticos**; **desperdício**, **produzido lançado por fornadas** e **utilizado de proteína manual** são **manuais** (lápis). Valor manual de proteína sobrescreve o automático.
- **Onde o lançamento é gravado:** produzido / desperdício / utilizado são salvos com **data = início do período**; a função soma tudo dentro de [ini, fim). Salvar 0 ou vazio apaga o lançamento.
- **Linhas "pendentes" (âmbar):** produção com venda mas **sem o "produzido" informado** — o balanço fica sem âncora, o desvio não é confiável e a linha é **excluída dos cards e da análise** (mostra "—").
- **Linhas "suspeitas":** saída teórica muito acima do consumo físico com impacto alto — sinaliza possível erro de ficha/unidade.
- **Qualidade do dado na Análise:** a caixa de análise separa a **perda distorcida** (itens sem contagem final ou sem ficha) da **perda real**, e sugere resolver o cadastro antes de cobrar a equipe. Também avisa itens **sem preço** (o desvio em R$ não conta para eles).
- **Sem preço = sem R$:** item sem preço cadastrado entra no desvio de quantidade, mas o desvio em R$ fica zerado.
- **Estados vazios:** cada aba mostra "Sem dados / Sem produção / Sem proteína nesse período" quando não há linhas.
- **Arredondamento:** quantidades a 3 casas; valores em R$ a 2 casas. Proteínas sempre em **kg** (converte gramas ÷ 1000).

## Dúvidas frequentes

**Por que a diária só mostra alguns itens?**
Porque só os itens de **Curva A** são contados todos os dias. Sem contagem diária, os demais não têm estoque final para fechar o balanço e ficariam com desvio falso — por isso são omitidos na diária.

**A perda deu enorme num item — é furo mesmo?**
Nem sempre. Cheque a caixa de Análise: se o item aparece como **sem contagem final** (estoque real zerado) ou **sem ficha**, o número está distorcido por cadastro, não por perda real. Resolva o cadastro antes de cobrar o time.

**Lancei uma contagem nova e não apareceu. O que faço?**
Clique em **Atualizar estoque** para puxar a planilha de contagem (últimos 14 dias) e recarregar os desvios.

**Qual a diferença entre "Utilizado Produção" e "Saída Direta" na aba Proteínas?**
"Utilizado Produção" é a proteína que a cozinha **processou em preparos** (Controle de Produção). "Saída Direta" é a proteína **vendida direto num produto** do cardápio. As duas são somadas como saída teórica — sem a Saída Direta, a proteína vendida direto viraria perda falsa.

**Desvio positivo (sobra) é bom?**
Não necessariamente. Sobra costuma indicar ficha "comendo" demais, produção não lançada ou erro de contagem/cadastro. O ideal é o desvio próximo de zero.

**Por que os cards mudam quando eu filtro?**
Os 3 cards (Desvio total / Perdas / Sobras) somam apenas as **linhas visíveis** da aba. Ao filtrar por área, Curva A ou faixa numérica, o headline recalcula sobre o que ficou na tela.

## Fonte dos dados

**Funções SQL (schema `gold`):**
- `gold.fn_desvios(p_bar, p_ini, p_fim)` — balanço de Insumos e Produções.
- `gold.fn_desvios_proteina(p_bar, p_ini, p_fim)` — balanço de Proteínas.
- `operations.contagem_datas(...)` — datas de contagem que alimentam o seletor de período.

**Tabelas / views:**
- `silver.estoque_contagem` — contagens de estoque (início e fim do período).
- `silver.vendas_consolidada_dia` + `silver.insumo_por_produto` — vendas × ficha (saída teórica, ao vivo).
- `silver.consumo_teorico_insumo_dia` — saída direta das proteínas.
- `gold.vmarket_pedido` / `gold.vmarket_pedido_item` + `public.bronze_vmarket_produtos` — compras (VMarket).
- `financial.trocas` / `financial.troca_itens` — trocas entre bares.
- `operations.insumos` — cadastro de insumos, Curva A e proteína.
- `public.producao_base` / `producao_ficha_item` — fichas e rendimentos de produção.
- `operations.producao_execucao` / `producao_execucao_insumo` / `producao_entrada_manual` — produção executada e lançada.
- `operations.desvio_desperdicio_manual` — desperdício lançado na tela.
- `operations.proteina_utilizado_manual` — utilizado de proteína lançado na tela.
- `operations.v_insumo_preco_atual` — preços para valorizar o desvio.

**Integrações de origem:** **ContaHub** (vendas), **VMarket** (compras), planilha de **contagem de estoque** (Google Sheets), Controle de Produção interno do Zykor.
