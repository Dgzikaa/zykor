---
title: Controle de Produção
area: producao-cmv
slug: controle-producao
route: /operacional/producoes
description: Cronômetro de produção da cozinha e do bar que registra tempo, custo, aderência à ficha e rendimento de cada preparo, com histórico e análise por período.
order: 90
icon: Timer
---

# Controle de Produção

## Visão geral

O **Controle de Produção** é a tela onde a equipe da cozinha e do bar **executa e registra as produções internas** (preparos que têm ficha técnica: molhos, massas, xaropes, pré-preparos, drinks-base etc.). Funciona como um **cronômetro** que acompanha, em tempo real, quanto tempo levou cada produção, quanto custou de insumo, o quanto o time seguiu a ficha (**aderência**) e o quanto rendeu de fato (**rendimento real × esperado**).

A tela é pensada para uso em **tablet/celular na bancada**: dá para ter **várias produções rodando ao mesmo tempo** (cada uma com seu cronômetro), pausar, retomar, e o progresso é salvo automaticamente no servidor — se recarregar a página, trocar de aparelho ou cair a internet, o trabalho não se perde.

No dia a dia é usada por:
- **Cozinheiros e bartenders**, para iniciar e finalizar as produções do dia.
- **Gestores/produção e o dono**, para acompanhar ao vivo o que está sendo produzido e revisar no histórico se rendeu, se demorou e se gastou mais insumo do que a ficha pedia.

A tela ainda registra a **Alimentação da equipe** (refeições dos funcionários), que não têm ficha técnica.

## Como acessar

No menu lateral: **Produção & CMV → Controle de Produção** (rota `/operacional/producoes`).

- **Permissão de acesso à página:** módulo `controle_producao`.
- **Editar/Excluir** execução no histórico: seguem a **ação** (editar / excluir) do módulo *Controle de Produção* na configuração do usuário — não é mais exclusivo de admin (admin sempre pode).
- **Gerir equipe** (cadastrar/editar/remover responsáveis): permissão granular do módulo *Gerir Equipe (Responsáveis)* — quem tem Inserir, Editar ou Excluir nesse módulo vê o botão.
- **Seção Cozinha × Bar:** quem tem só o acesso `producao_cozinha` vê apenas a Cozinha; quem tem só `producao_bar` vê apenas o Bar; admin e quem tem ambos veem as duas.

## Passo a passo

### Iniciar e registrar uma produção
1. Selecione o **bar** no topo e a **seção** (Cozinha 👨‍🍳 ou Bar 🍺) no seletor à direita das abas.
2. Na aba **Executar**, use o campo **"Buscar produção para adicionar…"** e clique na ficha desejada (só aparecem fichas marcadas para o Controle de Produção). Ela vira um **card com cronômetro**.
3. Escolha o **Responsável** (obrigatório) no detalhe da produção.
4. Clique em **Iniciar** para começar o cronômetro. Os campos de peso e rendimento só liberam depois de iniciar (ou se for um lançamento retroativo).
5. Se o insumo mestre tem **fator de correção (FC)**, informe o **Peso bruto** (antes de limpar) e o **Peso líquido**. Caso contrário, informe só o **Peso real do mestre**. Esse peso define a **proporção** que recalcula os demais insumos.
6. Informe o **Rendimento real** (quanto de fato saiu).
7. Na tabela de insumos, preencha o **"Usado"** de cada insumo não-mestre (obrigatório). O botão **"Preencher c/ o calculado"** joga o valor teórico em todos, para você só ajustar o que mudou.
8. (Opcional) escreva uma **Observação**.
9. Clique em **Salvar execução**. Se algum valor parecer estar em unidade trocada (g × kg), a tela pede confirmação antes de gravar.

### Rodar várias produções em paralelo
- Cada produção adicionada vira um **chip** na barra de produções ativas, com seu próprio cronômetro e ponto verde (rodando) ou cinza (pausada). Clique num chip para abrir o detalhe dela. O tempo de todas continua correndo mesmo com a aba fechada.

