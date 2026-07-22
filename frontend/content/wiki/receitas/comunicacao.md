---
title: Comunicação
area: receitas
slug: comunicacao
route: /receitas/comunicacao
description: Hub de mídia do bar no Instagram — painel do perfil (com sincronização), desempenho orgânico, anúncios pagos (Meta Ads), calendário de conteúdo e análise de feed, stories e demografia do público.
order: 30
icon: Megaphone
---

# Comunicação

## Visão geral

A tela **Comunicação** é o hub de mídia do bar. Ela junta, num só lugar, tudo o que acontece na comunicação digital: o que o perfil do Instagram alcança de forma **orgânica** (sem pagar), o que é **investido** em anúncios (Meta Ads), o **calendário** de posts programados e a análise detalhada de **feed, stories e demografia** do público.

A ideia central é separar o que é **orgânico** (alcance e engajamento naturais do perfil) do que é **pago** (mídia comprada com verba). Assim o gestor consegue enxergar se o crescimento vem do conteúdo em si ou do investimento em anúncios, e quanto cada real de mídia está rendendo.

A **página inicial** do hub é o **painel do Instagram**: foto, bio e contadores do perfil, um resumo das métricas recentes (alcance, visitas, cliques e saldo de seguidores), a evolução de seguidores e os top posts — além do botão **Sincronizar agora**, que puxa os dados da conta na hora.

Quem usa no dia a dia: donos, sócios e a pessoa responsável por marketing/social media, para acompanhar a performance das redes, planejar posts e avaliar o retorno da verba de anúncios.

## Como acessar

No menu lateral: **Receitas › Comunicação** (ícone de megafone). Ao abrir, a tela cai no **painel do Instagram** (aba principal).

A rota é `/receitas/comunicacao`. A permissão exigida é o módulo **relatorios** (o mesmo do restante da área Receitas). Sem esse acesso, o item não aparece no menu.

Todas as informações são sempre do **bar selecionado** no seletor de bar do topo. Se nenhum bar estiver selecionado, a tela pede para escolher um.

## Passo a passo

**Ver o painel e sincronizar o Instagram (aba Instagram):**
1. Entre em **Receitas › Comunicação** — abre direto no painel do Instagram.
2. Confirme o bar selecionado no topo.
3. Veja o cabeçalho do perfil (foto, bio, seguidores/posts/seguindo), os cards de métrica recente, a evolução de seguidores e os top posts.
4. Clique em **Sincronizar agora** para atualizar os dados na hora. Na **primeira conexão** de um bar, esse botão puxa o **histórico completo** (todos os feed e reels, não só os últimos 30 dias); depois disso os crons diários se alimentam sozinhos.
5. Se o painel disser que o Instagram não está conectado, use o botão **Ir para Integrações** para conectar o bar.

**Ver o desempenho orgânico do Instagram (aba Orgânico):**
1. Clique na aba **Orgânico**.
2. Confirme o bar selecionado no topo.
3. Use o seletor de período (barra logo abaixo do título) para escolher o intervalo — o padrão é o trimestre por mês. **O período escolhido é compartilhado entre as abas** (Orgânico, Mídia, Feed): trocou aqui, continua o mesmo ao navegar.
4. Os cards de KPI mostram alcance, interações, compartilhamentos, taxa de engajamento, stories, visualizações de stories, visitas de perfil e seguidores do período.
5. Role até o gráfico **Alcance & Interações** para ver a tendência mês a mês.

**Analisar os anúncios pagos (aba Mídia):**
1. Clique na aba **Mídia**.
2. Ajuste o período no seletor.
3. Veja o **Resumo do período** (investimento, alcance, cliques, CPM, CTR, conversas e as métricas de eficiência).
4. Confira os gráficos de posicionamento, público e investimento por campanha, além do **ROAS**.
5. Nas tabelas **Por campanha** e **Por anúncio**, clique no cabeçalho de qualquer coluna para reordenar. Use **Carregar mais** para ver além dos primeiros 50 itens.

