---
title: Feedbacks
area: configuracoes
slug: feedbacks
route: /configuracoes/feedbacks
description: Caixa de entrada dos feedbacks que a equipe envia sobre cada tela do sistema, para o admin ler, resolver ou descartar.
order: 50
icon: MessageCircle
---

# Feedbacks

## Visão geral

A tela **Feedbacks** é a caixa de entrada das mensagens que a equipe manda sobre o próprio sistema Zykor. Sempre que alguém aponta um bug, sugere uma melhoria ou tira uma dúvida sobre uma tela, essa mensagem cai aqui — junto com **quem** enviou e **em qual tela** a pessoa estava no momento.

O objetivo é simples: dar ao administrador um lugar único para acompanhar o que a galera está reportando, avaliar cada item, marcar como lido, resolver ou descartar. Não é feedback de cliente do bar — é feedback interno da equipe sobre o funcionamento das ferramentas do Zykor.

Quem usa no dia a dia é o **administrador** (dono ou gestor com perfil admin), que revisa periodicamente a fila e cuida dos itens em aberto.

## Como acessar

No menu lateral, dentro da seção de **Configurações**, clique em **Feedbacks**. A rota é `/configuracoes/feedbacks`.

O item de menu exige a permissão do módulo **`configuracoes`**. Além disso, a listagem em si só é liberada para usuários com perfil **admin**: a API que alimenta a tela (`GET /api/feedback`) responde "Apenas admin" (erro 403) para qualquer outro perfil. Ou seja, mesmo que a rota abra, só um admin consegue ver e mexer nos feedbacks.

## Passo a passo

### Ler os feedbacks

1. Acesse **Configurações → Feedbacks**.
2. A tela abre já mostrando **todos** os feedbacks, do mais recente para o mais antigo.
3. Cada feedback aparece em um cartão com: o **status** atual, o **nome de quem enviou** (ou o e-mail, ou "Anônimo"), a **tela/rota** de origem, a **data e hora** do envio e o **texto** da mensagem.

### Filtrar por situação

1. Use os botões no topo: **Todos**, **Novos**, **Lidos**, **Resolvidos**, **Descartados**.
2. Ao clicar em um filtro, a lista recarrega mostrando só os feedbacks naquele status.
3. Para voltar a ver tudo, clique em **Todos**.

### Ir até a tela reportada

1. Se o feedback tiver uma rota associada, o caminho aparece como um link azul no cabeçalho do cartão.
2. Clique nele para abrir a mesma tela em que a pessoa estava quando escreveu — útil para reproduzir o problema ou entender o contexto.

### Tratar um feedback

1. Localize o cartão do feedback.
2. Use os botões de ação no rodapé do cartão:
   - **Marcar lido** — disponível só enquanto o feedback estiver como "novo"; sinaliza que você já leu.
   - **Resolver** — marca como resolvido (some da fila de pendências quando você filtra por Novos/Lidos).
   - **Descartar** — arquiva o feedback como descartado, quando não for algo a tratar.
3. Ao clicar, o status muda na hora e a lista se atualiza sozinha respeitando o filtro ativo.

## Colunas e cálculos

A tela não tem tabela com colunas calculadas: cada feedback é um cartão com campos que vêm **direto** da tabela `system.feedbacks`, sem fórmula ou agregação. Abaixo, o que cada campo mostra e de onde vem.

| Campo no cartão | O que mostra | Como é preenchido | Fonte |
|---|---|---|---|
| Status (badge) | Situação do feedback: `novo`, `lido`, `resolvido` ou `descartado` | Começa em `novo` no envio; muda quando o admin clica em Marcar lido / Resolver / Descartar (PATCH) | `system.feedbacks.status` |
| Autor | Nome de quem enviou; se não houver nome, usa o e-mail; se nenhum, mostra "Anônimo" | Capturado do usuário logado no momento do envio | `system.feedbacks.usuario_nome`, `email` |
| Rota (link) | Tela em que a pessoa estava ao escrever, como link clicável | Gravada a partir do `pathname` da página no envio; só aparece se existir | `system.feedbacks.rota` |
| Data/hora | Quando o feedback foi enviado, no formato pt-BR | Carimbo de criação do registro, exibido com `toLocaleString('pt-BR')` | `system.feedbacks.criada_em` |
| Mensagem | O texto que a pessoa escreveu | Digitado no envio (mínimo 3, máximo 4000 caracteres) | `system.feedbacks.mensagem` |

Campos que existem na tabela mas **não** aparecem no cartão: `usuario_id`, `bar_id`, `user_agent`, `resposta` (nota interna do admin) e `atualizada_em`. Eles são carregados pela API, mas a versão atual da tela não os exibe.

