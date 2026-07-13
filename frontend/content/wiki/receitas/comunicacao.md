---
title: Comunicação
area: receitas
slug: comunicacao
route: /receitas/comunicacao
description: Hub de mídia do bar no Instagram — reúne desempenho orgânico, anúncios pagos (Meta Ads), calendário de conteúdo e análise de feed, stories e demografia do público.
order: 30
icon: Megaphone
---

# Comunicação

## Visão geral

A tela **Comunicação** é o hub de mídia do bar. Ela junta, num só lugar, tudo o que acontece na comunicação digital: o que o perfil do Instagram alcança de forma **orgânica** (sem pagar), o que é **investido** em anúncios (Meta Ads), o **calendário** de posts programados e a análise detalhada de **feed, stories e demografia** do público.

A ideia central é separar o que é **orgânico** (alcance e engajamento naturais do perfil) do que é **pago** (mídia comprada com verba). Assim o gestor consegue enxergar se o crescimento vem do conteúdo em si ou do investimento em anúncios, e quanto cada real de mídia está rendendo.

Quem usa no dia a dia: donos, sócios e a pessoa responsável por marketing/social media, para acompanhar a performance das redes, planejar posts e avaliar o retorno da verba de anúncios.

## Como acessar

No menu lateral: **Receitas › Comunicação** (ícone de megafone).

A rota é `/receitas/comunicacao`. A permissão exigida é o módulo **relatorios** (o mesmo do restante da área Receitas). Sem esse acesso, o item não aparece no menu.

Todas as informações são sempre do **bar selecionado** no seletor de bar do topo. Se nenhum bar estiver selecionado, a tela pede para escolher um.

## Passo a passo

**Ver o desempenho orgânico do Instagram (aba Visão geral):**
1. Entre em **Receitas › Comunicação**.
2. Confirme o bar selecionado no topo.
3. Use o seletor de período (barra logo abaixo do título) para escolher o intervalo — o padrão é o trimestre por mês.
4. Os cards de KPI mostram alcance, engajamento, taxa de engajamento, stories, visitas de perfil e seguidores do período.
5. Role até o gráfico **Alcance & Engajamento** para ver a tendência mês a mês.

**Analisar os anúncios pagos (aba Anúncios):**
1. Clique na aba **Anúncios**.
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
2. Escolha o período (30 dias, 90 dias, 6 meses ou 1 ano) no seletor.
3. Veja o resumo e o comparativo **Carrossel × Imagem**.
4. Na lista de posts, alterne entre **Melhores** e **Piores** para ordenar por engajamento.

## Abas e seções

A Comunicação é organizada em abas por rota (a navegação fica fixa no topo):

- **Visão geral** (`/receitas/comunicacao`) — KPIs do Instagram **orgânico** e o gráfico de tendência de alcance e engajamento. É a página inicial da tela.
- **Anúncios** (`/receitas/comunicacao/anuncios`) — mídia **paga** (Meta Ads): resumo, gráficos, e tabelas detalhadas por campanha e por anúncio.
- **Calendário** (`/receitas/comunicacao/calendario`) — planejamento mensal dos posts programados, com cadastro/edição/exclusão.
- **Feed** (`/receitas/comunicacao/feed`) — performance dos posts de feed (carrossel e imagem), com ranking e comparação de formatos.
- **Stories** (`/receitas/comunicacao/stories`) — desempenho dos stories capturados (reaproveita a tela de Stories do Instagram).
- **Demografia** (`/receitas/comunicacao/demografia`) — perfil do público (gênero, idade, cidades, países e origem do alcance).

Existe ainda uma rota **Reels** (`/receitas/comunicacao/reels`) que reaproveita a tela de Reels do Instagram, mas ela **não está listada na barra de abas** — só é acessível pela URL direta.

## Colunas e cálculos

### Visão geral — Instagram orgânico

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Alcance (orgânico) | Total de contas alcançadas no período | Soma dos valores diários de `reach` no intervalo | `integrations.instagram_conta_metricas` |
| Engajamento | Total de interações no período | Soma dos valores diários de `total_interactions` | `integrations.instagram_conta_metricas` |
| Taxa de engajamento | Interações por alcance, em % | `engajamento ÷ alcance × 100` (nulo se alcance = 0) | derivado |
| Stories | Quantidade de stories capturados no período | Contagem de registros de stories no intervalo | `integrations.instagram_stories` |
| Alcance dos stories | Alcance somado dos stories | Soma de `reach` dos stories do período | `integrations.instagram_stories` |
| Visitas de perfil | Visitas ao perfil no período | Soma dos valores diários de `profile_views` | `integrations.instagram_conta_metricas` |
| Seguidores | Total de seguidores | Valor de `followers_count` do **último** snapshot do período | `integrations.instagram_conta_metricas` |
| Gráfico Alcance & Engajamento | Tendência mês a mês | Alcance (barra) e engajamento (linha), agrupados por mês | `integrations.instagram_conta_metricas` |