**Programar um post no calendário (aba Calendário):**
1. Clique na aba **Calendário**.
2. Navegue entre meses com as setas, ou volte ao mês atual com o botão **Hoje**.
3. Clique num dia (ou no botão **Adicionar post**) para abrir o formulário.
4. Preencha **data**, **categoria** (define a cor), **título** e, se quiser, **formato** e **observação**.
5. Clique em **Adicionar**. Para editar ou excluir, clique no post já existente no calendário.

**Comparar formatos de feed (aba Feed):**
1. Clique na aba **Feed**.
2. Escolha o período no seletor (o mesmo controle das outras abas — compartilhado).
3. Veja o resumo e o comparativo entre formatos (**Carrossel × Imagem × Reels**).
4. Na lista de posts, alterne entre **Melhores** e **Piores** para ordenar por engajamento. Cada post mostra alcance, curtidas, comentários, **compartilhamentos** e salvos.

## Abas e seções

A Comunicação é organizada em abas por rota (a navegação fica fixa no topo):

- **Instagram** (`/receitas/comunicacao`) — **página inicial** do hub: painel do perfil (foto, bio, contadores), métricas recentes, evolução de seguidores, top posts e o botão **Sincronizar agora**.
- **Orgânico** (`/receitas/comunicacao/organico`) — KPIs do Instagram **orgânico** por período e o gráfico de tendência de alcance e interações. (Já foi a página inicial; antes disso chamava "Visão geral".)
- **Mídia** (`/receitas/comunicacao/anuncios`) — mídia **paga** (Meta Ads): resumo, gráficos, e tabelas detalhadas por campanha e por anúncio. (Antes chamava "Anúncios".)
- **Calendário** (`/receitas/comunicacao/calendario`) — planejamento mensal dos posts programados, com cadastro/edição/exclusão.
- **Feed** (`/receitas/comunicacao/feed`) — performance dos posts de feed (carrossel e imagem), com ranking e comparação de formatos.
- **Stories** (`/receitas/comunicacao/stories`) — desempenho dos stories capturados (reaproveita a tela de Stories do Instagram).
- **Demografia** (`/receitas/comunicacao/demografia`) — perfil do público (gênero, idade, cidades, países e origem do alcance).

Existe ainda uma rota **Reels** (`/receitas/comunicacao/reels`) que reaproveita a tela de Reels do Instagram, mas ela **não está listada na barra de abas** — só é acessível pela URL direta.

## Colunas e cálculos

### Instagram (painel) — página inicial

Diferente das outras abas, o painel do Instagram **não usa o seletor de período**: mostra o retrato atual do perfil e uma janela fixa recente (D-1 e últimos 7/30 dias). Os dados vêm de `/api/instagram/dashboard`.

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cabeçalho do perfil | Foto, nome, @usuário, bio e tipo de conta | Campos do perfil no último sync | `integrations.instagram_contas` |
| Seguidores / Posts / Seguindo | Contadores do perfil | `followers_count`, `media_count`, `follows_count` | `integrations.instagram_contas` |
| Reach (D-1) | Alcance da conta no dia anterior (+ 7 dias) | `reach` do snapshot D-1 e soma dos últimos 7 dias | `integrations.instagram_conta_metricas` |
| Profile views (D-1) | Visitas de perfil no dia anterior (+ 7 dias) | `profile_views` | `integrations.instagram_conta_metricas` |
| Cliques no link | Cliques no link do perfil (D-1 + 7 dias) | `website_clicks` | `integrations.instagram_conta_metricas` |
| Saldo seguidores (D-1) | Ganho/perda de seguidores no dia | Diferença de `followers_count` vs o snapshot anterior | `integrations.instagram_conta_metricas` |
| Evolução de seguidores (30 dias) | Linha de seguidores dia a dia | Série dos snapshots dos últimos 30 dias (com ganho/perda no tooltip) | `integrations.instagram_conta_metricas` |
| Top posts (30 dias) | Melhores posts por reach | Ordena posts por `reach` (fallback engajamento); mostra tipo, data e métricas | `integrations.instagram_posts` + `instagram_post_insights` |
| Botão **Sincronizar agora** | Dispara o sync do bar na hora | Chama `ig-sync-diario`; na 1ª conexão puxa histórico completo (feed + reels) | `/api/instagram/sync-agora` |
| Token expira / Última sync | Validade do token e horário do último sync | `expires_at` e log de sync | `integrations.instagram_contas` / `instagram_sync_logs` |

