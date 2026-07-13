---
title: DFC
area: relatorios-financeiros
slug: dfc
route: /financeiro/dfc
description: Demonstrativo de Fluxo de Caixa por regime de caixa (data de pagamento), com o dinheiro que entrou e saiu do bar mês a mês, dividido em fluxo operacional, de investimento e de financiamento.
order: 20
icon: TrendingUp
---

# DFC

## Visão geral

A tela **DFC (Demonstrativo de Fluxo de Caixa)** mostra, mês a mês, quanto dinheiro de fato **entrou e saiu** do bar ao longo do ano. Diferente da DRE (que trabalha por competência, ou seja, quando a receita/despesa "acontece"), o DFC é **por caixa**: ele conta o valor **na data em que o pagamento foi realizado/baixado**, não na data em que a conta foi gerada.

Os números são derivados do **Conta Azul**. A tela lê as **baixas** (movimentos financeiros efetivos) e as classifica em três grandes blocos do fluxo de caixa:

- **Fluxo Operacional** — o caixa do dia a dia do bar (vendas, fornecedores, salários, impostos operacionais, etc.).
- **Fluxo de Investimento** — compra/venda de bens, reformas, equipamentos.
- **Fluxo de Financiamento** — empréstimos, aportes de sócios, pagamento de dívidas.

A soma dos três resulta na **Variação de Caixa** do mês (quanto o caixa aumentou ou diminuiu). Lançamentos marcados como **Ajuste (fora do caixa)** são excluídos, porque não representam entrada/saída real de dinheiro.

É uma tela de leitura para dono, sócio e gestão financeira acompanharem a saúde de caixa e conferirem os números contra o próprio Conta Azul.

## Como acessar

No menu lateral: **Financeiro → Relatórios → DFC** (ícone de tendência).

- **Permissão necessária:** módulo `financeiro_relatorios`. Sem esse módulo, tanto a página quanto a API (`/api/financeiro/dfc`) são bloqueadas pelo guard de permissão.
- A tela sempre respeita o **bar selecionado** no seletor de bar do topo. Todos os números são filtrados por `bar_id`.

## Passo a passo

### Ver o fluxo de caixa do ano

1. Selecione o bar desejado no seletor do topo.
2. Escolha o **ano** no seletor à direita (opções: 2025, 2026, 2027).
3. A tabela abre na aba **Fluxo de Caixa**, já com os três grupos recolhidos.
4. Clique em um grupo (ex.: **Fluxo Operacional**) para **expandir** e ver as macro-categorias.
5. Clique em uma macro-categoria para expandir e ver as **categorias** individuais.
6. Leia os valores mês a mês. Verde = entrada líquida de caixa (positivo); vermelho = saída líquida (negativo); traço (`–`) = sem movimento.

### Alternar entre "só conciliado" e "baixado no CA"

1. No canto superior direito, use o checkbox **"Só conciliado"**.
2. **Marcado (padrão):** conta apenas o que foi **conciliado no extrato do banco** — reflete o dinheiro que realmente bateu na conta bancária.
3. **Desmarcado:** conta tudo que foi **baixado no Conta Azul**, mesmo sem conciliação bancária (inclui, por exemplo, dinheiro e ajustes ainda não conciliados).

### Exportar para conferência

1. Clique em **⬇ Exportar CSV** no canto superior direito.
2. O sistema baixa um arquivo `dfc_<bar>_<ano>.csv` com o valor líquido de cada **categoria × mês**, mais total do ano por categoria e uma linha de total geral.
3. O arquivo já vem no formato Excel pt-BR (separador `;` e BOM para acentos), pronto para abrir lado a lado com o export do Conta Azul.

### Classificar uma categoria nova (aba Categorias)

1. Abra a aba **Categorias**.
2. A tabela lista **todas** as categorias do Conta Azul com movimento no ano. As **não classificadas** aparecem com um alerta amarelo (e um contador no título da aba).
3. Opcional: marque **"Só não classificadas"** para focar apenas nas pendentes.
4. Na coluna **Classificar no DFC**, escolha no dropdown o grupo: **Operacional**, **Investimento**, **Financiamento** ou **Ajuste (fora do caixa)**.
5. A regra é salva **como exceção deste bar** e entra no fluxo de caixa na hora, sem precisar de desenvolvedor. A aba Fluxo de Caixa é recarregada automaticamente.

## Abas e seções

### Aba "Fluxo de Caixa"

A demonstração propriamente dita, em três níveis hierárquicos expansíveis:

- **Nível 1 — Grupo:** Fluxo Operacional, Fluxo de Investimento, Fluxo de Financiamento.
- **Nível 2 — Macro-categoria:** o mesmo agrupamento usado na DRE (ex.: uma família de despesas). Categorias sem macro definida caem em **"Outros"**.
- **Nível 3 — Categoria:** a categoria original do Conta Azul.

No rodapé, a linha **Variação de Caixa** soma os três grupos por mês.

### Aba "Categorias"

