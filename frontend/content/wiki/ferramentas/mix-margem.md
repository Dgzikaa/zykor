---
title: Mix & Margem
area: ferramentas
slug: mix-margem
route: /ferramentas/mix-categoria
description: Mostra a composição das vendas por categoria (bebida, drink, comida) e a evolução mensal do CMV sobre o faturamento.
order: 70
icon: PieChart
---

# Mix & Margem

## Visão geral

A tela **Mix & Margem** dá uma leitura rápida de **como o faturamento do bar se divide entre as categorias de produto** (bebida, drink e comida) e de **quanto o custo de mercadoria (CMV) pesa sobre o faturamento** mês a mês.

Ela junta duas visões complementares em um único painel:

- **Mix de vendas (30 dias):** quanto cada categoria representa do faturamento recente, com uma barra visual de composição.
- **CMV mensal:** a evolução do custo de insumos sobre o faturamento nos últimos 6 meses, com destaque quando o CMV fica alto.

É uma ferramenta de **diagnóstico e acompanhamento**, usada por gestores e donos para responder perguntas do tipo "estou vendendo mais bebida ou comida?", "minha margem está saudável?" e "o CMV do mês estourou?". Não há edição nem lançamento aqui — a tela é somente de consulta.

## Como acessar

No menu lateral, dentro da área **Ferramentas**, clique em **Mix & Margem** (ícone de gráfico de pizza).

- **Rota:** `/ferramentas/mix-categoria`
- **Permissão necessária:** módulo **`gestao`**. Sem essa permissão o item não aparece no menu e a rota fica bloqueada.

Os dados são sempre do **bar selecionado** no seletor de bar. Ao trocar de bar, o painel recarrega automaticamente.

## Passo a passo

### Ler o mix de vendas

1. Abra **Ferramentas → Mix & Margem**.
2. Confira o bar selecionado no topo (o painel usa sempre o bar ativo).
3. No card **Mix de vendas (30 dias)**, olhe primeiro a **barra colorida de composição** — cada faixa é uma categoria, e a largura é a fatia do faturamento.
4. Na tabela abaixo, veja **Faturamento**, **% Mix** e **Margem** por categoria. As linhas vêm ordenadas da categoria que mais fatura para a que menos fatura.

### Acompanhar o CMV mensal

1. No card **CMV mensal (custo de mercadoria)**, cada linha é um mês (últimos 6 meses).
2. Observe a coluna **CMV %** — ela fica **destacada em vermelho quando atinge ou passa de 35%**, sinal de custo alto.
3. Compare os meses para entender a tendência do custo de insumos sobre o faturamento.

> A tela não tem filtro de período na interface. O mix é sempre dos últimos **30 dias** e o CMV sempre dos últimos **6 meses**.

## Abas e seções

A tela não tem abas. É um painel único com **dois cards lado a lado**:

- **Mix de vendas (30 dias):** barra de composição + tabela por categoria.
- **CMV mensal (custo de mercadoria):** tabela mês a mês.

## Colunas e cálculos

### Card "Mix de vendas (30 dias)"

Os dados vêm da view `gold.mix_produtos_diario` (grão diário por categoria), agregados no período de 30 dias pela API.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Barra de composição | Faixa colorida por categoria, largura proporcional à fatia do faturamento | Para cada categoria: `faturamento da categoria ÷ faturamento total do mix × 100`. Cores fixas: bebida (âmbar), drink (violeta), comida (verde), sem categoria (cinza) | Cálculo no cliente sobre `mix_produtos_diario` |
| Categoria | Nome da categoria de produto: BEBIDA, DRINK, COMIDA ou SEM_CATEGORIA | Classificação do produto pelo **local de venda** (mapeamento em `bar_local_mapeamento`); sem local reconhecido cai em SEM_CATEGORIA | `silver.vendas_item.categoria_mix` |
| Faturamento | Valor vendido da categoria no período | Soma de `valor` de todos os itens da categoria nos últimos 30 dias | `sum(valor)` em `silver.vendas_item` |
| % Mix | Fatia da categoria no faturamento total | `faturamento da categoria ÷ soma do faturamento de todas as categorias × 100` | Cálculo no cliente |
| Margem* | Margem bruta percentual da categoria | `(faturamento − custo) ÷ faturamento × 100` | API sobre `custo` de `silver.vendas_item` |

Outros campos são calculados/agregados pela API mas **não aparecem na tabela**: `quantidade` (soma das unidades vendidas) e `skus` (número de produtos distintos — a API guarda o maior valor diário observado).

> **Atenção à margem:** o custo de produto só vem preenchido na origem para **BEBIDA**. Para DRINK e COMIDA o custo tende a ficar zerado, então a **margem dessas categorias aparece otimista** (perto de 100%). A própria tela avisa isso com um rodapé. Use a margem como referência apenas para bebida.

### Card "CMV mensal (custo de mercadoria)"

Os dados vêm da view `gold.cma_alimentacao_mensal` (grão mensal), últimos 6 meses, apenas meses com faturamento líquido positivo.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Mês | Mês de competência (formato mês/ano abreviado) | `date_trunc('month', data_competencia)` | `silver.lancamento_classificado` |
| CMV total | Custo de insumos (mercadoria) do mês, em reais | Soma de `valor_bruto` dos lançamentos do bloco **"Custo insumos (CMV)"**, ignorando lançamentos marcados como ignorados | `silver.lancamento_classificado` |
| CMV % | Peso do CMV sobre o faturamento | `CMV total ÷ faturamento líquido do mês × 100`. Fica **vermelho quando ≥ 35%** | `cmv_total` / `faturamento_liquido` |
| Comida % | Fatia de alimentação dentro do CMV | `custo de comida ÷ faturamento líquido do mês × 100`, onde custo de comida = lançamentos de CMV cuja categoria Zykor contém "comida" ou "aliment" | `cma_pct` da view |

