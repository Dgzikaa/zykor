---
title: NPS de Funcionários
area: rh
slug: nps-funcionarios
route: /operacional/nps
description: Acompanha a Pesquisa da Felicidade da equipe e os indicadores de NPS por categoria, com registro manual, sincronização por planilha e leitura de comentários.
order: 70
icon: Star
---

# NPS de Funcionários

## Visão geral

A tela reúne, em um só lugar, as pesquisas de clima e satisfação ligadas à operação do bar. Ela tem duas frentes:

- **Pesquisa da Felicidade** — mede como a equipe se sente em cinco dimensões (engajamento, pertencimento, relacionamento, liderança e reconhecimento), com nota de 0 a 5. É a pesquisa interna de RH, respondida pelos próprios funcionários.
- **NPS Categorizado** — mostra o NPS (Net Promoter Score) por categoria de experiência (ambiente, atendimento, limpeza, música, comida, drink, preço e reservas), agregado por semana ou por dia, com os comentários deixados junto de cada avaliação.

Serve para o dono/gestor e para o RH acompanharem o clima do time e a qualidade percebida da operação ao longo do tempo, identificando semanas fora da meta e lendo o que foi comentado. Os dados chegam de forma automática (sincronização com Google Sheets), mas também podem ser lançados manualmente pela própria tela.

> Observação: apesar do nome "NPS Funcionários" no menu, a aba **NPS Categorizado** exibe o NPS de experiência (mais próximo do cliente/operação), enquanto a aba **Pesquisa da Felicidade** é a de clima interno da equipe. As duas convivem na mesma tela.

## Como acessar

- Menu lateral: **RH → NPS Funcionários**.
- Rota direta: `/operacional/nps`.
- **Permissão necessária:** módulo `gestao` (Gestão). Quem não tiver esse acesso não vê o item no menu.
- O título exibido no cabeçalho é "😊 NPS e Pesquisa da Felicidade".

Existe ainda uma tela auxiliar em `/operacional/nps/categorizado` que mostra apenas a tabela de NPS por categoria (mesma fonte de dados, com filtro Por Dia / Por Semana).

## Passo a passo

### Filtrar o período e o setor
1. No topo, no card **Filtros**, informe **Data Início** e **Data Fim**.
2. Em **Setor**, escolha entre Todos, Liderança, Cozinha, Bar ou Salão (o filtro de setor afeta a Pesquisa da Felicidade).
3. Clique em **Atualizar** para recarregar os dados. Ao trocar as datas ou o setor, a tela já recarrega sozinha.

### Registrar uma nova pesquisa manualmente
1. Clique em **Nova Pesquisa**.
2. No modal, escolha o **Tipo de Pesquisa**: *Pesquisa da Felicidade* ou *NPS*.
3. Preencha os **dados básicos**: Data da Pesquisa, Setor, Nome do Funcionário e, opcionalmente, o Quórum (número de participantes).
4. Preencha as notas de cada pergunta (escala de 0 a 5, aceitando casas decimais):
   - *Felicidade:* Engajamento, Pertencimento, Relacionamento, Liderança e Reconhecimento.
   - *NPS:* Área de atuação, Motivação, Empresa se preocupa, Conexão com colegas, Relacionamento positivo e Identificação.
5. Clique em **Salvar Pesquisa**. O botão só habilita quando Setor e Nome do Funcionário estão preenchidos.

### Sincronizar com a planilha (Google Sheets)
1. Clique em **Sincronizar Planilha**.
2. O sistema busca os dados de NPS e de Pesquisa da Felicidade da planilha e importa para o banco.
3. Ao terminar, aparece um aviso com o resumo (quantos registros de cada pesquisa foram sincronizados) e a tela recarrega.

### Sincronizar apenas um período (Sync Retroativo)
1. No bloco **Sync Retroativo**, informe **Data Início** e **Data Fim** (ambos obrigatórios).
2. Clique em **Sync NPS** (respostas de NPS) ou **Sync NPS Reservas** (respostas ligadas a reservas).
3. Use isso para corrigir ou preencher dados antigos sem reprocessar tudo.

### Ler os comentários de uma semana (aba NPS Categorizado)
1. Abra a aba **NPS Categorizado**.
2. Clique no nome da semana (as semanas com comentários mostram um contador ao lado).
3. A linha expande e lista todos os comentários daquela semana, ordenados por sentimento — **negativos primeiro**, depois neutros e positivos —, com uma faixa colorida à esquerda (vermelho = negativo, verde = positivo, cinza = neutro).

## Abas e seções

### Aba "Pesquisa da Felicidade"
Mostra o clima da equipe no período/setor filtrado. Tem dois blocos:
- **Cards por setor** — um card para cada setor que teve respostas, com a média das notas (em uma escala de 0 a 5) e a quantidade de respostas.
- **Respostas Detalhadas** — tabela com uma linha por resposta registrada, exibindo data, setor, as cinco dimensões e a média geral.

