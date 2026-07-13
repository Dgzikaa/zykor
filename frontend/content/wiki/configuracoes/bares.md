---
title: Bares
area: configuracoes
slug: bares
route: /configuracoes/bares
description: Cadastro e configuração central de cada bar — perfil, dias de operação, metas, acessos, integrações e checklist de prontidão.
order: 20
icon: Store
---

# Bares

## Visão geral

A tela **Bares** é o cadastro central de cada casa do grupo (Ordinário, Deboche e qualquer bar novo). É aqui que se define **quem é o bar** (nome, CNPJ, endereço, logo, contatos), **quando ele opera** (dias da semana, horários, capacidade), **quais integrações estão ligadas** (ContaHub, Yuzer, Sympla, Conta Azul, Stone, Instagram) e **quem pode enxergá-lo** no sistema.

Cada bar cadastrado aqui vira uma opção no seletor de bar do topo do sistema e passa a alimentar todas as demais telas (dashboards, financeiro, produção, metas). Por isso o cadastro é a base de tudo: um bar mal configurado (sem dias de operação, sem metas, inativo) aparece com lacunas nas outras telas.

Na prática, quem usa esta tela é o **dono ou administrador** — normalmente ao abrir um bar novo, ao ligar uma integração ou ao dar/tirar acesso de um usuário.

## Como acessar

Menu lateral: **Configurações → Bares** (`/configuracoes/bares`).

A entrada usa a permissão de módulo `configuracoes`. Além disso, **todas as operações de dados desta tela exigem perfil de administrador**: as rotas de API por trás dela (`/api/configuracoes/bars` e suas sub-rotas) são protegidas por `requireAdmin`. Um usuário sem perfil admin não consegue listar, criar, editar bares nem mexer em acessos/prontidão — recebe "Acesso negado - apenas administradores".

## Passo a passo

### Ver a lista de bares
1. Abra **Configurações → Bares**.
2. A tela mostra um card por bar, com nome, número (`#id`), CNPJ, o selo **Ativo/Inativo** e, quando for o caso, os selos **Manual** (bar em modo manual) e **sem ContaHub**.
3. Clique em um card para abrir o editor completo daquele bar.

### Criar um bar novo
1. Clique em **Novo bar** (canto superior direito).
2. No editor, abra a aba **Perfil**.
3. (Opcional) Em **Copiar configuração de**, escolha um bar existente para clonar dias de operação, padrão de metas, acessos de usuários e categorias de custo. As integrações **começam sempre desligadas** (o bar novo nasce manual). Deixe em "Começar do zero" para não clonar nada.
4. Preencha **Nome** (obrigatório) e os demais campos de perfil (CNPJ, endereço, contatos, logo).
5. Ajuste a aba **Operação** (dias, horários, capacidade, integrações ativas).
6. Clique em **Criar bar**. As abas Prontidão, Integrações e Acesso ficam desabilitadas até o bar existir — salve primeiro e reabra para usá-las.

### Editar um bar existente
1. Clique no card do bar.
2. Navegue pelas abas (Prontidão, Perfil, Operação, Metas, Integrações, Acesso) e altere o que precisar.
3. Clique em **Salvar** no rodapé. As mudanças de Perfil e Operação são gravadas junto; abas como Acesso e Integrações salvam sozinhas a cada ação.

### Ativar ou inativar um bar
1. Abra o bar → aba **Perfil**.
2. Marque/desmarque **Bar ativo (aparece no seletor)**.
3. Salve. Um bar inativo some do seletor de bar no topo do sistema.

### Dar acesso a um usuário
1. Abra o bar → aba **Acesso**.
2. Digite o **email** do usuário no campo e clique no **+** (ou aperte Enter).
3. O sistema resolve o email para o usuário e concede o vínculo. Ele passa a ver o bar no seletor.
4. Para remover, clique no ícone de lixeira ao lado do nome.

### Enviar a logo do bar
1. Aba **Perfil** → bloco **Logo do bar** → **Enviar logo** (ou **Trocar logo**).
2. Escolha um PNG/JPEG/WebP (até 5 MB). PNG com fundo transparente fica melhor.
3. O arquivo é enviado sem compressão destrutiva; o header e o seletor exibem com ajuste automático de tamanho.

### Ligar/desligar o modo manual
1. Aba **Operação** → caixa **Modo manual (sem ContaHub)**.
2. Marcado: as telas e alertas **não cobram** integrações ausentes (dados preenchidos à mão). Desmarque quando o bar passar a sincronizar automaticamente.

## Abas e seções

O editor de cada bar tem seis abas:

