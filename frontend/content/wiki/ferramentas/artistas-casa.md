---
title: Artistas (visão da casa)
area: ferramentas
slug: artistas-casa
route: /ferramentas/artistas
description: Ranking de artistas e labels pela ótica da casa — ROI, lift, NPS, fidelização e momentum para decidir quem manter, renovar e como montar a grade.
order: 80
icon: Music
---

# Artistas (visão da casa)

## Visão geral

Esta é a tela que responde, com número, à pergunta mais cara da programação: **quanto cada artista (e cada noite recorrente) realmente vale para a casa?**

Diferente da página do artista (`/analitico/atracoes`, "Visão do artista"), aqui o olhar é **da casa**: o sistema compara o desempenho do artista com a média do **mesmo dia da semana sem ele** (o "lift"), cruza faturamento com o cachê pago (do Conta Azul), com o NPS dos clientes (Falae) e com a capacidade da casa de **transformar novos clientes em recorrentes** (fidelização). O resultado é um ranking interno e um conjunto de selos de decisão (Manter / Observar / Renovar).

Quem usa: **dono, sócio e quem cuida da programação/curadoria musical**, principalmente na hora de renovar contratos, escalar a grade da semana e negociar cachê.

Regra de ouro da tela: **cada noite é creditada apenas ao artista principal dela** (o de maior cachê). Um DJ de apoio numa noite de festival não herda o público inteiro — isso evita distorção no ranking.

## Como acessar

- Menu lateral: **Ferramentas → Artistas (visão da casa)**.
- Rota direta: `/ferramentas/artistas`.
- Permissão necessária: módulo **`gestao`** (mesma dos demais relatórios analíticos). Sem essa permissão o item não aparece no menu.

Há ainda um atalho no topo da tela, **"Visão do artista →"**, que leva à página `/analitico/atracoes` (mesmo dado, mas com foco em 1 artista por vez).

## Passo a passo

**1. Escolher o bar.** A tela sempre usa o bar selecionado no seletor global (Ordinário / Deboche). Trocar de bar recarrega tudo.

**2. Escolher o período.** No canto superior direito há três botões: **6m**, **12m** (padrão) e **24m**. Todo o cálculo (ranking, KPIs, NPS, momentum) passa a olhar essa janela retroativa a partir de hoje.

**3. Navegar entre as abas.** Abaixo do cabeçalho ficam **Artistas**, **Labels** e **Insights** (detalhadas mais abaixo).

**4. Reordenar o ranking.** Nas abas Artistas e Labels há uma linha "Ordenar:" com botões (Maior lift, Vale o cachê, Melhor NPS, Faturamento, etc.). O botão ativo aparece destacado em violeta e reordena a tabela na hora, sem recarregar dados.

**5. Abrir o detalhe do NPS de um artista.** Na aba Artistas, clique no número de **NPS** de uma linha (quando houver). Abre um painel com as dimensões da experiência (Atendimento, Comida, Música, Tempo...) e as respostas individuais daquela noite.

**6. Abrir a análise de uma label.** Na aba Labels, clique em qualquer linha do "Ranking de labels". Abaixo abre o **deep-dive** da label: mini-KPIs, dimensões, melhor/pior noite, composição do faturamento, evolução semanal e o ranking de artistas dentro dela.

**7. Ir para a página do artista.** O nome do artista (nas tabelas) é um link para `/analitico/atracoes?artista=<id>`, com a trajetória completa dele.

> Observação: esta é uma tela **de leitura**. Não há cadastro, edição, aprovação ou exportação aqui — os cachês vêm do Conta Azul, e o vínculo artista↔evento é cadastrado no Planejamento Comercial.

## Abas e seções

### Aba **Artistas**
Ranking interno dos artistas no período. Traz 6 KPIs no topo, os botões de ordenação e a tabela "Ranking interno". Cada linha é 1 artista (agrupado por `artista_id`, ou pelo nome quando não há cadastro). Só entram artistas com **2 ou mais shows** no período.

### Aba **Labels**
Uma **label** é a "noite recorrente" — o nome do evento que se repete (ex.: "Pagode Vira-Lata", "Quintal do Samba"). O sistema normaliza os nomes (acento, caixa, hífen) e corta o sufixo de convidado/DJ para agrupar variações do mesmo nome. Traz KPIs, cinco cards de insight automático, gráfico de evolução semana a semana, o "Ranking de labels", o deep-dive da label clicada e a **matriz artista × label**. Só entram labels com **3 ou mais shows** no período.

