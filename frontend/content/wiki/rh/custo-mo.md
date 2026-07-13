---
title: Custo de Mão de Obra
area: rh
slug: custo-mo
route: /rh/custo-mo
description: Consolida, por dia e por evento, o custo real dos freelas com o custo estimado da equipe fixa escalada, dando a visão do gasto de pessoal do mês.
order: 60
icon: Coins
---

# Custo de Mão de Obra

## Visão geral

A tela **Custo de Mão de Obra** mostra, dia a dia dentro de um mês, quanto o bar gastou (ou vai gastar) com equipe. Ela junta duas fontes de custo:

- **Freelas (real):** o valor efetivo das diárias de freelancers convocados e que confirmaram ou compareceram.
- **Fixo escalado (estimado):** uma aproximação do custo da equipe fixa (funcionários registrados) que estava escalada em cada dia, calculada a partir do salário base.

O objetivo é dar ao dono/gestor uma leitura rápida do gasto de pessoal por dia e por evento, cruzando com a agenda de eventos do bar. É uma ferramenta de acompanhamento gerencial — **não é folha de pagamento nem cálculo contábil oficial**. O número do fixo é uma estimativa (salário ÷ 30), servindo para comparar dias/eventos, não para fechar o mês com a contabilidade.

Usam essa tela principalmente gestores de operação e o dono, para entender em quais dias/eventos o custo de equipe pesa mais.

## Como acessar

No menu lateral: **RH → Custo de MO** (ícone de moedas).

- Rota: `/rh/custo-mo`.
- Permissão necessária: módulo **`gestao`** (a mesma de todo o RH). Quem não tem essa permissão não vê o item no menu e é bloqueado pelo guard da rota.
- A tela sempre trabalha no contexto do **bar selecionado** no topo do sistema. Trocar de bar recarrega os números daquele bar.

## Passo a passo

**1. Escolher o mês**

Ao abrir, a tela já vem no mês atual. No canto superior direito do cabeçalho verde há um seletor de mês (campo tipo "mês/ano"). Clique nele e escolha o mês desejado. A tabela e os cards de resumo recarregam automaticamente para o período selecionado (do dia 1 ao último dia do mês).

**2. Ler o resumo do mês**

Logo abaixo do cabeçalho aparecem três cartões (KPIs) com o total do mês: **Freelas (real)**, **Fixo escalado (est.)** e **Total do mês**. Eles somam todos os dias do período.

**3. Analisar dia a dia**

Na tabela, cada linha é um dia com movimento de escala ou freela. Os dias vêm ordenados do mais recente para o mais antigo. Para cada dia você vê o evento associado (se houver), o custo de freelas, quantas pessoas fixas estavam escaladas, o fixo estimado e o total do dia.

**4. Trocar de bar**

Se você opera mais de um bar, troque o bar no seletor do topo do sistema. A tela recarrega com os dados do novo bar.

> Observação: esta tela é **somente leitura**. Não há botões de exportar, editar, aprovar ou cadastrar aqui. Os freelas são lançados na tela **RH → Freelas**, as escalas na tela **RH → Escala**, e os salários no cadastro de **RH → Funcionários** — esta tela apenas consolida esses dados.

## Colunas e cálculos

Cabeçalho e cards de resumo (totais do mês):

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Freelas (real) — card | Soma no mês do custo real de todos os freelas confirmados/comparecidos | Soma de `valor_diaria` de todas as convocações do período com status `confirmado` ou `compareceu` | `hr.freela_convocacao` |
| Fixo escalado (est.) — card | Soma no mês da estimativa de custo da equipe fixa escalada | Soma do fixo estimado de cada dia (ver linha "Fixo est." abaixo) | `hr.escalas` + `hr.funcionarios` |
| Total do mês — card | Custo total de mão de obra do mês | Freelas (real) + Fixo escalado (est.) do mês | Cálculo na API |

Colunas da tabela (uma linha por dia):

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data do dia, com dia/mês e abreviação do dia da semana (ex.: `12/07 · sáb`) | Formatação da data do registro | `hr.freela_convocacao` / `hr.escalas` |
| Evento | Nome do evento daquele dia, se houver programação | Primeiro evento encontrado com `data_evento` igual ao dia; se não houver, mostra "—" | `operations.eventos_base` (campo `nome`) |
| Freelas | Custo real dos freelas do dia; entre parênteses, a quantidade de freelas (quando maior que zero) | Soma de `valor_diaria` das convocações do dia com status `confirmado`/`compareceu`; contador incrementa 1 por convocação | `hr.freela_convocacao` |
| Escalados | Quantidade de funcionários fixos escalados no dia | Conta 1 por registro de escala do dia, **exceto** status `folga` e `falta` | `hr.escalas` |
| Fixo est. | Estimativa de custo da equipe fixa escalada no dia | Para cada funcionário escalado (fora folga/falta): `salario_base ÷ 30`; somado no dia e arredondado a 2 casas | `hr.escalas` + `hr.funcionarios` (`salario_base`) |
| Total | Custo total de mão de obra do dia | Freelas do dia + Fixo est. do dia, arredondado a 2 casas | Cálculo na API |

