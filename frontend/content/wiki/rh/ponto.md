---
title: Ponto
area: rh
slug: ponto
route: /rh/ponto
description: Grade semanal de ponto por funcionário, com entrada/saída manual por dia e cálculo automático do banco de horas.
order: 40
icon: Clock
---

# Ponto

## Visão geral
A tela **Ponto & Banco de Horas** é uma grade semanal que mostra, para cada funcionário ativo do bar, quantas horas ele trabalhou em cada dia da semana e o saldo (positivo ou negativo) frente às horas previstas. É uma ferramenta de lançamento e controle **manual** de jornada: o gestor abre uma célula (funcionário × dia), informa entrada, saída, intervalo e horas previstas, e o sistema calcula automaticamente as horas trabalhadas e o saldo do dia e da semana.

Serve para o dia a dia do RH e da gerência acompanharem jornada, horas extras e faltas de forma simples, sem depender de relógio de ponto. O mesmo registro que essa tela grava também pode ser alimentado pela integração de ponto eletrônico (Tangerino), então ela funciona tanto como lançamento puramente manual quanto como conferência/ajuste do que veio do relógio.

## Como acessar
No menu lateral: **RH → Ponto** (ícone de relógio).

A rota é `/rh/ponto` e exige o módulo de permissão **gestao**. Usuários sem permissão de escrita nesse módulo enxergam a tela em modo **somente leitura** (aparece o selo "Somente leitura" no cabeçalho) — conseguem visualizar a grade e os saldos, mas as ações de salvar e limpar são bloqueadas no servidor.

## Passo a passo

### 1. Navegar pelas semanas
1. Ao abrir, a tela mostra a **semana atual** (de segunda a domingo).
2. Use as setas **‹** e **›** no cabeçalho para ir para a semana anterior ou seguinte.
3. O intervalo de datas exibido no meio das setas (ex.: "07 jul – 13 jul") confirma a semana carregada.
4. Clique em **Hoje** para voltar rapidamente à semana corrente.

### 2. Filtrar por área
1. No seletor **"Todas as áreas"**, escolha uma área (cozinha, salão, bar, etc.).
2. A grade passa a mostrar apenas os funcionários daquela área.
3. O contador ao lado (ex.: "12 funcionário(s)") reflete quantos aparecem no filtro atual.

### 3. Lançar ou editar um ponto
1. Localize a linha do funcionário e a coluna do dia desejado.
2. Clique na célula. Uma célula ainda sem registro mostra um pequeno **+**.
3. No modal que abre (com o nome do funcionário e a data por extenso), preencha:
   - **Entrada** e **Saída** (campos de hora).
   - **Intervalo (min)** — minutos de pausa a descontar (padrão 0).
   - **Previstas (h)** — jornada prevista para o dia (padrão 8, aceita meia hora, ex.: 6,5).
   - **Observação** — texto livre opcional.
4. Clique em **Salvar**. A grade recalcula as horas e o saldo na hora.

### 4. Limpar um registro
1. Clique na célula que já tem um registro.
2. No modal, clique em **Limpar** (botão vermelho à esquerda). O registro daquele dia é apagado.
3. Se não houver registro, o botão Limpar não aparece.

## Colunas e cálculos

A grade tem uma linha por funcionário. As colunas são: o nome, sete colunas de dias (Seg a Dom) e a coluna **Saldo** ao final. Dentro de cada célula de dia o sistema mostra as horas trabalhadas e, abaixo, o saldo do dia quando diferente de zero.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Funcionário | Iniciais (avatar) + nome do funcionário ativo | Lista de funcionários ativos do bar, ordenada por nome; iniciais = 2 primeiras palavras do nome | `hr.funcionarios` (`ativo = true`, filtrado por `bar_id`) |
| Célula do dia — horas trabalhadas | Total de horas efetivas naquele dia (ex.: "8h30") | `(saída − entrada) − intervalo`. Se saída < entrada, soma 24h (trata virada de meia-noite); nunca fica negativo. Entrada/saída convertidas para minutos | `hr.ponto_registro` (campos `entrada`, `saida`, `intervalo_min`) |
| Célula do dia — saldo do dia | Linha menor abaixo das horas: verde se positivo (+), vermelho se negativo | `horas_trabalhadas − (horas_previstas × 60)`, em minutos. Só aparece quando diferente de zero | `hr.ponto_registro` (`horas_previstas`) |
| Célula do dia — sem horas | "—" quando existe registro mas sem entrada/saída completas; **+** quando não há registro nenhum | Registro sem entrada ou sem saída retorna horas nulas | `hr.ponto_registro` |
| Saldo (coluna final) | Banco de horas da semana para o funcionário | Soma, sobre os 7 dias, de `horas_trabalhadas − (horas_previstas × 60)` de cada dia que tenha horas apuradas. Verde se >0, vermelho se <0, cinza "0h" se zero | Calculado no cliente a partir de `hr.ponto_registro` |

