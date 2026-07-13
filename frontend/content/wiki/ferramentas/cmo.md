---
title: CMO — Mão de Obra
area: ferramentas
slug: cmo
route: /ferramentas/cmo
description: Simula, acompanha e compara o Custo de Mão de Obra (CMO) semanal do bar — freelas, equipe fixa, alimentação e pró-labore — e mede a produtividade da folha sobre o faturamento.
order: 40
icon: Users
---

# CMO — Mão de Obra

## Visão geral

O CMO (Custo de Mão de Obra) é a ferramenta para **planejar, medir e controlar quanto o bar gasta com gente** a cada semana. Ela junta os quatro componentes que formam o custo de pessoal — **freelas, equipe fixa (CLT/PJ), alimentação da equipe (CMA) e pró-labore dos sócios** — e devolve um número único: o CMO Total da semana.

Além do valor em reais, a tela também mostra a **produtividade da folha** em base mensal: quanto o custo de mão de obra representa do faturamento (CMO %) e quanto custa a mão de obra por cliente atendido.

Quem usa no dia a dia: **gestão e sócios**. Serve para simular o custo antes de fechar a escala da semana, comparar semanas, receber alertas quando o CMO estoura a meta e acompanhar a evolução ao longo do ano.

## Como acessar

No menu lateral: **Ferramentas → CMO - Mão de Obra** (`/ferramentas/cmo`).

A tela exige a permissão de módulo **`gestao`**. Usuários sem esse módulo não veem o item no menu nem conseguem abrir a rota. O bar sempre vem do bar selecionado no topo (contexto de bar) — todos os cálculos são filtrados por `bar_id`.

## Passo a passo

### 1. Simular o CMO de uma semana
1. Abra a aba **Simulador**.
2. No card **Selecionar Período**, escolha o **Ano** e a **Semana**. As datas de início (segunda) e fim (domingo) são preenchidas automaticamente pelo padrão de semana ISO.
3. Clique em **Buscar Freelas + CMA** para puxar automaticamente o valor de freelas da semana a partir dos lançamentos financeiros (ver "Regras e detalhes").
4. Ajuste manualmente, se necessário, os campos **Freelas**, **CMA - Alimentação** e **Pró-Labore Mensal**.
5. No card **Funcionários Fixos**, clique em **Adicionar Funcionário** e preencha nome, tipo (CLT/PJ), área, dias trabalhados, salário bruto, vale-transporte, adicional e aviso prévio. O custo semanal de cada um é calculado na hora.
6. Acompanhe o **CMO Total** somando os quatro componentes no card de resultado.
7. Clique em **Salvar Simulação** para gravar a semana.

### 2. Definir uma meta e ver alertas
1. Ainda no Simulador, preencha **Meta CMO Semanal**.
2. Se o CMO Total ultrapassar a meta, o card fica vermelho e mostra o quanto passou (em R$ e %).
3. Salve a simulação para que o sistema possa gerar alertas.

### 3. Travar uma simulação
1. Depois de salvar, clique em **Travar Simulação**.
2. Com a simulação travada, todos os campos ficam bloqueados para edição (aparece o selo "Simulação Travada"). Use isso para congelar a semana já fechada.
3. Para editar de novo, clique em **Destravar Simulação**.

### 4. Acompanhar a evolução (Dashboard)
1. Abra a aba **Dashboard**.
2. No topo aparecem os indicadores de **produtividade mensal** (CMO %, custo por cliente, split fixo/variável).
3. Abaixo, escolha o **Ano** e ajuste a **Meta CMO** para ver os KPIs semanais, o gráfico de evolução e a composição por componente.

### 5. Comparar duas semanas
1. Abra a aba **Comparar**.
2. Selecione **Semana 1 (mais recente)** e **Semana 2 (anterior)**.
3. Veja a diferença em cada componente e a lista de funcionários adicionados/removidos entre as duas semanas.

### 6. Gerenciar alertas
1. Abra a aba **Alertas**.
2. Clique em **Verificar Novos Alertas** para o sistema checar quais semanas passaram da meta e criar os alertas.
3. Filtre por Todos / Pendentes / Enviados e clique em **Marcar como Enviado** quando o alerta já tiver sido tratado.

### 7. Consultar o histórico
1. Abra a aba **Histórico**.
2. Filtre por ano. Cada semana salva aparece com os componentes, a variação vs. a semana anterior, o selo de travada e a trilha de auditoria (quem criou, atualizou e travou).