### Anúncios — resumo do período (Meta Ads)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Investimento | Verba gasta em anúncios | `spend` da conta no período (arredondado) | Meta Marketing API (nível conta) |
| Alcance | Pessoas únicas alcançadas | `reach` | Meta Marketing API |
| Cliques | Cliques nos anúncios | `clicks` | Meta Marketing API |
| CPM | Custo por mil impressões | `investimento ÷ impressões × 1000` (recalculado dos totais) | derivado |
| CTR | Taxa de cliques, em % | `cliques ÷ impressões × 100` | derivado |
| Conversas | Conversas iniciadas por mensagem | Valor da ação `onsite_conversion.messaging_conversation_started_7d` | Meta Marketing API (`actions`) |
| Frequência | Média de vezes que cada pessoa viu o anúncio | `frequency` (sinal de fadiga acima de ~3–4) | Meta Marketing API |
| ROAS de compra | Retorno de venda por R$1 investido | `purchase_roas` (compra via pixel) | Meta Marketing API |
| Custo/conversa | Custo por conversa iniciada | `investimento ÷ conversas` | derivado |
| Custo/venda | Custo por compra | `investimento ÷ compras` | derivado |
| Leads | Leads gerados | Ação `lead` | Meta Marketing API (`actions`) |
| Vídeos assistidos | ThruPlays (vídeo assistido completo/15s) | `video_thruplay_watched_actions` (tipo `video_view`) | Meta Marketing API |

### Anúncios — gráficos

| Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Onde o investimento rende | Gasto por posicionamento (Stories/Feed/Reels × IG/FB) | Soma de `spend` por plataforma × posição; descarta posições com menos de R$1; top 8 | Meta API (breakdown `publisher_platform, platform_position`) |
| Público alcançado (pago) | Impressões por faixa etária e gênero | Soma de `impressions` por idade, separando feminino/masculino | Meta API (breakdown `age, gender`) |
| Investimento por campanha | Top 10 campanhas por gasto | `spend` por campanha, top 10 | Meta API (nível campanha) |
| ROAS / Gasto Comercial | Retorno por R$1 (artistas + produção + marketing) | `faturamento ÷ (artistas + produção + marketing)` por período | `/api/receitas/roas` |

### Anúncios — tabelas Por campanha e Por anúncio

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
| Posts | Quantidade de posts de feed no período | Contagem de posts com `media_product_type = FEED` | `integrations.instagram_posts` |
| Engajamento médio | Média de engajamento por post | Soma do engajamento ÷ nº de posts | derivado dos insights |
| Alcance médio | Média de alcance por post | Soma de `reach` ÷ nº de posts | `integrations.instagram_post_insights` |
| Melhor formato | Formato com maior engajamento médio | Formato (Carrossel/Imagem) com maior `engajamento_medio` | derivado |
| Engajamento (por post) | Interações do post | `curtidas + comentários + compartilhamentos + salvos` | `instagram_post_insights` (com fallback do post) |
| Taxa engaj. (por post) | Engajamento sobre alcance | `engajamento ÷ reach` | derivado |
| Alcance / Curtidas / Comentários / Salvos | Métricas do post | Campos `reach`, `likes`, `comments`, `saved` do insight mais recente do post | `instagram_post_insights` |
| Comparativo Carrossel × Imagem | Qual formato rende mais | Médias de engajamento, alcance e taxa por formato | derivado |

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
- **Período (Visão geral e Anúncios)** — seletor de intervalo com granularidade; o padrão é o trimestre agrupado por mês. Define o intervalo dos KPIs e gráficos.
- **Período em dias (Feed)** — 30 dias, 90 dias, 6 meses ou 1 ano.
- **Ordenação (Feed)** — alternância entre **Melhores** e **Piores** posts por engajamento.
- **Ordenação (Anúncios)** — clique no cabeçalho de qualquer coluna das tabelas para ordenar (investimento é o padrão).
- **Período em dias (Stories)** — 7, 30, 90, 180 ou 365 dias.
- **Mês (Calendário)** — navegação mês a mês, com botão **Hoje** para voltar ao mês atual.
- **Demografia** — não tem filtro de período; mostra o retrato mais recente do público capturado pela sincronização.

## Regras e detalhes importantes

