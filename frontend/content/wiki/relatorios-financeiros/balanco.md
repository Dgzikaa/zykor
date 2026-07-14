---
title: Balanço Patrimonial
area: relatorios-financeiros
slug: balanco
route: /financeiro/balanco
description: Foto do patrimônio do bar no último dia de cada mês (Ativo, Passivo, PL) com indicadores de liquidez, capital de giro e prazos médios, montada a partir do Conta Azul, do CMV e de inputs manuais.
order: 30
icon: Layers
---

# Balanço Patrimonial

## Visão geral

O **Balanço Patrimonial** mostra a "foto" do patrimônio do bar no **último dia de cada mês**: o que o bar tem (**Ativo**), o que o bar deve (**Passivo**) e a diferença entre os dois (**Patrimônio Líquido**). Diferente do DRE (que mostra o resultado do período) ou do fluxo de caixa (que mostra a movimentação), o Balanço mostra o **saldo acumulado** em uma data específica.

A tela exibe vários meses **lado a lado** (3, 6, 8 ou 12), do mais antigo à esquerda ao mais novo à direita, para você comparar a evolução do patrimônio e da saúde financeira ao longo do tempo. Além do balanço em si, a tela calcula automaticamente indicadores gerenciais: **liquidez**, **necessidade de capital de giro (NCG)**, **prazos médios** (estoque, recebimento, pagamento) e **ciclo financeiro**.

Cada valor tem uma origem sinalizada por cor:

- **Laranja** — vem automático do **Conta Azul** (não editável).
- **Azul** — input **manual** (clique para editar).
- **Cinza** — **cálculo** derivado das outras linhas.

Quem usa: dono e sócios, controladoria e financeiro, para acompanhar solvência, capital de giro e estrutura patrimonial mês a mês.

## Como acessar

No menu lateral: **Financeiro → Balanço Patrimonial** (ícone de camadas). Rota: `/financeiro/balanco`.

É necessária a permissão do módulo **`financeiro_relatorios`** (Relatórios Financeiros). A rota da API também é protegida pelo mesmo guard — sem essa permissão, tanto a página quanto a leitura/escrita dos dados são bloqueadas.

## Passo a passo

### 1. Escolher o período de comparação
1. No topo direito, selecione **quantos meses** ver lado a lado (`3`, `6`, `8` ou `12`).
2. Selecione o **mês final** e o **ano final** da janela.
3. A tabela recarrega mostrando os N meses que terminam no mês/ano escolhido (ex.: escolhendo Jul/2026 com 6 meses, aparecem Fev a Jul de 2026).

> **O Balanço começa em Out/2025** (abertura). Não há dado confiável antes disso, então os seletores de mês/ano não deixam escolher meses anteriores, e a janela de comparação nunca mostra colunas antes de Out/2025.

### 2. Editar um valor manual (azul)
1. Localize uma linha **azul** (ex.: *Caixa + Investimentos*, *Empréstimos CP a Receber*, *Financiamentos LP*, *Investimentos Aprovados*).
2. Clique no número da coluna do mês que quer editar.
3. Digite o valor (aceita vírgula ou ponto; o sistema limpa a máscara).
4. Pressione **Enter** ou clique no **✓** verde para salvar. **Esc** ou o **✗** vermelho cancela.
5. O valor é gravado por bar/ano/mês e a tabela recarrega em silêncio.

### 3. Cadastrar um bem no Imobilizado (depreciação)
No card **"Imobilizado — cadastro & depreciação"**, abaixo da tabela:
1. Preencha **Descrição** (ex.: "Telão", "Câmara fria").
2. Informe o **Valor (R$)** cheio da compra.
3. Escolha o **Mês da compra**.
4. Escolha o **Tipo**: **Inicial** (base de abertura, alimenta *Imobilizado Inicial*) ou **Reinvestimento** (compras novas, alimenta *Imobilizado Líquido*).
5. Ajuste a **Taxa %/ano** de depreciação (padrão 10% a.a.).
6. Clique em **Adicionar**. O bem aparece na lista com depreciação/mês e mês de fim, e as linhas de Imobilizado do balanço se atualizam.

### 4. Remover um bem do Imobilizado
Na lista de ativos, clique em **remover** na linha do bem. É uma remoção lógica (o registro fica inativo, não é apagado). As linhas de Imobilizado recalculam.