Ferramenta self-service para **classificar categorias no DFC**. Mostra todas as categorias do Conta Azul com movimento no ano, o grupo em que cada uma está hoje (ou o alerta de não classificada), e sinaliza se a categoria também falta no de-para da **DRE** e da **Orçamentação**. Serve para o gestor manter o de-para completo sem depender de dev.

## Colunas e cálculos

### Aba Fluxo de Caixa

Cada célula da grade cruza uma linha (Grupo / Macro-categoria / Categoria) com um dos **12 meses** do ano. O valor exibido é sempre o **net** (líquido do caixa) daquele recorte no mês.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Grupo (Fluxo Operacional / Investimento / Financiamento)** | Total líquido de caixa do grupo por mês | Soma dos `net` de todas as categorias do grupo naquele mês | `gold.mv_dfc_ano` (campo `grupo_dfc`) |
| **Macro-categoria** | Total líquido da macro-categoria (igual DRE) por mês | Soma dos `net` das categorias da macro naquele mês | `gold.mv_dfc_ano` (`categoria_macro`, `ordem_macro`) |
| **Categoria** | Valor líquido da categoria do Conta Azul por mês | `net` do mês para aquela categoria | `gold.mv_dfc_ano` (`categoria`) |
| **Entradas** (base de cálculo) | Dinheiro que entrou | `SUM(valor_liquido)` das baixas com `tipo_evento = 'RECEITA'` | `bronze.bronze_contaazul_baixas` |
| **Saídas** (base de cálculo) | Dinheiro que saiu | `SUM(valor_liquido)` das baixas com `tipo_evento = 'DESPESA'` | `bronze.bronze_contaazul_baixas` |
| **Net (valor exibido)** | Efeito líquido no caixa | `SUM( (RECEITA:+1 / DESPESA:-1) × valor_liquido )` — na prática, entradas menos saídas | `bronze.bronze_contaazul_baixas` |
| **Mês** | Competência de caixa da linha | `date_trunc('month', data_pagamento)` — o mês é definido pela **data de pagamento/baixa** | `bronze.bronze_contaazul_baixas.data_pagamento` |
| **Variação de Caixa** (rodapé) | Aumento/redução total do caixa no mês | Soma dos `net` dos três grupos (Operacional + Investimento + Financiamento) no mês | Cálculo no cliente sobre `gold.mv_dfc_ano` |

Regras de montagem: o mês vem da data de pagamento da baixa; a categoria é o nome da categoria no Conta Azul (vazio vira `(sem categoria)`); a macro-categoria e a ordem de exibição vêm do de-para da DRE (`financial.dre_categoria_macro`). Lançamentos do grupo **AJUSTE são excluídos** do fluxo.

### Aba Categorias

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Categoria** | Nome da categoria no Conta Azul | Direto do lançamento (agrupado por `categoria_nome`) | `bronze.bronze_contaazul_lancamentos` |
| **Lançamentos** | Quantos lançamentos a categoria teve no ano | `COUNT(*)` dos lançamentos do ano | `bronze.bronze_contaazul_lancamentos` |
| **Total** | Valor movimentado no ano pela categoria | `SUM(coalesce(nullif(valor_bruto,0), valor_pago))` — usa o valor bruto; se zero, cai no valor pago | `bronze.bronze_contaazul_lancamentos` |
| **Período** | Primeiro → último mês/dia com movimento | `MIN(data_competencia)` → `MAX(data_competencia)` (por **competência**) | `bronze.bronze_contaazul_lancamentos` |
| **DRE / Orç** | Se a categoria já está mapeada na DRE e na Orçamentação | `DRE` verde se existe em `financial.dre_categoria_macro`; `Orç` verde se existe em `meta.categoria_zykor_map` (com override por bar) | de-paras DRE e Zykor |
| **Classificar no DFC** | Grupo atual da categoria (ou "classificar") | Resolvido em `meta.categoria_dfc_map` com override por bar; `null` = não classificada (alerta amarelo) | `meta.categoria_dfc_map` |

> Atenção a uma diferença importante entre as duas abas: a aba **Fluxo de Caixa** conta por **data de pagamento** e usa o **valor líquido das baixas**; a aba **Categorias** conta por **data de competência** e usa o **valor bruto do lançamento**. Por isso os totais das duas abas não batem 1:1 — cada uma responde a uma pergunta diferente (caixa realizado × movimento contábil da categoria).

### Exportação CSV

O CSV é um pivô **Grupo / Categoria × 12 meses**, usando o `net` de cada categoria por mês, com coluna **Total (ano)** por categoria e uma linha final **TOTAL** somando tudo por mês.

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| **Seletor de bar** (topo global) | Define o `bar_id` de todos os números. Cada bar tem seu próprio DFC e seu próprio de-para de categorias. |
| **Ano** | Filtra o ano do fluxo (2025, 2026, 2027). No fluxo, o ano é pela data de pagamento; na aba Categorias, pela data de competência. |
| **Só conciliado** (checkbox) | Marcado (padrão): só baixas conciliadas no extrato do banco (`conciliada = true`). Desmarcado: tudo que foi baixado no Conta Azul, conciliado ou não. |
| **Exportar CSV** | Baixa o fluxo (categoria × mês) em CSV para conferência com o Conta Azul. |
| **Só não classificadas** (aba Categorias) | Mostra apenas categorias ainda sem grupo do DFC atribuído. |
| **Expandir/recolher** (clique nas linhas) | Abre/fecha os níveis Grupo → Macro-categoria → Categoria. |

