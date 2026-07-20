---
title: DRE
area: relatorios-financeiros
slug: dre
route: /financeiro/dre
description: Demonstrativo de Resultados do ano, mês a mês, montado a partir dos lançamentos do Conta Azul por competência, com margens, lucro operacional e lucro líquido.
order: 10
icon: FileText
---

# DRE

## Visão geral

A DRE (Demonstrativo de Resultados do Exercício) é o relatório que mostra, **mês a mês ao longo do ano**, quanto o bar faturou e quanto gastou em cada grupo de despesa, chegando até o **Lucro Líquido**. A estrutura espelha a planilha "[Ordinário] DRE e DFC" usada pela gestão.

Cada número vem dos lançamentos do **Conta Azul** (receitas e despesas), agrupados por **competência** (o mês a que o gasto/receita se refere, não a data em que foi pago) e classificados nas categorias da DRE. A tela é usada por donos, sócios e financeiro para acompanhar rentabilidade, comparar meses e entender onde o dinheiro está indo.

A DRE tem duas visões empilhadas: a do **ano corrente** (sempre visível) e a de **comparativo** com o ano anterior (que pode ser mostrada ou ocultada). Cada célula de uma subcategoria é clicável e abre a lista dos lançamentos que formaram aquele valor.

## Como acessar

No menu lateral: **Relatórios Financeiros → DRE** (rota `/financeiro/dre`).

Requer a permissão de módulo **`financeiro_relatorios`** (a mesma que libera DFC, Balanço Patrimonial e Business Plan). Quem não tem essa permissão não vê o item no menu nem acessa a página.

É obrigatório ter um **bar selecionado** no seletor do topo. Sem bar selecionado, a tela mostra apenas o aviso "Selecione um Bar".

## Passo a passo

**1. Escolher o ano**
No canto superior esquerdo há um seletor de ano (de 2023 até o ano atual). Ao trocar o ano, a tabela inteira é recarregada com os dados daquele ano.

**2. Expandir / recolher categorias**
A DRE abre com todas as macrocategorias **recolhidas** (mostra só a linha TOTAL de cada grupo). Para ver o detalhe:
- Clique na linha de uma macrocategoria (ex.: "Custo insumos (CMV)") para abri-la e ver as subcategorias.
- Use o botão **"Expandir tudo" / "Recolher tudo"** no topo para abrir ou fechar todas de uma vez.
- Dentro de Mão-de-Obra há um nível a mais (subgrupos "CMO Fixo" e "CMO Freelas") que também abre e fecha.

**3. Destacar uma linha**
Clique em qualquer linha para pintá-la de amarelo. Isso ajuda a seguir a mesma categoria pelas 12 colunas de mês sem se perder. Clicar de novo tira o destaque.

**4. Ver os lançamentos por trás de um valor (drill-down)**
Nas **subcategorias** (linhas folha), clique diretamente na célula de um mês que tenha valor. Abre um popup listando cada lançamento do Conta Azul daquele mês/categoria: data, descrição, fornecedor, categoria do CA e valor, com o total no rodapé.

**5. Comparar com o ano anterior**
Abaixo da tabela principal, clique em **"Mostrar comparativo"**. Aparece uma segunda DRE completa, idêntica em estrutura, referente ao ano anterior. Clique em "Ocultar comparativo" para escondê-la.

**6. Atualizar os dados**
- **"Atualizar"** (botão com ícone de reciclar): sincroniza as **alterações recentes** do Conta Azul de forma incremental (rápido, ~5-15s). É o uso do dia a dia — pega, por exemplo, um imposto que teve o valor ajustado.
- **"sincronizar ano completo"** (link discreto): re-puxa o **ano inteiro** mês a mês (~1-2 min). Só é necessário quando alguém mudou **apenas a categoria** de um lançamento no Conta Azul (recategorizar não marca o lançamento como alterado, então a sincronização rápida não pega).

## Abas da tela

A tela tem quatro abas no topo:

- **DRE** — a DRE completa do bar (descrita nesta página). Faturamento menos todos os custos até o Lucro Líquido.
- **DRE Bar** — espelho que **isola a operação de bar** da economia do show. Deduz a entrada de eventos (couvert + ingresso Yuzer + Sympla) da Receita e **remove** o grupo Atrações & Eventos. Serve para enxergar o resultado do bar "puro", sem os shows.
- **DRE Eventos** — o **complemento exato da DRE Bar**: mostra só a economia do show (ver seção abaixo). DRE Bar + DRE Eventos reconstroem a DRE cheia.
- **Categorias** — a Central de Categorias, onde se configura o de-para (qual categoria do Conta Azul cai em qual macro/subgrupo da DRE).

## DRE Eventos

Aba que mostra **só a operação de eventos/shows**, mês a mês, no mesmo formato da DRE (12 meses + coluna do ano). É o inverso da DRE Bar — pega justamente o que a DRE Bar tira.

Estrutura:

- **Receita** — a arrecadação de entrada, aberta em três linhas: **Couvert** (ContaHub), **Ingresso (Yuzer)** e **Sympla**.
- **Custo Variável** — **Imposto (2% da entrada)** e **Taxa maquininha** (proporcional à queda de receita do mês). É a **mesma conta** que a DRE Bar compensa, aqui aparecendo como custo real, o que garante que as duas abas fechem juntas.
- **Despesas Artístico** — as quatro categorias que a DRE Bar remove: **Atrações Programação**, **[Consumação] Artistas**, **Produção Eventos** e **Produção Mensal Fixo**. Cada valor é **clicável** (drill-down) e abre os lançamentos do Conta Azul, igual à DRE.
- **= Resultado de Eventos** — linha final: Receita − Custo Variável − Despesas Artístico. Mostra se os shows, isoladamente, deram lucro ou prejuízo no mês.

Detalhe importante: o Custo Variável do couvert é **aproximado** de propósito — o couvert (ContaHub) não separa cartão de dinheiro, então a taxa de maquininha entra proporcional em vez de exata. É a mesma aproximação da DRE Bar; por isso as duas abas continuam batendo entre si.

## Blocos da DRE (aba principal)

A DRE principal organiza a tabela em **blocos verticais** com resultados parciais destacados:

- **Receita** — faturamento do período.
- **Custos Variáveis** e **Custo insumos (CMV)** — deduções diretas.
- **Margem de Contribuição** (linha de subtotal em destaque) = Receita − Custos Variáveis − CMV.
- **Mão-de-Obra** (com subgrupos CMO Fixo / CMO Freelas), **Despesas Comerciais**, **Despesas Administrativas**, **Despesas Operacionais** e **Despesas de Ocupação (Contas)**.
- **Lucro Operacional** (subtotal em destaque) = Margem de Contribuição menos todas as despesas operacionais acima.
- **Não Operacionais** — receitas/despesas fora da operação.
- **Lucro Líquido** (linha final, destaque verde/vermelho e negrito) = Lucro Operacional + Não Operacionais.
- **Investimentos** — bloco separado, **fora** do cálculo do resultado (não entra no lucro).
- **Dividendos** — linha única, também fora do resultado.

## Colunas e cálculos