### 5. Recolher/expandir seções
- Clique no título de uma **seção azul** (ATIVO, PASSIVO, NCG, etc.) para recolher/expandir tudo dentro dela.
- Clique numa linha **em negrito com filhos** (ex.: *Ativo Circulante*, *Passivo Circulante*) para esconder/mostrar suas sublinhas.
- Passe o mouse sobre labels sublinhados (pontilhado) para ver a **fórmula** de cálculo em tooltip.

## Abas e seções

A tela é uma tabela única, organizada em blocos macro (cada um recolhível):

- **Topo (DRE do mês)** — Receita Líquida, Lucro Líquido, CMV e CMC do mês, para dar contexto ao balanço.
- **ATIVO** — Ativo Circulante (Caixa+Investimentos, Contas a Receber, Empréstimos CP, Estoques), Ativo Não Circulante (Imobilizado) e Ativo Total.
- **PASSIVO** — Passivo Circulante (dívidas de curto prazo por bloco), Passivo Não Circulante (investimentos a fazer, financiamentos, provisões e Patrimônio Líquido) e Passivo Total.
- **Necessidade de Capital de Giro (NCG)** — duas visões de NCG e sua variação mensal.
- **Liquidez & Tesouraria** — saldo de tesouraria e os índices de liquidez corrente/imediata/seca.
- **Prazos Médios (Contábil)** — PME, PMR, PMP e Ciclo Financeiro em dias.
- **Estrutura** — Capital de Giro, Dividendos, Investimentos (aprovados/realizados) e Caixa "Líquido".

Abaixo da tabela há o **card de Imobilizado** para cadastro e acompanhamento da depreciação dos bens.

## Colunas e cálculos

Cada linha aparece nas colunas de mês. Abaixo, o significado e o cálculo real de cada linha.

### Topo (DRE do mês)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Receita Líquida | Receita do mês (competência) | Soma dos lançamentos do macro "Receita" no mês, com sinal (RECEITA +, DESPESA −) | `get_balanco_ca` → `bronze_contaazul_lancamentos` × `dre_categoria_macro` |
| Lucro Líquido | Resultado do mês | Soma com sinal de todos os macros até `ordem_macro ≤ 9` da DRE | `get_balanco_ca` |
| CMV | Custo de mercadoria vendida | Valor absoluto da soma (com sinal) do macro "Custo insumos (CMV)" | `get_balanco_ca` |
| CMC | Custo comida/bebidas/drinks | Soma só de lançamentos tipo DESPESA nas categorias CUSTO COMIDA, CUSTO BEBIDAS, CUSTO DRINKS (exclui estornos lançados como RECEITA) | `get_balanco_ca` |

Todos os valores do mês usam **competência entre o 1º e o último dia do mês** e **valor efetivo** = valor pago (se ≠ 0) senão valor bruto.

### ATIVO

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Ativo Circulante | Bens/direitos de curto prazo | Caixa+Investimentos + Contas a Receber + Empréstimos CP + Estoques | Cálculo na tela |
| Caixa + Investimentos | Saldo em caixa e aplicações no dia 31 | Input **manual** (não é sobrescrito pelo snapshot do CA) | `balanco_manual.caixa_investimentos` |
| Contas a Receber | Receitas em aberto no dia 31 | Receitas com competência ≤ fim do mês **e** vencimento > fim do mês | `get_balanco_ca` (bloco `receber`) |
| Empréstimos CP a Receber | Empréstimos de curto prazo a receber | Input **manual** | `balanco_manual.emprestimos_cp_receber` |
| Estoques (CMV) | Estoque final do mês | `estoque_final` da aba **Mensal** do CMV; 0 se o mês não estiver preenchido | `get_estoque_cmv` → `financial.cmv_mensal` |
| Ativo Não Circulante | Bens de longo prazo | = Imobilizado Líquido (Inicial + Reinvestimento) | Cálculo na tela |
| Imobilizado Líquido | Valor contábil dos bens | Soma do valor contábil de cada bem = valor − depreciação acumulada | `get_imobilizado` → `financial.imobilizado_ativos` |
| ATIVO TOTAL | Total do ativo | Ativo Circulante + Ativo Não Circulante | Cálculo na tela |

**Depreciação do imobilizado:** cada bem entra com o valor cheio no mês da compra e deprecia um valor fixo por mês (juros simples) = `valor × taxa_anual ÷ 1200`. A depreciação começa no mês seguinte à compra e dura `1200 ÷ taxa_anual` meses (120 meses para 10% a.a.), com piso de valor contábil em zero.

