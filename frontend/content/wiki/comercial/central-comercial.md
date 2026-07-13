---
title: Central Comercial
area: comercial
slug: central-comercial
route: /comercial
description: Calendário estratégico de 2026 com datas quentes, feriadões, ideias de ação e o histórico de faturamento de 2025 para planejar as campanhas comerciais do bar.
order: 10
icon: Megaphone
---

# Central Comercial

## Visão geral

A **Central Comercial** é o painel de planejamento estratégico de datas e oportunidades comerciais do ano. Ela reúne, em um só lugar, o calendário de 2026 com todas as datas que costumam movimentar o bar (feriados, Copa do Mundo, festas juninas, datas especiais como Dia dos Namorados, festivais), os "feriadões" (períodos de vários dias de folga), sugestões de ações comerciais e um resumo do desempenho real de 2025 para servir de referência.

O objetivo é ajudar o gestor/dono a **antecipar preparativos** — estoque, escala de equipe, marketing, reservas e decoração temática — nas datas que historicamente rendem mais faturamento.

Um ponto importante para entender a tela: a **grande maioria do conteúdo é um guia de referência fixo** (uma "agenda" curada de 2026 e um retrato do que aconteceu em 2025). O único dado que muda conforme o bar selecionado e a operação real é a **programação de atrações**, que vem do módulo de Planejamento e aparece sobreposta no calendário. Os demais números (datas, feriadões, ranking de 2025) são conteúdo editorial, não são recalculados a partir do banco em tempo real.

## Como acessar

- No menu lateral: **Comercial → Central Comercial**.
- Rota direta: `/comercial`.
- **Permissão necessária:** módulo `gestao`. Quem não tiver esse módulo não vê o item no menu nem acessa a página.

## Passo a passo

### 1. Ver o calendário do ano com as atrações do seu bar

1. Abra **Comercial → Central Comercial**.
2. A tela abre na aba **Calendário Visual**, mostrando os 12 meses de 2026 lado a lado.
3. Cada dia colorido é uma data importante; a cor indica o potencial (veja a legenda no topo).
4. Os dias com uma **bolinha roxa** têm uma atração já planejada para o seu bar (vinda do módulo de Planejamento).
5. **Passe o mouse** sobre qualquer dia colorido ou com atração para abrir o balão com o nome do evento, a dica e a atração programada.
6. Troque o **bar selecionado** (seletor no topo do sistema) para ver a programação de atrações de outro bar — as datas fixas do calendário não mudam, só as atrações.

### 2. Buscar uma data específica

1. Vá na aba **Lista de Datas**.
2. Use o campo **"Buscar data, evento ou tipo..."** no topo.
3. Digite parte do nome do evento (ex.: "Copa"), do tipo (ex.: "carnaval") ou da dica. A tabela filtra em tempo real.
4. O contador ao lado do título mostra quantas datas correspondem ao filtro.

### 3. Planejar os feriadões

1. Abra a aba **Feriadões**.
2. Veja os cartões com cada período longo, as datas de início e fim, quantos dias tem e uma descrição-dica.
3. Use o bloco **Resumo por Trimestre** logo abaixo para ter a visão macro do ano (o que se destaca em cada trimestre).

### 4. Buscar ideias de ação comercial

1. Abra a aba **Plano de Ação**.
2. Percorra os cartões de ideias (pacotes corporativos, parcerias, fidelidade, reservas antecipadas etc.). A cor da borda indica a prioridade sugerida (alta = vermelho, média = amarelo).
3. Role até o bloco **Dicas de Ouro** para orientações práticas de Copa do Mundo e feriadões.

### 5. Consultar o histórico de 2025

1. Abra a aba **Histórico 2025**.
2. No topo, três cartões-resumo trazem o melhor dia, a média de sextas e o pico de pessoas em um dia.
3. Abaixo, o gráfico de barras compara o faturamento médio por dia da semana.
4. Mais abaixo, a tabela **Top 15 Melhores Dias de 2025** lista os dias campeões, com faturamento, público e ticket médio.

> Observação: não há botão de exportar, aprovar ou editar nesta tela. Ela é somente de consulta/planejamento. Para cadastrar ou alterar as atrações que aparecem no calendário, use o módulo de **Planejamento Comercial**.

## Abas e seções

A tela tem **5 abas**:

- **Calendário Visual** — os 12 meses de 2026 em grade, com as datas importantes coloridas por potencial e as atrações planejadas do bar sobrepostas (bolinha roxa + balão no hover).
- **Lista de Datas** — tabela pesquisável com todas as datas importantes de 2026 (data, dia da semana, evento, tipo, potencial e dica).
- **Feriadões** — cartões dos períodos longos de folga + um resumo dividido por trimestre.
- **Plano de Ação** — ideias de ações comerciais (com prioridade e categoria) e um bloco de dicas de ouro.
- **Histórico 2025** — cartões-resumo, gráfico de faturamento por dia da semana, ranking Top 15 dias, insights de aprendizado e um comparativo de datas equivalentes 2025 × 2026.