A tabela tem uma coluna de **Categoria**, depois **12 pares de colunas (uma por mês)** — cada par é `Valor R$` + `% da receita` — e por fim o par **YTD** (acumulado do ano).

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Categoria | Nome da macrocategoria, subgrupo ou subcategoria, indentado por nível | Estrutura vem do de-para `dre_categoria_macro` (macro, ordem_sub, subcategoria canônica) | `financial.dre_categoria_macro` |
| Valor do mês (R$) | Total daquela linha no mês | Soma dos lançamentos com sinal: receita entra positiva, despesa negativa. Valor por lançamento = `valor_bruto` (se > 0) ou, na falta dele, `valor_pago`. Agrupado por mês de **competência** | `bronze.bronze_contaazul_lancamentos` via `get_dre_por_ano` → `gold.mv_dre_ano` |
| % da receita (por mês) | Peso da linha sobre a receita do mesmo mês | `valor da linha ÷ receita total do mês × 100`, arredondado a 1 casa. Fica em branco quando a receita do mês é zero ou o valor é zero | Calculado no SQL / frontend |
| YTD (R$) | Acumulado do ano até o momento | Soma **apenas dos meses já fechados**. Um mês fecha no **dia 15 do mês seguinte** (ex.: junho fecha em 15/julho). Meses ainda abertos não entram | Calculado no frontend (`DreTab`) |
| YTD (%) | Peso acumulado sobre a receita acumulada | `YTD da linha ÷ YTD da receita × 100`. Em branco para blocos sem base de receita (Investimentos/Dividendos) | Calculado no frontend |
| TOTAL da macro | Linha-resumo de cada grupo (ex.: total de Mão-de-Obra) | Soma de todas as subcategorias do grupo, por mês | `get_dre_por_ano` |
| CMO Fixo / CMO Freelas | Subtotais dentro de Mão-de-Obra | Subgrupos montados no frontend: "CMO Fixo" agrupa SALÁRIO FUNCIONÁRIOS, PROVISÃO TRABALHISTA, VALE TRANSPORTE, ADICIONAIS e ALIMENTAÇÃO; "CMO Freelas" agrupa as categorias que começam com "FREELA". O que não cair em nenhum (ex.: PRO LABORE) vira linha solta | `DreTab.tsx` |
| Margem de Contribuição | Sobra depois dos custos diretos | Receita − Custos Variáveis − Custo insumos (CMV), por mês | `DreTab.tsx` (soma de macros) |
| Lucro Operacional | Resultado da operação | Margem de Contribuição − Mão-de-Obra − Comercial − Administrativas − Operacionais − Ocupação | `DreTab.tsx` |
| Lucro Líquido | Resultado final do período | Lucro Operacional + Não Operacionais | `DreTab.tsx` |
| Investimentos | Aportes/investimentos do período | Soma da macro Investimentos, mês a mês. Não entra no Lucro Líquido; exibido sem coluna de % | `get_dre_por_ano` |
| Dividendos | Distribuição de dividendos | Linha única da macro Dividendos, mês a mês. Fora do resultado, sem % | `get_dre_por_ano` |

**Colunas do popup de lançamentos (drill-down):**

| Coluna | O que mostra | Fonte |
|---|---|---|
| Data | Data de competência do lançamento (formato dd/mm) | `data_competencia` |
| Descrição | Descrição do lançamento no Conta Azul | `descricao` |
| Fornecedor | Pessoa/fornecedor vinculado | `pessoa_nome` |
| Categoria (CA) | Categoria original do Conta Azul | `categoria_nome` |
| Valor | Valor do lançamento (`valor_bruto` ou, na falta, `valor_pago`) | `bronze_contaazul_lancamentos` |
| Total (rodapé) | Soma dos lançamentos listados | Somatório no servidor |

## Filtros e opções

| Filtro / Opção | Efeito |
|---|---|
| **Bar** (seletor do topo) | Toda a DRE é filtrada por `bar_id`. Cada bar tem sua própria DRE e seu próprio de-para de categorias |
| **Ano** | Troca o ano exibido (2023 até o ano atual). Anos passados têm todos os meses fechados |
| **Expandir / Recolher** | Mostra ou esconde as subcategorias de cada grupo (não altera os números) |
| **Mostrar / Ocultar comparativo** | Exibe uma segunda DRE do ano anterior abaixo da principal |
| **Atualizar** | Puxa alterações recentes do Conta Azul (incremental) e recarrega a tabela |
| **sincronizar ano completo** | Re-puxa o ano inteiro do Conta Azul (usar quando recategorizaram lançamentos) |

## Regras e detalhes importantes

