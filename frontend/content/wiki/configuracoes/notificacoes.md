---
title: Notificações
area: configuracoes
slug: notificacoes
route: /configuracoes/notifications
description: Central de notificações do Zykor — caixa de entrada em tempo real e, para admins, o controle de quem recebe cada alerta e por quais canais (no app, push e WhatsApp).
order: 10
icon: Bell
---

# Notificações

## Visão geral

A **Central de Notificações** é o lugar onde cada pessoa vê os avisos do Zykor em tempo real e onde os administradores controlam **quem recebe o quê e por onde**.

Ela junta três coisas numa tela só:

- **Sua caixa de entrada pessoal** — tudo que o sistema disparou para você (checklist vencido, pendência financeira, meta batida, item em falta, recados da equipe…), com contadores dos últimos 7 dias.
- **Configuração dos alertas (só admins)** — ligar/desligar cada evento do sistema, criar alertas sob medida (ex.: "faturamento abaixo da meta"), e mandar recados manuais para a equipe.
- **Seus dispositivos** — ativar push no celular e cadastrar seu WhatsApp para receber alertas.

No dia a dia, **todo usuário** usa a caixa de entrada e a aba de dispositivos. **Donos e administradores** usam também as abas de Alertas, Enviar aviso e Histórico para orquestrar a comunicação do bar.

## Como acessar

No menu lateral: **Configurações → Notificações** (rota `/configuracoes/notifications`). O título da tela aparece como **🔔 Central de Notificações**.

A tela abre para qualquer usuário autenticado, mas o conteúdo depende da permissão:

- **Caixa de entrada** e **Dispositivos**: visíveis para todo mundo.
- **Alertas**, **Enviar aviso** e **Histórico**: aparecem apenas para quem tem o **módulo Configurações** (ou é `admin`). Quem não tem esse módulo simplesmente não vê essas abas.

Essa regra segue o módulo Configurações, não o cargo bruto — admin sempre passa.

## Passo a passo

### Ler e organizar sua caixa de entrada

1. Abra **Configurações → Notificações**. A aba **Caixa de entrada** já vem selecionada.
2. No topo, quatro cartões mostram o resumo (não lidas, últimos 7 dias, alertas, concluídas).
3. Use os **chips de categoria** (Operacional, Financeiro, Eventos & Metas, Estoque & Compras, NPS & Clientes, Sistema) para filtrar a lista. Clique em **Todas** para limpar o filtro.
4. Clique no botão **Só não lidas** para esconder o que você já leu.
5. **Clique numa notificação** para abri-la: ela é marcada como lida e, se tiver link, leva direto para a tela correspondente (ex.: um checklist vencido abre `/operacional/checklists`).
6. Passando o mouse sobre um item aparecem dois botões: o **✓ (marcar como lida)** e a **lixeira (excluir)**.
7. Se houver não lidas, o botão **Marcar todas** limpa todas de uma vez.

### Ligar/desligar um alerta do sistema (admin)

1. Vá até a aba **Alertas** (seção "Alertas do sistema").
2. Os eventos aparecem agrupados por categoria. Cada um tem um **interruptor (Switch)**: ligado = notifica; desligado = **não avisa ninguém**.
3. Ligue o evento. Aparecem as opções:
   - **Cargos**: marque Admin, Financeiro e/ou Funcionário.
   - **Pessoas específicas**: abra a lista e marque usuários individuais (some às regras de cargo).
   - **Canais**: escolha entre 🔔 No Zykor, 📱 Push e 💬 WhatsApp (a tela só oferece os canais que o evento suporta).
4. Clique em **Salvar**. Se o evento estiver ligado sem nenhum cargo nem pessoa selecionada, o sistema avisa "Selecione um cargo ou pessoa".

### Criar um alerta sob medida (admin)

