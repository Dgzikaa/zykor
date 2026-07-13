---
title: Freelas
area: rh
slug: freelas
route: /rh/freelas
description: Convocação diária de freelancers, controle de presença e cálculo do valor a pagar por PIX.
order: 30
icon: HandCoins
---

# Freelas

## Visão geral

A tela **Freelas** organiza a convocação de freelancers (diaristas) para um dia específico de operação do bar. Ela funciona como uma "escala rápida" de freelas: você escolhe a data, vê quem está disponível no seu pool de freelancers cadastrados, convoca as pessoas para aquele dia, acompanha se cada uma confirmou ou compareceu e, no final, o sistema soma automaticamente quanto será pago em diárias.

É uma ferramenta operacional do dia a dia, usada principalmente pelo **gestor de RH, gerente ou coordenador de operação** para montar o time extra de um evento ou turno — e depois pagar cada freela via PIX usando a chave já cadastrada no funcionário.

O funcionamento gira em torno de **um dia por vez**: tudo que aparece na tela (disponíveis, convocados, valor a pagar) se refere à data selecionada no topo.

## Como acessar

No menu lateral: **RH → Freelas**.

- Ícone: HandCoins (mãos com moedas).
- Rota: `/rh/freelas`.
- Permissão necessária: módulo **Gestão** (`gestao`). Sem esse acesso, o item não aparece no menu e a rota fica bloqueada.
- Se o seu usuário tiver o módulo apenas em modo leitura, a tela exibe o selo **Somente leitura** e as ações de escrita (convocar, alterar status, editar valor, remover) são negadas pelo backend.

## Passo a passo

### Escolher o dia
1. Abra **RH → Freelas**.
2. No canto superior direito do cabeçalho laranja, use o seletor de **data** (campo de calendário). Por padrão ele já vem no dia de hoje.
3. Ao trocar a data, a tela recarrega mostrando os convocados e o pool daquele dia.

### Convocar um freela
1. No card **Disponíveis** (coluna da esquerda), localize a pessoa pelo nome.
2. Clique no botão **Convocar** ao lado do nome.
3. A pessoa sai da lista de disponíveis e passa para o card **Convocados**, já com o status **Convocado** e o valor de diária pré-preenchido com o valor cadastrado no funcionário.

### Atualizar o status de presença
1. No card **Convocados**, encontre a pessoa.
2. Use o menu suspenso de status e escolha entre **Convocado, Confirmado, Compareceu, Faltou** ou **Recusou**.
3. A alteração é salva automaticamente (não há botão de salvar).

### Ajustar o valor da diária
1. Ainda no card **Convocados**, no campo **R$** ao lado do status, digite o valor da diária daquele freela para aquele dia.
2. O campo aceita centavos (ex.: 120,00). Deixar em branco remove o valor.
3. A edição é salva automaticamente e o total a pagar recalcula na hora.

### Copiar a chave PIX para pagamento
1. Se o freela tiver chave PIX cadastrada, aparece um botão com o tipo da chave (ex.: "cpf", "telefone", "email") ao lado do valor.
2. Clique nele para **copiar a chave PIX** para a área de transferência.
3. Cole no seu app do banco para fazer o pagamento da diária.

### Remover uma convocação
1. No card **Convocados**, clique no ícone de **lixeira** no canto direito da linha da pessoa.
2. A convocação é apagada e o freela volta para a lista de disponíveis.

### Ver o total a pagar
- No rodapé, o card **A pagar** mostra quantos freelas confirmaram/compareceram e o valor total das diárias correspondentes.

## Abas e seções

A tela não tem abas; é composta por três blocos na mesma página:

- **Disponíveis** (card à esquerda): pool de freelancers cadastrados que ainda **não** foram convocados para o dia selecionado.
- **Convocados** (card central/direito): pessoas já convocadas para o dia, com status, valor e ação de PIX.
- **A pagar** (card de rodapé): resumo financeiro do dia, exibido apenas quando há pelo menos uma convocação.

## Colunas e cálculos

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Disponíveis (contador) | Quantos freelas ainda não foram convocados no dia | Pool de freelas menos quem já está convocado: `pool.filter(p => !convocadoIds.has(p.id))` | `hr.funcionarios` × `hr.freela_convocacao` |
| Nome (Disponíveis) | Nome do freelancer | Campo `nome` do cadastro do funcionário | `hr.funcionarios.nome` |
| Iniciais (avatar) | Bolinha com as iniciais | Duas primeiras palavras do nome, primeira letra de cada, em maiúsculo | Derivado de `nome` |
| Convocados (contador) | Quantas pessoas foram convocadas no dia | Número de registros de convocação da data | `hr.freela_convocacao` (filtrado por `bar_id` e `data`) |
| Nome (Convocados) | Nome do freela convocado | Cruzamento do `funcionario_id` da convocação com o pool; se não achar, mostra `#id` | `hr.freela_convocacao.funcionario_id` → `hr.funcionarios` |
| Status | Situação da convocação | Valor do campo `status`; opções: Convocado, Confirmado, Compareceu, Faltou, Recusou | `hr.freela_convocacao.status` |
| Diária (R$) | Valor a pagar por aquele freela no dia | Campo editável `valor_diaria`; ao convocar, herda o valor cadastrado no funcionário | `hr.freela_convocacao.valor_diaria` (default `hr.funcionarios.valor_diaria`) |
| Chave PIX (botão) | Botão para copiar a chave de pagamento | Só aparece se o funcionário tiver `chave_pix`; o rótulo é o `tipo_chave_pix` | `hr.funcionarios.chave_pix`, `tipo_chave_pix` |
| A pagar (quantidade) | Nº de freelas que confirmaram ou compareceram | Filtra convocações com status `confirmado` **ou** `compareceu` | Calculado no cliente sobre `hr.freela_convocacao` |
| A pagar (total R$) | Soma das diárias a pagar | Soma de `valor_diaria` das convocações com status confirmado/compareceu (nulos contam como 0) | Calculado no cliente sobre `hr.freela_convocacao` |

