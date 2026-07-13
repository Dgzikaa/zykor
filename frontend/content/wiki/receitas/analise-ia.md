---
title: Análise (IA)
area: receitas
slug: analise-ia
route: /receitas/analise
description: Compara o faturamento médio por dia da semana do mês de referência contra três janelas (ano anterior, mês anterior e trimestre) e gera com IA um rascunho editável de Problemas, Oportunidades e Reflexões.
order: 20
icon: Sparkles
---

# Análise (IA)

## Visão geral

A tela **Análise (IA)** é o "raio-x de detratores e promotores de receita" do bar. Ela pega o **faturamento médio por dia da semana** (segunda a domingo) do mês que você escolher e compara com três períodos de referência: o mesmo mês do ano passado, o mês anterior e o trimestre anterior. Assim você enxerga rapidamente **quais dias da semana estão crescendo (promotores) e quais estão caindo (detratores)**.

Além do comparativo em números, a tela usa **inteligência artificial** para gerar um **rascunho** de análise textual dividido em três blocos — Problemas, Oportunidades e Reflexões. Esse rascunho é editável: o sócio ou gestor revisa, ajusta e salva. A ideia é acelerar a leitura estratégica do mês sem partir da folha em branco.

Quem usa no dia a dia: sócios, donos e gestores de receita, tipicamente no fechamento mensal, para entender o desempenho por dia da semana e montar o plano do próximo período.

## Como acessar

No menu lateral: **Receitas → Análise (IA)** (`/receitas/analise`).

A área Receitas exige permissão de módulo. O acesso é liberado para quem tem qualquer um dos módulos: `receitas_dashboard_de_receitas`, `receitas`, `relatorios`, `analitico` ou `gestao`. No menu, o item aparece com a permissão `relatorios`. Se você não vê a opção, provavelmente falta o módulo de relatórios/receitas no seu perfil.

Um bar precisa estar selecionado no seletor de bar. Sem bar escolhido, a tela mostra "Selecione um bar".

## Passo a passo

**1. Escolher o mês de referência**
No topo direito, use o campo **Mês de referência** (seletor de mês) para definir qual mês você quer analisar. Por padrão, abre no mês corrente. Toda a tela recalcula a partir dessa escolha.

**2. Ler a matriz mês a mês**
O primeiro bloco ("Faturamento médio por dia da semana — mês a mês") mostra uma tabela com os dias da semana nas linhas e os meses nas colunas. Use o seletor **Janela** (3, 6 ou 12 meses) para definir quantos meses aparecem — a janela sempre termina no mês de referência.

**3. Ler o comparativo por janelas**
O segundo bloco mostra, para cada dia da semana, o faturamento médio do mês de referência e a variação percentual contra ano anterior, mês anterior e trimestre, com cor e ícone indicando promotor (verde/subiu) ou detrator (vermelho/caiu).

**4. Informar o contexto do período**
No bloco "Contexto do período", escreva o que mudou na operação (programação, happy hour, temáticas, eventos). Isso é opcional, mas ajuda a IA a explicar as **causas** das variações em vez de só descrever os números.

**5. Gerar o rascunho com IA**
Clique em **Gerar rascunho com IA**. A IA lê o comparativo por dia da semana e o contexto que você escreveu e devolve cards de Problemas, Oportunidades e Reflexões. (O botão fica desabilitado enquanto não houver dados do mês.)

**6. Revisar e editar os cards**
Cada card tem título e texto **editáveis** direto na tela. Ajuste o que quiser — a IA gera apenas um ponto de partida.

**7. Salvar a análise**
Clique em **Salvar análise**. O texto é guardado por **bar + mês**. Ao reabrir a tela no mesmo bar e mês, a análise salva volta preenchida. Aparece "Salvo às HH:MM" quando grava com sucesso.

## Abas e seções

A tela é uma página única, organizada em blocos empilhados (não há abas):

- **Matriz mês a mês** — tabela dia da semana × mês, com mapa de calor e variação célula a célula.
- **Comparativo por janelas** — tabela do mês de referência contra ano anterior, mês anterior e trimestre.
- **Contexto do período** — campo de texto livre + botão de gerar IA.
- **Rascunho (Problemas / Oportunidades / Reflexões)** — cards editáveis, aparecem só depois de gerar ou se já houver análise salva.

