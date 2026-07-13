---
title: Escala
area: rh
slug: escala
route: /rh/escala
description: Grade semanal para planejar os turnos da equipe, marcando quem trabalha, folga ou falta em cada dia.
order: 20
icon: CalendarRange
---

# Escala

## Visão geral

A tela **Escala** é uma grade semanal onde você planeja os turnos da equipe do bar. Cada linha é um funcionário ativo, cada coluna é um dia da semana (segunda a domingo), e cada célula guarda o turno daquele funcionário naquele dia — ou uma marca de **folga** ou **falta**.

É uma ferramenta de planejamento manual, feita para o gestor de operação montar a escala da semana com poucos cliques: clica na célula, escolhe o turno e o horário, salva. Não há cálculo automático de métricas aqui — o que aparece na tela é exatamente o que foi preenchido à mão.

Quem usa no dia a dia: gerentes e coordenadores de salão/cozinha que organizam quem trabalha em cada dia. Para cruzar escala com faturamento use a tela **Escala × Venda** (em Operacional), que é análise; esta aqui é o planejamento.

## Como acessar

No menu lateral: **RH → Escala**.

A tela exige o módulo de permissão **Gestão** (`gestao`). Quem tem acesso apenas de leitura vê a grade normalmente, mas com o selo **Somente leitura** e sem conseguir salvar ou limpar células — as ações de gravação são bloqueadas tanto na interface quanto na API (guard por rota).

## Passo a passo

### Navegar entre semanas

1. Ao abrir, a tela mostra a **semana atual**, começando na segunda-feira.
2. Use as setas **◀** e **▶** no topo (ao lado do intervalo de datas) para ir para a semana anterior ou a próxima. Cada clique pula 7 dias.
3. O botão **Hoje** volta rápido para a semana que contém o dia de hoje.
4. O intervalo exibido (ex.: "07 jul – 13 jul") confirma qual semana está na tela. O dia de hoje aparece destacado em azul.

### Escalar um funcionário num dia

1. Encontre a linha do funcionário e a coluna do dia desejado.
2. Clique na célula. Células vazias mostram um **+** cinza; células já preenchidas mostram o turno atual.
3. No modal que abre (com o nome do funcionário e a data por extenso), preencha:
   - **Turno**: Manhã, Tarde, Noite ou Integral.
   - **Status**: Planejado, Confirmado, Folga ou Falta.
   - **Início** e **Fim**: horários do turno (opcionais).
   - **Observação**: texto livre (opcional).
4. Clique em **Salvar**. A grade recarrega e a célula passa a mostrar o turno.

### Marcar folga ou falta

1. Clique na célula do dia.
2. No campo **Status**, escolha **Folga** ou **Falta**.
3. Salve. A célula passa a mostrar uma etiqueta cinza ("Folga") ou vermelha ("Falta") no lugar do turno.

### Editar ou limpar uma escala

1. Clique numa célula já preenchida — o modal abre com os valores atuais.
2. Ajuste o que precisar e clique em **Salvar** para atualizar, ou
3. Clique em **Limpar** (canto inferior esquerdo do modal, em vermelho) para apagar a escala daquele dia. A célula volta a ficar vazia.

### Filtrar por área

1. No seletor **Todas as áreas** (acima da grade), escolha uma área.
2. A grade passa a mostrar só os funcionários daquela área. O contador ao lado indica quantos funcionários estão sendo exibidos.

## Colunas e cálculos

A grade não calcula números — cada célula reflete diretamente o registro salvo na tabela `hr.escalas`. Abaixo, o que cada elemento da tela mostra e de onde vem.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Funcionário (coluna fixa) | Iniciais (avatar) + nome de cada funcionário ativo do bar, ordenado por nome | Lista de funcionários ativos do bar; iniciais = primeiras letras das 2 primeiras palavras do nome | `hr.funcionarios` (filtro `ativo = true`, `bar_id`) |
| Colunas de dia (Seg…Dom) | Cabeçalho com o dia da semana e o número do dia; segunda a domingo da semana selecionada | Datas geradas a partir da segunda-feira da semana (7 colunas); coluna de hoje é destacada em azul | Cálculo no navegador (não vem do banco) |
| Célula — turno | Etiqueta com o turno (Manhã/Tarde/Noite/Integral) e, se preenchido, o horário `início–fim` | Registro salvo na escala daquele funcionário+dia; horário exibido cortado em HH:MM | `hr.escalas` (`turno`, `hora_inicio`, `hora_fim`) |
| Célula — "Folga" | Etiqueta cinza | Registro com `status = folga` | `hr.escalas` (`status`) |
| Célula — "Falta" | Etiqueta vermelha | Registro com `status = falta` | `hr.escalas` (`status`) |
| Célula vazia (+) | Ícone de mais, indicando que não há escala | Não existe registro para aquele funcionário+dia | — |
| Contador "N funcionário(s)" | Quantos funcionários estão visíveis com o filtro atual | Contagem da lista já filtrada por área | Derivado no navegador |

