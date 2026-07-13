---
title: Business Plan
area: relatorios-financeiros
slug: business-plan
route: /financeiro/bp
description: Tela 100% manual onde o dono preenche, mês a mês, o planejado do bar (receita, custos e despesas) — o que vira a coluna Planejado da Orçamentação.
order: 40
icon: BarChart3
---

# Business Plan

## Visão geral

O **Business Plan (BP)** é a tela onde o dono/sócio **planeja o resultado do bar mês a mês**, digitando na mão a meta de faturamento, os percentuais de custo e as despesas fixas previstas. É a peça de **planejamento** do financeiro: aqui você declara "quanto pretendo faturar e gastar" em cada categoria.

O ponto mais importante de entender: **o BP é 100% manual e grava exatamente no mesmo lugar que alimenta a coluna Planejado da Orçamentação.** Ou seja, tudo que você salva aqui aparece automaticamente como o "planejado" daquele mês na tela de Orçamentação (mesmo campo, mesma base de dados). O BP é a porta de entrada dos números; a Orçamentação é onde você depois compara esse planejado com o projetado e o realizado (que vêm do Conta Azul).

A tela mostra apenas a coluna **Planejado**. Não há aqui projeção nem realizado — esses aparecem na Orçamentação. O BP existe para você preencher a meta com calma, categoria por categoria, e ter uma leitura rápida do resultado planejado (Break Even, Lucro Líquido e Margem).

Quem usa no dia a dia: **sócio/dono e o financeiro**, tipicamente no fechamento de um mês para montar a meta do mês seguinte (ou do ano).

## Como acessar

No menu lateral: **Relatórios Financeiros › Business Plan** (ícone de gráfico de barras), rota `/financeiro/bp`.

A permissão exigida é o módulo **`financeiro_relatorios`** — a mesma dos demais relatórios financeiros fechados (DRE, DFC, Balanço). Quem não tem essa permissão não vê o item no menu nem acessa a tela.

Se **nenhum bar estiver selecionado** no seletor do topo, a tela pede para escolher um bar antes de carregar. Todos os dados são sempre filtrados pelo bar ativo.

## Passo a passo

### Escolher o ano e o mês
1. No cabeçalho escuro do topo, use o seletor de **ano** (mostra o ano anterior, o atual e o próximo).
2. Na aba **BP do mês**, clique no botão do **mês** desejado (Jan, Fev, Mar… no formato de "pílulas"). O mês selecionado fica destacado em escuro.
3. A tabela recarrega mostrando o planejado daquele mês/ano.

### Preencher a meta de faturamento
1. Na primeira linha, **Receita › Faturamento Meta**, clique sobre o valor em azul.
2. Digite a meta de faturamento do mês (use vírgula ou ponto para os centavos).
3. Pressione **Enter** (ou clique fora do campo) para salvar. **Esc** cancela.
4. Ao salvar, um ícone de disquete/loading aparece e a tabela recarrega com o valor atualizado. Esse número passa a ser o **planejado de receita** do mês, tanto aqui quanto na Orçamentação.

### Preencher os custos e despesas
1. Clique no nome de uma **categoria** (ex.: *Mão-de-Obra*, *Despesas Comerciais*, *Custos Variáveis*) para **expandir** e ver as linhas.
2. Algumas linhas têm sublinhas: clique na seta ao lado do nome (ex.: *CMO Fixo*, *Marketing*) para abrir os **filhos**.
3. Clique no valor em azul da linha que quer editar, digite o número e pressione **Enter**.
4. Atenção ao tipo do valor:
   - **Custos Variáveis** e **Custo insumos (CMV)** são digitados como **percentual (%)** do faturamento.
   - **Escritório Central** também é digitado como **percentual (%)** do faturamento.
   - As demais despesas fixas são digitadas em **R$**.
5. Cada valor é salvo individualmente na hora. A linha-pai (que tem filhos) é **somente leitura** — o valor dela é a soma dos filhos que você edita.

### Comparar dois meses
1. Clique na aba **Comparativo**.
2. Escolha o **mês A** e o **mês B** nos dois seletores.
3. A tabela mostra, por categoria, o planejado de cada mês e a diferença (Δ) entre eles.

## Abas e seções

A tela tem duas abas:

- **BP do mês** — a aba principal. À esquerda, uma tabela hierárquica (Receita → categorias → linhas → filhos) com o valor planejado editável de cada item. À direita, um **card de resumo** com os indicadores do mês (Faturamento Meta, Real Fixo, Break Even, Lucro Líquido e Margem).
- **Comparativo** — coloca **dois meses lado a lado** e mostra a diferença do planejado por categoria. Serve para ver como a meta evoluiu de um mês para o outro (ex.: Agosto vs Setembro).