## Abas e seções

| Aba | O que faz |
|---|---|
| **Simulador** | Monta o CMO da semana: escolhe período, puxa freelas, cadastra funcionários fixos, informa CMA e pró-labore, define meta, salva e trava a simulação. |
| **Dashboard** | Combina a **Produtividade da Mão de Obra** (mensal: CMO %, custo/cliente, fixo vs. variável) com o **painel semanal** em R$ (CMO médio, tendência, aderência à meta, gráficos de evolução e composição). |
| **Comparar** | Confronta duas semanas salvas lado a lado, componente por componente, e detecta mudanças na equipe. |
| **Alertas** | Lista os alertas de CMO acima da meta, com valores, mensagem e controle de "enviado/pendente". |
| **Histórico** | Linha do tempo das simulações salvas no ano, com variação semana a semana e auditoria. |

## Colunas e cálculos

### Componentes do CMO (Simulador / Dashboard / Histórico / Comparar)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Freelas** | Gasto com freelancers da semana | Preenchido manual ou puxado pelo botão "Buscar Freelas + CMA": soma de `valor_bruto` dos lançamentos do bloco **Mão-de-Obra** com categoria começando por `FREELA`, no período da semana | `silver.lancamento_classificado` (Conta Azul → silver) |
| **Fixos (Total)** | Custo semanal da equipe fixa | Soma do **Custo Semanal** de todos os funcionários cadastrados no simulador | Cálculo em `calculos-folha.ts` |
| **Alimentação (CMA)** | Custo de alimentação da equipe | Valor manual informado no campo CMA. **Não** é buscado automaticamente (alimentação não é considerada mão de obra pelo botão automático) | Campo manual (aba CMA Semanal) |
| **Pró-Labore (semanal)** | Parte semanal do pró-labore dos sócios | `pró-labore mensal ÷ 30 × 7` | Campo manual (pró-labore mensal) |
| **CMO Total** | Custo total de mão de obra da semana | `Freelas + Fixos + Alimentação + Pró-Labore semanal` | Soma dos 4 componentes |
| **Meta CMO** | Limite de custo definido pelo gestor | Valor manual (padrão sugerido: R$ 45.000) | Campo manual |
| **Acima da meta** | Sinaliza estouro da meta | `CMO Total > Meta`; o excedente = `CMO Total − Meta`, e o % = `(CMO − Meta) ÷ Meta × 100` | Cálculo na tela |

### Custo por funcionário fixo (Simulador)

O custo de cada funcionário depende do tipo de contratação:

| Campo | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Salário Bruto** | Salário base informado | Entrada manual | Campo |
| **Vale Transporte / Adicional / Aviso Prévio** | Acréscimos ao custo (só CLT) | Entradas manuais | Campos |
| **Dias Trabalhados** | Dias da semana (padrão 7) | Entrada manual; vira proporção `dias ÷ 30` | Campo |
| **Custo Semanal (PJ)** | Custo do PJ na semana | `salário bruto × (dias ÷ 30)` — sem encargos | `calculos-folha.ts` |
| **Custo Semanal (CLT)** | Custo cheio do CLT na semana | `custo empresa × (dias ÷ 30)`, onde **custo empresa** = `salário bruto + vale transporte + adicional + aviso prévio + FGTS(8%) + INSS patronal(20%) + produtividade(R$ 5,00 fixo)` | `calculos-folha.ts` |

> Os percentuais de **FGTS (8%)** e **INSS patronal (20%)** são os padrões da biblioteca de folha e podem ser parametrizados por bar (`bar_regras_negocio`). A produtividade entra como um bônus fixo de R$ 5,00 por CLT, conforme a planilha original de cálculo de salários.