- **Prontidão** — checklist do que já está configurado x pendente (só existe em bar já salvo).
- **Perfil** — identidade do bar: nome, CNPJ, endereço, telefone, email, Instagram, site, logo e o toggle Ativo. Na criação, também traz o seletor "Copiar configuração de".
- **Operação** — modo manual, dias que o bar abre, horários de abertura/fechamento, capacidade de atendimento por dia e quais integrações estão ativas.
- **Metas** — não edita metas aqui; é um atalho explicativo que aponta para a tela dedicada **Metas** (`/configuracoes/metas`), que opera sobre o bar selecionado no topo.
- **Integrações** — status e conexão das integrações do bar (Conta Azul, Stone, Instagram, Inter e outras de escopo "bar"), com atalho para a tela completa de integrações. Só existe em bar já salvo.
- **Acesso** — lista de usuários que enxergam o bar, com adicionar/remover. Só existe em bar já salvo.

## Colunas e cálculos

### Lista de bares (cards)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome | Nome do bar | Campo `nome` | `operations.bares` |
| `#id` | Número interno do bar | Campo `id` | `operations.bares` |
| CNPJ | CNPJ do bar (se houver) | Campo `cnpj`, exibido após o `#id` | `operations.bares` |
| Selo Ativo / Inativo | Se o bar aparece no seletor | `ativo !== false` → "Ativo"; senão "Inativo" | `operations.bares.ativo` |
| Selo Manual | Bar em modo manual | Exibido quando `config.modo_manual` é verdadeiro | `operations.bares.config` (jsonb) |
| Aviso "sem ContaHub" | Bar sem integração ContaHub | Exibido quando existe operação e `tem_api_contahub` é falso | `operations.bares_config` |

### Aba Prontidão (checklist)

O resumo mostra **`concluídos/total` prontos** e a contagem de **pendentes**. Cada item tem status `ok` (verde), `pendente` (âmbar) ou `opcional` (cinza).

| Item | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Perfil do bar | Se nome, CNPJ e endereço estão preenchidos | `ok` se `cnpj` **e** `endereco` existem; senão `pendente` | `operations.bares` |
| Bar ativo | Se aparece no seletor | `ok` se `ativo` é verdadeiro; senão `pendente` | `operations.bares.ativo` |
| Dias de operação | Se há registro de operação | `ok` se existe linha em `bares_config`; senão `pendente` | `operations.bares_config` |
| Acesso de usuários | Quantos usuários têm acesso | `ok` se contagem > 0; texto mostra "N usuário(s) com acesso" | `auth_custom.usuarios_bares` (count) |
| Metas preenchidas | Se há metas com valor | `ok` se existe algum número > 0 em qualquer nível do JSONB de metas; senão `pendente` | `operations.bares.metas` (jsonb) |
| Tabela de desempenho pronta | Semanas disponíveis para preencher | `ok` se há linhas de desempenho; mostra "N semanas disponíveis" | `gold.desempenho` (count) |
| Planejamento comercial (eventos) | Eventos cadastrados | `ok` se há eventos, senão `opcional`; mostra "N evento(s)" | `operations.eventos_base` (count) |
| Integrações do bar | Integrações configuradas | `ok` se há credenciais, senão `opcional`; lista os sistemas | `api_credentials` (por `bar_id`) |

### Aba Acesso (lista de usuários)

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome | Nome do usuário (ou email se sem nome) | Campo `nome` do usuário vinculado | `auth_custom.usuarios` |
| Email · Papel | Email e papel (role) do usuário | Campos `email` e `role` | `auth_custom.usuarios` |

A lista é montada cruzando os vínculos de `usuarios_bares` (por `bar_id`) com os dados dos usuários por `auth_id`.

### Aba Integrações (cards de status)

| Item | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Conta Azul | Estado da conexão + estatísticas | "Conectada" se `connected`; "Falta autorizar" se há credencial sem OAuth; "Não configurada" se nada. Quando conectada, mostra `N lançamentos · N fornecedores sincronizados` | `/api/financeiro/contaazul/status` |
| Stone — antecipação | Liga/desliga antecipação de crédito e os dias do mês | `antecipa` (bool) + `dias_landing` (lista de dias 1–31). Se ligado, o crédito cai nos dias fixos em vez do ~D+30 | `/api/financeiro/stone/antecipacao-config` |
| Demais integrações (Instagram, Inter, etc.) | Status geral de cada integração de escopo "bar" | Badge por `statusGeral`: Conectada / Atenção (parcial) / Desconectada / Não configurada; mostra o 1º problema | `/api/configuracoes/administracao/integracoes?bar_id=` (filtrado por `escopo = 'bar'`) |

## Filtros e opções

Esta tela **não tem filtro de período nem seletor de bar próprio** — ela lista todos os bares e você entra em cada um pelo card. As "opções" relevantes são os campos de configuração:

- **Novo bar** → abre o editor em modo criação.
- **Copiar configuração de** (só na criação) → clona dias de operação, padrão de metas, acessos e categorias de custo do bar escolhido; integrações ficam desligadas.
- **Bar ativo** → controla se o bar aparece no seletor do topo.
- **Modo manual (sem ContaHub)** → silencia cobranças de integração ausente nas telas/alertas.
- **Dias que o bar abre** (Seg…Dom, em chips) → dia desmarcado não conta como falha de pipeline.
- **Integrações ativas** (ContaHub, Yuzer, Sympla) → flags booleanas que dizem quais fontes esse bar sincroniza.
- **Capacidade de atendimento por dia** → número usado na Taxa de Lotação do Dashboard de Receitas.