### Aba "NPS Categorizado"
Mostra o NPS por categoria, agregado por semana. Cada linha é uma semana, com a nota de NPS de cada categoria (colorida conforme a meta) e o total de respostas. Clicar na semana abre os comentários. Tem paginação (20 semanas por página) e uma legenda de cores no rodapé.

### Modal "Nova Pesquisa"
Formulário para lançar manualmente uma resposta de Felicidade ou de NPS interno (ver "Passo a passo").

## Colunas e cálculos

### Aba Pesquisa da Felicidade — cards por setor

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Setor | Nome do setor com respostas | Agrupamento das respostas por `setor` | `pesquisa_felicidade` |
| Média (/ 5.0) | Média de satisfação do setor | Soma de `media_geral` das respostas do setor ÷ nº de respostas do setor, com 2 casas | `pesquisa_felicidade` |
| Respostas | Quantas respostas o setor teve | Contagem de linhas do setor | `pesquisa_felicidade` |

### Aba Pesquisa da Felicidade — tabela Respostas Detalhadas

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Data | Data da pesquisa | Campo `data_pesquisa` formatado em pt-BR | `pesquisa_felicidade` |
| Setor | Setor do respondente | Campo `setor` | `pesquisa_felicidade` |
| Engajamento | "Eu comigo" | Campo `eu_comigo_engajamento` (0–5) | `pesquisa_felicidade` |
| Pertencimento | "Eu com a empresa" | Campo `eu_com_empresa_pertencimento` (0–5) | `pesquisa_felicidade` |
| Relacionamento | "Eu com colega" | Campo `eu_com_colega_relacionamento` (0–5) | `pesquisa_felicidade` |
| Liderança | "Eu com gestor" | Campo `eu_com_gestor_lideranca` (0–5) | `pesquisa_felicidade` |
| Justiça | Reconhecimento | Campo `justica_reconhecimento` (0–5) | `pesquisa_felicidade` |
| Média | Média das dimensões da resposta | Campo `media_geral` (gravado na origem), exibido com 2 casas | `pesquisa_felicidade` |

### Aba NPS Categorizado — tabela por semana

Cada célula de categoria é um NPS na escala clássica (−100 a 100), calculado na view semanal a partir das respostas individuais (notas de 0 a 10). A regra geral por categoria é: **% de promotores (nota > 8) menos % de detratores (nota entre 1 e 6)**, considerando apenas respostas com nota maior que 0, e arredondado para inteiro.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Semana | Rótulo da semana (ex.: "Semana 27") | `EXTRACT(week …)` da `data_pesquisa`; abre os comentários ao clicar | view `nps_agregado_semanal` |
| Respostas | Total de respostas na semana | `count(*)` das respostas da semana/bar | view `nps_agregado_semanal` |
| NPS Geral | NPS da avaliação geral | %(nps_geral > 8) − %(nps_geral entre 1 e 6), sobre respostas com nota > 0 | view `nps_agregado_semanal` (tabela `nps`) |
| Ambiente | NPS do ambiente | mesma fórmula sobre `nps_ambiente` | view `nps_agregado_semanal` |
| Atendimento | NPS do atendimento | mesma fórmula sobre `nps_atendimento` | view `nps_agregado_semanal` |
| Limpeza | NPS da limpeza | mesma fórmula sobre `nps_limpeza` | view `nps_agregado_semanal` |
| Música | NPS da música | mesma fórmula sobre `nps_musica` | view `nps_agregado_semanal` |
| Comida | NPS da comida | mesma fórmula sobre `nps_comida` | view `nps_agregado_semanal` |
| Drink | NPS dos drinks | mesma fórmula sobre `nps_drink` | view `nps_agregado_semanal` |
| Preço | NPS de preço/custo-benefício | mesma fórmula sobre `nps_preco` | view `nps_agregado_semanal` |
| Reservas | NPS da experiência de reserva | (count(nota ≥ 6) − count(nota ≤ 5)) ÷ total × 100; sem dados vira 0 | view `nps_agregado_semanal` (tabela `nps_reservas`) |
| Contador de comentários | Nº de comentários únicos da semana | Junta os comentários de todas as categorias e remove duplicados | view `nps_agregado_semanal` |

Observações sobre a coluna de NPS:
- O valor exibido no badge é o número inteiro de NPS calculado na view (não é a média simples das notas).
- Promotores, neutros e detratores individuais **não** são exibidos por categoria (ficam zerados na resposta da API); o que aparece é o índice de NPS já consolidado.
- A cor do badge segue a **meta 70**: verde quando ≥ 70, vermelho quando < 70.

## Filtros e opções

| Filtro / Opção | Efeito |
|---|---|
| Bar (BarContext) | Todos os dados são carregados para o bar selecionado; a tela sempre filtra por `bar_id`. Trocar de bar recarrega tudo. |
| Data Início / Data Fim | Delimita o período das duas abas. Início padrão: 26/06/2025 (primeira data da planilha); Fim padrão: hoje. |
| Setor | Filtra a Pesquisa da Felicidade por Liderança, Cozinha, Bar, Salão ou Todos. |
| Sync Retroativo (Início/Fim) | Define a janela para o Sync NPS / Sync NPS Reservas (só reimporta o período informado). |
| Aba Por Dia / Por Semana | Na tela auxiliar `/operacional/nps/categorizado`, alterna a agregação do NPS entre diária e semanal. |