> Observação: existe no código uma variação de comparativo entre **versões/anos** de BP (arquivo `BpComparativo.tsx`, alimentado por `/api/estrategico/bp/dados`), mas a tela em produção usa o componente `BpManual`, cujo comparativo é **mês contra mês** dentro do mesmo ano.

## Colunas e cálculos

Todos os valores exibidos são a coluna **Planejado**. As linhas editáveis gravam em `orcamento_planilha` (schema `meta`); as linhas de resumo são calculadas pelo serviço `getOrcamentacaoCompleta` a partir do que foi digitado. A tabela abaixo cobre a tabela principal, o card de resumo e a aba Comparativo.

### Tabela principal (BP do mês)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Receita (linha-título) | Total de receita planejada do mês | Espelha o Faturamento Meta planejado (`faturamento_meta_plan`) | Cálculo do serviço |
| Faturamento Meta | Meta de faturamento do mês (editável) | Valor manual digitado; se ainda não preenchido, cai no fallback Σ M1 dos eventos do mês | `orcamento_planilha` (categoria `FATURAMENTO META`) / fallback `gold.planejamento` (M1) |
| Categoria (linha cinza) | Subtotal planejado do bloco (ex.: Mão-de-Obra) | Soma do `planejado` de todas as subcategorias do bloco | Cálculo do serviço |
| Linha de despesa fixa (R$) | Valor planejado da linha em reais | Valor manual digitado | `orcamento_planilha.valor_planejado` |
| Linha-pai com filhos (ex.: CMO Fixo, Marketing) | Soma dos filhos (somente leitura) | Σ do `planejado` das linhas-filhas | Cálculo do serviço |
| Linha-filha (ex.: FREELA BAR, Marketing Mídia) | Valor planejado da sublinha (editável) | Valor manual digitado | `orcamento_planilha.valor_planejado` |
| Custos Variáveis (%) | Percentual planejado sobre o faturamento | Valor manual digitado em % (bloco em modo percentual) | `orcamento_planilha` (categoria `Custos Variáveis`) |
| Custo insumos (CMV) (%) | Percentual de CMV planejado sobre o faturamento | Valor manual digitado em % (bloco em modo percentual) | `orcamento_planilha` (categoria `Custo insumos (CMV)`) |
| Escritório Central (%) | Percentual do faturamento (default 4%) | Digitado em %; para os totais vira R$ = % × Faturamento Meta planejado | `orcamento_planilha` (categoria `Escritório Central`) |

### Card de resumo (Planejado do mês)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Faturamento Meta | Receita planejada do mês | `faturamento_meta_plan` (manual ou fallback Σ M1) | Cálculo do serviço |
| Real Fixo | Soma das despesas fixas planejadas | Σ do planejado dos blocos Mão-de-Obra + Comerciais + Administrativas + Operacionais + Ocupação (não inclui Variáveis, CMV nem Não Operacionais) | Cálculo do serviço |
| Break Even | Faturamento mínimo para empatar | Real Fixo ÷ % Contribuição, onde **% Contribuição = 1 − (Var% + CMV%)** | Cálculo do serviço |
| Lucro Líquido | Resultado planejado do mês | **(Faturamento − Break Even) × % Contribuição + Não Operacionais** (fórmula do Excel do sócio). Exibido em verde se ≥ 0, vermelho se negativo | Cálculo do serviço |
| Margem | Margem do lucro líquido | Lucro Líquido ÷ Faturamento Meta (em %) | Cálculo do serviço |

### Aba Comparativo

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Categoria | Nome do bloco | Lista de categorias do mês | Cálculo do serviço |
| Mês A | Planejado da categoria no 1º mês | Σ do `planejado` das subcategorias no mês A | `orcamento_planilha` |
| Mês B | Planejado da categoria no 2º mês | Σ do `planejado` das subcategorias no mês B | `orcamento_planilha` |
| Δ (delta) | Diferença entre B e A | `valor B − valor A`. Em vermelho quando aumentou (mais despesa), verde quando diminuiu, "–" quando igual | Cálculo na tela |

## Filtros e opções

- **Bar** — vem do seletor global do topo. Todos os dados são filtrados por `bar_id`; o BP de um bar não se mistura com o de outro.
- **Ano** — seletor no cabeçalho (ano anterior, atual e próximo). Troca o ano recarrega todos os 12 meses.
- **Mês** (aba BP do mês) — pílulas de Jan a Dez. Seleciona qual mês está sendo preenchido/visto.
- **Mês A / Mês B** (aba Comparativo) — dois seletores independentes para escolher os meses que serão comparados.
- **Expandir/recolher** — clicar numa categoria abre/fecha suas linhas; clicar na seta de uma linha-pai abre/fecha os filhos. Por padrão tudo começa **fechado**.