## Regras e detalhes importantes

- **Onde cada dado mora**: perfil e IDs de integração vivem no JSONB `config` de `operations.bares`; dias de operação, horários e flags de API vivem em `operations.bares_config` (uma linha por `bar_id`). Metas vivem no JSONB `metas` da própria `bares`.
- **Sempre por `bar_id`**: acessos, prontidão, integrações e antecipação Stone são todos consultados/gravados filtrando por `bar_id`.
- **Bar novo nasce manual**: ao criar, `modo_manual` fica ligado por padrão e todas as flags de API (`tem_api_contahub/yuzer/sympla`) entram como `false`, independentemente do que se copie de outro bar.
- **Metas na criação**: copiando de outro bar, herda as metas dele **com valores**; começando do zero, semeia a estrutura de metas do bar 3 (Ordinário) **zerada** — por isso a prontidão marca "Metas zeradas" até você preencher na tela de Metas.
- **Clones best-effort**: ao copiar de um bar, os clones de acessos, categorias de custo e config de notificação são "tentativa e erro" — se algum falhar, o bar ainda é criado (o erro só é logado).
- **Merge de config**: ao salvar o Perfil, o `config` jsonb é mesclado superficialmente (não apaga chaves antigas não enviadas).
- **Capacidade de lotação**: a capacidade mensal usada no Dashboard de Receitas é **dias abertos no mês × capacidade por dia**.
- **Antecipação Stone**: vale o **próximo dia da lista** após a venda; caindo em fim de semana/feriado, rola para o próximo dia útil. Débito e PIX não mudam — só o crédito.
- **Acesso por email**: conceder acesso por email resolve o usuário por email (case-insensitive); se não achar, retorna "Usuário não encontrado por esse email".
- **Estados vazios**: sem usuários, a aba Acesso mostra "Ninguém tem acesso a este bar ainda". Abas Prontidão/Integrações/Acesso só aparecem depois de o bar existir (desabilitadas durante a criação).

## Dúvidas frequentes

**Como faço para um bar aparecer no seletor do topo?**
Marque **Bar ativo** na aba Perfil e garanta que o usuário tem acesso a ele (aba Acesso). Bar inativo ou sem vínculo não aparece.

**Criei um bar novo e as telas cobram ContaHub. Como paro isso?**
Deixe o **Modo manual** ligado (aba Operação) enquanto os dados forem preenchidos à mão. Isso silencia os avisos de integração ausente.

**Copiar de outro bar traz as integrações?**
Não. Copiar clona dias de operação, metas, acessos e categorias de custo, mas as integrações começam sempre desligadas — o bar novo nasce manual.

**Por que as metas aparecem "zeradas" na Prontidão?**
Bar criado do zero recebe a estrutura de metas zerada. Preencha os valores na tela **Metas** (`/configuracoes/metas`), com o bar selecionado no topo.

**Quem pode mexer nesta tela?**
Apenas administradores. Toda operação passa por rotas protegidas por `requireAdmin`; usuários comuns recebem acesso negado.

**Alterei o CNPJ/endereço, mas a Prontidão ainda mostra pendente. Por quê?**
A Prontidão de "Perfil do bar" só fica verde quando **CNPJ e endereço** estão preenchidos. Salve os dois campos e reabra a aba.

## Fonte dos dados

- **`operations.bares`** — cadastro do bar: `nome`, `cnpj`, `endereco`, `ativo`, `config` (jsonb: perfil, contatos, logo, modo_manual, capacidade) e `metas` (jsonb).
- **`operations.bares_config`** — operação por bar: dias (`opera_*`), horários, happy hour, `dias_principais` e flags `tem_api_contahub/yuzer/sympla`.
- **`auth_custom.usuarios_bares`** — vínculo usuário × bar (quem enxerga o bar).
- **`auth_custom.usuarios`** — dados dos usuários (nome, email, role) exibidos na aba Acesso.
- **`api_credentials`** — credenciais de integração por bar (usado na Prontidão).
- **`gold.desempenho`** — semanas de desempenho (Prontidão).
- **`operations.eventos_base`** — eventos cadastrados (Prontidão).
- **`operations.bar_categorias_custo`** — categorias de custo clonadas na criação.
- **`bar_notification_configs`** — config padrão de notificações criada junto com o bar.
- Endpoints de integração consumidos pela aba Integrações: **Conta Azul** (`/api/financeiro/contaazul/status` e OAuth), **Stone** (`/api/financeiro/stone/antecipacao-config`), **Instagram** (`/api/integracoes/instagram/iniciar`) e a agregação geral de integrações (`/api/configuracoes/administracao/integracoes`).

Integrações de origem envolvidas: **ContaHub**, **Yuzer** e **Sympla** (flags de sincronização), **Conta Azul** (financeiro/lançamentos), **Stone** (antecipação de crédito) e **Instagram** (mídia).