1. Ainda na aba **Alertas**, role até a seção **⚡ Meus alertas**.
2. No cartão **Novo alerta**, escolha o **Sinal** (o que medir) — ex.: "Faturamento do dia abaixo da meta", "Estoque de UM insumo abaixo de X", "CMV acima de X%".
3. Se o sinal usa limite, escolha a **condição** (menor que, maior que…) e digite o **limite** (aceita vírgula ou ponto). Se não usa limite, o alerta dispara automático quando o fato acontece.
4. Se o sinal pede um **alvo** (ex.: um insumo específico), selecione-o na lista.
5. Preencha um **título** (opcional), escolha os **canais**, os **cargos** e/ou **pessoas** que recebem.
6. Ajuste a **severidade** e o **"Não repetir por (h)"** (cooldown — evita repetir o mesmo alerta antes desse tempo).
7. Clique em **Criar alerta**. Ele passa a ser avaliado sozinho pelo sistema (por cron).
8. Na lista **Meus alertas** abaixo, cada alerta tem botões: **▶ Testar agora** (avalia na hora, sem esperar o cron), **Power** (ativar/desativar) e **Lixeira** (excluir).

### Enviar um recado manual para a equipe (admin)

1. Vá para a aba **Enviar aviso**.
2. Preencha **Título** (até 120 caracteres) e **Mensagem** (até 1000).
3. Escolha o **Tipo** (Info, Boa notícia, Atenção, Urgente).
4. Selecione **para quais cargos** e/ou **pessoas específicas**.
5. Escolha os **canais** (No Zykor, Push, WhatsApp).
6. Opcionalmente informe um **link ao clicar** (ex.: `/operacional/checklists`).
7. Clique em **Enviar aviso**. O sistema mostra para quantas pessoas foi (e quantos push saíram). O aviso aparece na hora na Central de quem você escolheu.

### Ativar push e WhatsApp (qualquer usuário)

1. Vá para a aba **Dispositivos**.
2. Em **Notificações push neste aparelho**, ligue o interruptor. É preciso ativar **em cada aparelho** que você usa. No iPhone, primeiro adicione o Zykor à Tela de Início pelo Safari e abra pelo ícone instalado.
3. Em **Meu WhatsApp para alertas**, digite seu número com DDD (10 ou 11 dígitos) e clique em **Salvar**. Você passa a receber pelo WhatsApp oficial os alertas em que for destinatário e que tenham o canal WhatsApp ligado.

## Abas e seções

| Aba | Quem vê | O que faz |
|---|---|---|
| **Caixa de entrada** | Todos | Suas notificações em tempo real, com resumo, filtros e ações (ler, excluir). |
| **Alertas** | Admin / módulo Configurações | Duas seções: **Alertas do sistema** (matriz evento × destinatário × canal) e **Meus alertas** (construtor de alertas sob medida). |
| **Enviar aviso** | Admin / módulo Configurações | Broadcast manual: um recado para cargos e/ou pessoas escolhidas. |
| **Histórico** | Admin / módulo Configurações | Tudo que o sistema disparou no bar — uma linha por destinatário. |
| **Dispositivos** | Todos | Push por aparelho, canal "No Zykor" (sempre ligado) e cadastro do WhatsApp pessoal. |

## Colunas e cálculos

### Cartões de resumo (Caixa de entrada)

Os quatro cartões usam as estatísticas dos **últimos 7 dias** do usuário logado (calculadas contando as notificações desse período).

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Não lidas** | Quantas notificações suas ainda não foram lidas | Contagem de registros do usuário com `lida = false` (todo o histórico, não só 7 dias) | `system.notificacoes` |
| **Últimos 7 dias** | Total de notificações recebidas na última semana | Contagem de registros do usuário com `criada_em` nos últimos 7 dias | `system.notificacoes` |
| **Alertas** | Quantas foram de atenção/urgência | Soma das severidades `alerta` + `critico` nos últimos 7 dias | `system.notificacoes` |
| **Concluídas** | Quantas foram boas notícias/conclusões | Contagem da severidade `sucesso` nos últimos 7 dias | `system.notificacoes` |

### Lista de notificações (Caixa de entrada e Histórico)

Cada linha da caixa de entrada mostra os campos do próprio registro de notificação. Não há cálculo — são os dados gravados quando o evento foi disparado.