## Regras e detalhes importantes

- **Sempre por bar:** todas as consultas exigem `bar_id`; nenhum dado é misturado entre bares.
- **Escalas diferentes por aba:** a Pesquisa da Felicidade usa nota de **0 a 5** (e mostra média nessa escala); o NPS Categorizado usa a escala clássica de **NPS (−100 a 100)**, calculada a partir de notas de 0 a 10.
- **Promotor x detrator no NPS por categoria:** promotor é nota **> 8** (ou seja, 9 e 10) e detrator é nota **entre 1 e 6**; notas iguais a 0 são ignoradas (tratadas como "sem resposta" naquele critério). Reservas usa um corte diferente: promotor ≥ 6 e detrator ≤ 5.
- **Meta 70:** na aba principal, verde é ≥ 70 e vermelho é < 70. A legenda "4–5 Excelente / 2–3 Regular / 1 Ruim" que aparece na tela auxiliar `/categorizado` refere-se a outra leitura e não reflete o índice de NPS mostrado; use a régua de 70 como referência.
- **Manual x automático:** os dados chegam automaticamente pela sincronização com a planilha do Google Sheets (via a função `google-sheets-sync`), mas também podem ser lançados/corrigidos manualmente pelo botão "Nova Pesquisa". O upsert usa a chave `bar_id + data_pesquisa + funcionario_nome + setor`, então relançar a mesma combinação **substitui** o registro anterior.
- **Dados de origem podem estar congelados:** as tabelas `nps` e `nps_reservas` que alimentam o NPS Categorizado vinham da planilha do Google Sheets, cuja carga parou em meados de março/2026. Se a aba aparecer sem semanas recentes, é por isso — não é erro de cálculo.
- **Análise de sentimento dos comentários:** a ordenação dos comentários (negativo → neutro → positivo) é feita no próprio navegador por uma lista de palavras-chave em português; é uma heurística simples, não uma classificação de IA.
- **Arredondamento:** o NPS de cada categoria é arredondado para inteiro na view; as médias da Felicidade são exibidas com 2 casas.
- **Estados vazios:** quando não há respostas no período, cada aba mostra "Nenhum dado encontrado para o período selecionado".

## Dúvidas frequentes

**A aba NPS Categorizado está vazia. É erro?**
Provavelmente não. Verifique o período (o padrão começa em 26/06/2025) e lembre que a carga da planilha que alimenta essa aba parou em março/2026. Ajuste as datas ou faça um Sync Retroativo do período desejado.

**Qual a diferença entre "Nova Pesquisa" tipo NPS e tipo Felicidade?**
Ambas registram notas de 0 a 5 por funcionário/setor, mas gravam em tabelas diferentes: o tipo Felicidade vai para a Pesquisa da Felicidade (as cinco dimensões de clima) e o tipo NPS grava as seis perguntas de engajamento interno.

**Por que o número do NPS é tão diferente da média das notas?**
Porque NPS não é média: é a diferença entre a porcentagem de promotores e a de detratores, o que gera uma escala de −100 a 100. Uma categoria pode ter "boas" notas médias e ainda ficar abaixo de 70 de NPS se tiver muitos detratores.

**O filtro de Setor afeta a aba NPS Categorizado?**
Não. O filtro de Setor age sobre a Pesquisa da Felicidade. A aba NPS Categorizado é agregada por semana e por bar.

**"Sincronizar Planilha" e "Sync Retroativo" fazem a mesma coisa?**
Não. "Sincronizar Planilha" reimporta tudo (NPS + Felicidade). O "Sync Retroativo" reimporta somente a janela de datas informada, útil para corrigir dados antigos.

**Quem consegue registrar e ver essas pesquisas?**
Quem tiver a permissão de módulo `gestao`. O item aparece no menu em RH → NPS Funcionários.

## Fonte dos dados

- **`pesquisa_felicidade`** (tabela) — respostas da Pesquisa da Felicidade; alimenta os cards por setor e a tabela detalhada. API: `/api/pesquisa-felicidade`.
- **`nps`** (tabela) — respostas de NPS por categoria (geral, ambiente, atendimento, limpeza, música, comida, drink, preço) e comentários.
- **`nps_reservas`** (tabela) — respostas de NPS ligadas à experiência de reserva.
- **View `nps_agregado_semanal`** (e as variantes `nps_agregado_diario` / `nps_agregado_mensal`) — agregam as tabelas acima e aplicam a fórmula de NPS por categoria. API: `/api/nps/agregado`.
- **Função `google-sheets-sync`** (Supabase Edge Function) — importa NPS e Felicidade da planilha do Google Sheets. Acionada por `/api/ferramentas/nps/sync-manual` (sincronização completa) e por `/api/nps/sync` e `/api/nps/sync-reservas` (sync retroativo).
- **Integração de origem:** Google Sheets (planilha de pesquisas). As reservas têm relação com o fluxo de reservas (GetIn) que alimenta a planilha.
