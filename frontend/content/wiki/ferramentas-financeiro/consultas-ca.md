---
title: Consultas CA
area: ferramentas-financeiro
slug: consultas-ca
route: /ferramentas/consultas
description: Ferramenta de auditoria que encontra lançamentos do Conta Azul criados com data de competência anterior (retroativos), ajudando a detectar registros que impactam períodos já fechados.
order: 110
icon: FileSearch
---

# Consultas CA

## Visão geral

A tela **Consultas CA** é uma ferramenta de auditoria dos lançamentos financeiros importados do **Conta Azul**. O objetivo dela é responder a uma pergunta específica: *quais lançamentos foram registrados no sistema DEPOIS de uma data, mas com competência (o mês a que o gasto ou receita realmente pertence) ANTERIOR?*

Esses lançamentos são chamados de **retroativos**. Eles são importantes porque, quando alguém cadastra hoje uma despesa que pertence a um mês já encerrado, isso altera relatórios (DRE, CMV, orçamentação) de um período que já tinha sido dado como fechado. A tela ajuda o gestor a caçar esses casos, entender o volume envolvido, ver por qual categoria eles entraram e exportar tudo para conferência.

Quem mais usa: dono, controladoria e quem fecha o mês financeiro, principalmente ao investigar diferenças em relatórios de meses passados.

## Como acessar

No menu lateral: **Ferramentas Financeiro → Consultas CA**.

- Rota: `/ferramentas/consultas`
- Permissão necessária: módulo **`ferramentas financeiro_consultas_ca`**. Quem tiver a permissão genérica `financeiro_ferramentas` também enxerga (retrocompatibilidade).

## Passo a passo

### 1. Fazer uma busca de retroativos

1. Confirme no seletor de bar (topo do sistema) qual bar você quer analisar — a consulta sempre filtra pelo bar selecionado.
2. Em **Data de Criação → Criado após** (campo obrigatório, marcado com `*`), informe a partir de qual data de registro você quer olhar. Ex.: `15/01/2026` para achar tudo que foi lançado no sistema a partir dessa data.
3. Em **Data de Competência → Competência antes de** (campo obrigatório, marcado com `*`), informe até qual competência conta como "período antigo". Ex.: `01/01/2026` para dizer "quero lançamentos cuja competência é anterior a janeiro/2026".
4. (Opcional) Preencha **Criado antes** para limitar a janela de registro por cima, e **Competência após** para definir um piso de competência.
5. (Opcional) Selecione uma ou mais **categorias** (veja a seção de filtros abaixo).
6. (Opcional) Ajuste o **Limite de meses retroativos** para exigir uma distância mínima entre competência e criação.
7. Clique em **Buscar Lançamentos**. O sistema mostra um aviso de sucesso com a quantidade encontrada.

Se faltar algum campo obrigatório, aparece um aviso pedindo para preencher "Criado após" e "Competência antes de".

### 2. Usar o filtro de exemplo

Se estiver na dúvida de como preencher, clique no botão **Exemplo** (canto superior direito do card de filtros). Ele preenche automaticamente: criado após `15/01/2026` e competência antes de `01/01/2026`. Depois é só clicar em **Buscar Lançamentos**.

### 3. Explorar os resultados

1. Veja os quatro **cards de resumo** no topo (Total, Entradas, Saídas, Saldo).
2. Abra o painel **Por Usuário** ou **Por Categoria** para ver a quebra (clique no título para expandir/recolher).
3. Na lista principal, os lançamentos vêm **agrupados por categoria**. Clique no cabeçalho de uma categoria para abrir seus lançamentos.
4. Clique em um lançamento individual para expandir e ver os detalhes completos (ID, tipo, vencimento, data/hora de criação, última atualização etc.).

### 4. Exportar para CSV

1. Após uma busca com resultados, clique em **Exportar CSV** (o botão só aparece quando há dados).
2. O arquivo é baixado com o nome `lancamentos-retroativos-<criado após>-a-<competência antes>.csv`.
3. O CSV usa `;` como separador e vem com BOM UTF-8 (abre corretamente no Excel em pt-BR).

## Abas e seções

A tela não tem abas, mas se organiza em blocos:

- **Card de Filtros** — todos os campos de busca e os botões de ação.
- **Cards de estatísticas** — quatro números-resumo (Total, Entradas, Saídas, Saldo).
- **Por Usuário** e **Por Categoria** — dois painéis recolhíveis de análise. O de Usuário vem aberto por padrão; o de Categoria vem recolhido.
- **Lista de Lançamentos Retroativos** — a lista completa, agrupada por categoria, com expansão por lançamento.

## Colunas e cálculos

