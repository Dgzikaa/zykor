---
title: Recrutamento
area: rh
slug: recrutamento
route: /rh/recrutamento
description: Mini-ATS para abrir vagas, organizar candidatos por etapa (funil) e admitir o aprovado criando o funcionário direto na Central.
order: 50
icon: Briefcase
---

# Recrutamento

## Visão geral
A tela de **Recrutamento** é um controle de processos seletivos (um ATS "leve") para o bar. Ela permite:

- **Abrir vagas** (ex.: Bartender, Garçom) com tipo de contratação e área.
- **Cadastrar candidatos** dentro de cada vaga.
- **Mover cada candidato pelas etapas** do funil (Inscrito → Triagem → Entrevista → Aprovado → Contratado), ou marcá-lo como Reprovado.
- **Admitir o candidato aprovado**, o que cria automaticamente o registro de funcionário na Central de Funcionários e vincula o candidato a esse funcionário.

É usada pela gestão/RH do bar no dia a dia de contratação. Tudo é **manual** (não há integração com portais de vagas externos): quem recruta digita as vagas e os candidatos aqui.

## Como acessar
No menu lateral: **RH → Recrutamento** (ícone de maleta).

Rota: `/rh/recrutamento`.

**Permissão necessária:** módulo de **gestão** (`permission: 'gestao'`). Quem tem acesso apenas de leitura vê a tela com o selo **Somente leitura** e as ações de escrita (criar vaga, adicionar/mover/admitir/remover candidato) são bloqueadas no servidor — a rota de escrita `POST/DELETE /api/rh/vagas` é protegida pelo guard de permissão amarrado a `/rh/recrutamento`.

## Passo a passo

### 1. Criar uma vaga
1. Clique em **Nova vaga** (botão branco no cabeçalho roxo). Um formulário aparece abaixo.
2. Preencha o **Título da vaga** (obrigatório — ex.: "Bartender").
3. Escolha o **Tipo** de contratação: **CLT**, **PJ** ou **Freela**.
4. Escolha a **Área** (opcional; a lista vem das áreas cadastradas do bar).
5. Clique em **Criar**. A vaga aparece na coluna da esquerda com status **aberta**.

### 2. Selecionar uma vaga e ver os candidatos
1. Na lista de vagas (coluna da esquerda), clique na vaga desejada. Ela fica destacada em roxo.
2. À direita aparece o funil da vaga (as colunas por etapa) e o cabeçalho com o título e o status.

### 3. Adicionar um candidato
1. Com a vaga selecionada, use os campos no topo do painel direito: **Nome do candidato** e **Telefone**.
2. Clique em **Candidato** (botão com "+"). O candidato entra na coluna **Inscritos**.

### 4. Mover o candidato pelas etapas
1. No cartão do candidato, use o menu suspenso (dropdown) para escolher a etapa: Inscrito, Triagem, Entrevista, Aprovado, Contratado ou Reprovado.
2. O cartão se move para a coluna correspondente. Reprovado sai do funil visível (não aparece como coluna, mas é contado como "reprovado(s)" no cabeçalho).

### 5. Admitir um candidato aprovado
1. Mova o candidato para a etapa **Aprovado**.
2. No cartão dele (na coluna Aprovados) aparece o botão verde **Admitir**.
3. Clique em **Admitir**. O sistema cria o funcionário na Central de Funcionários (com nome, telefone, e-mail, tipo de contratação e área herdados da vaga, data de admissão = hoje, ativo) e marca o candidato como **Contratado**.
4. Uma mensagem confirma "admitido(a)! Funcionário criado na Central".

### 6. Mudar o status da vaga
1. Com a vaga selecionada, use o menu **status** no cabeçalho do painel direito.
2. Escolha **Aberta**, **Pausada** ou **Fechada**.

### 7. Remover um candidato
1. No cartão do candidato, clique no "x" ao lado do nome. O candidato é excluído da vaga.

## Colunas e cálculos

### Lista de vagas (coluna esquerda)
| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Título | Nome da vaga | Campo `titulo` da vaga | `hr.vagas` |
| Status (badge) | Situação da vaga: aberta / pausada / fechada | Campo `status`; cor verde para "aberta", âmbar para "pausada", cinza para outras | `hr.vagas` |
| Tipo de contratação | CLT / PJ / Freela | Campo `tipo_contratacao` | `hr.vagas` |
| "N cand." | Quantidade de candidatos ativos na vaga | Contagem de candidatos da vaga **excluindo os de etapa `reprovado`** | `hr.candidatos` |

### Funil da vaga selecionada (colunas por etapa)
As cinco colunas do funil são fixas. Cada uma lista os candidatos cuja etapa corresponde à coluna, com um contador no topo.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Inscritos | Candidatos recém-adicionados | Candidatos com `etapa = 'inscrito'` (etapa padrão de todo candidato novo) | `hr.candidatos` |
| Triagem | Candidatos em análise inicial | `etapa = 'triagem'` | `hr.candidatos` |
| Entrevista | Candidatos em fase de entrevista | `etapa = 'entrevista'` | `hr.candidatos` |
| Aprovados | Candidatos aprovados (aptos a admitir) | `etapa = 'aprovado'` | `hr.candidatos` |
| Contratados | Candidatos já admitidos | `etapa = 'contratado'` (etapa definida automaticamente ao clicar em Admitir) | `hr.candidatos` |
| Contador por coluna | Número no topo de cada coluna | Quantidade de candidatos naquela etapa | `hr.candidatos` |
| "N reprovado(s)" | Aviso no cabeçalho da vaga | Contagem de candidatos com `etapa = 'reprovado'` (só aparece se maior que zero; não vira coluna) | `hr.candidatos` |