### PASSIVO

O Passivo Circulante é o total de despesas do Conta Azul **em aberto no dia 31** (competência ≤ fim do mês e vencimento > fim do mês), distribuído em blocos por categoria. **PROVISÃO TRABALHISTA e PROVISÃO FISCAL são excluídas** do total do circulante — viram provisões separadas no Não Circulante.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Passivo Circulante | Dívidas de curto prazo | Soma dos 8 blocos abaixo + Outras (= total de despesas em aberto, exceto provisões) | `get_balanco_ca.pc_total_despesas` |
| Outras Contas a Pagar | Despesas sem bloco definido | Total de despesas em aberto − soma dos 8 blocos | Cálculo na tela |
| Artistas e Produção | Cachês e produção de eventos | Categorias ATRAÇÕES PROGRAMAÇÃO + PRODUÇÃO EVENTOS (em aberto) | `get_balanco_ca.pc_artistas_producao` |
| Fornecedores CMV | Fornecedores de insumos | CUSTO COMIDA + BEBIDAS + DRINKS + OUTROS (em aberto) | `get_balanco_ca.pc_fornecedores_cmv` |
| Adm & Mkt | Administrativo e marketing | MARKETING + ADMINISTRATIVO ORDINÁRIO + ESCRITÓRIO CENTRAL + RECURSOS HUMANOS | `get_balanco_ca.pc_adm_mkt` |
| Despesas Operacionais | Materiais e utensílios de operação | MATERIAIS OPERAÇÃO + LIMPEZA E DESCARTÁVEIS + UTENSÍLIOS + OUTROS OPERAÇÃO + LOCAÇÕES + EQUIPAMENTOS + ACESSÓRIOS SALÃO + sem categoria | `get_balanco_ca.pc_operacionais` |
| Ocupação | Custos de ocupação | LUZ + ÁGUA + INTERNET + ALUGUEL/CONDOMÍNIO/IPTU + MANUTENÇÃO + TENDA + GÁS | `get_balanco_ca.pc_ocupacao` |
| CMO + Comissão | Mão de obra e comissão | SALÁRIO + VALE TRANSPORTE + ADICIONAIS + PRÓ-LABORE + FREELAS (Atend/Bar/Cozinha/Limpeza/Segurança/Brigadista) + ALIMENTAÇÃO + COMISSÃO 10% | `get_balanco_ca.pc_cmo_comissao` |
| Investimentos | Investimentos em aberto | Categorias [Investimento] exceto "Investimento Inicial Abertura do Bar" | `get_balanco_ca.pc_investimentos` |
| Impostos | Impostos em aberto | Categoria IMPOSTO | `get_balanco_ca.pc_impostos` |
| Passivo Não Circulante | Dívidas de longo prazo + PL | Inv. Aprovados a Fazer + Financiamentos LP + Provisões Fiscais + Provisões Trabalhistas + Patrimônio Líquido | Cálculo na tela |
| Investimentos Aprovados a Fazer | Saldo de investimentos aprovados ainda não realizados | Saldo rolante desde **Out/2025**: soma de (Aprovados − Realizados) de cada mês | `get_inv_aprovados_a_fazer` |
| Financiamentos LP | Financiamentos de longo prazo | Input **manual** | `balanco_manual.financiamentos_lp` |
| Provisões Fiscais Eventos | Provisão fiscal em aberto | Categoria PROVISÃO FISCAL em aberto | `get_balanco_ca.provisoes_fiscais` |
| Provisões Trabalhistas | Provisão trabalhista em aberto | Categoria PROVISÃO TRABALHISTA em aberto | `get_balanco_ca.provisoes_trabalhistas` |
| Patrimônio Líquido | Capital próprio (plug) | Ativo Total − Passivo Circulante − (Passivo Não Circulante exceto o próprio PL) | Cálculo na tela |
| PASSIVO TOTAL | Total do passivo | Passivo Circulante + Passivo Não Circulante (deve **igualar** o Ativo Total) | Cálculo na tela |

O **Patrimônio Líquido é o "plug"** do balanço: é calculado como o que falta para o Passivo Total bater com o Ativo Total. Por isso o balanço sempre fecha.

### Necessidade de Capital de Giro (NCG)