### Cards de resumo (topo)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total Encontrado | Quantidade de lançamentos retroativos que passaram no filtro | Contagem dos registros retroativos (`retroativos.length`) | `bronze.bronze_contaazul_lancamentos` |
| Entradas | Soma dos valores das receitas retroativas | Soma de `abs(valor_bruto)` de todos os lançamentos com `tipo = RECEITA`; abaixo mostra a contagem desses lançamentos | idem |
| Saídas | Soma dos valores das despesas retroativas | Soma de `abs(valor_bruto)` de todos os lançamentos com `tipo ≠ RECEITA` (despesas); abaixo mostra a contagem | idem |
| Saldo | Resultado líquido entradas − saídas | `Entradas − Saídas`; fica verde com `+` se positivo, vermelho com `-` se negativo | idem |

### Painel "Por Usuário"

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Usuário | Nome de quem criou o lançamento | Chave do agrupamento `porUsuario` | — |
| (contagem) | Nº de lançamentos do usuário | `stats.count` | — |
| Valor | Soma dos valores do usuário | `stats.valor` | — |

> **Atenção:** hoje este painel vem sempre **vazio**. A API não preenche `porUsuario` (o campo "criado por" retorna nulo, pois essa informação não está disponível na tabela de origem). Trate o painel Por Usuário como indisponível no momento.

### Painel "Por Categoria"

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Categoria | Nome da categoria do lançamento | `categoria_nome` (ou "Sem categoria" quando vazio) | `bronze_contaazul_lancamentos` |
| (contagem) | Nº de lançamentos na categoria | `porCategoria[cat].count` | idem |
| Valor | Soma dos valores da categoria | Soma de `abs(valor_bruto)` dos lançamentos da categoria | idem |

Ordenado do maior valor para o menor.

### Lista de Lançamentos — cabeçalho de grupo (categoria)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Categoria | Nome da categoria (título do grupo) | `categoria_nome` ou "Sem categoria" | `bronze_contaazul_lancamentos` |
| Contador (badge) | Nº de lançamentos no grupo | `count` do grupo | idem |
| Total do grupo | Valor líquido da categoria | Soma: receitas entram como `+abs(valor)` e despesas como `−abs(valor)`. Verde com `+` se resultado ≥ 0, vermelho com `-` se < 0 | idem |

Os grupos são ordenados pelo **valor absoluto** do total (do maior impacto para o menor).

### Lista de Lançamentos — linha individual

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Ícone de status | Pago (verde ✓) ou pendente (relógio âmbar) | `isPaid` = status é `PAGO` ou `LIQUIDADO` | `status` |
| Descrição | Texto do lançamento | `descricao` (ou nome do stakeholder, ou "Sem descrição") | `descricao` / `pessoa_nome` |
| Comp | Data de competência | `data_competencia` formatada em pt-BR | `data_competencia` |
| Criado | Data em que foi registrado no Conta Azul | `data_criacao_ca` formatada em pt-BR | `data_criacao_ca` |
| Stakeholder | Cliente/fornecedor vinculado | `pessoa_nome` | `pessoa_nome` |
| Valor | Valor do lançamento com sinal | `abs(valor_bruto)`; verde `+` se receita, vermelho `-` se despesa | `valor_bruto` |
| Status (badge) | Situação traduzida | `status_traduzido` (ou `status` bruto) | `status_traduzido` / `status` |

### Lista de Lançamentos — detalhes expandidos

| Campo | O que mostra | Fonte |
|---|---|---|
| ID | Identificador do lançamento no Conta Azul | `contaazul_id` |
| Tipo | RECEITA ou despesa | `tipo` |
| Categoria | Categoria do lançamento | `categoria_nome` |
| Stakeholder | Cliente/fornecedor | `pessoa_nome` |
| Data/Hora Criação | Momento exato do registro | `data_criacao_ca` |
| Data Vencimento | Vencimento do lançamento | `data_vencimento` |
| Última Atualização | Momento da última alteração no CA | `data_alteracao_ca` |

## Filtros e opções

