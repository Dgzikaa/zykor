---
title: Visão do Artista
area: receitas
slug: visao-artista
route: /analitico/atracoes
description: A trajetória completa de cada artista com a casa — shows, cachê, público, faturamento e NPS — num painel feito para mostrar ao próprio artista.
order: 60
icon: Music
---

# Visão do Artista

## Visão geral

A **Visão do Artista** conta a história de cada atração que já tocou no bar: quantos shows fez, quanto recebeu de cachê, quanta gente veio, quanto a casa faturou nas noites dele e como tudo isso evoluiu no tempo. É uma tela **artista-first** — você escolhe um artista e vê a trajetória inteira dele com a casa, com gráficos, marcos comemorativos e um cartão bonito pronto para compartilhar com o próprio músico.

Serve para dois usos no dia a dia:

- **Negociar e valorizar o relacionamento** com o artista — mostrar de forma visual "olha o que a gente construiu juntos" (público que cresceu, recordes, tempo de casa).
- **Decidir programação** — entender quem puxa mais público, em qual dia toca melhor e quanto custa versus o que traz.

Os dados dependem de os eventos estarem **taggeados** (associados a artistas). Se o bar ainda não tem eventos taggeados, a tela orienta ir em **Taggear Artistas** primeiro.

## Como acessar

No menu lateral: **Receitas → Visão do Artista** (ícone de nota musical), rota `/analitico/atracoes`.

A tela exige a permissão de módulo **`relatorios`**. Quem taggeia os eventos precisa também da permissão **`analitico_taggear_artistas`** (tela separada, em **Taggear Artistas**).

## Passo a passo

### Ver a trajetória de um artista

1. Selecione o **bar** no seletor do topo (todos os números são sempre filtrados por bar).
2. Na tela, use o campo **Artista** (dropdown) e escolha o artista. A lista já mostra ao lado quantos shows cada um tem, ordenada do que mais tocou para o que menos tocou.
3. A tela carrega o **cabeçalho (hero)** com foto, tipo (banda/DJ/solo), total de shows, desde quando toca e o dia favorito, seguido dos cartões de números, gráficos e seções.

### Filtrar por período e dia da semana

1. No card de filtros, escolha um **preset** de período: `Tudo`, o ano atual, o ano passado, `Este mês` ou `Mês passado`.
2. Ou defina um intervalo manual nos campos **De** e **Até**.
3. Opcionalmente escolha um **Dia da semana** (ex.: só as sextas) para ver a trajetória apenas naquelas noites.
4. Os filtros afetam **tudo ao mesmo tempo**: a lista de artistas do dropdown (só aparecem os que tocaram no período), os números da trajetória e o NPS.

### Adicionar ou trocar a foto do artista

1. No cabeçalho, clique no ícone de **câmera** sobre o avatar.
2. Cole a **URL** da foto e confirme. A foto passa a aparecer no cabeçalho e no cartão de compartilhamento.

### Compartilhar a trajetória com o artista

1. Clique no botão **Compartilhar** no cabeçalho.
2. Abre um **cartão visual** (avatar + principais números + marcos) sobre fundo violeta.
3. **Tire um print** desse cartão para enviar ao artista (WhatsApp, Instagram etc.). A tela sugere isso no rodapé do cartão.

## Abas e seções

A tela é organizada como um perfil de trajetória. As principais seções, de cima para baixo:

- **Cabeçalho (hero)** — avatar, nome, tipo, total de shows, "desde" (mês/ano do primeiro show), dia favorito e a frequência média (1 show a cada X dias, ~Y/mês).
- **Marcos** — selos comemorativos automáticos (ex.: `💯 100+ shows`, `🏠 2 anos de casa`, `📆 residente`, `🔥 recorde de público na última!`, `💰 cachê top`).
- **Cartões de números** — dez indicadores-chave da trajetória (detalhados abaixo).
- **NPS do público** — selo positivo com o score de satisfação de quem foi nas noites do artista.
- **Melhor / Menor noite (cachê)** — os dois extremos de cachê recebido.
- **Gráfico de evolução do cachê** — quanto o artista recebeu por show ao longo do tempo.
- **Público por show** e **Faturamento da noite** — dois gráficos lado a lado.
- **Parceiros de palco** — com quem o artista mais dividiu a noite.
- **Cartão compartilhável** (modal) — versão resumida e visual para print.

> Observação técnica: o código traz também uma visão de **Ranking** (tabela dos artistas dos últimos 12 meses), mas na versão atual da página não há botão que ative essa aba pela interface — ela funciona como recurso interno/legado. A descrição das colunas de ranking está incluída abaixo para referência.

## Colunas e cálculos