### Aba **Insights**
Leitura executiva para decisão. Traz:
- **Leitura rápida**: frases automáticas (dia que esquenta/esfria, quem sobe/cai, concentração do faturamento).
- **Como vem cada dia da semana**: gráficos de faturamento e público médio por dia + cards com a variação dos últimos 4 daquele dia vs a média do período.
- **Momentum dos artistas**: tabela comparando os 3 shows mais recentes com os 3 anteriores, cadência e o **selo de decisão**.
- **Estreias & novos** e **Melhor encaixe artista × dia**.
- **NPS do público (casa)**: retorno por categoria, NPS por lotação e temas dos comentários.

## Colunas e cálculos

Todos os valores consideram apenas noites com **faturamento (`real_r`) acima de R$ 1.000** e o **período selecionado**. "Público" = o maior entre `cl_real` (clientes ContaHub) e `publico_real` (inclui bilheteria).

### Aba Artistas — KPIs do topo

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Artistas | Nº de artistas no ranking | Contagem de artistas com ≥ 2 shows | `operations.evento_artistas` |
| Shows | Total de shows no período | Soma dos shows de todos os artistas | `eventos_base` |
| Faturamento | Faturamento somado das noites rankeadas | Soma de `real_r` das noites creditadas | `eventos_base` |
| Cachê pago (Xm) | Cachê pago no período | Soma dos cachês (Conta Azul) das noites | `fn_ca_cache_artista` (Conta Azul) |
| ROI médio | ROI médio entre artistas com custo | Média de `((fat − custo) / custo) × 100` | derivado |
| Maior lift | Artista com maior lift de faturamento | Nome do topo por `lift_fat` | derivado |

### Aba Artistas — tabela "Ranking interno"

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| # | Posição no ranking | Ordem pela coluna de ordenação escolhida | — |
| Artista | Nome + tipo (banda/dj/solo) | Nome do cadastro; tipo de `bar_artistas` | `operations.bar_artistas` |
| Shows | Nº de shows do artista | Contagem de noites em que ele foi o **principal** | `evento_artistas` |
| Fat. médio/noite | Faturamento médio por show | `soma(real_r) ÷ nº shows` | `eventos_base` |
| Público médio | Público médio por show | `soma(público) ÷ nº shows`; público = max(`cl_real`, `publico_real`) | `eventos_base` |
| NPS | Score NPS no período (nº de respostas) | `%promotores − %detratores` das respostas vinculadas ao artista | `silver.nps_artista_respostas` (Falae) |
| Fideliza | % dos novos clientes daquelas noites que viraram recorrentes (nº de novos) | `fidelizados ÷ novos × 100`, somando as noites do artista | `fn_aquisicao_por_evento` |
| Cachê pago (Xm) | Cachê pago no período | Soma dos cachês das noites do artista | `fn_ca_cache_artista` (Conta Azul) |
| Retorno | R$ faturado por R$ de cachê | `soma(real_r) ÷ soma(cachê)` — exibido como "×" | derivado |
| % cachê | Quanto do faturamento vira cachê | `soma(cachê) ÷ soma(real_r) × 100` | derivado |
| Vale o cachê? | Saldo entre o que o artista traz a mais e o que custa | `lift_fat − cachê médio por show` (positivo = traz mais do que custa) | derivado |
| Lift fat | Faturamento incremental por noite | `fat_médio do artista − média do mesmo dia-da-semana sem ele` | `eventos_base` (baseline) |
| Lift púb. | Público incremental por noite | `público médio − média de público do mesmo dia sem ele` | `eventos_base` (baseline) |
| Tend. | Tendência recente | 3 shows mais recentes vs anteriores: variação > +10% = subindo; < −10% = caindo; senão estável | derivado |

**Sobre o baseline (lift):** para cada show do artista, o sistema calcula a média de faturamento/público dos **outros** eventos do mesmo dia-da-semana (excluindo os shows do próprio artista) e tira a média dessas médias. O lift é o quanto o artista fica acima (ou abaixo) desse "dia normal".

**Sobre o cachê:** usa o valor **exato do Conta Azul** por (evento, artista). Sem cachê no CA, cai para o valor manual do vínculo; sem manual, usa o `c_art` do evento **apenas em noite solo** (co-headline sem match não rateia, para bater com o relatório do artista).