| Indicador | O que mostra | Como é calculado |
|---|---|---|
| NCG Contábil / Fornecedores | Capital de giro operacional vs. fornecedores | (Contas a Receber + Empréstimos CP + Estoques) − Fornecedores CMV |
| NCG Contábil / Passivo Circulante | Capital de giro vs. todo o circulante | (Contas a Receber + Empréstimos CP + Estoques) − Passivo Circulante |
| Variação de NCG | Mudança da NCG no mês | NCG/Fornecedores deste mês − do mês anterior na série (0 no 1º mês exibido) |

### Liquidez & Tesouraria

| Indicador | O que mostra | Como é calculado |
|---|---|---|
| Saldo Tesouraria | Dinheiro disponível | = Caixa + Investimentos |
| Liquidez Corrente | Capacidade de pagar o circulante | Ativo Circulante ÷ Passivo Circulante |
| Liquidez Imediata | Cobertura só com caixa | (Caixa + Investimentos) ÷ Passivo Circulante |
| Liquidez Seca | Cobertura sem estoques | (Caixa + Investimentos + Contas a Receber) ÷ Passivo Circulante |

Os índices são exibidos com 2 casas decimais. Se o Passivo Circulante for zero, o índice fica em 0.

### Prazos Médios (Contábil)

| Indicador | O que mostra | Como é calculado |
|---|---|---|
| PME — Estoques (d) | Dias de estoque | Estoques ÷ CMV × 30 |
| PMR — Recebimento (d) | Dias para receber | Contas a Receber ÷ Receita Líquida × 30 |
| PMP — Pagamento (d) | Dias para pagar fornecedores | Fornecedores CMV ÷ CMV × 30 |
| Ciclo Financeiro (d) | Dias que o dinheiro fica "preso" | PME + PMR − PMP |

Exibidos com 1 casa decimal. Quando o denominador é zero, o prazo fica em 0.

### Estrutura

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Capital de Giro | Folga estrutural de longo prazo | Passivo Não Circulante − Ativo Não Circulante | Cálculo na tela |
| Dividendos Pagos | Dividendos do mês | Categoria DIVIDENDOS no mês (competência) | `get_balanco_ca.dividendos_pagos` |
| Investimentos Aprovados | Valor de investimento aprovado no mês | Input **manual** | `balanco_manual.investimentos_aprovados` |
| Investimentos Realizados | Investimento efetivamente gasto no mês | Despesas em categorias [Investimento]% pagas/vencidas no mês | `get_investimentos_realizados` |
| Caixa "Líquido" | Caixa após compromissos de longo prazo | Saldo Tesouraria + Empréstimos CP − (Inv. Aprovados a Fazer + Financiamentos LP + Provisões Fiscais + Provisões Trabalhistas) | Cálculo na tela |

## Filtros e opções

| Filtro / Opção | Efeito |
|---|---|
| **Bar** | Toda a tela é filtrada pelo bar selecionado no seletor global (`bar_id`). Nenhum dado cruza entre bares. |
| **Quantidade de meses** | Define quantas colunas de meses aparecem lado a lado: 3, 6, 8 ou 12. |
| **Mês final / Ano final** | Definem o último mês da janela (coluna mais à direita); os anteriores são preenchidos para trás. |
| **Recolher/expandir seção** | Clique no cabeçalho azul para esconder/mostrar toda a seção macro. |
| **Recolher/expandir bloco** | Clique numa linha-pai (negrito) para esconder suas sublinhas. |
| **Tooltip de fórmula** | Passar o mouse sobre labels sublinhados mostra a fórmula exata da linha. |

## Regras e detalhes importantes