## Colunas e cálculos

Toda a tela usa uma métrica base: **faturamento médio por ocorrência de cada dia da semana**. Ou seja, soma o faturamento (`real_r`) de todos os eventos daquele dia da semana no período e divide pelo número de ocorrências (não é soma bruta). Isso permite comparar meses que têm, por exemplo, 4 ou 5 sábados de forma justa. Só entram eventos com faturamento maior que zero (`real_r > 0`).

### Matriz mês a mês (bloco 1)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Dia da semana, de Segunda a Domingo | Dia da semana da `data_evento` (calculado ao meio-dia UTC) | `eventos_base` |
| [Mês] (uma coluna por mês da janela) | Faturamento médio por ocorrência daquele dia naquele mês | Soma de `real_r` dos eventos daquele dia da semana no mês ÷ nº de ocorrências, arredondado | `eventos_base` |
| Variação na célula (▲/▼ %) | Quanto o dia cresceu/caiu vs o **mesmo dia no mês anterior** da tabela | (valor do mês − valor do mês anterior) ÷ valor do mês anterior × 100, 1 casa decimal; só quando ambos > 0 | Calculado na API |
| Intensidade (cor de fundo verde) | Mapa de calor: verde mais forte = valor mais alto naquela linha | Proporção do valor sobre o maior valor da linha (dia) | Calculado no componente |
| Média | Média geral do dia no período | Média das médias mensais, considerando só os meses com valor > 0 | Calculado no componente |

### Comparativo por janelas (bloco 2)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Dia da semana (Seg..Dom) | Dia da semana da `data_evento` | `eventos_base` |
| Atual | Faturamento médio por ocorrência do dia no **mês de referência** | Soma de `real_r` do dia no mês ÷ nº de ocorrências, arredondado | `eventos_base` |
| vs [ano anterior] (YoY) | Variação % contra o **mesmo mês do ano passado** | (Atual − média do mesmo mês ano anterior) ÷ base × 100, 1 casa; classifica promotor/detrator | `eventos_base` |
| vs [mês anterior] (MoM) | Variação % contra o **mês imediatamente anterior** | (Atual − média do mês anterior) ÷ base × 100, 1 casa; classifica promotor/detrator | `eventos_base` |
| vs trimestre (Tri) | Variação % contra a **média dos 3 meses anteriores** | (Atual − média por ocorrência dos 3 meses anteriores) ÷ base × 100; classifica | `eventos_base` |

**Classificação de cada variação** (define a cor/ícone verde ou vermelho):
- **Promotor** (verde, ▲): variação **≥ +3%** — o dia melhorou naquela janela.
- **Detrator** (vermelho, ▼): variação **≤ −3%** — o dia caiu naquela janela.
- **Estável** (cinza, –): entre −3% e +3%.
- **"—"**: sem base de comparação (não havia dado naquela janela para o dia).

### Cards da análise IA (bloco 4)

| Card | O que mostra | Como é gerado | Fonte |
|---|---|---|---|
| Problemas | Dias/janelas que caíram (detratores) e merecem atenção | IA a partir do comparativo por dia da semana + contexto | IA (Zykor AI) |
| Oportunidades | Dias que cresceram (promotores) para escalar, ou dias fracos com potencial | IA a partir dos mesmos dados | IA (Zykor AI) |
| Reflexões | Leituras estratégicas do trimestre | IA a partir dos mesmos dados | IA (Zykor AI) |

Cada card tem **Título** e **Texto**, ambos editáveis manualmente antes de salvar.

## Filtros e opções

| Filtro / Opção | Onde | Efeito |
|---|---|---|
| **Bar** | Seletor global de bar (topo) | Todas as consultas filtram por `bar_id`. Cada bar tem seus próprios números e sua própria análise salva. |
| **Mês de referência** | Campo de mês no topo | Define o mês analisado e a base das três janelas de comparação. Recarrega tudo. |
| **Janela (3 / 6 / 12 meses)** | Dentro do bloco da matriz | Quantos meses a matriz mostra. A janela sempre termina no mês de referência. Não afeta o bloco de comparativo por janelas. |
| **Contexto do período** | Campo de texto | Alimenta a IA com causas da operação. Opcional; sem contexto a IA descreve o padrão sem inventar causa. |

