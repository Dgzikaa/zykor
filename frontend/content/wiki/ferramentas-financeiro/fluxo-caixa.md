---
title: Fluxo de Caixa
area: ferramentas-financeiro
slug: fluxo-caixa
route: /financeiro/fluxo-caixa
description: Projeta o saldo do caixa dia a dia combinando o saldo atual em conta, as entradas de receita previstas e as contas a pagar em aberto no Conta Azul, para mostrar quando o dinheiro aperta.
order: 100
icon: Wallet
---

# Fluxo de Caixa

## Visão geral

A tela de **Fluxo de Caixa** responde a uma pergunta prática do dia a dia: *"vai faltar dinheiro em algum momento à frente?"*.

Ela pega três coisas e junta em uma projeção diária:

1. **O saldo que você tem hoje em conta** (informado por você ou puxado do Conta Azul).
2. **As entradas previstas** — a receita projetada pelo modelo de previsão de demanda do sistema.
3. **As saídas comprometidas** — as contas a pagar que já estão lançadas e em aberto no Conta Azul, organizadas pela data de vencimento.

Com isso, o sistema monta o **saldo acumulado dia a dia** e mostra num gráfico quando o caixa cai — e, principalmente, se em algum dia ele fica **negativo**. É uma ferramenta de alerta para o dono/gestor financeiro planejar antecipação de recebíveis ou renegociação de pagamentos antes do aperto acontecer.

É uma tela de **leitura e planejamento**: você não cadastra nem edita lançamentos aqui. A única coisa que você digita é o saldo inicial atual em conta.

## Como acessar

No menu lateral: **Ferramentas Financeiro → Fluxo de Caixa**.

A rota é `/financeiro/fluxo-caixa`.

Permissão necessária: o item de menu exige o módulo **`ferramentas financeiro_fluxo_de_caixa`**. Quem tiver a permissão genérica de ferramentas financeiras (`financeiro_ferramentas`) também enxerga a tela, por retrocompatibilidade. A página é protegida por login (`ProtectedRoute`) e sempre opera sobre o **bar selecionado** no seletor de bar.

## Passo a passo

### 1. Informar o saldo atual em conta

1. No campo **"Saldo atual em conta (R$)"**, digite quanto você tem hoje somando suas contas (ex.: `150.000`). O campo aceita valores no formato brasileiro (ponto de milhar, vírgula de centavos).
2. Assim que você digita, a projeção é recalculada automaticamente (com um pequeno atraso de ~0,35s para não recalcular a cada tecla).
3. O valor digitado fica **guardado por bar** no seu navegador — da próxima vez que abrir a tela naquele bar, ele volta preenchido.

### 2. Puxar o saldo direto do Conta Azul

Em vez de digitar na mão, você pode buscar o saldo real das contas:

1. Clique em **"Puxar saldo (CA)"**.
2. O sistema consulta o saldo atual de **todas as contas financeiras ativas** do bar no Conta Azul.
3. O campo de saldo é preenchido com o valor total do **caixa** (contas correntes, caixinhas, meios de recebimento e outros). Aparece um aviso confirmando o valor de caixa e o valor de investimentos separadamente.
4. Se o Conta Azul não estiver conectado, ou o token estiver expirado, aparece um erro pedindo para reconectar.

> Observação: o valor puxado é apenas o **caixa** (dinheiro disponível). Investimentos/aplicações são calculados e mostrados no aviso, mas **não** entram no saldo inicial da projeção.

### 3. Escolher o período de projeção

1. No seletor **"Período"**, escolha **30**, **60** (padrão) ou **90 dias**.
2. A projeção e o gráfico se ajustam ao horizonte escolhido.

### 4. Ler a projeção

1. Os três cards no topo resumem o cenário: saldo final, total a pagar e o menor saldo (o ponto de aperto).
2. Se o caixa ficar negativo em algum dia, aparece uma **faixa vermelha de alerta** indicando a data.
3. O gráfico de linha mostra o saldo dia a dia, com uma **linha vermelha no zero** para você enxergar de imediato quando cruza para o negativo.

## Colunas e cálculos

A tela é composta por três cards de resumo e um gráfico de saldo diário. Não há tabela de linhas exposta na tela — as linhas diárias existem por baixo (uma por dia) e alimentam o gráfico e os totais.

### Cards de resumo