### Retomar uma produção de outro aparelho
- Produções iniciadas em **outro tablet do bar** aparecem no **quadro amarelo "em andamento no bar"**. Clique em **Retomar esta** para assumir a posse (ela sai da tela do aparelho de origem — modelo de dono único).

### Lançamento retroativo
- No detalhe, mude a **"Data da produção"** para um dia passado. A produção passa a ser **retroativa** (sem cronômetro, pois já foi feita) e os campos liberam sem precisar iniciar o timer.

### Consultar o histórico
1. Vá na aba **Histórico**.
2. Filtre por **semana**, **dia**, **produção**, **responsável**, ou por texto (busca).
3. Use os botões **"Só fora do plano"**, **"Só acima do plano"** e o filtro de **rendimento** para focar em problemas.
4. Clique numa linha para ver o **detalhe dos insumos** consumidos.
5. Com permissão, dá para **Editar** (corrigir lançamento errado) ou **Excluir** a execução dentro do detalhe.

### Analisar por período
- Na aba **Análise**, escolha **Dia / Semana / Mês** e o período no seletor. O topo mostra o resumo consolidado e a lista, as produções do período.

### Registrar refeição da equipe
1. Vá na aba **Alimentação** e clique em **Nova refeição**.
2. Escolha **Responsável**, **Data**, tipo (**Almoço / Janta / Ceia**) e **Nº de pessoas** (opcional).
3. Busque e adicione os **insumos** (arroz, feijão, linguiça…) e informe a **quantidade** de cada.
4. Clique em **Iniciar** para cronometrar (opcional) e depois em **Registrar refeição**.

## Abas e seções

A tela tem um seletor **Cozinha 👨‍🍳 / Bar 🍺** (a seção sai da ficha pelo código: código começando com `pd` = Bar/drinks, o resto = Cozinha) que se aplica às abas Executar, Histórico e Análise. A aba Alimentação é do bar todo (sem seção).

| Aba | O que faz |
|---|---|
| **Executar** | Adiciona produções e roda o cronômetro. Traz o quadro "em andamento no bar" (retomar), o calendário do Planejamento da Produção e o formulário de execução (peso, rendimento, insumos usados). |
| **Histórico** | Lista as execuções já finalizadas, com tempo, custo planejado/real, aderência, rendimento, FC e alertas. Tem o "Resumo da semana" quando uma semana está selecionada. Permite editar/excluir e ver o detalhe dos insumos. |
| **Análise** | Consolida as execuções por Dia/Semana/Mês, com "Nota" (% de produções dentro do rendimento), rendimento médio, aderência, desvios de insumo e rendimento, e tempo. |
| **Alimentação** | Registra refeições da equipe (sem ficha), com custo total e custo por pessoa, e histórico das refeições. |

## Colunas e cálculos

### Aba Executar — detalhe da produção

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Tempo (cronômetro) | Tempo decorrido da produção | Âncora de relógio: `segundos` bancados (segmentos pausados) + tempo do segmento em curso (`agora − rodandoDesde`). Reconstrói do relógio ao recarregar. | Estado local + rascunho no servidor |
| Proporção | Quanto a produção foi escalada vs. a ficha | `peso do mestre (em base) ÷ quantidade do mestre na ficha`. Se sem mestre ou sem peso, = 1. | Ficha (`producao_ficha_item`) + peso digitado |
| Planejado (insumo) | Quantidade da ficha para aquele insumo | `quantidade` do item na ficha (exibido dividido pelo fator de unidade do mestre). | `producao_ficha_item.quantidade` |
| Calculado (insumo) | Quanto deveria usar dado o tamanho da fornada | Mestre: peso do mestre digitado. Demais: `quantidade da ficha × proporção`. | Cálculo da tela |
| Usado (insumo) | Quanto de fato foi usado (obrigatório nos não-mestre) | Valor digitado; se em branco, cai no Calculado. O mestre é dirigido pelo peso, não pela coluna Usado. | Entrada manual |
| Desvio (insumo) | Diferença % entre usado e calculado | `(usado − calculado) ÷ calculado`. Verde <5%, âmbar <15%, vermelho acima. | Cálculo da tela |
| Custo real (insumo) | Custo do que foi usado | `usado × preço unitário`. Preço vem da cascata VMarket → planilha (recebido de `/producoes/ficha`). | `preco_un` da ficha |
| Custo planejado (card) | Custo teórico da fornada | Soma de `calculado × preço unitário` de todos os insumos. | Cálculo da tela |
| Custo real (card) | Custo efetivo da fornada | Soma de `usado × preço unitário` de todos os insumos. | Cálculo da tela |
| FC real (peso do mestre) | Aproveitamento do mestre (líquido/bruto) | `peso líquido ÷ peso bruto`. Comparado ao FC esperado da ficha (verde acima, vermelho abaixo). Só quando o mestre tem FC. | Pesos digitados + `producao_ficha_item.fator_correcao` |
| Rendimento real / meta | Quanto rendeu vs. o esperado | Meta = `rendimento da ficha × proporção`. Real = valor digitado (na unidade do produto). | Ficha + entrada manual |