## Regras e detalhes importantes

- **Tudo é manual.** Nenhum valor do BP vem automaticamente de integração. O que você digita é a **meta/planejado**. O realizado (Conta Azul) e o projetado só aparecem na Orçamentação, não aqui.
- **Mesmo campo da Orçamentação.** Salvar no BP escreve em `meta.orcamento_planilha` no campo `valor_planejado` (com `fonte_planejado = 'manual'`). É literalmente a coluna Planejado da Orçamentação — não existe duplicidade de dados.
- **Filtragem por bar.** O carregamento e a gravação sempre usam o `bar_id` do bar ativo (nas chaves `bar_id, ano, mes, categoria_nome`).
- **Percentual vs R$.** Custos Variáveis, CMV e Escritório Central são digitados em **percentual**; as demais despesas fixas em **R$**. No Escritório Central, se houver um valor legado maior que 100 (resquício da época em que era R$), o sistema cai no **default de 4%** até você digitar o percentual novo.
- **Linha-pai é somente leitura.** Categorias com filhos (ex.: *CMO Fixo*, *CMO Freela*, *Marketing*) mostram a **soma dos filhos**; você edita os filhos, não o pai.
- **Fallback do Faturamento Meta.** Se você ainda não digitou a meta de faturamento do mês, a tela exibe como planejado a **soma do M1** dos eventos daquele mês (vindo do planejamento comercial). Assim que você salvar um valor manual, ele passa a mandar.
- **Salvamento imediato.** Cada célula é salva individualmente ao pressionar Enter ou ao sair do campo (não há botão "salvar tudo"). Após salvar, a tabela é revalidada via cache (SWR) por bar/ano.
- **Estado vazio.** Se o mês não tem estrutura de dados, a tela mostra "Sem dados.". Valores nunca preenchidos aparecem como R$ 0.
- **Arredondamento.** Os valores em R$ são exibidos sem casas decimais (arredondados para o real inteiro); percentuais aparecem com uma casa decimal.

## Dúvidas frequentes

**O que eu preencho aqui muda a Orçamentação?**
Sim. É o mesmo campo. O valor que você salva no BP vira o **Planejado** daquele mês na Orçamentação, automaticamente.

**Por que não vejo Realizado nem Projetado no BP?**
Porque o BP é só o planejamento. Para comparar planejado × projetado × realizado, use a tela **Orçamentação**.

**Digitei o CMV e ele pediu um número pequeno. É percentual?**
Sim. Custos Variáveis, CMV e Escritório Central são digitados em **percentual do faturamento**, não em reais.

**Por que a linha "CMO Fixo" não deixa editar?**
Porque ela é a **soma dos filhos** (CUSTO-EMPRESA, Adicionais, Alimentação, Pro Labore…). Abra a seta e edite cada filho.

**Eu não digitei a meta de faturamento e apareceu um valor. De onde veio?**
É o **fallback**: enquanto você não preenche, a tela usa a soma do M1 dos eventos do mês (do planejamento comercial). Ao salvar um valor, ele substitui o fallback.

**Muda o bar e os números somem — é bug?**
Não. Cada bar tem seu próprio BP. A tela sempre filtra pelo bar ativo; preencha o BP de cada bar separadamente.

## Fonte dos dados

- **`meta.orcamento_planilha`** (via view `public.orcamento_planilha`) — onde o planejado manual é gravado e lido (`valor_planejado`, chave `bar_id, ano, mes, categoria_nome`). É a fonte central do BP.
- **`gold.planejamento`** — usado apenas como **fallback** do Faturamento Meta (soma de M1 dos eventos do mês) quando a meta ainda não foi digitada. Origem: planejamento comercial (eventos, ContaHub/Yuzer/Sympla consolidados).
- **Serviço `getOrcamentacaoCompleta`** (`frontend/src/app/estrategico/orcamentacao/services/orcamentacao-service.ts`) — monta a estrutura de categorias e calcula os indicadores de resumo (Real Fixo, % Contribuição, Break Even, Lucro Líquido, Margem).
- **API de leitura**: `/api/estrategico/orcamentacao/todos-meses` (GET). **API de gravação**: `/api/estrategico/orcamentacao` (POST, com autenticação e guard de rota).

> Observação: embora o serviço também busque realizado do Conta Azul (`gold.orcamento_realizado_mensal`) e ajustes manuais (`financial.dre_manual`), esses dados **não são exibidos no BP** — a tela consome apenas as colunas de planejado. Eles aparecem na tela de Orçamentação.