Todos os números da trajetória vêm da função SQL `operations.fn_artista_trajetoria`, que monta o conjunto de shows do artista (join de `operations.evento_artistas` com `public.eventos_base`) e calcula os agregados. O **cachê por show** é resolvido em cascata: valor exato do Conta Azul (função `fn_ca_cache_artista`, casado por evento + artista) → valor manual no vínculo (`evento_artistas.c_art`) → cachê do evento (`eventos_base.c_art`) **apenas em noite solo** → senão 0. O **público** por noite é o maior valor entre `cl_real` e `publico_real` (inclui bilheteria).

### Cartões de números (trajetória)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| 1º show | Data da estreia do artista na casa | Menor `data_evento` entre os shows | `eventos_base` via `fn_artista_trajetoria` |
| 1º cachê | Cachê da noite de estreia | `cache` do primeiro show (data mais antiga) | Conta Azul / `evento_artistas` / `eventos_base` |
| Total de shows | Quantidade de noites do artista | Contagem de shows (`count`) no período | `evento_artistas` × `eventos_base` |
| Faturamento médio | Faturamento típico por noite do artista | Média de `real_r` dos shows | `eventos_base.real_r` |
| Público (1º → atual) | Público da estreia comparado ao do último show, com % de crescimento | `primeiro.publico` → `atual.publico`; crescimento = (atual − primeiro) / primeiro × 100 | `eventos_base` (maior de `cl_real`, `publico_real`) |
| Cachê médio | Quanto o artista recebe em média por show | Média de `cache` **considerando só shows com cachê > 0**; "cobertura" = % de shows com cachê registrado | Conta Azul / `evento_artistas` / `eventos_base` |
| Total de cachê pago | Soma de tudo que o artista já recebeu | `sum(cache)` de todos os shows | idem |
| Ticket médio da noite | Consumo médio por pessoa nas noites do artista | Média de `t_medio` dos shows com ticket > 0 | `eventos_base.t_medio` |
| Público recorde | Maior público numa única noite | `max(publico)` entre os shows, com a data | `eventos_base` |
| Faturamento recorde | Maior faturamento numa única noite | `max(real_r)` entre os shows, com a data | `eventos_base.real_r` |
| Melhor noite (cachê) | Maior cachê recebido numa noite | `max(cache)` entre shows com cachê > 0 | Conta Azul / vínculo / evento |
| Menor noite (cachê) | Menor cachê recebido numa noite | `min(cache)` entre shows com cachê > 0 | idem |

### Cabeçalho e marcos

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Desde | Mês/ano do primeiro show | Mês/ano da menor `data_evento` | `eventos_base` |
| Dia favorito | Dia da semana em que o artista mais toca | Dia da semana (`dia_semana`) mais frequente entre os shows | `eventos_base.dia_semana` |
| Frequência | Cadência de shows | Dias médios entre estreia e último show ÷ (nº de shows − 1); shows/mês = total ÷ meses de casa | cálculo no front sobre a trajetória |
| Marcos (selos) | Conquistas comemorativas | Faixas de nº de shows (10/25/50/100+), anos de casa, "residente" (≤10 dias entre shows), recorde na última noite, "cachê top" (média ≥ R$ 5.000) | cálculo no front |
| NPS do público | Satisfação de quem foi nas noites do artista | Score = %promotores − %detratores; nota média = média das notas; nº de respostas | `silver.nps_artista_respostas` (Falae · Data da Visita) |

### Gráficos

| Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Evolução do cachê | Cachê por show ao longo do tempo | Um ponto por show (eixo em dd/mm), valor = `cache` | `evolucao` de `fn_artista_trajetoria` |
| Público por show | Quanta gente veio em cada noite | Um ponto por show, valor = `publico` | idem |
| Faturamento da noite | Faturamento da casa em cada noite do artista | Um ponto por show, valor = `fat` (`real_r`) | idem |
| Parceiros de palco | Com quem o artista mais dividiu a noite e quantas vezes | Outros artistas nos mesmos eventos, contados e ordenados (top 5) | `evento_artistas` |

### Ranking (recurso interno/legado)

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| # | Posição no ranking | Ordenação por faturamento total (desc) | agregação na API |
| Artista / tipo | Nome e tipo (banda/DJ/solo) | Cadastro do artista | `operations.bar_artistas` |
| Shows | Nº de noites do artista no período | Contagem de shows creditados ao artista **principal** da noite | `evento_artistas` × `eventos_base` |
| Público médio | Média de público por noite | `publico_total ÷ shows` (público = maior de `cl_real`, `publico_real`) | `eventos_base` |
| Fat. médio/noite | Faturamento médio por noite | `fat_total ÷ shows` (`real_r`) | `eventos_base.real_r` |
| Cachê médio | Cachê médio por noite | `custo_total ÷ shows` | Conta Azul / vínculo / evento |

## Filtros e opções