- **"Em aberto" no dia 31:** um lançamento entra no snapshot patrimonial quando tem **competência ≤ fim do mês E vencimento > fim do mês**. Como no bronze a `data_pagamento` costuma ser nula, o vencimento é usado como aproximação do "ainda não pago". Isso pode gerar divergências residuais (~1 mil) em CMC e Despesas Operacionais frente à planilha, que usa a data de pagamento real.
- **Valor efetivo:** todos os blocos do CA usam `valor_pago` quando diferente de zero, senão `valor_bruto`.
- **Sinal:** receita e lucro carregam sinal (RECEITA +, DESPESA −); CMV é o valor absoluto do macro.
- **Filtragem por bar:** todas as funções recebem `bar_id` e filtram por ele; nunca há mistura entre bares.
- **Caixa + Investimentos é 100% manual.** Existe um snapshot mensal automático do saldo do Conta Azul (`saldo_snapshot_mensal`, cron diário às 4h), que é carregado pela API, mas **não** sobrescreve o valor manual — a linha exibida vem do que foi digitado.
- **Patrimônio Líquido é o plug:** é derivado para fechar o balanço, não é um input. Por isso o Passivo Total sempre iguala o Ativo Total.
- **Investimentos Aprovados a Fazer é um saldo rolante** desde Out/2025: acumula, mês a mês, o que foi aprovado (manual) menos o que foi realizado (CA). Depende de você preencher os "Investimentos Aprovados" de cada mês.
- **Provisões separadas:** PROVISÃO TRABALHISTA e PROVISÃO FISCAL não entram no Passivo Circulante — aparecem no Não Circulante como provisões automáticas.
- **Estoque depende do CMV Mensal:** se a aba Mensal do CMV não estiver preenchida para aquele bar/mês, a linha Estoques fica zerada.
- **Imobilizado é remoção lógica:** ao "remover" um bem, ele fica inativo (`ativo=false`) e para de contar; o registro não é apagado.
- **Arredondamentos de exibição:** valores em R$ sem casas decimais, índices de liquidez com 2 casas, prazos em dias com 1 casa.
- **Escrita protegida:** salvar valores manuais e cadastrar/remover imobilizado exige autenticação e a permissão da rota (`financeiro_relatorios`).

## Dúvidas frequentes

**Por que o Passivo Total sempre bate com o Ativo Total?**
Porque o Patrimônio Líquido é calculado como "o que falta" para fechar o balanço. Ele absorve qualquer diferença — é o comportamento contábil correto de um balanço.

**Editei "Caixa + Investimentos" mas ele volta ao valor antigo?**
Não deveria. Esse campo é 100% manual e não é sobrescrito pelo snapshot automático do Conta Azul. Se o valor não persistiu, verifique se salvou (Enter ou ✓) e se tem a permissão de escrita.

**A linha Estoques está zerada. Por quê?**
O estoque vem da aba **Mensal** do CMV daquele bar/mês. Se essa aba não estiver preenchida, a linha fica em zero.

**Qual a diferença entre Imobilizado "Inicial" e "Reinvestimento"?**
Inicial é a base patrimonial de abertura; Reinvestimento são compras novas ao longo do tempo. Ambos depreciam da mesma forma, mas alimentam linhas distintas de controle.

**Por que os números divergem um pouco da minha planilha?**
Porque o "em aberto" aqui usa a data de vencimento como proxy de pagamento (a data de pagamento real não está no bronze). A diferença costuma ser pequena e concentrada em CMC e Despesas Operacionais.

**Como comparo a evolução ao longo do ano?**
Aumente a quantidade de meses (até 12) e ajuste o mês/ano final. As colunas ficam lado a lado, do mais antigo à esquerda ao mais novo à direita.

## Fonte dos dados

- **`get_balanco_ca`** (função SQL) — monta o topo (Receita, Lucro, CMV, CMC), Contas a Receber, os blocos do Passivo Circulante, provisões e dividendos. Lê `bronze.bronze_contaazul_lancamentos` cruzado com `financial.dre_categoria_macro`. Origem: **Conta Azul**.
- **`get_estoque_cmv`** → `financial.cmv_mensal` — estoque final da aba Mensal do CMV.
- **`get_imobilizado`** → `financial.imobilizado_ativos` — valor contábil dos bens após depreciação linear.
- **`get_investimentos_realizados`** → `bronze.bronze_contaazul_lancamentos` — despesas em categorias [Investimento]% pagas/vencidas no mês.
- **`get_inv_aprovados_a_fazer`** — saldo rolante desde Out/2025 usando `financial.balanco_manual.investimentos_aprovados` e `get_investimentos_realizados`.
- **`financial.balanco_manual`** — inputs manuais por bar/ano/mês (Caixa+Investimentos, Empréstimos CP, Financiamentos LP, Investimentos Aprovados, etc.).
- **`financial.saldo_snapshot_mensal`** — snapshot diário do saldo das contas do Conta Azul (carregado pela API, não sobrescreve o campo manual). Origem: **Conta Azul**.
- **`financial.imobilizado_ativos`** — cadastro dos bens depreciáveis.
- **API:** `GET/POST /api/financeiro/balanco` e `GET/POST/DELETE /api/financeiro/balanco/imobilizado`.