### Produtividade da Mão de Obra (Dashboard — cards e tabela mensal)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **CMO % do faturamento** | Peso da mão de obra na receita | `cmo_total ÷ faturamento_líquido × 100`. Cores: ≤25% verde, ≤35% âmbar, >35% vermelho | `gold.cmo_produtividade_mensal` |
| **Custo MO / cliente** | Custo de mão de obra por cliente | `cmo_total ÷ pessoas` | `gold.cmo_produtividade_mensal` |
| **Fixo (salário/encargos)** | Parte fixa da folha no mês | Soma de `valor_bruto` dos lançamentos de Mão-de-Obra **não** começando por `FREELA`; card mostra também `% do CMO` = `cmo_fixo ÷ cmo_total × 100` | `gold.cmo_produtividade_mensal` |
| **Variável (freela)** | Parte variável (freelas) no mês | Soma de `valor_bruto` das categorias `FREELA%`; card mostra `100 − % fixo` | `gold.cmo_produtividade_mensal` |
| **CMO (tabela)** | Custo total do mês | `cmo_fixo + cmo_variavel` (todos os lançamentos de Mão-de-Obra do mês) | `gold.cmo_produtividade_mensal` |
| **Faturamento (tabela)** | Faturamento líquido do mês | Soma de `faturamento_liquido_r` das vendas diárias do mês | `silver.vendas_diarias` |

> A tabela mensal só exibe os meses **fechados** — aqueles que já têm faturamento (CMO % não nulo). O card de referência usa o último mês fechado do ano.

### KPIs semanais do Dashboard

| Indicador | O que mostra | Como é calculado |
|---|---|---|
| **CMO Médio** | Média das semanas do ano filtrado | `soma dos CMO Total ÷ nº de semanas` |
| **Tendência** | Se o CMO está subindo/descendo | Compara as duas semanas mais recentes (subindo = mais recente > anterior, marcado em vermelho) |
| **Aderência à Meta** | % de semanas dentro da meta | `100 − (semanas acima da meta ÷ total × 100)` |
| **Última Semana** | CMO da semana mais recente | Valor da última semana salva + nº de funcionários |
| **Média por Componente / Distribuição** | Média de cada componente e seu peso | Média de cada componente nas semanas; `% = média do componente ÷ CMO médio × 100` |

### Comparar (variações entre duas semanas)

| Indicador | O que mostra | Como é calculado |
|---|---|---|
| **CMO Total / componentes** | Valor de cada semana e a diferença | `valor1 − valor2`; variação `%` = `(valor1 − valor2) ÷ valor2 × 100`. Aumento = vermelho, queda = verde |
| **Funcionários NOVO / REMOVIDO** | Quem entrou ou saiu | Cruzamento por **nome** do funcionário entre as duas semanas |
| **Impacto Fixos / nº Funcionários** | Efeito das mudanças de equipe | Diferença de `fixos_total` e da contagem de funcionários |

### Alertas

| Campo | O que mostra | Como é calculado / origem |
|---|---|---|
| **CMO Real** | CMO da semana que estourou | `valor_cmo` do alerta |
| **Meta** | Meta vigente na semana | `valor_meta` do alerta |
| **Diferença** | Quanto passou da meta | `valor_cmo − valor_meta` |
| **Variação** | % acima da meta | `percentual_diferenca` |
| **Enviado / Pendente** | Status de tratamento | Flag `enviado` do alerta |

## Filtros e opções

- **Bar (seletor no topo):** define de qual bar vêm todos os dados. Todas as consultas filtram por `bar_id`; nunca há mistura entre bares.
- **Ano** (Simulador, Dashboard, Histórico): filtra as semanas/meses do ano escolhido. As opções vão de dois anos atrás até dois à frente.
- **Semana** (Simulador): seleciona a semana ISO (1 a 53) a simular.
- **Meta CMO** (Simulador e Dashboard): valor de referência. No Dashboard é só de exibição/comparação; no Simulador dispara o alerta visual e é salvo com a semana.
- **Buscar Freelas + CMA** (Simulador): puxa o valor de freelas do financeiro para a semana selecionada.
- **Travar / Destravar** (Simulador): bloqueia/desbloqueia a edição de uma simulação salva.
- **Filtro de status** (Alertas): Todos / Pendentes / Enviados.

## Regras e detalhes importantes