No topo, acima das abas, ficam fixos a **legenda de cores** e quatro **cartões de contagem** (Datas Potencial Máximo, Jogos Copa do Mundo, Festivais/Shows e Feriadões Identificados).

## Colunas e cálculos

### Cartões de contagem (topo da página)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Datas Potencial Máximo | Quantas datas de 2026 têm potencial "máximo" | Conta as datas com `potencial === 'maximo'` na lista fixa de datas | `DATAS_2026` (constants.ts) |
| Jogos Copa do Mundo | Quantas datas são jogos da Copa | Conta as datas com `tipo === 'copa'` | `DATAS_2026` (constants.ts) |
| Festivais/Shows | Quantas datas são festivais | Conta as datas com `tipo === 'festival'` (atualmente 0, pois a lista não usa esse tipo) | `DATAS_2026` (constants.ts) |
| Feriadões Identificados | Quantos períodos longos estão catalogados | Conta o total de itens da lista de feriadões | `FERIADOES_2026` (constants.ts) |

### Aba Calendário Visual

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cor do dia | Potencial da data (máximo/alto/médio/baixo) | Cor definida pelo campo `potencial` da data importante | `DATAS_2026` (constants.ts) |
| Bolinha / destaque roxo | Existe atração planejada nesse dia | Dia consta no mapa de atrações retornado pela API | `gold.planejamento` (via API) |
| Balão (hover) | Nome do evento, dica e nome da atração | Junta o texto da data importante com o nome da atração do dia | `DATAS_2026` + `gold.planejamento` |

### Aba Lista de Datas

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Data | Dia/mês do evento (formato DD/MM) | Formatação da data cadastrada | `DATAS_2026` |
| Dia | Dia da semana | Campo `diaSemana` fixo; sexta/sábado ficam verdes, domingo azul, demais cinza | `DATAS_2026` |
| Evento | Nome do evento + ícone do tipo | Campo `nome`; o ícone varia conforme `tipo` | `DATAS_2026` |
| Tipo | Categoria do evento (copa, carnaval, nacional…) | Campo `tipo` (com "_" trocado por espaço) | `DATAS_2026` |
| Potencial | Nível de oportunidade | Campo `potencial`, com cor e ícone (chama/alta/alvo/queda) | `DATAS_2026` |
| Dica | Sugestão de aproveitamento da data | Campo `dica` fixo | `DATAS_2026` |

### Aba Feriadões

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome | Nome do feriadão | Campo `nome` | `FERIADOES_2026` |
| Dias | Duração do período | Campo `dias` (nº de dias), com cor pelo `potencial` | `FERIADOES_2026` |
| Período | Data inicial → data final | Campos `inicio` e `fim` formatados | `FERIADOES_2026` |
| Descrição | Dica do feriadão | Campo `descricao` | `FERIADOES_2026` |
| Resumo por Trimestre | Destaques de cada trimestre do ano | Texto editorial fixo (não calculado) | Conteúdo estático |

### Aba Plano de Ação

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Título | Nome da ideia de ação | Campo `titulo` | `IDEIAS_ACOES` |
| Descrição | Detalhe da ação sugerida | Campo `descricao` | `IDEIAS_ACOES` |
| Prioridade | Alta/média (cor da borda e do selo) | Campo `prioridade` | `IDEIAS_ACOES` |
| Categoria | Área da ação (Vendas, Parcerias…) | Campo `categoria` | `IDEIAS_ACOES` |
| Dicas de Ouro | Orientações de Copa e feriadões | Texto editorial fixo | Conteúdo estático |

### Aba Histórico 2025

Cartões-resumo:

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Melhor Dia de 2025 | Maior faturamento em um único dia | Pega o faturamento do 1º item do ranking (lista já ordenada) | `TOP_DIAS_2025` |
| Média Sextas-feiras | Faturamento médio das sextas de 2025 | Média das sextas já pré-calculada na constante | `FATURAMENTO_POR_DIA_2025` |
| Máximo de Pessoas (1 dia) | Maior público em um único dia | Público do 1º item do ranking | `TOP_DIAS_2025` |

Gráfico "Faturamento Médio por Dia da Semana":

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia da semana | Domingo a Sábado | Campo `diaSemana` | `FATURAMENTO_POR_DIA_2025` |
| Barra / valor | Faturamento médio do dia | Campo `mediaFaturamento`; largura da barra = valor ÷ maior média × 100% | `FATURAMENTO_POR_DIA_2025` |

Tabela "Top 15 Melhores Dias de 2025":

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| # | Posição no ranking | Ordem da lista (1º ao 15º; medalhas nos 3 primeiros) | `TOP_DIAS_2025` |
| Data | Dia/mês | Campo `data` formatado | `TOP_DIAS_2025` |
| Dia | Dia da semana (colorido) | Campo `diaSemana` | `TOP_DIAS_2025` |
| Evento/Motivo | Contexto do dia | Campo `evento` | `TOP_DIAS_2025` |
| Faturamento | Faturamento do dia (R$) | Campo `faturamento` | `TOP_DIAS_2025` |
| Pessoas | Público do dia | Campo `pessoas` | `TOP_DIAS_2025` |
| Ticket Médio | Gasto médio por pessoa | Campo `ticketMedio` já pré-calculado (faturamento ÷ pessoas) | `TOP_DIAS_2025` |