## Regras e detalhes importantes

- **Regime de caixa, não de competência.** O DFC posiciona cada valor no mês da **data de pagamento/baixa**. Isso é o que o diferencia da DRE.
- **Conciliação é por baixa, não por parcela.** O Conta Azul concilia pela **baixa** (`id_reconciliacao`), então o filtro "Só conciliado" usa o flag de conciliação da baixa (`bronze.bronze_contaazul_baixas.conciliada`), refletindo fielmente o "Conciliado" do extrato do CA.
- **Sempre filtrado por `bar_id`.** Nenhum número mistura bares.
- **Grupo AJUSTE é excluído** do fluxo, por não representar entrada/saída real de caixa. Classificar uma categoria como "Ajuste (fora do caixa)" a remove do demonstrativo.
- **Categoria sem classificação não aparece no fluxo.** Enquanto uma categoria não tiver um grupo no de-para do DFC, o dinheiro dela fica **de fora** do fluxo de caixa — daí a importância da aba Categorias.
- **De-para com override por bar.** As classificações têm um padrão global (`bar_id` nulo) e podem ser sobrescritas por bar. A classificação feita na tela é salva como **exceção daquele bar** e vale na hora, sem deploy.
- **Casamento de nomes tolerante a acento/maiúsculas.** O de-para casa a categoria por nome normalizado (sem acento, sem diferença de caixa), evitando furos por grafia.
- **Origem materializada e cacheada.** A aba Fluxo de Caixa lê a materialização `gold.mv_dfc_ano` (atualizada de hora em hora, espelho da função `public.get_dfc_por_ano`), o que deixa a tela quase instantânea. Como há cache, um lançamento recém-baixado pode levar até ~1 hora para aparecer no fluxo.
- **Valores em BRL**, arredondados a 2 casas. Célula sem movimento mostra `–`.

## Dúvidas frequentes

**Por que o DFC não bate com a DRE?**
Porque medem coisas diferentes: o DFC é por **caixa** (data de pagamento, valor líquido efetivamente movimentado) e a DRE é por **competência**. Uma venda faturada em um mês e recebida no outro cai em meses diferentes em cada relatório.

**O que significa "Só conciliado"?**
Conta apenas as baixas que já foram **conciliadas no extrato do banco**. Desmarcando, você inclui o que foi baixado no Conta Azul mas ainda não conciliado (por exemplo, dinheiro em espécie e ajustes).

**Uma categoria minha não aparece no fluxo. Por quê?**
Provavelmente ela ainda **não está classificada** em um grupo do DFC. Vá na aba **Categorias**, encontre-a (use "Só não classificadas") e escolha o grupo no dropdown. Ela entra no fluxo na hora.

**Marquei uma categoria como "Ajuste". Onde ela foi parar?**
Ajustes são propositalmente **excluídos** do fluxo de caixa, por não serem entrada/saída real de dinheiro. Se foi um engano, reclassifique-a para Operacional/Investimento/Financiamento.

**Acabei de dar baixa em um pagamento e não vejo no DFC. É bug?**
Não necessariamente. O fluxo lê uma versão materializada atualizada de hora em hora, e a sincronização das baixas do Conta Azul também roda em ciclos. Aguarde a próxima atualização.

**Para que serve o Exportar CSV?**
Para conferir os números do Zykor lado a lado com o export do próprio Conta Azul, categoria por categoria e mês a mês.

## Fonte dos dados

- **Integração de origem:** Conta Azul (lançamentos e baixas/movimentos financeiros).
- **Aba Fluxo de Caixa (leitura):** `gold.mv_dfc_ano` — materialização por ano e por modo (só conciliado × todos), atualizada de hora em hora, espelho da função `public.get_dfc_por_ano(bar_id, ano, so_conciliado)`.
- **Base de cálculo do fluxo:** `bronze.bronze_contaazul_baixas` (valor líquido, data de pagamento, flag de conciliação) cruzada com `bronze.bronze_contaazul_lancamentos` (categoria).
- **De-para de grupo do DFC:** `meta.categoria_dfc_map` (com override por bar; grava via `meta.set_categoria_dfc`).
- **Macro-categoria e ordem (igual DRE):** `financial.dre_categoria_macro`.
- **Aba Categorias:** `financial.get_dfc_categorias(bar_id, ano)`, com as flags de presença nos de-paras da DRE (`financial.dre_categoria_macro`) e da Orçamentação (`meta.categoria_zykor_map`).
- **Exportação CSV:** rota `/api/financeiro/dfc/export`, mesma fonte `gold.mv_dfc_ano`.