### Orgânico — Instagram orgânico

O alcance e as interações são somados **post a post** (Feed **+** Reels), pegando o último snapshot de cada mídia — a mesma base da aba Feed. Antes o hub somava o snapshot diário da conta inteira, o que inflava o número.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Alcance (orgânico) | Alcance somado dos posts do período | Soma do `reach` de cada post **Feed + Reels** (último snapshot por mídia) | `integrations.instagram_posts` + `instagram_post_insights` |
| Interações | Total de interações dos posts | Soma de `curtidas + comentários + compartilhamentos + salvos` por post (Feed + Reels) | `instagram_post_insights` |
| Compartilhamentos | Compartilhamentos (subconjunto das interações, exposto à parte) | Soma de `shares` por post (Feed + Reels) | `instagram_post_insights` |
| Taxa de engajamento | Interações por alcance, em % | `interações ÷ alcance × 100` (nulo se alcance = 0) | derivado |
| Stories | Quantidade de stories capturados no período | Contagem de registros de stories no intervalo | `integrations.instagram_stories` |
| Visualizações dos stories | Visualizações somadas dos stories | Soma de `views` dos stories do período | `integrations.instagram_stories` |
| Visitas de perfil | Visitas ao perfil no período | Soma dos valores diários de `profile_views` | `integrations.instagram_conta_metricas` |
| Seguidores | Total de seguidores | Valor de `followers_count` do **último** snapshot do período | `integrations.instagram_conta_metricas` |
| Gráfico Alcance & Interações | Tendência mês a mês | Alcance (barra) e interações (linha), agrupados por mês | derivado dos posts |

> A quebra **Feed × Reels** aparece logo abaixo dos KPIs (posts, alcance, interações e compartilhamentos de cada um). "Alcance orgânico = Feed + Reels": ferramentas externas cujo card é só "postagens do feed" podem excluir parte dos reels e mostrar um número menor.

### Mídia — resumo do período (Meta Ads)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Investimento | Verba gasta em anúncios | `spend` da conta no período (valor cheio, com centavos) | Meta Marketing API (nível conta) |
| Impressões | Vezes que os anúncios foram exibidos | `impressions` | Meta Marketing API |
| Alcance | Pessoas únicas alcançadas | `reach` | Meta Marketing API |
| Cliques | **Todos** os cliques (link, perfil, expandir…) | `clicks` | Meta Marketing API |
| CPM | Custo por mil impressões | `investimento ÷ impressões × 1000` (recalculado dos totais) | derivado |
| CTR | Taxa de cliques **no link**, em % | `cliques no link ÷ impressões × 100` (usa `inline_link_clicks`, igual Reportei) | derivado |
| Conversas | Conversas iniciadas por mensagem | Valor da ação `onsite_conversion.messaging_conversation_started_7d` | Meta Marketing API (`actions`) |
| Custo/clique (CPC) | Custo por clique **no link** | `investimento ÷ cliques no link` (usa `inline_link_clicks`) | derivado |
| Frequência | Média de vezes que cada pessoa viu o anúncio | `frequency`, precisão cheia (sinal de fadiga acima de ~3–4) | Meta Marketing API |
| ROAS de compra | Retorno de venda por R$1 investido | `purchase_roas` (compra via pixel) | Meta Marketing API |
| Custo/conversa | Custo por conversa iniciada | `investimento ÷ conversas` | derivado |
| Custo/venda | Custo por compra | `investimento ÷ compras` | derivado |
| Leads | Leads gerados | Ação `lead` | Meta Marketing API (`actions`) |
| Vídeos assistidos | ThruPlays (vídeo assistido completo/15s) | `video_thruplay_watched_actions` (tipo `video_view`) | Meta Marketing API |

### Mídia — gráficos

| Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Onde o investimento rende | Gasto por posicionamento (Stories/Feed/Reels × IG/FB) | Soma de `spend` por plataforma × posição; descarta posições com menos de R$1; top 8 | Meta API (breakdown `publisher_platform, platform_position`) |
| Público alcançado (pago) | Impressões por faixa etária e gênero | Soma de `impressions` por idade, separando feminino/masculino | Meta API (breakdown `age, gender`) |
| Investimento por campanha | Top 10 campanhas por gasto | `spend` por campanha, top 10 | Meta API (nível campanha) |
| ROAS / Gasto Comercial | Retorno por R$1 (artistas + produção + marketing) | `faturamento ÷ (artistas + produção + marketing)` por período | `/api/receitas/roas` |