| Card / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Saldo projetado no fim** | Saldo estimado no último dia do período | Saldo acumulado da última linha da projeção = saldo inicial + soma de (entradas − saídas) até o último dia | RPC `financial.fluxo_caixa_real` |
| **A pagar no período (CA)** | Total de contas a pagar comprometidas dentro do horizonte | Soma de todas as **saídas** de todos os dias do período | `bronze.bronze_contaazul_lancamentos` (via RPC) |
| **Menor saldo projetado** | O pior ponto do caixa no período (quando aperta) e em que dia | Menor valor de saldo acumulado entre todos os dias; guarda também a data desse dia | RPC `financial.fluxo_caixa_real` |
| **Alerta de caixa negativo** | Faixa vermelha exibida só quando o menor saldo é abaixo de zero | Aparece se `menor_saldo < 0`; mostra a data do menor saldo | Derivado do menor saldo |

### Série diária (gráfico de linha)

Cada ponto do gráfico corresponde a um dia da projeção. Por baixo, cada dia tem quatro números:

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **dia** | A data do dia projetado | Sequência de datas de hoje até hoje + (dias − 1) | `generate_series` na função SQL |
| **entradas** | Receita prevista para aquele dia | Soma de `receita_prevista` do cenário **base** naquele dia | `financial.fluxo_caixa_previsto` (cenário `base`) |
| **saidas** | Contas a pagar que vencem naquele dia | Soma de `GREATEST(valor_bruto − valor_pago, 0)` das despesas em aberto do CA com vencimento naquele dia | `bronze.bronze_contaazul_lancamentos` |
| **saldo** | Saldo acumulado até aquele dia (linha do gráfico) | `saldo_inicial + soma acumulada de (entradas − saídas)` do primeiro dia até aquele dia | Cálculo da função SQL |

Observações importantes sobre o cálculo das partes:

**Entradas (receita prevista):** vêm da tabela `financial.fluxo_caixa_previsto`, cenário **base** (multiplicador 1.0). Essa tabela é preenchida por um processo separado (edge function `fluxo-caixa-90d`) que projeta 90 dias à frente assim:
- Para cada dia, usa a previsão de faturamento de `gold.demanda_previsoes` (`fat_previsto`) quando existe;
- Quando não há previsão para o dia, usa a **mediana** do faturamento daquele dia da semana nos últimos 90 dias (`gold.desempenho` diário).

Ou seja, as entradas são um **modelo de receita esperada**, não recebíveis já confirmados no banco.

**Saídas (contas a pagar):** são **reais e comprometidas**. Vêm dos lançamentos do Conta Azul do tipo **DESPESA**, ainda **não quitados** (status diferente de `ACQUITTED`), não excluídos e com vencimento **de hoje em diante**. O valor considerado é o **saldo em aberto** de cada conta (valor bruto menos o que já foi pago), nunca negativo. Cada despesa é alocada no dia do seu **vencimento**.

## Filtros e opções

| Filtro / Opção | Efeito |
|---|---|
| **Seletor de bar** (topo do sistema) | Toda a projeção é do bar selecionado. Entradas, saídas e saldo são sempre filtrados por `bar_id`. |
| **Saldo atual em conta (R$)** | Ponto de partida da projeção (o saldo de hoje). Sem ele, o gráfico não aparece — a tela mostra "Informe o saldo atual pra ver a projeção". |
| **Puxar saldo (CA)** | Preenche o saldo atual com o caixa consolidado das contas financeiras do Conta Azul. |
| **Período (30 / 60 / 90 dias)** | Define o horizonte da projeção. Internamente é limitado entre 7 e 120 dias. |

## Regras e detalhes importantes