Comparativo "Datas Equivalentes 2025 vs 2026":

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Data 2026 / Data 2025 | Data de 2026 e sua equivalente de 2025 | Pares mapeados manualmente | `COMPARACAO_DATAS` |
| Faturamento 2025 | Quanto rendeu a data equivalente em 2025 | Campo `faturamento2025`; se 0, mostra "Sem dados comparáveis" | `COMPARACAO_DATAS` |

## Filtros e opções

- **Seletor de bar (topo do sistema):** afeta **somente** a camada de atrações no Calendário Visual. Ao trocar de bar, a página busca as atrações planejadas daquele bar. Todo o resto (datas, feriadões, histórico) é igual para qualquer bar.
- **Busca (aba Lista de Datas):** filtra a tabela por nome do evento, tipo ou texto da dica. É a única busca da tela.
- **Legenda de potencial (topo):** apenas explicativa — mostra o que cada cor significa (máximo, alto, médio, baixo). Não é um filtro clicável.
- Não há filtro de período/data range, nem exportação, nem toggles. O calendário é sempre o ano de 2026.

## Regras e detalhes importantes

- **Conteúdo majoritariamente estático:** as datas de 2026, os feriadões, as ideias de ação e todo o histórico de 2025 são uma lista curada dentro do código (não vêm do banco em tempo real). O rótulo "Dados reais do sistema" no ranking Top 15 se refere a números que foram apurados uma vez e fixados como referência — eles **não** se recalculam sozinhos a cada acesso.
- **Único dado ao vivo:** a programação de atrações no Calendário Visual. Ela vem da tabela `gold.planejamento`, filtrada por `bar_id`, por atrações ativas (`ativo = true`) e pelo ano de 2026. É o único ponto da tela que respeita o filtro por bar.
- **Filtro por bar (`bar_id`):** aplicado apenas na busca de atrações. Se o bar não tiver nada planejado, o calendário aparece sem as bolinhas roxas — só com as datas importantes.
- **Histórico é do agregado de 2025**, não separado por bar. Sirva-se dele como referência geral, não como número oficial de um bar específico.
- **Potencial das datas** é uma classificação editorial (opinião de negócio sobre a força esperada da data), não uma previsão calculada a partir de vendas.
- **Aba de concorrência não está ativa:** existe no código um componente de "Eventos da Concorrência" (que consome uma API `/api/concorrencia`), mas ele **não está sendo exibido** nesta versão da tela.
- **Sem edição pela tela:** nada aqui é editável. Para mudar as atrações que aparecem no calendário, edite o Planejamento Comercial.

## Dúvidas frequentes

**Os números de 2025 mudam se eu atualizar a página?**
Não. O histórico de 2025 e o ranking são um retrato fixo, usado como referência para planejar 2026.

**Por que troquei de bar e o calendário quase não mudou?**
Só as atrações planejadas (bolinhas roxas) mudam por bar. As datas importantes e os feriadões são os mesmos para todos os bares.

**Como faço para uma atração aparecer no calendário?**
Cadastre-a no módulo de **Planejamento Comercial** para o bar e o ano corretos, com o status ativo. Ela passa a aparecer no dia correspondente no Calendário Visual.

**Consigo exportar essa agenda?**
Não há botão de exportação. A tela é de consulta e planejamento.

**Por que o cartão "Festivais/Shows" mostra 0?**
A contagem procura datas do tipo "festival", que hoje não existem na lista curada. Festivais aparecem nas dicas e no resumo por trimestre, mas não estão marcados com esse tipo.

**O que significa cada cor no calendário?**
Verde = potencial máximo, azul = alto, amarelo = médio, cinza = baixo. É a força esperada da data para o faturamento do bar.

## Fonte dos dados

- **`gold.planejamento`** (via `GET /api/comercial/atracoes?bar_id=N&ano=2026`) — atrações planejadas por dia, sobrepostas no Calendário Visual. Filtra por `bar_id`, `ativo = true` e o ano informado. Origem: módulo de Planejamento Comercial do Zykor.
- **Constantes fixas do código** (`frontend/src/app/comercial/data/constants.ts`): `DATAS_2026` (datas importantes), `FERIADOES_2026` (feriadões), `IDEIAS_ACOES` (plano de ação), `TOP_DIAS_2025` (ranking de dias), `FATURAMENTO_POR_DIA_2025` (média por dia da semana) e `COMPARACAO_DATAS` (datas equivalentes). Esses dados de 2025 foram apurados a partir da operação real (base ContaHub) e gravados como referência estática.