| Campo | O que mostra | Origem |
|---|---|---|
| **Emoji de severidade** | ℹ️ info · ✅ sucesso · ⚠️ alerta · 🚨 crítico (e a borda colorida à esquerda) | Campo `severidade` |
| **Categoria** | Rótulo + emoji da categoria (Operacional, Financeiro etc.) | Campo `categoria` (mapeado pelo catálogo) |
| **Ponto azul** | Indica que a notificação ainda não foi lida | Campo `lida = false` |
| **Tempo** | "agora", "5min atrás", "2h atrás", "3d atrás" | Diferença entre agora e `criada_em` |
| **Título** | Assunto curto do aviso | Campo `titulo` |
| **Mensagem** | Texto do aviso | Campo `mensagem` |
| **Link (ao clicar)** | Abre a tela relacionada | Campo `url` |

Na aba **Histórico**, cada linha ainda mostra o **destinatário** (nome/e-mail do usuário) e um selo **nova/lida** (campo `lida`). O histórico traz **uma linha por destinatário** — se um aviso foi para 5 pessoas, aparecem 5 linhas.

### Alertas do sistema (aba Alertas)

Cada evento vem do catálogo de notificações (código, não banco). As opções por evento são gravadas como uma regra.

| Campo da regra | O que é | Fonte |
|---|---|---|
| **Evento (label/descrição)** | O que dispara o aviso (ex.: "Checklist vencido") | Catálogo `NOTIFICATION_EVENTS` |
| **Ligado/desligado** | Se o evento notifica alguém | `system.notification_rules.ativo` |
| **Cargos** | Cargos que recebem (admin, financeiro, funcionário) | `target_roles` |
| **Pessoas específicas** | Usuários individuais que recebem | `target_user_ids` |
| **Canais** | 🔔 No Zykor, 📱 Push, 💬 WhatsApp (só os suportados pelo evento) | `canais` |

### Meus alertas — construtor (aba Alertas)

O resumo de cada alerta criado é montado assim: **rótulo do sinal + [alvo, se houver] + operador + limite + unidade**, seguido dos canais e da lista de destinatários.

| Campo | O que é | Fonte |
|---|---|---|
| **Sinal** | A métrica medida (ex.: faturamento do dia, estoque de insumo, CMV%) | Catálogo `ALERT_SIGNALS` → `signal_key` |
| **Operador** | `<`, `≤`, `>`, `≥`, `=` | `operador` |
| **Limite** | Valor de comparação (só para sinais que usam limite) | `limite` |
| **Alvo** | Insumo/produto específico, quando o sinal exige | `alvo_id` / `alvo_label` |
| **Severidade** | Info / Sucesso / Alerta / Crítico | `severidade` |
| **Canais** | Onde o alerta é entregue | `canais` |
| **Destinatários** | Cargos e/ou pessoas | `target_roles` / `target_user_ids` |
| **Não repetir por (h)** | Cooldown — tempo mínimo antes de repetir o mesmo alerta | `cooldown_horas` (padrão 12h) |
| **Ativo** | Se o alerta está sendo avaliado | `ativo` |

## Filtros e opções

- **Categoria (chips)** — na Caixa de entrada e no Histórico, filtra a lista por Operacional, Financeiro, Eventos & Metas, Estoque & Compras, NPS & Clientes ou Sistema. "Todas" remove o filtro.
- **Só não lidas** — na Caixa de entrada, mostra apenas o que você ainda não leu.
- **Carregar mais** — no Histórico, pagina de 30 em 30 registros.
- **Bar atual** — toda a tela é escopada ao bar selecionado no topo do Zykor; ao trocar de bar, as notificações, regras e alertas mudam junto.
- **Canais (nas regras e no construtor)** — cada canal (No Zykor, Push, WhatsApp) é ligado independentemente. Um canal marcado como indisponível fica esmaecido com "(em breve)".

## Regras e detalhes importantes