### Mídia — tabelas Por campanha e Por anúncio

Ambas as tabelas usam as mesmas colunas de métrica; a tabela **Por anúncio** ainda mostra a miniatura do criativo, o status e a campanha de origem.

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Campanha / Anúncio | Nome do item | `campaign_name` / `ad_name` | Meta API |
| Status (só anúncios) | Situação do anúncio (Ativo, Pausado, Arquivado…) | `effective_status` do anúncio | Meta API |
| Investido | Gasto do item | `spend` | Meta API |
| Impressões | Vezes que o anúncio foi exibido | `impressions` | Meta API |
| Alcance | Pessoas únicas alcançadas | `reach` | Meta API |
| Cliques | Cliques | `clicks` | Meta API |
| CTR | Taxa de cliques | `cliques ÷ impressões × 100` | derivado |
| CPM | Custo por mil impressões | `spend ÷ impressões × 1000` | derivado |
| CPC | Custo por clique | `spend ÷ cliques` | derivado |
| Conversas | Conversas iniciadas por mensagem | Ação de conversa (7 dias) | Meta API |
| R$/conversa | Custo por conversa | `spend ÷ conversas` | derivado |
| Freq. | Frequência | `frequency` | Meta API |

### Feed

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Posts | Quantidade de posts no período | Contagem de posts com `media_product_type` **FEED ou REELS** | `integrations.instagram_posts` |
| Engajamento médio | Média de engajamento por post | Soma do engajamento ÷ nº de posts | derivado dos insights |
| Alcance médio | Média de alcance por post | Soma de `reach` ÷ nº de posts | `integrations.instagram_post_insights` |
| Melhor formato | Formato com maior engajamento médio | Formato (Carrossel/Imagem/Reels) com maior `engajamento_medio` | derivado |
| Engajamento (por post) | Interações do post | `curtidas + comentários + compartilhamentos + salvos` | `instagram_post_insights` (com fallback do post) |
| Taxa engaj. (por post) | Engajamento sobre alcance | `engajamento ÷ reach` | derivado |
| Alcance / Curtidas / Comentários / Compartilhamentos / Salvos | Métricas do post | Campos `reach`, `likes`, `comments`, `shares`, `saved` do insight mais recente do post | `instagram_post_insights` |
| Comparativo de formatos | Qual formato rende mais | Médias de engajamento, alcance e taxa por formato | derivado |

### Stories

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Stories | Quantidade de stories no período | Contagem de stories | `integrations.instagram_stories` |
| Reach total | Alcance somado | Soma de `reach` | `integrations.instagram_stories` |
| Replies | Respostas recebidas | Soma de `replies` | `integrations.instagram_stories` |
| Follows ganhos | Novos seguidores vindos dos stories | Soma de `follows` | `integrations.instagram_stories` |
| Profile visits | Visitas ao perfil pelos stories | Soma de `profile_visits` | `integrations.instagram_stories` |
| Cards por story (Reach, Replies, Exits, Taps fwd, Visits, Follows) | Métricas de cada story | Campos individuais do story | `integrations.instagram_stories` |

### Demografia

| Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Distribuição por gênero | Público por gênero | Contagem por gênero (donut) | `/api/instagram/dashboard` (demografia da conta) |
| Distribuição por idade | Público por faixa etária | Contagem por faixa de idade | `/api/instagram/dashboard` |
| Top 15 cidades | Cidades com mais público | Ranking por volume, top 15 | `/api/instagram/dashboard` |
| Top 10 países | Países com mais público | Ranking por volume, top 10 (nomes traduzidos) | `/api/instagram/dashboard` |
| Reach por tipo de conteúdo | De onde vem o alcance (posts, reels, stories, anúncios) | Soma do alcance por tipo, com carrossel unificado | `/api/instagram/dashboard` |

### Calendário