- **Bar** (seletor global): todo cálculo é filtrado por `bar_id`; a tela nunca mistura bares.
- **Período (presets)**: `Tudo`, ano atual, ano anterior, `Este mês`, `Mês passado`. Ajustam os campos De/Até automaticamente.
- **De / Até**: intervalo de datas manual (limita os shows considerados). Definir manualmente desmarca o preset.
- **Dia da semana**: filtra a trajetória para um dia específico (ex.: só sábados). Usa o dia da semana da data do evento.
- **Artista** (dropdown): escolhe de qual artista ver a trajetória; a lista só mostra artistas que tocaram dentro do período filtrado.
- Efeito conjunto: período e dia da semana afetam **simultaneamente** a lista de artistas, todos os números da trajetória e o NPS.

## Regras e detalhes importantes

- **Filtragem por bar**: obrigatória em toda query (`bar_id`). Cada bar tem sua própria trajetória de artistas.
- **Público inclui bilheteria**: o público de cada noite é o **maior** valor entre `cl_real` (clientes registrados) e `publico_real`, para não subestimar noites de bilheteria.
- **Cachê em cascata**: o valor de cachê usado por show segue a ordem Conta Azul (exato) → valor manual no vínculo → cachê do evento **só em noite solo** → 0. Em noites com vários artistas (co-headline) sem cachê individual identificado, o valor não é rateado — fica 0 para não distorcer o relatório do artista.
- **Cachê médio e cobertura**: a média de cachê considera **apenas shows com cachê > 0**; a "cobertura" indica em quantos % dos shows há cachê registrado (o resto pode simplesmente não ter sido lançado).
- **No ranking, a noite é creditada só ao artista principal** (o de maior cachê da noite), para evitar que um DJ de apoio "herde" o público inteiro de um festival.
- **Só shows já realizados**: a trajetória considera eventos com `data_evento` até a data de hoje (não conta shows futuros agendados).
- **Datas sem fuso**: as datas são interpretadas como texto `AAAA-MM-DD` para evitar deslocamento de dia por fuso horário.
- **Foto do artista**: é um dado **manual** (URL colada pelo usuário), gravado no cadastro do artista; não vem de integração.
- **Estado vazio**: se o bar não tem nenhum artista taggeado, a tela mostra um aviso com link para **Taggear Artistas** em vez de números.
- **NPS pode não aparecer**: o selo de NPS só surge quando há respostas vinculadas ao artista no período; sem respostas, a seção fica oculta.

## Dúvidas frequentes

**Por que um artista não aparece no dropdown?**
Ou ele não tem shows no período/dia filtrado, ou os eventos dele ainda não foram taggeados. Ajuste o período para `Tudo` ou verifique o tagging.

**O cachê médio parece baixo — por quê?**
A média só conta shows com cachê registrado (> 0). Se muitos shows estão sem cachê lançado, a "cobertura" abaixo do valor indica isso. Lance os cachês no Conta Azul ou no vínculo do artista para melhorar a cobertura.

**Como o público é contado se a noite teve bilheteria?**
Usamos o maior valor entre clientes registrados e público real informado, justamente para incluir quem entrou pela bilheteria.

**Uma noite teve dois artistas. Como o faturamento é dividido?**
No ranking, a noite inteira é creditada ao artista principal (maior cachê). Na trajetória individual, os números da noite aparecem para cada artista taggeado naquele evento.

**O NPS é do artista ou da casa?**
É do público que foi **nas noites daquele artista**, vindo das respostas do Falae associadas pela data da visita. É uma leitura da experiência da noite, não uma avaliação direta do músico.

**Posso mostrar isso para o artista?**
Sim — é o objetivo. Use o botão **Compartilhar** e tire um print do cartão.

## Fonte dos dados

- **`operations.fn_artista_lista`** — lista de artistas para o dropdown (com foto, contagem de shows, primeiro/último show), filtrada por período e dia da semana.
- **`operations.fn_artista_trajetoria`** — todos os agregados da trajetória (marcos, recordes, médias, evolução, parceiros).
- **`operations.evento_artistas`** — vínculo artista ↔ evento (tagging), inclui cachê manual (`c_art`) por artista.
- **`public.eventos_base`** — métricas de cada noite: faturamento (`real_r`), público (`cl_real`/`publico_real`), ticket médio (`t_medio`), dia da semana, cachê do evento.
- **`operations.bar_artistas`** — cadastro do artista (nome, tipo, `foto_url`).
- **`operations.fn_ca_cache_artista`** — cachê exato por evento/artista vindo do **Conta Azul** (lançamentos financeiros).
- **`silver.nps_artista_respostas`** — respostas de NPS vinculadas ao artista da noite, originadas da integração **Falae** (campo "Data da Visita").

Integrações de origem: **ContaHub** (faturamento/público/ticket que alimentam `eventos_base`), **Conta Azul** (cachês), **Falae** (NPS). A foto do artista é entrada manual.