- **Filtragem por bar**: tudo é filtrado por `bar_id`. A caixa de entrada é ainda escopada ao **seu usuário** (`usuario_id`); o histórico mostra o bar inteiro.
- **Tempo real**: a Caixa de entrada assina mudanças ao vivo (Supabase Realtime). Notificações novas aparecem sem recarregar a página, e o contador de não lidas sobe na hora — inclusive no sino do topo.
- **Canal "No Zykor" sempre ligado**: o canal in-app não pode ser desligado; é o mínimo garantido. Push e WhatsApp são opcionais e dependem do usuário ter ativado no aparelho / cadastrado o número.
- **Evento desligado = ninguém recebe**: se o interruptor do evento estiver desligado nas Regras, aquele fato não gera notificação para nenhum canal.
- **Só canais suportados**: ao salvar uma regra, o sistema descarta canais que o evento não suporta (não dá para ligar WhatsApp num evento que não usa WhatsApp).
- **Cooldown dos alertas sob medida**: o campo "Não repetir por (h)" evita spam — o mesmo alerta não repete antes desse intervalo. O botão **Testar agora** ignora o cooldown para você validar na hora.
- **Alguns eventos têm roteamento próprio** e não aparecem na matriz de Regras: aviso manual, alerta automático (condição), novo feedback e o briefing diário do dono (destinatários definidos por código — piloto).
- **WhatsApp oficial**: mensagens saem pelo número oficial do Zykor (via Umbler Talk). O usuário só recebe pelo WhatsApp se cadastrar o número (10 ou 11 dígitos com DDD) e for destinatário de um alerta com o canal WhatsApp ligado.
- **Manual vs automático**: os avisos da aba **Enviar aviso** são 100% manuais (broadcast do admin). Os **Alertas do sistema** e os **Meus alertas** são automáticos — avaliados por cron e disparados quando a condição bate.

## Dúvidas frequentes

**Não estou recebendo push no celular. O que fazer?**
Ative o push na aba **Dispositivos**, em cada aparelho. No iPhone, é obrigatório adicionar o Zykor à Tela de Início pelo Safari e abrir pelo ícone instalado — o iOS só permite push pelo app instalado.

**Cadastrei meu WhatsApp mas não chega nada.**
Você só recebe pelo WhatsApp os alertas em que é **destinatário** e que tenham o **canal WhatsApp ligado** nas Regras (ou no alerta sob medida). Confirme com o admin se o evento tem WhatsApp habilitado para o seu cargo/pessoa.

**Liguei um evento nas Regras mas ninguém recebe.**
Verifique se você selecionou ao menos um **cargo** ou **pessoa** e ao menos um **canal**, e clicou em **Salvar**. Evento ligado sem destinatário não notifica.

**Qual a diferença entre "Alertas do sistema" e "Meus alertas"?**
Alertas do sistema são eventos que o Zykor já detecta (checklist vencido, meta batida etc.) — você só escolhe quem recebe. Meus alertas são condições que você mesmo cria (ex.: "faturamento do dia < meta", "CMV > 30%").

**O que faz o botão "Testar agora" num alerta sob medida?**
Avalia a condição na hora (dry-run), ignorando o cooldown. Se a condição bater, dispara de verdade e você confere no sino/WhatsApp; se não bater, ele só informa que nada foi disparado.

**Por que não vejo as abas Alertas, Enviar e Histórico?**
Essas abas exigem o módulo **Configurações** (ou cargo admin). Sem essa permissão, você vê apenas a Caixa de entrada e os Dispositivos.

## Fonte dos dados

- **`system.notificacoes`** — o inbox: uma linha por notificação por destinatário (colunas `event_key`, `categoria`, `severidade`, `titulo`, `mensagem`, `url`, `canais`, `lida`, `criada_em`). Alimenta a Caixa de entrada, os cartões de resumo e o Histórico.
- **`system.notification_rules`** — regras por evento e por bar (ligado, cargos, pessoas, canais). Alimenta a aba Alertas do sistema.
- **`system.alert_conditions`** — alertas sob medida do construtor (sinal, operador, limite, alvo, severidade, canais, destinatários, cooldown). Alimenta "Meus alertas".
- **Catálogos em código** — `lib/notifications/catalog.ts` (eventos, categorias, canais) e `lib/notifications/signals.ts` (sinais do construtor). Não vêm do banco.
- **Usuários do bar** — via repositório de usuários (`/api/configuracoes/notifications/usuarios`), para os seletores de destinatários.
- **Perfil do usuário** — `/api/usuarios/perfil` (telefone/WhatsApp), na aba Dispositivos.
- **Motor de avaliação e entrega** — os alertas automáticos são avaliados pelo *condition engine* (por cron) e entregues pelo *dispatcher*, que também envia push (Web Push) e WhatsApp (via Umbler Talk, número oficial do Zykor). Os sinais leem dados de estoque/contagem, produção, financeiro (Conta Azul), CMV, NPS/avaliações Google e status dos pipelines, conforme cada sinal.