Ordenações disponíveis (aba Artistas): Maior lift · Vale o cachê · Melhor NPS · Mais fideliza · Faturamento · ROI · Retorno · Público · Cachê pago.

### Aba Labels — KPIs do topo

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Labels ativas | Nº de labels no período | Labels com ≥ 3 shows | `eventos_base.nome` |
| Shows | Total de shows | Soma dos shows das labels | `eventos_base` |
| Faturamento | Faturamento somado | Soma de `real_r` das noites | `eventos_base` |
| Top faturamento | Label que mais fatura | Label do topo por faturamento total | derivado |
| Maior retorno | Label com maior fat/cachê | Label do topo por `retorno` | derivado |
| Maior público | Label com maior público médio | Label do topo por público médio | derivado |

### Aba Labels — cards de insight automático

| Card | O que mostra | Como é calculado |
|---|---|---|
| Mais rentável | Label com maior retorno | Maior `fat_total ÷ cachê_total` |
| Mais cresce | Label em maior alta recente | Maior variação (3 recentes vs anteriores) entre as "subindo" |
| Atenção (queda) | Label em maior queda | Menor variação entre as "caindo" |
| Mais consistente | Label mais previsível | Menor coeficiente de variação (mín. 4 shows) |
| Melhor dupla artista × label | Par artista+label que mais rende | Maior `lift vs label` entre pares com ≥ 2 shows |

### Aba Labels — tabela "Ranking de labels"

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Label | Nome de exibição da noite | Nome bruto mais frequente, com sufixo de convidado removido | `eventos_base.nome` |
| Dia | Dia da semana predominante | Dia mais frequente entre os eventos da label | `eventos_base.dia_semana` |
| Shows | Nº de noites da label | Contagem de eventos | `eventos_base` |
| Fat. médio | Faturamento médio por noite | `soma(real_r) ÷ nº noites` | `eventos_base` |
| Público méd. | Público médio | `soma(público) ÷ nº noites` | `eventos_base` |
| NPS | Score NPS (nº de respostas) | `%promotores − %detratores` das respostas dos eventos da label | `silver.nps_evento_respostas` (Falae) |
| Fideliza | % de novos que viraram recorrentes (nº de novos) | `fidelizados ÷ novos × 100` somando as noites da label | `fn_aquisicao_por_evento` |
| Ticket | Ticket médio | Média de `t_medio` das noites (>0) | `eventos_base` |
| Retorno | R$ faturado por R$ de cachê | `soma(real_r) ÷ soma(cachê)` | derivado |
| % cachê | % do fat que vira cachê | `soma(cachê) ÷ soma(real_r) × 100` | derivado |
| Composição | De onde vem o faturamento | Barra Bar × Couvert × Bilheteria (ver abaixo) | `eventos_base` |
| Meta | Realizado ÷ meta M1 | `soma(real_r com meta) ÷ soma(m1_r) × 100`, só onde há meta lançada | `eventos_base.m1_r` |
| Ocup. | Ocupação média | Média de `min(público ÷ capacidade, 1,5) × 100` | `eventos_base` (`lot_max`/`capacidade_estimada`) |
| Consistência | Quão previsível é a label | Selo pelo coef. de variação: <0,15 Muito consistente · <0,30 Consistente · <0,50 Variável · senão Volátil | derivado |
| Tend. | Tendência recente | 3 recentes vs anteriores (> +10% sobe, < −10% cai) | derivado |

**Composição do faturamento:** `Bar (consumo)` = `faturamento_bar`; `Couvert` = `faturamento_couvert`; **`Bilheteria` = `real_r − bar − couvert`** (o que sobra, atribuído ao ticketing das plataformas Yuzer/Sympla).

### Aba Labels — deep-dive da label selecionada

Mini-KPIs (Fat. médio/noite, Público médio, Retorno, Atingimento de meta, NPS do público), tags de **dimensões da experiência** (nota 1–5 por critério do Falae — a mais baixa é o gargalo), cards de **melhor** e **pior noite**, **composição do faturamento**, gráfico de **evolução semanal** (Faturamento × Meta) e a tabela de artistas dentro da label:

| Coluna (artistas na label) | Como é calculado |
|---|---|
| Artista | Artista principal da noite (link para a página dele) |
| Shows | Nº de noites em que foi principal nessa label |
| Fat. médio | Média de `real_r` das noites dele nessa label |
| Público méd. | Média de público |
| Cachê méd. | Média do cachê (Conta Azul) |
| Retorno | `fat total ÷ cachê total` do artista na label |
| Lift vs label | `fat médio do artista − fat médio da label` |
| Melhor noite | Maior faturamento dele na label |

### Aba Labels — matriz artista × label
Cruza as até 8 labels com mais shows contra os até 8 artistas com mais shows. Cada célula é o **faturamento médio por noite** do artista quando foi o principal naquela label — quanto mais escura, mais fatura. Célula vazia (·) = o artista nunca tocou naquela label.

### Aba Insights — "Como vem cada dia da semana"

| Coluna / campo | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Faturamento médio por dia | Barras por dia da semana | Média de `real_r` de todas as noites (>R$1.000) daquele dia | `eventos_base` |
| Público médio por dia | Barras por dia | Média de público daquele dia | `eventos_base` |
| Variação (seta) | Se o dia esquenta/esfria | `(média dos últimos 4 daquele dia − média do período) ÷ média × 100` | derivado |
| N (Nx) | Quantas noites daquele dia | Contagem de eventos do dia | `eventos_base` |

### Aba Insights — "Momentum dos artistas"

| Coluna | O que mostra | Como é calculado |
|---|---|---|
| Artista | Nome (link) | — |
| Cadência | Frequência de shows | `shows ÷ meses`; ≥3/mês = Residente, ≥1 = Frequente, senão Pontual. Marca "inativo Nd" se não toca há muito |
| Shows | Nº de shows | Contagem |
| Fat. recente | Faturamento recente e variação | Média dos **últimos 3 shows** e variação vs os **3 anteriores** ("sem base" se faltar histórico) |
| Público | Público recente e variação | Igual ao anterior, com público |
| NPS | Score e nº de respostas | `%promotores − %detratores`; abaixo de 5 respostas fica cinza (não pesa no selo) |
| Selo | Decisão sugerida | Ver regra abaixo |

**Regra do selo:** só decide com **≥ 4 shows**, o artista ativo (tocou nos últimos 120 dias) e **pelo menos 2 sinais confiáveis** (tendência, retorno, NPS com ≥5 respostas, momentum de público). Cada sinal soma/subtrai ponto: `pts ≥ 2` = **Manter**, `pts ≤ −2` = **Renovar**, entre eles = **Observar**. Sem amostra suficiente = **Poucos dados**; sem tocar há +120 dias = **Inativo**. É proposital: evita renovar/cortar em cima de ruído.

### Aba Insights — outros blocos

| Bloco | O que mostra | Como é calculado |
|---|---|---|
| Estreias & novos | Quem estreou nos últimos 90 dias e como foi vs a casa | `(fat médio do artista − fat médio da casa) ÷ casa × 100` |
| Melhor encaixe artista × dia | Quem mais fatura em cada dia (mín. 2 shows no dia, só ativos) | Maior média de faturamento por artista naquele dia da semana |
| NPS do público — retorno | Taxa de retorno por categoria | % de respostas que voltaram, por promotor/neutro/detrator | `silver.nps_retorno_respostas` |
| NPS do público — lotação | Se casa cheia derruba a nota | NPS por tercis de público da noite | `silver.nps_lotacao` |
| NPS do público — temas | Motivos citados (foco em reclamações) | Temas extraídos dos comentários de neutros+detratores | `silver.nps_comentarios` |

## Filtros e opções

| Filtro / opção | Onde | Efeito |
|---|---|---|
| Bar | Seletor global (topo do sistema) | Filtra tudo por `bar_id`. Cada bar é independente. |
| Período (6m / 12m / 24m) | Botões no topo da página | Define a janela retroativa a partir de hoje. Vale para as 3 abas. |
| Ordenar | Linha "Ordenar:" (abas Artistas e Labels) | Reordena a tabela no cliente (não recarrega dados). |
| Clique na linha da label | Ranking de labels | Abre/atualiza o deep-dive da label. |
| Clique no NPS | Aba Artistas | Abre o painel de dimensões e respostas do artista. |

## Regras e detalhes importantes