| Filtro | Efeito |
|---|---|
| **Bar** (seletor global) | Filtra todos os lançamentos por `bar_id`. Cada bar é analisado isoladamente. Obrigatório ter um bar selecionado. |
| **Criado após** *(obrigatório)* | Só considera lançamentos com `data_criacao_ca` maior ou igual a essa data. |
| **Criado antes** (opcional) | Limita por cima: `data_criacao_ca` menor ou igual a essa data. |
| **Competência antes de** *(obrigatório)* | Só considera lançamentos com `data_competencia` menor ou igual a essa data (o "período antigo"). |
| **Competência após** (opcional) | Piso de competência: `data_competencia` maior ou igual a essa data. Quando preenchido, **desabilita** o campo "Limite de meses retroativos". |
| **Filtrar por Categoria (múltiplas)** | Restringe aos `categoria_nome` selecionados. Segure Ctrl (Windows) / Cmd (Mac) para escolher várias. Botão **📦 Apenas CMV** pré-seleciona as categorias de custo (Custo Bebidas, Comida, Drinks, Outros, em maiúsculas e minúsculas); botão **Limpar** zera a seleção. |
| **Limite de meses retroativos** | Exige uma distância mínima entre competência e criação. `Qualquer` = todos os retroativos (criação depois da competência). Demais opções exigem no mínimo 1 dia, 1 semana, 2 semanas, 1, 2, 3, 6 ou 12 meses de defasagem. |

## Regras e detalhes importantes

- **O que é "retroativo" aqui:** um lançamento entra na lista apenas quando a **data de criação é posterior à data de competência** (`data_criacao_ca > data_competencia`). Lançamentos sem data de criação ou sem competência são descartados. Se você escolher um limite de meses, além de ser posterior, a diferença precisa ser de pelo menos aquele período (o limite é calculado como `meses × 30 dias`, então "1 mês" ≈ 30 dias).
- **Sempre por bar:** a consulta filtra por `bar_id` do bar selecionado. Nunca mistura bares.
- **Fonte é a camada bronze do Conta Azul:** os dados vêm de `bronze.bronze_contaazul_lancamentos`, que é o espelho dos lançamentos sincronizados do Conta Azul. Registros marcados como excluídos (`excluido_em` preenchido) são ignorados.
- **Limite de 500 registros:** a busca traz no máximo 500 lançamentos mais recentes por data de criação (ordenados do mais novo para o mais antigo) e depois aplica o filtro de retroatividade. Em bares com muitos lançamentos no período, refine os filtros (categoria, janela de datas) para não perder registros.
- **Valores sempre em módulo nos totais:** entradas, saídas e as somas por categoria/usuário usam o valor absoluto. O sinal (+/−) é decidido pelo **tipo** (RECEITA vs despesa), não pelo sinal armazenado.
- **Competência × vencimento × criação:** a tela cruza *competência* (período contábil do lançamento) com *criação* (quando foi digitado no CA). Vencimento e pagamento aparecem só como informação nos detalhes, não entram no critério de retroatividade.
- **Painel "Por Usuário" indisponível:** como o "criado por" não vem da origem, esse painel fica vazio hoje.
- **Estado vazio:** se nenhum lançamento passar no filtro, a lista mostra "Nenhum lançamento retroativo encontrado" com sugestão de ajustar as datas.
- **Nada é editado por aqui:** a tela é somente leitura/auditoria. Não cria, não aprova, não altera lançamentos — apenas consulta e exporta.

## Dúvidas frequentes

**O que exatamente é um lançamento retroativo?**
É um lançamento cuja competência (mês a que ele pertence) é anterior à data em que ele foi criado no Conta Azul. Ou seja, alguém registrou hoje algo de um período passado.

**Por que isso importa?**
Porque mexe em relatórios de meses já fechados (DRE, CMV, orçamentação). Encontrar esses lançamentos ajuda a explicar diferenças que "apareceram do nada" em um período antigo.

**Por que o painel "Por Usuário" está vazio?**
A informação de quem criou o lançamento não está disponível na tabela de origem, então o painel não é preenchido no momento.

**Estou vendo menos lançamentos do que esperava. Por quê?**
A busca traz no máximo 500 registros por vez (os mais recentes por data de criação). Se o período for muito grande, filtre por categoria ou reduza a janela de datas.

**Como pego só os custos de CMV?**
Clique no botão **📦 Apenas CMV** no filtro de categorias — ele já seleciona as categorias de custo de bebidas, comida, drinks e outros.

**O botão "Exemplo" apaga meus filtros?**
Ele sobrescreve as datas com um exemplo pronto (criado após 15/01/2026, competência antes de 01/01/2026) e limpa os campos opcionais de data. Use só para experimentar.

## Fonte dos dados

- **Tabela:** `bronze.bronze_contaazul_lancamentos` — camada bronze dos lançamentos financeiros sincronizados do **Conta Azul** (receitas e despesas).
- **Endpoint da tela:** `GET /api/financeiro/contaazul/consultas/lancamentos-retroativos` (lê a tabela acima com service role, filtra por `bar_id`, datas e categoria, e calcula a retroatividade em memória).
- **Integração de origem:** Conta Azul (via sincronização que popula a camada bronze).