### Cartão do candidato
| Campo | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Avatar (iniciais) | Círculo com as iniciais | Primeiras letras das duas primeiras palavras do nome, em maiúsculas | `hr.candidatos.nome` (só no front) |
| Nome | Nome do candidato | Campo `nome` | `hr.candidatos` |
| Telefone | Contato | Campo `telefone` (só aparece se preenchido) | `hr.candidatos` |
| Seletor de etapa | Etapa atual (editável) | Campo `etapa` | `hr.candidatos` |
| Botão Admitir | Só na coluna Aprovados | Ação que cria o funcionário e marca o candidato como contratado | `hr.funcionarios` + `hr.candidatos` |

## Filtros e opções
Esta tela não tem filtros de período ou seletor interno de bar. O que existe:

- **Seleção de bar:** implícita. Todos os dados são do bar ativo no seletor de bar do topo do sistema; a API sempre filtra por `bar_id`.
- **Seleção de vaga:** clicar em uma vaga na lista à esquerda define qual funil é exibido à direita.
- **Status da vaga (dropdown):** aberta / pausada / fechada — apenas classifica a vaga; não filtra a lista automaticamente.
- **Etapa do candidato (dropdown por cartão):** move o candidato entre colunas do funil (ou para Reprovado).
- **Tipo de contratação e Área:** definidos na criação da vaga; a área alimenta a lista vinda de `/api/rh/funcionarios/opcoes`.

## Regras e detalhes importantes
- **Isolamento por bar:** toda leitura e escrita filtra por `bar_id` do usuário. Vagas e candidatos de um bar não aparecem em outro.
- **Contagem "N cand." ignora reprovados:** o número ao lado de cada vaga conta apenas candidatos ativos (não conta quem está em `etapa = 'reprovado'`).
- **Admissão é irreversível pela tela:** ao admitir, cria-se um funcionário e o campo `funcionario_id` do candidato é preenchido. Se você tentar admitir de novo o mesmo candidato, o sistema recusa com "Candidato já foi admitido".
- **Dados herdados na admissão:** o funcionário criado recebe nome, telefone e e-mail do candidato, e **tipo de contratação e área da vaga**. Data de admissão = data de hoje; funcionário nasce como **ativo**.
- **Ordenação:** vagas são listadas da mais recente para a mais antiga (por `criado_em`); candidatos são listados por ordem de criação.
- **Reprovado não tem coluna:** é uma etapa válida, mas o candidato reprovado some do funil visível — só o total aparece no cabeçalho.
- **Exclusão em cascata:** apagar a vaga remove seus candidatos (`on delete cascade`). Apagar um candidato individual usa o "x" do cartão.
- **Somente leitura:** usuários sem permissão de gestão veem os dados mas não conseguem criar/editar (bloqueio no servidor). O selo "Somente leitura" aparece no cabeçalho.
- **Tudo manual:** não há integração com fontes externas (ContaHub, Conta Azul etc.). Vagas e candidatos são digitados pela equipe.

## Dúvidas frequentes

**Onde o funcionário admitido aparece?**
Na Central de Funcionários (RH → Funcionários). Ele é criado automaticamente ao clicar em Admitir, já como ativo.

**Por que o botão Admitir não aparece em um candidato?**
O botão só existe para candidatos na coluna **Aprovados**. Mova o candidato para "Aprovado" primeiro.

**Reprovei um candidato sem querer — ele sumiu?**
Não sumiu, apenas saiu do funil visível. Ele continua contado no aviso "N reprovado(s)". Para trazê-lo de volta, seria preciso reabrir o registro (hoje a tela não lista os reprovados individualmente).

**A contagem de candidatos da vaga inclui os reprovados?**
Não. O número "N cand." na lista de vagas conta só candidatos ativos (exclui a etapa reprovado).

**Posso ter vagas de bares diferentes na mesma tela?**
Não. A tela mostra apenas as vagas e candidatos do bar ativo no seletor do topo.

**O que acontece com o tipo de contratação e a área do funcionário admitido?**
São herdados da vaga (não do candidato). Se a vaga não tiver tipo definido, o funcionário nasce como CLT por padrão.

## Fonte dos dados
- **`hr.vagas`** — vagas do bar (título, área, tipo de contratação, status). Alimenta a lista de vagas.
- **`hr.candidatos`** — candidatos por vaga (nome, telefone, e-mail, etapa, `funcionario_id`). Alimenta o funil.
- **`hr.funcionarios`** — destino da admissão; o funcionário criado a partir do candidato aprovado.
- **`hr.areas`** — lista de áreas para o dropdown de criação de vaga (via `/api/rh/funcionarios/opcoes`).

APIs internas: `GET/POST/DELETE /api/rh/vagas`, `GET/POST/DELETE /api/rh/vagas/[id]/candidatos`, `GET /api/rh/funcionarios/opcoes`. Todos os dados são internos do próprio Zykor (schema `hr`); não há integração com sistemas externos nesta tela.