- **Sempre por `bar_id`**: a DRE nunca mistura bares. O de-para de categorias pode inclusive ser diferente por bar.
- **Regime de competência, valor bruto**: a DRE trabalha por competência e usa o **valor bruto** do lançamento (`valor_bruto`; cai para `valor_pago` só se o bruto for zero). Essa decisão evita subreportar quando uma parcela está paga parcialmente — a DRE mostra o total devido no mês, não o pago. Isso a diferencia da DFC, que trabalha por baixa/pagamento.
- **Sinais**: lançamentos do tipo RECEITA entram positivos; todo o resto entra negativo. As despesas aparecem com sinal negativo (em vermelho).
- **YTD só de meses fechados**: o acumulado do ano soma apenas meses encerrados (fecham no dia 15 do mês seguinte), então o mês corrente/aberto não infla o YTD. Isso atualiza sozinho conforme o calendário.
- **Categorização própria da DRE**: a classificação usa o de-para `financial.dre_categoria_macro`, que **não é** o mesmo da Orçamentação. O drill-down também respeita essa categorização.
- **Fonte materializada**: a tabela lê `gold.mv_dre_ano` (uma cópia materializada da função `get_dre_por_ano`) por performance — mesmos números, sem risco de timeout. Um cron dá refresh a cada hora (às XX:07), mas **cada vez que você aperta "Atualizar" ou "sincronizar ano completo" o refresh também é acionado no final do sync**, então a alteração aparece na hora, não só na próxima virada.
- **Exclusões**: lançamentos marcados como excluídos no Conta Azul (`excluido_em`) são ignorados. Categorias marcadas como **IGNORAR** no de-para (ex.: "Despesas Grupo Bizu") não entram na DRE de nenhum bar. Movimentações financeiras que o Conta Azul taggeia como "Outras Receitas" mas que são transferências, aplicações, resgates, PIX intercompany, depósitos do próprio caixa etc. são **filtradas por padrão de descrição** (tabela `dre_receita_ignorar_pattern`), para não inflar a receita.
- **Esqueleto de categorias**: mesmo categorias sem nenhum lançamento no ano aparecem zeradas, para manter a estrutura da DRE sempre completa e comparável.
- **Estados vazios**: célula com valor zero mostra "—". Célula sem base de receita não mostra %. O popup mostra "Nenhum lançamento neste período" quando não há dados.

## Dúvidas frequentes

**Por que o valor da DRE difere do que vejo no Conta Azul?**
A DRE usa o valor **bruto por competência** (total devido no mês), enquanto o Conta Azul às vezes mostra o valor liquidado (pago). Além disso, transferências e movimentações internas taggeadas como receita são propositalmente excluídas.

**Mudei um valor no Conta Azul e a DRE não atualizou. O que faço?**
Clique em **"Atualizar"**. Se você mudou apenas a **categoria** de um lançamento (não o valor), use **"sincronizar ano completo"**, porque recategorizar não é detectado pela sincronização rápida — o toast do modo rápido, aliás, avisa isso quando a contagem volta zerada. Nos dois casos o refresh da tabela materializada já é acionado no fim do sync, então o efeito aparece na hora.

**Vejo o valor certo no drill-down (lista de lançamentos) mas o total da coluna do mês está diferente. Como pode?**
Era o sintoma clássico da MV desatualizada — o drill-down lê ao vivo e o agregado lia do cache horário. Isso foi resolvido em 16/07/2026: agora todo sync força o refresh da MV. Se ainda acontecer, é bug: reportar.

**O que é o YTD?**
É o acumulado do ano (Year To Date), somando só os meses já fechados. Cada mês fecha no dia 15 do mês seguinte.

**Por que Investimentos e Dividendos não entram no Lucro Líquido?**
Porque não são resultado operacional — são movimentações de capital. Ficam em blocos à parte, abaixo do Lucro Líquido.

**A DRE é diferente para cada bar?**
Sim. Tudo é filtrado por bar, e cada bar pode ter seu próprio de-para de categorias.

**Consigo ver o que compõe um número?**
Sim. Em qualquer subcategoria, clique na célula do mês para abrir a lista de lançamentos que somaram aquele valor.

## Fonte dos dados

- **`bronze.bronze_contaazul_lancamentos`** — lançamentos brutos do **Conta Azul** (receitas e despesas), fonte primária de todos os valores.
- **`financial.dre_categoria_macro`** — de-para que classifica cada categoria do Conta Azul em macro/subgrupo/subcategoria e define a ordem e o sinal.
- **`financial.dre_receita_ignorar_pattern`** — padrões de descrição para excluir movimentações financeiras taggeadas como receita.
- **`public.get_dre_por_ano(bar_id, ano)`** — função SQL que agrega os lançamentos por mês/categoria e calcula o % da receita.
- **`gold.mv_dre_ano`** — materialização de `get_dre_por_ano` (refresh horário); é o que a rota `/api/estrategico/orcamentacao/dre-excel` realmente lê.
- **`financial.get_dre_lancamentos(...)`** — função SQL do drill-down, que lista os lançamentos por trás de cada célula (rota `/api/financeiro/dre/lancamentos`).
- **Sincronização** — rota `/api/contaazul/sync-manual` (integração **Conta Azul**), acionada pelos botões "Atualizar" e "sincronizar ano completo".