Observação sobre as cores dos turnos: são apenas visuais (Manhã em âmbar, Tarde em azul-claro, Noite em índigo, Integral em verde) e não afetam nenhum cálculo.

## Filtros e opções

| Filtro / Opção | Efeito |
|---|---|
| **Semana** (setas ◀ ▶ e botão Hoje) | Define qual período de 7 dias (segunda a domingo) é carregado e exibido. Só as escalas dessa janela são buscadas. |
| **Todas as áreas** (seletor) | Restringe a grade aos funcionários de uma área específica. As áreas vêm do cadastro do bar. |
| **Bar selecionado** | Toda a tela responde ao bar ativo no seletor de bar do sistema. Trocar de bar recarrega funcionários e escalas daquele bar. |

## Regras e detalhes importantes

- **Filtragem por bar**: tanto os funcionários quanto as escalas são sempre filtrados pelo `bar_id` do bar selecionado. A tela nunca mistura equipes de bares diferentes, e a gravação confirma que o funcionário pertence ao bar antes de salvar.
- **Um turno por pessoa por dia**: o modelo é MVP — cada funcionário tem no máximo **uma** escala por dia (chave única `funcionario_id + data`). Salvar de novo no mesmo dia **substitui** o registro anterior (upsert), não cria uma segunda linha.
- **Folga e Falta são status**, não turnos separados. O turno continua gravado no registro, mas a célula mostra a etiqueta de folga/falta em vez do turno.
- **Tudo é manual**: não há importação automática de ponto, escala sugerida ou preenchimento por IA. O que está na grade foi digitado por alguém.
- **Só funcionários ativos** aparecem. Quem está inativo no cadastro some da grade (mas escalas antigas continuam no banco).
- **Horários são opcionais**: dá para escalar um turno (ex.: "Noite") sem informar início e fim.
- **Limpar apaga de verdade**: a ação de limpar remove o registro daquele dia. Não é um histórico — a célula simplesmente volta a ficar vazia.
- **Permissão de escrita**: usuários somente leitura conseguem consultar a escala, mas as chamadas de salvar/limpar são recusadas pela API (guard por rota), além do bloqueio visual.

## Dúvidas frequentes

**Posso escalar a mesma pessoa em dois turnos no mesmo dia?**
Não. O modelo atual permite um registro por funcionário por dia. Escolha o turno que melhor representa o dia (inclusive "Integral") ou use a observação para detalhar.

**Marquei "Falta" — isso desconta algo ou avisa alguém?**
Não. Aqui é só o planejamento/registro visual da escala. Não há integração automática com folha, ponto ou alertas a partir desta tela.

**Sumiu um funcionário da grade. Por quê?**
Provavelmente ele está **inativo** no cadastro de funcionários, ou você está com um filtro de **área** ativo. Confira o seletor de áreas e o cadastro em RH → Funcionários.

**A escala da semana passada continua salva?**
Sim. Navegue para trás com a seta ◀ e a semana anterior carrega com o que foi preenchido. Nada é apagado ao trocar de semana.

**Qual a diferença para a tela "Escala × Venda"?**
Esta tela é **planejamento** (quem trabalha em cada dia). A "Escala × Venda" (em Operacional) é **análise**, cruzando presença/escala com o faturamento para medir produtividade.

**Onde defino as áreas que aparecem no filtro?**
As áreas vêm do cadastro do bar (mesma base usada em RH → Funcionários). Só áreas ativas do bar selecionado aparecem no seletor.

## Fonte dos dados

- **`hr.escalas`** — tabela principal: guarda 1 linha por funcionário escalado por dia (turno, status, horários, observação, área), com chave única por `funcionario_id + data` e índice por `bar_id, data`. Origem: preenchimento manual nesta tela.
- **`hr.funcionarios`** — lista de funcionários ativos do bar (nome, área, cargo, tipo de contratação). Origem: cadastro interno de RH.
- **`hr.areas`** — áreas do bar, usadas no filtro. Origem: cadastro interno de RH.

Todos os dados são internos do módulo de RH do Zykor (schema `hr`); não há integração com ContaHub, NIBO, Conta Azul ou outras fontes externas nesta tela.