- **Sempre por bar:** todo cálculo é filtrado por `bar_id` (Ordinário = 3, Deboche = 4).
- **Semana = ISO (segunda a domingo):** a semana e o intervalo de datas seguem o padrão ISO 8601. A data de início é a segunda-feira e a fim é o domingo.
- **Freelas automático ≠ CMA:** o botão "Buscar Freelas + CMA" traz **apenas freelas** (categorias `FREELA%` do bloco Mão-de-Obra). A **alimentação (CMA)** é sempre manual — o sistema não a considera mão de obra para efeito de busca automática.
- **Competência mensal na produtividade:** a base mensal (`gold.cmo_produtividade_mensal`) agrupa os lançamentos por **mês de competência** (`data_competencia`), e o faturamento por **mês da data gerencial** (`dt_gerencial`). Lançamentos ignorados (`is_ignorado = true`) ficam de fora.
- **Fixo × Variável (mensal):** na visão de produtividade, "variável" = categorias `FREELA%`; "fixo" = todo o resto do bloco Mão-de-Obra (salários, encargos, etc.). Isso é diferente do "Fixos" do simulador, que é o custo calculado dos funcionários cadastrados manualmente.
- **PJ não tem encargos:** funcionários PJ entram pelo valor cheio, proporcional aos dias. CLT recebe FGTS, INSS patronal e produtividade por cima.
- **Proporção 30 dias:** tanto o custo do funcionário quanto o pró-labore usam base de 30 dias (`dias ÷ 30`).
- **Simulação travada:** congela a edição. Serve para fechar a semana; ainda pode ser destravada.
- **Auditoria e versões:** o histórico guarda quem criou, atualizou e travou cada semana, além de versionar as mudanças (view `vw_cmo_historico_completo` sobre `cmo_semanal_historico`).
- **Estados vazios:** sem dados no ano, cada aba mostra mensagem de "nenhum dado/simulação encontrado". A produtividade mostra "Sem dados de produtividade" quando não há mês fechado.
- **Manual vs. automático:** freelas pode ser automático; CMA, pró-labore, meta e a equipe fixa são sempre manuais. A produtividade mensal é 100% automática (vem do financeiro e das vendas).
- **Arredondamentos:** valores em reais na tela geralmente são exibidos sem centavos; os cálculos da base mensal são arredondados a 2 casas. O freela automático é arredondado a 2 casas.

## Dúvidas frequentes

**Por que o "Fixos" do Simulador é diferente do "Fixo" da Produtividade?**
São conceitos distintos. No Simulador, "Fixos" é o custo calculado dos funcionários que você cadastra manualmente na semana. Na Produtividade (mensal), "Fixo" é tudo que não é freela dentro do bloco Mão-de-Obra do financeiro (salários, encargos, etc.).

**O botão "Buscar Freelas + CMA" não trouxe a alimentação. Está com erro?**
Não. Apesar do nome, ele traz apenas os freelas. A alimentação (CMA) deve ser informada manualmente — ela não é tratada como mão de obra na busca automática.

**De onde vem o valor de freelas puxado automaticamente?**
Dos lançamentos financeiros classificados como Mão-de-Obra e categoria iniciada por "FREELA", somados pela data de competência dentro da semana. A origem é o Conta Azul, já processado na camada silver.

**Como o CMO % é calculado?**
É o custo total de mão de obra do mês dividido pelo faturamento líquido do mês, em percentual. Verde até 25%, âmbar até 35%, vermelho acima disso.

**Travei a simulação por engano. Consigo editar de novo?**
Sim. Clique em "Destravar Simulação" no Simulador para liberar os campos.

**Por que alguns meses não aparecem na tabela de produtividade?**
Só aparecem meses fechados (que já têm faturamento registrado). Meses sem vendas lançadas ficam ocultos.

## Fonte dos dados

- **`gold.cmo_produtividade_mensal`** (view gold) — base da produtividade mensal (CMO %, custo/cliente, fixo vs. variável). Deriva de:
  - **`silver.lancamento_classificado`** — lançamentos financeiros do bloco "Mão-de-Obra" (origem: **Conta Azul** → camada silver). Também alimenta o botão de freelas automático.
  - **`silver.vendas_diarias`** — faturamento líquido e número de pessoas por dia (origem: **ContaHub**).
- **`cmo_semanal`** — simulações semanais salvas (freelas, fixos, CMA, pró-labore, CMO total, meta, travamento).
- **`cmo_semanal_historico` / `vw_cmo_historico_completo`** — versões e auditoria das simulações (usado nas abas Histórico, Dashboard e Comparar).
- **Alertas de CMO** — registros de semanas acima da meta (aba Alertas).
- **`calculos-folha.ts`** (frontend) — motor de cálculo do custo por funcionário (FGTS, INSS patronal, produtividade, proporção semanal). Parametrizável por `bar_regras_negocio`.