Observações sobre a apresentação dos tempos: o sistema formata minutos como "XhYY" (ex.: 510 min → "8h30"); saldos negativos ganham sinal "−". Dias sem registro não entram na soma do saldo — não contam como falta nem como zero.

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| **Semana** (setas ‹ ›) | Move a janela de 7 dias (segunda a domingo) e recarrega os registros do período |
| **Hoje** | Reposiciona na semana atual |
| **Área** | Restringe a grade aos funcionários da área escolhida; "Todas as áreas" mostra todos |
| **Bar selecionado** | Todos os dados (funcionários e registros) são sempre do bar ativo no seletor de bar |

A coluna do dia de hoje fica destacada em verde-claro para facilitar a leitura.

## Regras e detalhes importantes

- **Tudo é filtrado por `bar_id`.** Funcionários e registros de ponto pertencem ao bar selecionado; a tela nunca mistura bares.
- **Lançamento manual.** Não existe importação/upload nesta tela — os dados são digitados célula a célula. A integração de ponto eletrônico (Tangerino), quando ativa, grava no **mesmo** registro (`hr.ponto_registro`), então esta grade também serve para conferir e corrigir o que veio do relógio.
- **Chave do registro.** Cada registro é único por **funcionário + data**. Salvar de novo o mesmo dia **substitui** o registro anterior (upsert), não cria duplicado.
- **Padrões ao salvar.** Se o intervalo não for informado, assume **0**; se as previstas não forem informadas, assume **8 horas**.
- **Virada de meia-noite.** Turnos que cruzam a meia-noite (ex.: entrada 22h, saída 02h) são calculados corretamente somando 24h à diferença.
- **Horas nunca negativas.** O cálculo de horas trabalhadas trava em zero — não é possível apurar tempo negativo mesmo com intervalo maior que a jornada.
- **Saldo ignora dias em branco.** O banco de horas da semana soma só os dias com horas apuradas; um dia sem lançamento não vira saldo negativo automaticamente.
- **Estados vazios.** Sem funcionários ativos, a tela mostra "Nenhum funcionário ativo."; enquanto carrega, exibe um indicador de carregamento.
- **Somente leitura.** Sem permissão de escrita no módulo, salvar e limpar são recusados pelo servidor (guard por rota).

## Dúvidas frequentes

**Por que um funcionário não aparece na grade?**
Só entram funcionários marcados como **ativos** no bar selecionado. Se estiver inativo ou for de outro bar, não aparece. Confira também o filtro de área.

**O intervalo é descontado das horas?**
Sim. O valor em minutos do campo Intervalo é subtraído do tempo entre entrada e saída.

**Um dia sem lançamento conta como falta?**
Não. Dias sem registro simplesmente não entram na conta do saldo semanal. A tela não classifica faltas automaticamente.

**Como funciona o turno que passa da meia-noite?**
Basta lançar entrada e saída normalmente (ex.: 22:00 e 02:00). O sistema entende a virada e calcula as horas certas.

**O que significa a linha menor colorida na célula?**
É o saldo do dia: verde quando trabalhou mais que o previsto (hora extra), vermelho quando trabalhou menos. Só aparece quando é diferente de zero.

**Se eu salvar o mesmo dia duas vezes, cria dois registros?**
Não. O registro é único por funcionário e data; salvar de novo atualiza o existente.

## Fonte dos dados

- **`hr.ponto_registro`** — tabela principal de registros de ponto (data, entrada, saída, intervalo em minutos, horas previstas, observação), com chave única por `funcionario_id + data`. Alimentada manualmente por esta tela e, quando ativa, pela integração **Tangerino** (ponto eletrônico).
- **`hr.funcionarios`** — funcionários ativos do bar (id, nome, área, tipo de contratação).
- **`hr.areas`** — áreas do bar, usadas no filtro de área (via `/api/rh/funcionarios/opcoes`).
- API: `GET/POST/DELETE /api/rh/ponto` (leitura do período, upsert e exclusão) e `GET /api/rh/funcionarios/opcoes` (áreas).

> Observação: existe também a rota `/api/rh/ponto/espelho` (view `hr.v_espelho_ponto`, cruzando ponto com escala) que gera o espelho mensal por funcionário — mas ela alimenta a aba "Ponto" do dossiê em RH → Funcionários, **não** esta tela.