- **Orgânico × pago é a separação-chave.** A **Visão geral** só traz Instagram **orgânico** (Graph API). Toda a mídia **paga** e o **ROAS** ficam na aba **Anúncios** (Meta Ads).
- **Filtro por bar sempre.** Toda consulta é filtrada por `bar_id`; a tela nunca mistura dados de bares diferentes.
- **Alcance e engajamento são somas dos valores diários** dos snapshots (aproximação de período, no mesmo estilo de ferramentas como o Reportei). Não é um deduplicado de pessoas únicas ao longo do intervalo.
- **Seguidores** usa o valor do **último** snapshot do período (é um estoque, não uma soma).
- **Stories dependem do sync.** A Meta só permite ler stories **ativos** (vida de 24h). A tela mostra apenas o que a sincronização capturou (roda a cada ~2h); stories antigos que não foram capturados a tempo não aparecem.
- **Anúncios exigem conta conectada.** Se o bar não tiver conta de anúncio configurada (variável `META_ADS_ACCOUNTS` no Vercel), a aba avisa que não está conectada. Se estiver conectada mas sem gasto no período, mostra "sem anúncios com investimento".
- **CPM, CTR e CPC são recalculados** a partir dos totais (gasto, impressões e cliques) — mais estável do que confiar nas médias que a API devolve.
- **Conversas = mensagens iniciadas por anúncio** nos últimos 7 dias (não é qualquer clique). Custo/conversa e custo/venda só aparecem quando há conversas/compras no período.
- **Posicionamento descarta ruído:** posições com gasto abaixo de R$1 são omitidas do gráfico.
- **Feed = apenas posts de feed** (carrossel e imagem). Reels e stories têm suas próprias abas.
- **Calendário é manual.** Os posts programados são cadastrados pela equipe (título, formato, categoria e observação livres) — não vêm de integração. Editar/excluir só afeta o registro do próprio bar.
- **Dados de anúncio têm cache curto** no servidor (cerca de 30 min) para não bater na API da Meta a cada abertura da tela.

## Dúvidas frequentes

**Por que o alcance da Visão geral é diferente do alcance dos Anúncios?**
São coisas diferentes: a Visão geral é o alcance **orgânico** do perfil (Graph API); os Anúncios mostram o alcance da **mídia paga** (Meta Ads). Um não substitui o outro.

**Meus stories de ontem não apareceram. Por quê?**
A Meta só deixa ler stories enquanto estão ativos (24h). A sincronização roda a cada ~2h; se um story saiu do ar antes de ser capturado, ele não fica registrado.

**A aba Anúncios diz que a conta não está conectada. O que fazer?**
Falta configurar a conta de anúncio do bar (variável `META_ADS_ACCOUNTS` no Vercel). Sem isso, não há como puxar os dados da Meta Marketing API.

**O que significa a Frequência alta nos anúncios?**
É quantas vezes, em média, cada pessoa viu o anúncio. Acima de ~3–4 costuma indicar fadiga de público — vale renovar criativo ou ampliar o público.

**O calendário publica os posts automaticamente?**
Não. Ele é uma agenda de planejamento (título, formato, categoria e observação). A publicação continua sendo feita manualmente no Instagram.

**Como sei qual formato de post rende mais?**
Na aba Feed, o comparativo **Carrossel × Imagem** marca o "melhor" formato pelo maior engajamento médio no período escolhido.

## Fonte dos dados

**Instagram orgânico (Graph API):**
- `integrations.instagram_conta_metricas` — snapshots diários de alcance, interações, visitas e seguidores (Visão geral).
- `integrations.instagram_stories` — stories capturados (Visão geral e aba Stories).
- `integrations.instagram_posts` + `integrations.instagram_post_insights` — posts de feed e suas métricas (aba Feed).
- `/api/instagram/dashboard` — dados demográficos da conta (aba Demografia).

**Mídia paga (Meta Ads / Marketing API):**
- Endpoint `graph.facebook.com/act_<id>/insights` via System User token, nos níveis conta, campanha e anúncio, além dos breakdowns de posicionamento e demografia (aba Anúncios). Configuração pelas variáveis `META_ADS_ACCESS_TOKEN` e `META_ADS_ACCOUNTS` no Vercel.
- `/api/receitas/roas` — card ROAS / Gasto Comercial (faturamento sobre custos de artistas, produção e marketing).

**Planejamento (manual):**
- `marketing_calendario_posts` — posts programados no calendário (CRUD via `/api/receitas/comunicacao/calendario`).

**Rotas de API usadas pela tela:**
- `/api/receitas/comunicacao-organico` (Visão geral)
- `/api/receitas/anuncios` e `/api/receitas/roas` (Anúncios)
- `/api/instagram/feed`, `/api/instagram/stories`, `/api/instagram/dashboard` (Feed, Stories, Demografia)
- `/api/receitas/comunicacao/calendario` (Calendário)