| Campo | O que mostra | Origem |
|---|---|---|
| Data | Dia do post programado | `marketing_calendario_posts.data` |
| Título | Nome/descrição do post | `titulo` |
| Formato | Rótulo livre (Reels, Carrossel, Meme, Story…) | `formato` |
| Categoria | Cor do post no calendário (Datas importantes, Reels, Postado, Programação, Design, Evento, Outro) | `categoria` |
| Observação | Referência/briefing opcional | `observacao` |

## Filtros e opções

- **Bar** — todas as abas mostram apenas o bar selecionado no topo (filtro por `bar_id`). Trocar de bar recarrega os dados.
- **Instagram (painel)** — **não tem seletor de período**: mostra o retrato atual do perfil e uma janela fixa recente (D-1, últimos 7 e 30 dias).
- **Período (Orgânico, Mídia e Feed)** — seletor de intervalo; o padrão é o trimestre agrupado por mês. **É o mesmo entre essas abas** (compartilhado): trocou numa, vale nas outras. Define o intervalo dos KPIs, gráficos e da lista de posts.
- **Ordenação (Feed)** — alternância entre **Melhores** e **Piores** posts por engajamento.
- **Ordenação (Mídia)** — clique no cabeçalho de qualquer coluna das tabelas para ordenar (investimento é o padrão).
- **Período em dias (Stories)** — 7, 30, 90, 180 ou 365 dias.
- **Mês (Calendário)** — navegação mês a mês, com botão **Hoje** para voltar ao mês atual.
- **Demografia** — não tem filtro de período; mostra o retrato mais recente do público capturado pela sincronização.

## Regras e detalhes importantes

- **Instagram é a aba principal (landing).** Abrir "Comunicação" cai no painel do Instagram; o orgânico por período virou a aba **Orgânico** ao lado.
- **"Sincronizar agora" puxa histórico completo.** Na primeira conexão de um bar o botão traz **todos** os posts (feed + reels), não só os últimos 30 dias — a API do Instagram (`/me/media`) não tem limite de tempo. Depois, os crons diários se alimentam de forma incremental (post novo + atualização dos recentes). Os *snapshots diários* de métrica só começam a partir do primeiro sync (não dá pra reconstruir o histórico dia a dia de um post antigo), mas os números **atuais** de cada post antigo vêm normalmente.
- **Orgânico × pago é a separação-chave.** A aba **Orgânico** só traz Instagram **orgânico** (Graph API). Toda a mídia **paga** e o **ROAS** ficam na aba **Mídia** (Meta Ads).
- **Filtro por bar sempre.** Toda consulta é filtrada por `bar_id`; a tela nunca mistura dados de bares diferentes.
- **Período compartilhado entre as abas.** O intervalo escolhido em Orgânico, Mídia ou Feed é o mesmo ao navegar (não reseta). Fica guardado na sessão.
- **Alcance e interações são somados post a post** (Feed + Reels), pegando o último snapshot de cada mídia. É alcance **somado**, não deduplicado de pessoas únicas — quem viu 3 posts conta 3 vezes. Por isso pode ficar acima de ferramentas que mostram alcance único da conta.
- **Seguidores** usa o valor do **último** snapshot do período (é um estoque, não uma soma).
- **Stories dependem do sync.** A Meta só permite ler stories **ativos** (vida de 24h). A sincronização roda a cada ~2h e agora **pagina** a lista — captura **todos** os stories ativos, não só os 25 primeiros (antes perdia o excedente quando havia muitos ativos ao mesmo tempo). Stories que saíram do ar antes de qualquer sync não ficam registrados. **Reposts de conteúdo de terceiros não vêm pela API oficial** e não entram na contagem.
- **Anúncios exigem conta conectada.** Se o bar não tiver conta de anúncio configurada (variável `META_ADS_ACCOUNTS` no Vercel), a aba **Mídia** avisa que não está conectada. Se estiver conectada mas sem gasto no período, mostra "sem anúncios com investimento".
- **CPM é recalculado** dos totais. **CTR e CPC usam cliques NO LINK** (`inline_link_clicks`), não todos os cliques — assim batem com o Reportei. O card "Cliques" segue mostrando **todos** os cliques (como o Meta Ads Manager).
- **Conversas = mensagens iniciadas por anúncio** nos últimos 7 dias (não é qualquer clique). Custo/conversa e custo/venda só aparecem quando há conversas/compras no período.
- **Posicionamento descarta ruído:** posições com gasto abaixo de R$1 são omitidas do gráfico.
- **Feed = posts de feed + reels** (carrossel, imagem e reels). Stories têm sua própria aba. (A aba dedicada de Reels existe só por URL direta.)
- **Calendário é manual.** Os posts programados são cadastrados pela equipe (título, formato, categoria e observação livres) — não vêm de integração. Editar/excluir só afeta o registro do próprio bar.
- **Dados de anúncio têm cache curto** no servidor (cerca de 30 min) para não bater na API da Meta a cada abertura da tela.