## Regras e detalhes importantes

- **Sempre filtrado por bar.** Nenhum número é somado entre bares. A análise textual é salva separadamente por bar e por mês.
- **Média por ocorrência, não soma.** A métrica divide o faturamento pelo número de vezes que aquele dia da semana aconteceu, para não penalizar/beneficiar meses com mais sábados.
- **Data do evento define o dia da semana.** O dia da semana é calculado a partir de `data_evento` (ao meio-dia UTC, para evitar erro de fuso). Não é o dia do pagamento nem a competência contábil.
- **Só faturamento positivo entra.** Eventos com `real_r` igual a zero ou nulo são ignorados.
- **Janelas de comparação:** ano anterior = mesmo mês do ano passado; mês anterior = mês imediatamente anterior; trimestre = média dos 3 meses anteriores ao mês de referência.
- **Limiar de ±3%** separa promotor de detrator; entre esses valores o dia é considerado estável.
- **A IA gera rascunho, não verdade final.** O texto é um ponto de partida editável; a orientação do sistema é citar deltas e dias concretos e **não inventar causas** quando não há contexto informado.
- **Estados vazios:** "Selecione um bar" (sem bar); "Sem dados para o mês" (comparativo sem eventos); "Sem eventos no período selecionado" (matriz vazia).
- **Salvamento silencioso.** Se o salvar falhar, o texto permanece na tela; só o carimbo "Salvo às HH:MM" confirma a gravação.

## Dúvidas frequentes

**O que significa "promotor" e "detrator"?**
Promotor é um dia da semana cujo faturamento médio **subiu** (≥ +3%) em relação à janela comparada; detrator é um dia que **caiu** (≤ −3%). É o mesmo conceito de "quem puxa a receita para cima ou para baixo".

**Por que o valor é uma média e não o total do mês?**
Para comparar meses de forma justa. Um mês com 5 sábados venderia mais no total só por ter mais sábados. A média por ocorrência isola o desempenho real de cada dia.

**Preciso escrever o contexto para gerar a IA?**
Não é obrigatório, mas ajuda muito. Sem contexto, a IA descreve o padrão dos números sem tentar explicar a causa. Com contexto (ex.: "sábado com festa até 4h"), ela conecta causa e efeito.

**A análise que eu editei fica salva?**
Sim, ao clicar em Salvar análise ela é gravada por bar e mês. Ao reabrir a tela no mesmo bar e mês, o texto volta preenchido.

**Por que alguns dias aparecem com "—" na comparação?**
Porque não havia faturamento registrado para aquele dia da semana na janela de comparação (ex.: um dia em que o bar não operou), então não há base para calcular a variação.

**A janela de 3/6/12 meses muda o comparativo YoY/MoM/Tri?**
Não. A janela afeta apenas quantas colunas a **matriz** mostra. O bloco de comparativo por janelas usa sempre o mês de referência contra ano anterior, mês anterior e trimestre.

## Fonte dos dados

- **`eventos_base`** — tabela base de eventos por bar; fornece `data_evento` e `real_r` (faturamento real do evento). É a origem de todos os números das duas tabelas. Alimentada pelo pipeline de eventos do Zykor (dados de faturamento consolidados a partir das integrações operacionais, como ContaHub/Yuzer, conforme o evento).
- **`meta.analise_receita`** — tabela onde a análise textual é persistida (colunas `bar_id`, `mes`, `contexto`, `problemas`, `oportunidades`, `reflexoes`, `atualizado_em`), com upsert por `bar_id + mes`.
- **Zykor AI** — camada de IA (`zykorAI.processQuery`) que gera o rascunho de Problemas/Oportunidades/Reflexões a partir do comparativo e do contexto.

Rotas internas que a tela consome: `/api/receitas/dia-semana-mensal` (matriz), `/api/receitas/analise-dia-semana` (comparativo por janelas), `/api/receitas/analise-narrativa` (geração IA) e `/api/receitas/analise-salvar` (ler/gravar a análise).