## Filtros e opções

- **Bar (implícito):** toda a tela é filtrada pelo bar selecionado no topo do sistema. As consultas usam `bar_id` do usuário; você nunca vê freelas ou convocações de outro bar.
- **Data:** o único filtro visível. Define para qual dia são mostrados os disponíveis, os convocados e o total a pagar. Padrão: dia de hoje.
- **Pool de freelas:** o card de disponíveis mostra apenas funcionários **ativos** com `tipo_contratacao = 'Freela'`. Quem não é freela, ou está inativo, não aparece aqui.

## Regras e detalhes importantes

- **Um freela por dia:** existe restrição de unicidade por `funcionario_id` + `data`. A mesma pessoa não pode ser convocada duas vezes no mesmo dia; convocar de novo apenas atualiza o registro existente (upsert).
- **Valor herdado:** ao convocar, a diária é preenchida com o `valor_diaria` cadastrado na ficha do funcionário. Você pode sobrescrever esse valor manualmente na convocação sem alterar o cadastro.
- **"A pagar" = confirmou ou compareceu:** o total considera **somente** quem está com status **Confirmado** ou **Compareceu**. Quem está apenas Convocado, Faltou ou Recusou **não entra** na conta.
- **Diária vazia conta como zero:** convocações sem valor de diária somam R$ 0,00 no total.
- **Salvamento automático:** mudar status ou valor grava na hora (atualização otimista na tela; se der erro, a tela recarrega os dados reais). Não há botão "Salvar".
- **Pool vem do cadastro de Funcionários:** para alguém aparecer como freela disponível, é preciso cadastrá-lo em **RH → Funcionários** com tipo de contratação "Freela", marcado como ativo, e (para pagar) com chave PIX.
- **Estados vazios:** se ninguém do pool está disponível (todos convocados ou nenhum freela cadastrado), o card mostra aviso; se ninguém foi convocado, o card de convocados mostra "Ninguém convocado pra esse dia ainda" e o card A pagar não aparece.
- **Somente leitura:** usuários com o módulo Gestão em modo leitura visualizam tudo, mas o backend recusa convocar, atualizar e remover.
- **Sem competência × vencimento:** aqui não há regime de competência/vencimento — o pagamento é uma diária amarrada à data do dia trabalhado. Não há integração automática com contas a pagar; o pagamento é feito manualmente via PIX.

## Dúvidas frequentes

**Por que um freela não aparece na lista de Disponíveis?**
Ou ele já foi convocado para esse dia (está no card Convocados), ou não está cadastrado como funcionário ativo com tipo de contratação "Freela".

**Como cadastro um novo freela?**
Em **RH → Funcionários**, criando o funcionário com tipo de contratação "Freela", deixando-o ativo e preenchendo a chave PIX e o valor de diária.

**O valor a pagar considera quem faltou?**
Não. Só entram no total quem está com status **Confirmado** ou **Compareceu**. Faltou, Recusou e Convocado ficam de fora.

**A tela paga o freela sozinha?**
Não. Ela organiza a convocação, calcula o total e facilita copiar a chave PIX. O pagamento em si é feito manualmente pelo seu app bancário.

**Mudei o valor da diária de um freela; isso altera o cadastro dele?**
Não. A edição vale só para aquela convocação daquele dia. O valor cadastrado na ficha do funcionário continua o mesmo e é usado como padrão nas próximas convocações.

**Consigo convocar a mesma pessoa em dias diferentes?**
Sim. A restrição é uma convocação por pessoa **por dia**. Em datas diferentes, cada dia tem sua própria convocação.

## Fonte dos dados

- **`hr.freela_convocacao`** — registro das convocações (data, funcionário, status, valor da diária, função, observação). Filtrada por `bar_id` e `data`.
- **`hr.funcionarios`** — cadastro de funcionários; alimenta o pool de freelas (filtro `ativo = true` e `tipo_contratacao = 'Freela'`) e fornece nome, valor de diária padrão e chave PIX (`chave_pix`, `tipo_chave_pix`).
- **API:** `/api/rh/freelas` (GET para listar convocações + pool, POST para convocar/atualizar, DELETE para remover).

Os dados são inteiramente **manuais/internos do módulo RH do Zykor** — não vêm de integrações externas como ContaHub, NIBO, Conta Azul ou Stone.