Campos calculados na view mas **não exibidos** diretamente: `cma_alimentacao` (custo de comida em reais) e `faturamento_liquido` (usado como base dos percentuais e como filtro).

## Filtros e opções

A tela **não tem filtros na interface**. O comportamento é fixo:

| Item | Efeito |
|---|---|
| Bar selecionado | Único "filtro" ativo. Todos os números são do bar escolhido no seletor global; trocar o bar recarrega o painel |
| Janela do mix | Fixa em **30 dias** (a API aceita `dias` entre 7 e 180, mas a tela sempre chama com 30) |
| Janela do CMV | Fixa nos **últimos 6 meses**, apenas meses com faturamento líquido > 0 |

## Regras e detalhes importantes

- **Filtragem por bar:** toda a consulta é filtrada por `bar_id`, obtido do usuário autenticado — nunca de um bar assumido.
- **Competência (não vencimento):** o CMV mensal usa a **data de competência** do lançamento de custo de insumo, não a data de pagamento. Custo de insumo é lançado de forma "lumpy" (concentrado em algumas datas), então meses individuais podem oscilar.
- **Data de venda do mix:** o mix usa `dt_gerencial` (data gerencial da venda) para montar a janela de 30 dias.
- **Classificação da categoria:** cada produto é classificado como bebida, drink ou comida pelo **local em que foi vendido** (cozinha → comida, chopp/bar/pegue-e-pague → bebida, drinks/montados/batidos → drink, etc.), configurável por bar em `bar_local_mapeamento`. Sem local reconhecido, cai em **SEM_CATEGORIA**.
- **Custo incompleto:** custo só é confiável para **BEBIDA**. Margem de DRINK/COMIDA é otimista por falta de custo na origem.
- **Deboche (bar_id=4):** não separa custo de comida no CMV (só bebidas/drinks/outros), então a coluna **Comida %** aparece zerada — isso é fiel ao dado, não é perda de informação.
- **"Comida %" ≠ CMA de refeição de equipe:** a fatia de comida do CMV é o custo de insumo de alimentação **vendida**, não o custo da alimentação da equipe.
- **Arredondamentos:** faturamento, quantidade e custo do mix são arredondados a 2 casas; percentuais de margem a 1 casa. Na moeda, a tela exibe **sem centavos** (arredonda para o real).
- **Alerta visual de CMV:** a coluna CMV % fica vermelha a partir de 35% — é um limiar visual de atenção, não um valor de política oficial.
- **Estados vazios:** se não houver vendas no período, o card do mix mostra "Sem vendas no período."; sem dados de CMV, mostra "Sem dados de CMV no período."
- **Somente leitura:** não há edição, exportação nem lançamento nesta tela. Tudo é automático, alimentado pelo pipeline de dados.

## Dúvidas frequentes

**Por que a margem de comida e drink parece altíssima?**
Porque o custo desses produtos não vem preenchido na origem — só bebida tem custo confiável. A margem de drink/comida é otimista; ignore-a e use a de bebida.

**Posso mudar o período de 30 dias ou de 6 meses?**
Na tela, não. A janela é fixa. O período do mix é sempre 30 dias e o do CMV sempre 6 meses.

**Por que o Deboche mostra "Comida %" zerada?**
Porque o Deboche não separa custo de comida dentro do CMV. O zero é fiel ao cadastro, não um erro.

**O CMV % em vermelho significa que estourei a meta?**
O vermelho aparece a partir de 35% como sinal de atenção visual. Trate como alerta para investigar, não como veredito oficial de meta.

**Por que a soma do faturamento do mix não bate com o faturamento total do bar?**
O mix considera itens vendidos classificados por categoria (base `silver.vendas_item`); o faturamento oficial pode incluir ajustes, taxas e outras fontes que não entram nesta composição.

**"Comida %" é o custo da refeição da equipe?**
Não. É a fatia de alimentação **vendida** dentro do CMV. Custo de refeição de equipe (CMA de pessoal) é outra métrica.

## Fonte dos dados

- **`gold.mix_produtos_diario`** — view do mix de vendas por dia e categoria (faturamento, quantidade, custo, margem, nº de SKUs). Base: `silver.vendas_item`.
- **`silver.vendas_item`** — itens de venda com `categoria_mix`, `valor`, `custo`, `quantidade`, `produto_codigo`. Alimentada pelo processamento de vendas (ContaHub e Yuzer).
- **`bar_local_mapeamento`** — mapa por bar de local de venda → categoria (bebida/drink/comida), usado por `map_categoria_mix`.
- **`gold.cma_alimentacao_mensal`** — view mensal de CMV total, custo de comida e percentuais sobre faturamento.
- **`silver.lancamento_classificado`** — lançamentos financeiros classificados; usa o bloco DRE "Custo insumos (CMV)" (origem Conta Azul / NIBO).
- **`silver.vendas_diarias`** — faturamento líquido diário, agregado por mês como base dos percentuais.

Integrações de origem: **ContaHub** e **Yuzer** (vendas), **Conta Azul / NIBO** (lançamentos de custo de insumos).