### Aba Histórico — tabela principal

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Data | Data/hora do registro | `criado_em` formatado em horário local (dia/mês, hora:min). | `operations.producao_execucao` |
| Produção | Nome e código da ficha | Juntado por `producao_id` com `producao_base`. Mostra selo "plano → feito" se acima do plano. | `producao_base` |
| Responsável | Quem fez | `responsavel_nome` gravado no momento do registro. | `producao_execucao` |
| Tempo | Duração da produção | `duracao_seg` formatado (h:mm:ss). | `producao_execucao.duracao_seg` |
| Custo plan./real | Custo teórico e efetivo | `custo_planejado` e `custo_real` (snapshot no save: soma de qtd × preço). | `producao_execucao` |
| Desvio Insumos | Gastou mais/menos ingrediente que a ficha | `custo_real − custo_planejado`. Vermelho se positivo, verde se negativo. | Cálculo da tela |
| Aderência | O quanto seguiu a ficha nos insumos | `100 − (média dos desvios % absolutos dos insumos)`, limitado a 0–100. Verde ≥90, âmbar ≥80, vermelho abaixo. | `producao_execucao.aderencia_pct` |
| Rend. real/meta | Rendimento produzido × esperado | Valores em unidade amigável (kg/L). Real e esperado gravados na execução. | `producao_execucao` |
| % Rend. | Percentual do rendimento | `rendimento_real ÷ rendimento_esperado × 100`. Verde 95–105%, âmbar ≥90%, vermelho abaixo. | Cálculo da tela |
| FC real/esp | Fator de correção realizado vs. esperado | Real = `peso_mestre_real ÷ peso_bruto`. Esperado = FC da ficha. Só quando pesaram o bruto. | Execução + `fator_correcao` da ficha |
| Desvio Rend. | Valor em R$ do desvio de rendimento | `(rendimento real − esperado) × custo por kg da produção`, onde custo por kg = `custo_planejado ÷ rendimento_esperado`. Verde se sobrou, vermelho se faltou. | Cálculo da tela (`_shared.desvioRendReais`) |
| Alertas | Selos de atenção | Ver "Regras e detalhes" abaixo. | Cálculo da tela |

**Detalhe da execução (modal)** — tabela de insumos: **Insumo**, **Bruto** (só o mestre com FC), **Calculado**, **Usado**, **Desvio %** (`(usado − calculado) ÷ calculado`), **Custo real**.

### Aba Histórico — Resumo da semana (só com semana selecionada)

| Card | O que mostra | Como é calculado |
|---|---|---|
| Planejado × executado | Quantas planejadas foram feitas / total planejado | Produções do plano encerrado da semana cruzadas com as executadas. |
| Fora do plano | Execuções não planejadas na semana | Contagem de execuções dentro da janela do plano cuja produção não estava planejada. |
| Acima do plano | Produziram mais que o planejado (>5%) | Compara quantidade produzida (rend. real convertido) com `decidido_qtd` do plano, tolerância 5%. |
| Aderência média | Média de aderência das execuções | Média de `aderencia_pct`. |
| Rend. no esperado | Quantas ficaram dentro de ±5% | Contagem com `|real ÷ esperado − 1| ≤ 0,05`. |
| Desvio insumos | Custo extra de ingrediente na semana | `Σ custo_real − Σ custo_planejado`. |
| Desvio rendimento | Ganho/perda em R$ por rendimento | `Σ` do desvio de rendimento em R$ das execuções. |
| Tempo total | Soma de tempo | `Σ duracao_seg`. |