- **Sempre por bar.** Todas as consultas (entradas, saídas, saldo) filtram por `bar_id` do usuário/bar selecionado. A tela nunca mistura bares.
- **Vencimento, não competência.** As contas a pagar são posicionadas na data de **vencimento** (`data_vencimento`), pois o que importa para o caixa é *quando o dinheiro sai*.
- **Só o que ainda não foi pago.** Despesas já quitadas no Conta Azul (`status = ACQUITTED`) e lançamentos excluídos ficam de fora. Se uma conta foi paga parcialmente, entra apenas o **saldo restante** (`valor_bruto − valor_pago`).
- **Entradas são estimativa, saídas são reais.** As entradas vêm de um modelo de previsão de receita; as saídas são compromissos concretos do Conta Azul. Por isso a tela deixa claro no rodapé: "Entradas = projeção de receita (modelo). Saídas = contas a pagar em aberto no Conta Azul (vencimento)."
- **Saldo inicial é manual (ou puxado do CA).** Ele não é lido automaticamente do banco a cada carga — você informa o valor, ou clica em "Puxar saldo (CA)". Para a projeção bater com a realidade, mantenha esse número atualizado.
- **Investimentos ficam de fora do saldo inicial.** Ao puxar do CA, só o caixa disponível entra na projeção; aplicações/poupança são exibidas à parte apenas como informação.
- **Cartão de crédito é ignorado** no cálculo de saldo do Conta Azul (contas do tipo cartão de crédito, cobranças CA e recebimento fácil por cartão não são somadas).
- **Arredondamento.** Entradas, saídas e saldo diário são arredondados para 2 casas; os cards de resumo são exibidos sem centavos (formato "R$ 150.000").
- **Estado vazio.** Sem saldo informado (ou sem dados), o gráfico não aparece e a tela pede para informar o saldo atual.
- **Dependência da tabela de previsão.** As entradas só aparecem se a tabela `fluxo_caixa_previsto` estiver preenchida para o bar e período (gerada pela rotina de projeção de 90 dias). Se ela estiver vazia, as entradas ficam em zero e a projeção fica só com o saldo inicial menos as contas a pagar.

## Dúvidas frequentes

**As entradas são recebíveis reais que já tenho a receber?**
Não. As entradas são uma *projeção de receita* baseada no modelo de previsão de demanda do bar (previsão de faturamento ou mediana histórica do dia da semana). Elas indicam o que se espera vender, não valores já confirmados no banco. Já as **saídas** são reais — contas a pagar de fato lançadas no Conta Azul.

**Por que o gráfico não aparece?**
Porque falta o saldo atual. Digite o valor no campo "Saldo atual em conta" ou clique em "Puxar saldo (CA)".

**"Puxar saldo (CA)" trouxe um valor diferente do que esperava. Por quê?**
Ele soma apenas as contas de **caixa** ativas (conta corrente, caixinha, meios de recebimento e outros) e ignora cartão de crédito. Investimentos e aplicações aparecem separados no aviso e **não** entram no saldo da projeção.

**A projeção considera contas que já paguei?**
Não. Despesas quitadas no Conta Azul (`ACQUITTED`) e excluídas são desconsideradas. Contas pagas pela metade entram só pelo valor que ainda falta pagar.

**Muda algo se eu trocar de bar?**
Sim. A tela recarrega toda a projeção para o bar selecionado. O saldo digitado também é lembrado separadamente por bar.

**Por que o menor saldo aparece em vermelho com alerta?**
Quando o saldo acumulado de algum dia fica **abaixo de zero**, o caixa fica negativo naquele dia. O sistema destaca o card, mostra a data e sugere antecipar recebíveis ou renegociar pagamentos.

## Fonte dos dados

- **`financial.fluxo_caixa_real`** — função SQL (RPC) que monta a projeção diária (entradas − saídas + saldo acumulado). É o coração da tela, chamado pela rota `/api/financeiro/fluxo-caixa-real`.
- **`financial.fluxo_caixa_previsto`** — tabela com a receita prevista por dia e cenário (a tela usa o cenário `base`). Alimenta as **entradas**. É gerada pela edge function `fluxo-caixa-90d`, que se apoia em:
  - `gold.demanda_previsoes` (previsão de faturamento por data);
  - `gold.desempenho` (histórico diário/semanal para mediana e CMV).
- **`bronze.bronze_contaazul_lancamentos`** — contas a pagar (despesas em aberto) do **Conta Azul**. Alimentam as **saídas** por data de vencimento.
- **`bronze.bronze_contaazul_contas_financeiras`** + API do **Conta Azul** (`/conta-financeira/{id}/saldo-atual`) — usadas pelo botão "Puxar saldo (CA)" para consolidar o saldo de caixa. Via rota `/api/financeiro/contaazul/saldos`.
- **`api_credentials`** — token de acesso do Conta Azul por bar (usado para autenticar a busca de saldos).

Integração de origem: **Conta Azul** (saídas e saldo real) e o modelo interno de **previsão de demanda/desempenho** do próprio Zykor (entradas projetadas).