## Filtros e opções

| Filtro | Efeito |
|---|---|
| **Todos** | Mostra todos os feedbacks, sem filtro de status (padrão ao abrir). |
| **Novos** | Só os que ainda não foram lidos (`status = novo`). |
| **Lidos** | Só os marcados como lidos (`status = lido`). |
| **Resolvidos** | Só os já resolvidos (`status = resolvido`). |
| **Descartados** | Só os arquivados como descartados (`status = descartado`). |

O filtro age apenas sobre o status. A lista sempre vem ordenada da mais recente para a mais antiga e traz no máximo **200** feedbacks por vez.

## Regras e detalhes importantes

- **Não filtra por bar.** Diferente da maioria das telas do Zykor, esta lista mostra os feedbacks de **todos os bares** juntos. O `bar_id` de quem enviou é gravado no registro, mas a tela não separa nem filtra por bar. Cada cartão não distingue visualmente de qual bar veio.
- **Só admin vê e mexe.** Tanto a listagem (GET) quanto a mudança de status (PATCH) são bloqueadas para não-admins com erro 403.
- **Autor sempre identificado.** O feedback carrega o nome/e-mail de quem enviou justamente para o admin poder chamar a pessoa e tirar dúvida. "Anônimo" só aparece se o registro não tiver nem nome nem e-mail.
- **Status é manual.** A mudança de situação depende do admin clicar nos botões; nada muda de status sozinho. Cada clique também grava a data de atualização (`atualizada_em`) no registro.
- **Notificação no sino.** Quando um feedback novo é criado, o sistema avisa os admins do bar por notificação interna (evento `feedback_novo`), com link direto para esta tela. Esse aviso é "best-effort": se falhar, não impede o envio do feedback.
- **Campo de resposta existe, mas não é editável aqui.** A tabela tem um campo `resposta` para nota interna do admin, previsto na API (PATCH), mas a tela atual não oferece caixa para preenchê-lo — só os botões de status.
- **Origem dos feedbacks: o widget flutuante.** Os registros eram criados por um widget de feedback que ficava fixo na borda da tela em todas as páginas autenticadas, capturando automaticamente a rota atual. Importante: esse widget flutuante **não está mais montado no layout** do sistema. O componente e a API de envio continuam existindo no código, mas, sem o widget ativo, novos feedbacks não estão sendo capturados pela via original — esta tela funciona como leitora do histórico já registrado.

## Dúvidas frequentes

**Consigo ver feedbacks de todos os bares?**
Sim. A tela lista os feedbacks de todos os bares em conjunto, sem separar por unidade.

**Quem pode acessar esta tela?**
Usuários com a permissão do módulo Configurações, e efetivamente só perfis **admin** conseguem carregar e tratar a lista — os demais recebem bloqueio.

**Qual a diferença entre "Descartar" e "Resolver"?**
"Resolver" indica que o ponto foi tratado/atendido; "Descartar" arquiva algo que não será tratado (duplicado, sem ação, etc.). Ambos tiram o item das filas de Novos/Lidos.

**Dá para responder a pessoa por aqui?**
Não diretamente na tela. Existe um campo de nota interna (`resposta`) na estrutura de dados, mas a versão atual não tem caixa para escrevê-lo. Para responder, chame a pessoa pelo nome/e-mail que aparece no cartão.

**Por que alguns feedbacks aparecem como "Anônimo"?**
Só quando o registro não tem nome nem e-mail salvos. Normalmente o feedback traz o nome de quem enviou.

**Parei de receber feedbacks novos, é normal?**
Pode ser. O widget flutuante que capturava os feedbacks foi removido do layout. Esta tela continua mostrando o que já foi registrado; para voltar a captar novos, o widget precisaria ser reativado.

## Fonte dos dados

- **Tabela:** `system.feedbacks` (Supabase/PostgreSQL) — guarda cada feedback com autor, bar, rota, mensagem, status, user agent e carimbos de criação/atualização. Criada na migração `20260707_feedbacks.sql`.
- **API de leitura/edição:** `frontend/src/app/api/feedback/route.ts` — `GET` lista (só admin, ordenado por data, limite 200), `PATCH` altera status/resposta (só admin), `POST` cria um novo feedback.
- **Origem dos registros:** componente `FeedbackWidget` (`frontend/src/components/FeedbackWidget.tsx`), que enviava a mensagem junto com a rota atual (`pathname`) — atualmente não montado no layout.
- **Notificações:** disparo do evento `feedback_novo` para os admins (catálogo em `frontend/src/lib/notifications/catalog.ts`).

Não há integração externa (ContaHub, NIBO, Conta Azul, Stone, etc.) envolvida: o dado é 100% interno do próprio Zykor.