### Aba Análise — Resumo do período

| Card | O que mostra | Como é calculado |
|---|---|---|
| Nota | Qualidade do rendimento | `% de produções (com rendimento) dentro de ±5% do esperado`. Verde ≥90, âmbar ≥70. |
| Rend. médio | Rendimento médio | Média de `rendimento_real ÷ esperado × 100` das produções com rendimento. |
| Aderência | Aderência média de insumos | Média de `aderencia_pct`. |
| Desvio insumos | Custo real − planejado | `Σ custo_real − Σ custo_planejado`. |
| Desvio rend. | Ganho/perda de rendimento em R$ | `Σ` do desvio de rendimento em R$. |
| Tempo | Soma de tempo | `Σ duracao_seg`. |
| Produções | Quantas no período | Contagem de execuções do período. |

### Aba Alimentação

| Coluna / Card | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Custo total | Custo da refeição | `Σ (quantidade em base × preço unitário)` dos insumos. Preço = preço do insumo ÷ embalagem. | `silver.insumo_catalogo` (via `/operacional/insumos`) |
| Custo / pessoa | Custo por funcionário | `custo total ÷ nº de pessoas`. | Cálculo da tela |
| Tempo | Duração do preparo | `duracao_seg` (cronômetro opcional). | `operations.alimentacao_execucao` |
| Pessoas | Nº de pessoas servidas | Valor digitado (opcional). | Entrada manual |
| Custo (histórico) | Custo gravado | `custo_total` no momento do registro. | `alimentacao_execucao` |

## Filtros e opções

- **Bar** (topo): todas as queries filtram por `bar_id`. Nunca mistura bares.
- **Seção Cozinha / Bar**: filtra as fichas e as execuções pela origem (código `pd` = Bar).
- **Semana** (Histórico): mesmo calendário do Planejamento da Produção; ativa o "Resumo da semana" e as marcações fora/acima do plano.
- **Dia** (Histórico): filtra por uma data local específica.
- **Busca por texto**: por nome ou código da produção.
- **Produção / Responsável**: filtros diretos.
- **Só fora do plano**: mostra apenas execuções não planejadas (dentro da semana do plano).
- **Só acima do plano**: mostra apenas produções que passaram da quantidade planejada (>5%); precisa de semana selecionada.
- **Rendimento (todos / abaixo / dentro / acima)**: filtra pela relação real ÷ esperado com tolerância ±5%.
- **Granularidade Dia/Semana/Mês** (Análise) e **período** de datas (Alimentação).

## Regras e detalhes importantes