Observações de exibição:
- Valores zerados aparecem como travessão ("–") em vez de "R$ 0,00".
- "Escalados" mostra "–" quando não há ninguém escalado no dia.
- O nome do evento é truncado se for muito longo.

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| Seletor de mês (cabeçalho) | Define o período. A tela sempre considera do dia 1 ao último dia do mês escolhido. Recarrega os dados ao mudar. |
| Bar selecionado (topo do sistema) | Todos os dados são filtrados pelo bar ativo (`bar_id`). Freelas, escalas, funcionários e eventos são sempre do bar selecionado. |

Não há filtro por evento, por funcionário, por categoria de custo nem toggles adicionais nesta tela.

## Regras e detalhes importantes

- **Filtragem por bar:** freelas, escalas, funcionários e eventos são todos restritos ao `bar_id` do bar selecionado. A tela nunca mistura bares.
- **Freelas — quais entram:** apenas convocações com status **`confirmado`** ou **`compareceu`**. Convocações canceladas, recusadas ou ainda pendentes **não** entram no custo. O valor usado é o `valor_diaria` acordado da convocação.
- **Fixo é estimativa, não folha:** o custo do fixo usa `salário base ÷ 30` por funcionário escalado no dia. Isso é uma aproximação de "custo-dia" e **não** inclui encargos, benefícios, horas extras, adicionais ou proporcionais de férias/13º. Serve para comparar dias e eventos, não para fechamento contábil.
- **Folga e falta não custam (na estimativa):** funcionários com escala marcada como `folga` ou `falta` são ignorados tanto na contagem de escalados quanto no fixo estimado.
- **Um dia só aparece se tiver movimento:** só entram na tabela os dias que tiveram ao menos um freela (confirmado/comparecido) ou ao menos uma escala. Dias sem escala e sem freela não geram linha.
- **Evento por dia:** cada dia mostra apenas um nome de evento — o primeiro encontrado para aquela data. Se houver mais de um evento no mesmo dia, os demais não aparecem no rótulo.
- **Arredondamento:** o fixo estimado, o total de cada dia e os totais do mês são arredondados para 2 casas decimais.
- **Ordenação:** a tabela lista do dia mais recente para o mais antigo dentro do mês.
- **Estado vazio:** se não houver escala nem freela no mês, aparece a mensagem "Sem escala/freelas nesse mês.".
- **Somente leitura:** nada é lançado ou editado aqui; a origem dos dados são as telas de Freelas, Escala e Funcionários.

## Dúvidas frequentes

**O total bate com a folha de pagamento?**
Não. O fixo é uma estimativa (salário ÷ 30 por dia escalado) sem encargos, benefícios ou horas extras. Use esta tela para comparar o peso de pessoal entre dias/eventos, não para conferir a folha.

**Por que um dia com equipe trabalhando não aparece?**
O dia só aparece se houver escala registrada (fora folga/falta) ou freela confirmado/comparecido no período. Se a escala não foi lançada em **RH → Escala**, o dia não entra.

**Um freela que convoquei não está somando. Por quê?**
Provavelmente o status da convocação ainda não é `confirmado` nem `compareceu` (pode estar pendente, recusado ou cancelado). Só esses dois status entram no custo. Ajuste na tela **RH → Freelas**.

**O fixo estimado está diferente do que esperava.**
Ele depende do `salário base` cadastrado em **RH → Funcionários** e de quem estava escalado no dia. Funcionário sem salário base cadastrado entra como zero, e quem está em folga/falta não é contado.

**Consigo exportar para Excel?**
Não há exportação nesta tela. Ela é de consulta.

**Por que o dia mostra um evento que não é o que aconteceu?**
A tela usa o primeiro evento cadastrado para aquela data em `operations.eventos_base`. Se houver mais de um evento no mesmo dia, só o primeiro aparece no rótulo.

## Fonte dos dados

A tela é montada pela rota de API `/api/rh/custo-mo`, que consulta em paralelo (tudo filtrado por `bar_id` e pelo período):

- **`hr.freela_convocacao`** — convocações de freelas: `data`, `valor_diaria`, `status` (usa apenas `confirmado`/`compareceu`). Origem: módulo de RH / Freelas do próprio Zykor.
- **`hr.escalas`** — escala da equipe fixa: `data`, `funcionario_id`, `status` (ignora `folga`/`falta`). Origem: módulo de Escala do Zykor.
- **`hr.funcionarios`** — cadastro de funcionários: `id`, `salario_base` (usado para estimar o custo-dia). Origem: módulo de Funcionários do Zykor.
- **`operations.eventos_base`** — agenda de eventos: `data_evento`, `nome` (rótulo do evento por dia).

Não há integração externa (ContaHub, NIBO, Conta Azul, Stone etc.) alimentando esta tela — todos os dados vêm dos módulos internos de RH e da base de eventos do Zykor.