- **Sempre filtra por `bar_id`.** O ranking do Ordinário nunca mistura com o do Deboche.
- **Corte de faturamento:** só entram noites com `real_r > R$ 1.000`. Datas de teste, noites zeradas ou fechadas ficam de fora.
- **Crédito ao principal:** cada noite é atribuída **só ao artista de maior cachê**. O apoio não entra no ranking daquela noite. Por isso o "cachê pago" aqui pode diferir do total histórico na página do artista.
- **Mínimo de shows:** Artistas ≥ 2 shows; Labels ≥ 3 shows. Quem toca menos que isso não aparece no ranking.
- **Cachê = Conta Azul (sem rateio).** A cascata é: cachê exato do CA → valor manual no vínculo → `c_art` do evento (só em noite solo). Co-headline sem cachê identificado **não** é rateado.
- **Cachê ≠ total histórico.** Como a tela recorta pelo período e só conta noites >R$1.000, o "Cachê pago (Xm)" é do período — não do histórico completo do artista.
- **NPS vem do Falae**, vinculado pela "Data da Visita" ao artista/evento da noite. Sem respostas no período, a coluna fica "—". Amostra pequena de NPS **não pesa** no selo de decisão (mín. 5 respostas).
- **Fidelização** conta clientes cuja **1ª visita** foi numa noite do artista/label e que depois voltaram (viraram recorrentes).
- **Bilheteria é residual:** `real_r − bar − couvert`. Se a plataforma (Yuzer/Sympla) não estiver conciliada, esse valor pode absorver diferenças.
- **Consumação de cortesia e mix de produtos ficam de fora deste ranking** (são cálculos pesados, só computados sob demanda em outra visão) — por isso não há colunas de consumação aqui.
- **Estado vazio:** sem eventos taggeados no período, a aba Artistas mostra "Sem dados de atrações (precisa de eventos taggeados)"; a aba Labels pede para cadastrar a **Label** no Planejamento Comercial.
- **Cache de 5 minutos:** o ranking é servido de um cache em memória por alguns minutos (o dado só muda ~1x/dia, no ETL), então re-navegar é instantâneo.

## Dúvidas frequentes

**Por que o cachê aqui é diferente do que vejo na página do artista?**
Porque esta tela olha só o período selecionado e só noites acima de R$ 1.000. A página do artista mostra o histórico completo.

**O que é "lift"?**
É o valor incremental do artista: o faturamento (ou público) médio dele **menos** a média do mesmo dia da semana sem ele. Lift positivo = ele traz gente/dinheiro acima do "dia normal".

**Um DJ que abriu a noite aparece com o público inteiro?**
Não. A noite é creditada só ao artista **principal** (o de maior cachê). O apoio não herda o público daquela noite.

**Por que alguns artistas aparecem como "Poucos dados"?**
De propósito. O selo só decide com pelo menos 4 shows e 2 sinais confiáveis. Menos que isso seria decidir renovação em cima de ruído.

**De onde vem o NPS?**
Das pesquisas do Falae, vinculadas pela data da visita ao artista/evento da noite. É por isso que artistas sem respostas ficam com "—".

**O que é uma "label"?**
É a noite recorrente — o nome do evento que se repete (ex.: um pagode toda quarta). O sistema agrupa variações do mesmo nome mesmo com diferenças de acento, caixa ou convidado.

## Fonte dos dados

- **`operations.eventos_base`** — métricas por noite: faturamento (`real_r`), público (`cl_real`/`publico_real`), cachê do evento (`c_art`), ticket (`t_medio`), meta (`m1_r`), consumo do bar (`faturamento_bar`), couvert (`faturamento_couvert`), capacidade. Origem: **ContaHub** (+ Yuzer/Sympla em noites de bilheteria).
- **`operations.evento_artistas`** — vínculo artista↔evento (cadastrado no Planejamento Comercial).
- **`operations.bar_artistas`** — cadastro dos artistas (nome, tipo).
- **`operations.fn_ca_cache_artista`** — cachê exato por (evento, artista). Origem: **Conta Azul**.
- **`operations.fn_aquisicao_por_evento`** — novos clientes e fidelização por evento.
- **`silver.nps_artista_respostas` / `nps_evento_respostas` / `nps_criterio_evento` / `nps_retorno_respostas` / `nps_lotacao` / `nps_comentarios`** — NPS, dimensões, retorno, lotação e temas. Origem: **Falae**.

Endpoints usados pela tela: `/api/analitico/atracoes` (aba Artistas e Insights) e `/api/analitico/labels` (aba Labels).