- **Filtragem por bar:** obrigatória em toda query; a lista de fichas, execuções e catálogo é sempre do bar selecionado.
- **Manual vs. automático:** os **pesos, o rendimento real e o "usado" são manuais** (digitados na execução). O **custo é automático** — o preço vem da cascata **VMarket → planilha** (`preco_un` recebido da ficha) e é **congelado (snapshot)** no momento do salvamento; a tela não recalcula o motor de custo depois.
- **Unidades:** os valores são gravados na **unidade-base** (g/ml/un). A tela deixa digitar em unidade amigável (kg/L quando a referência ≥ 1.000) e converte multiplicando pelo fator. O **rendimento** usa a unidade do **produto** (da ficha), não a do insumo mestre.
- **Aviso de unidade:** se um valor ficar ~25× (aviso inline) ou ~50× (bloqueio no salvar) longe do esperado, a tela alerta sobre confusão g × kg / ml × L. O servidor ainda **bloqueia** o fisicamente impossível: peso líquido > peso bruto, ou rendimento ≥ 50× a meta.
- **Aderência:** `100 − desvio médio absoluto dos insumos`, limitada a 0–100. Só entra no cálculo o insumo com "usado" informado e calculado > 0.
- **Retroativo:** lançar uma data passada ancora o fim ao meio-dia daquele dia e dispensa o cronômetro; ganha o selo "retroativo".
- **Idempotência:** o "Finalizar" pode disparar 2–3× em rede lenta. Uma chave de idempotência por execução (índice único `bar_id + idempotencia_key`) e uma janela de 5 min impedem duplicatas — o retry recebe a execução que já venceu, não cria outra.
- **Autosave e dono único:** o rascunho é salvo no `localStorage` (a cada 1s) e no servidor (a cada 10s + ao sair/backgroundear). Produções em andamento são visíveis entre aparelhos do bar via Supabase Realtime; cada uma tem **um único dono** (aparelho) por vez.
- **Alertas do histórico:** `demorou` (tempo > meta da ficha, ou > 1,3× o tempo médio), `gasto alto` (custo real > 1,1× planejado), `insumo fora` (aderência < 85%), `baixo rend.` (rend. real < 95% do esperado), `retroativo`, `fora do plano`, `acima do plano`.
- **Fora do plano** só é marcado **dentro da janela** de uma semana com plano encerrado — nunca marca execução de outra semana.
- **Excluir** remove a execução do histórico **e das médias** (baselines) — não dá para desfazer. Fichas do ContaHub e bases de clientes não são afetadas (isto é tabela própria de execução).
- **Estados vazios:** sem fichas marcadas para o Controle, o buscador avisa para marcar em Fichas Técnicas → aba Produção (checkbox). Sem execuções, as tabelas mostram mensagem apropriada.

## Dúvidas frequentes

**Por que a produção não aparece no buscador?**
Só aparecem fichas com o **checkbox "Controle de Produção" marcado** (em Fichas Técnicas → aba Produção) e da **seção** (Cozinha/Bar) ativa.

**Recarreguei a página / mudei de tablet e perdi a produção?**
Não. O progresso é salvo no servidor. Se começou em outro aparelho, ela aparece no quadro amarelo "em andamento no bar" — clique em **Retomar esta**.

**O que é "aderência"?**
É o quanto o time seguiu a ficha nos insumos: 100% quando o "usado" bate com o calculado; cai conforme os desvios. Abaixo de 85% ganha o alerta "insumo fora".

**Qual a diferença entre "Desvio Insumos" e "Desvio Rend."?**
**Desvio Insumos** é dinheiro gasto a mais/menos em ingrediente (custo real − planejado). **Desvio Rend.** é o valor em R$ de ter rendido mais ou menos do que a ficha previa.

**De onde vem o custo?**
Do preço do insumo na cascata VMarket → planilha, congelado no momento em que você salva a execução. Mudança de preço depois não altera execuções já gravadas.

**A aba Alimentação usa ficha técnica?**
Não. Você escolhe os insumos direto do catálogo e informa a quantidade; o preço vem do catálogo (preço ÷ embalagem). Serve para registrar o custo das refeições da equipe.

## Fonte dos dados

- **`operations.producao_execucao`** — cabeçalho de cada execução (tempo, custos, aderência, rendimento, pesos).
- **`operations.producao_execucao_insumo`** — insumos consumidos por execução (calculado, usado, desvio, custo).
- **`operations.producao_execucao_rascunho`** — rascunhos de autosave (produções e refeições em andamento, sincronizados via Realtime).
- **`operations.alimentacao_execucao`** e **`operations.alimentacao_execucao_insumo`** — refeições da equipe.
- **`public.producao_base`** — cadastro das fichas de produção (nome, código, unidade, rendimento, seção, tempo-meta, flag de controle).
- **`public.producao_ficha_item`** — itens da ficha (quantidade, mestre, fator de correção, custo da planilha).
- **`operations.producao_plano` / `producao_plano_item`** — planejamento da produção (para marcar fora/acima do plano).
- **`silver.insumo_catalogo`** (via `/api/operacional/insumos`) — catálogo e preço dos insumos da Alimentação.
- **Preço dos insumos:** cascata **VMarket → planilha** (integração VMarket de compras + planilha mestre de insumos). Custos são snapshot no momento do save.