## Dúvidas frequentes

**Por que o alcance do Orgânico é diferente do alcance da Mídia?**
São coisas diferentes: a aba **Orgânico** é o alcance **orgânico** do perfil (Graph API); a aba **Mídia** mostra o alcance da **mídia paga** (Meta Ads). Um não substitui o outro.

**Meus stories de ontem não apareceram. Por quê?**
A Meta só deixa ler stories enquanto estão ativos (24h). A sincronização roda a cada ~2h; se um story saiu do ar antes de ser capturado, ele não fica registrado.

**A aba Mídia diz que a conta não está conectada. O que fazer?**
Falta configurar a conta de anúncio do bar (variável `META_ADS_ACCOUNTS` no Vercel). Sem isso, não há como puxar os dados da Meta Marketing API.

**O que significa a Frequência alta nos anúncios?**
É quantas vezes, em média, cada pessoa viu o anúncio. Acima de ~3–4 costuma indicar fadiga de público — vale renovar criativo ou ampliar o público.

**O calendário publica os posts automaticamente?**
Não. Ele é uma agenda de planejamento (título, formato, categoria e observação). A publicação continua sendo feita manualmente no Instagram.

**Como sei qual formato de post rende mais?**
Na aba Feed, o comparativo **Carrossel × Imagem** marca o "melhor" formato pelo maior engajamento médio no período escolhido.

## Fonte dos dados

**Instagram orgânico (Graph API):**
- `integrations.instagram_posts` + `integrations.instagram_post_insights` — posts (Feed + Reels) e suas métricas; base do alcance/interações/compartilhamentos do Orgânico e da aba Feed.
- `integrations.instagram_conta_metricas` — snapshots diários de alcance, visitas de perfil, seguidores e demografia (painel Instagram e Orgânico).
- `integrations.instagram_stories` — stories capturados (Orgânico e aba Stories).
- `integrations.instagram_contas` — perfil e token da conta conectada (painel Instagram).
- `/api/instagram/dashboard` — painel do Instagram (perfil, métricas recentes, evolução, top posts) e dados demográficos da conta (aba Demografia).
- `ig-sync-diario` (edge function) — sincroniza perfil, posts e insights; disparável na hora pelo botão **Sincronizar agora** via `/api/instagram/sync-agora`.

**Mídia paga (Meta Ads / Marketing API):**
- Endpoint `graph.facebook.com/act_<id>/insights` via System User token, nos níveis conta, campanha e anúncio, além dos breakdowns de posicionamento e demografia (aba Mídia). Configuração pelas variáveis `META_ADS_ACCESS_TOKEN` e `META_ADS_ACCOUNTS` no Vercel (mapa `bar_id → conta de anúncio`).
- `/api/receitas/roas` — card ROAS / Gasto Comercial (faturamento sobre custos de artistas, produção e marketing).

**Planejamento (manual):**
- `marketing_calendario_posts` — posts programados no calendário (CRUD via `/api/receitas/comunicacao/calendario`).

**Rotas de API usadas pela tela:**
- `/api/instagram/dashboard` e `/api/instagram/sync-agora` (painel Instagram + botão Sincronizar)
- `/api/receitas/comunicacao-organico` (Orgânico)
- `/api/receitas/anuncios` e `/api/receitas/roas` (Mídia)
- `/api/instagram/feed`, `/api/instagram/stories`, `/api/instagram/dashboard` (Feed, Stories, Demografia)
- `/api/receitas/comunicacao/calendario` (Calendário)
