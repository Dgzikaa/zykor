---
title: Notas Fiscais
area: ferramentas-financeiro
slug: notas-fiscais
route: /financeiro/notas-fiscais
description: Consolida o total emitido em notas fiscais (NFCe e NFe) por dia e por mês, separado por CNPJ, com comparação ano-a-ano.
order: 80
icon: ReceiptText
---

# Notas Fiscais

## Visão geral

A tela **Notas Fiscais** mostra quanto o bar emitiu em nota fiscal, consolidado a partir do relatório de Notas Fiscais do ContaHub (a chamada `qry=73`). O valor exibido é o **total autorizado** de notas — ou seja, o que efetivamente saiu como documento fiscal válido (NFCe de consumidor e NFe de operações B2B).

O grande diferencial da tela é a separação **por CNPJ**. Cada bar do grupo emite notas sob mais de um CNPJ (por exemplo, Ordinário usa dois: "ORDINARIO BAR E GASTRONOMIA" e "ORDI BAR"; Deboche usa "DESCUBRA BAR E RESTAURANTE" e "DSCBR BAR E RESTAURANTE"). A tela quebra o faturamento fiscal por cada CNPJ, o que ajuda o dono/gestor a enxergar quanto está sendo emitido em cada empresa.

É uma tela de **leitura/consulta** — não há cadastro, edição ou aprovação de notas aqui. Serve para conferência fiscal, acompanhamento da emissão diária e análise de tendência mês a mês.

## Como acessar

No menu lateral: **Financeiro → Notas Fiscais** (ícone de recibo).

- Rota: `/financeiro/notas-fiscais`
- Permissão necessária: módulo **`ferramentas financeiro_notas_fiscais`**. Quem não tem essa permissão não vê o item no menu nem consegue abrir a página.

A tela sempre respeita o **bar selecionado** no seletor do topo — todos os números são filtrados pelo bar atual.

## Passo a passo

### Consultar a emissão de um mês (aba Diário)

1. Abra **Financeiro → Notas Fiscais**. A aba **Diário** já vem selecionada.
2. No canto superior direito há um **seletor de mês**. Ele é preenchido automaticamente com os meses que têm nota fiscal registrada para o bar (do mais recente para o mais antigo).
3. Escolha o mês desejado. A tela recarrega mostrando os cards de resumo e a tabela dia a dia daquele mês.
4. Leia os **cards de resumo** no topo: o primeiro traz o total emitido do mês inteiro; os demais trazem o total por CNPJ.
5. Percorra a **tabela diária** para ver quanto foi emitido em cada dia, quebrado por CNPJ, e o total do dia (com a barrinha de proporção).

### Analisar a tendência mês a mês (aba Mensal / YoY)

1. Clique na aba **Mensal (YoY)**.
2. O **gráfico de barras empilhadas** mostra o total emitido por mês, com cada CNPJ como uma cor da pilha.
3. Abaixo, a **tabela mensal** lista cada mês (do mais recente para o mais antigo), com o total por CNPJ, o total geral, a variação contra o mesmo mês do ano anterior e a quantidade de notas.
4. Use a coluna **vs ano ant.** para identificar rapidamente se aquele mês cresceu (verde, seta pra cima) ou caiu (vermelho, seta pra baixo) em relação a 12 meses atrás.

> Observação: não há botão de exportação nesta tela. A leitura é feita na própria página.

## Abas e seções

A tela tem duas abas:

- **Diário** — visão do mês selecionado, dia a dia. Traz cards de resumo (total geral + um por CNPJ) e uma tabela pivotada onde cada linha é um dia e cada coluna de CNPJ mostra o valor emitido naquele dia. O seletor de mês só aparece nesta aba.
- **Mensal (YoY)** — visão do histórico inteiro do bar, agregado por mês. Traz um gráfico de barras empilhadas por CNPJ e uma tabela mensal com comparação ano-a-ano. Esta aba só é carregada quando você a abre pela primeira vez (e fica em cache depois).

## Colunas e cálculos

Todos os valores vêm da view `gold.notas_fiscais_diaria`, que agrega a camada silver `silver.contahub_notas_fiscais` (dados do ContaHub `qry=73`) por dia contábil de emissão e por índice de CNPJ.

### Aba Diário — Cards de resumo

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total emitido (card principal) | Total autorizado do mês selecionado | Soma de `total_autorizado` de todas as linhas do período | `gold.notas_fiscais_diaria` |
| Notas (subtexto do card) | Quantidade de notas autorizadas no mês | Soma de `qtd_notas` (= `qtd_autorizada`) | `gold.notas_fiscais_diaria` |
| Dias (subtexto do card) | Quantos dias distintos tiveram emissão | Contagem de dias distintos com nota no período | Cálculo na API |
| NFe (subtexto, se > 0) | Parcela do total que foi NFe (B2B) | Soma de `total_nfe` (autorizado só das notas tipo NFe) | `gold.notas_fiscais_diaria` |
| Card por CNPJ (valor) | Total emitido no mês por aquele CNPJ | Soma de `total_autorizado` filtrada pelo índice do CNPJ | `gold.notas_fiscais_diaria` |
| Card por CNPJ (subtexto) | Nº de notas do CNPJ + o número do documento | Soma de `qtd_notas` do CNPJ; documento vem do rótulo cadastrado | `gold.notas_fiscais_diaria` + `financial.nf_cnpj_labels` |

### Aba Diário — Tabela dia a dia

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Dia | Data contábil de emissão + dia da semana | Campo `data` (= `nf_dtcontabil`); dia da semana calculado na tela | `gold.notas_fiscais_diaria` |
| Coluna por CNPJ | Valor autorizado emitido naquele dia por aquele CNPJ | `total_autorizado` daquele dia/CNPJ; "—" se não houve | `gold.notas_fiscais_diaria` |
| Subvalor NFe (roxo, se > 0) | Parcela NFe dentro da célula do CNPJ | `total_nfe` daquele dia/CNPJ | `gold.notas_fiscais_diaria` |
| Subvalor Cancelado (vermelho, se > 0) | Valor cancelado naquele dia/CNPJ | `total_cancelado` daquele dia/CNPJ | `gold.notas_fiscais_diaria` |
| Total do dia | Soma emitida no dia (todos os CNPJs) | Soma de `total_autorizado` de todos os CNPJs do dia | Cálculo na API |
| Barra de proporção | Peso visual do dia frente ao maior dia do mês | `total_autorizado` do dia ÷ maior total_autorizado diário do mês | Cálculo na tela |
| Notas | Nº de notas emitidas no dia | Soma de `qtd_notas` de todos os CNPJs do dia | `gold.notas_fiscais_diaria` |
| Linha Total (rodapé) | Totais do mês por CNPJ, total geral e nº de notas | Mesmos totais do resumo do período | Cálculo na API |

### Aba Mensal (YoY) — Gráfico e tabela

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Gráfico barras empilhadas | Total emitido por mês, uma cor por CNPJ | Soma mensal de `total_autorizado` por CNPJ | `gold.notas_fiscais_diaria` |
| Mês | Mês/ano da linha | Primeiros 7 caracteres da `data` (YYYY-MM) | `gold.notas_fiscais_diaria` |
| Coluna por CNPJ | Total emitido no mês por aquele CNPJ | Soma de `total_autorizado` do mês, por índice de CNPJ | `gold.notas_fiscais_diaria` |
| Total | Total emitido do mês (todos os CNPJs) | Soma de `total_autorizado` do mês | `gold.notas_fiscais_diaria` |
| vs ano ant. | Variação % contra o mesmo mês do ano anterior | (total do mês − total do mesmo mês 1 ano antes) ÷ total do ano anterior × 100 | Cálculo na API |
| Notas | Nº de notas emitidas no mês | Soma de `qtd_notas` do mês | `gold.notas_fiscais_diaria` |

## Filtros e opções

- **Bar selecionado** — todo o conteúdo é filtrado por `bar_id`. Trocar de bar no topo troca todos os números. Cada CNPJ pertence a um bar específico.
- **Seletor de mês** (aba Diário) — define o período consultado dia a dia. O mês vira o intervalo do dia 1 ao último dia do mês. As opções do seletor são apenas os meses que realmente têm nota registrada para o bar, montadas automaticamente.
- **Abas Diário / Mensal** — alternam entre a visão do mês (dia a dia) e a visão do histórico inteiro (mês a mês). A aba Mensal só busca os dados quando aberta.

Não há filtro por tipo de nota (NFCe/NFe) nem por CNPJ individual: a NFe aparece como destaque dentro das células, e cada CNPJ tem sua própria coluna.

## Regras e detalhes importantes

- **Data usada é a contábil de emissão da nota** (`nf_dtcontabil`), não a data gerencial da venda. Uma venda feita após a meia-noite pode ter dia gerencial D-1, mas a nota é consolidada pela data contábil em que foi emitida. Por isso os números aqui podem diferir levemente do faturamento gerencial de outras telas.
- **CNPJ vem como índice, não como número.** O ContaHub só devolve o índice do CNPJ (1, 2, 3...). O nome amigável e o número do documento ficam na tabela editável `financial.nf_cnpj_labels`. Se um índice não estiver cadastrado, a tela mostra "CNPJ X" genérico. Atenção: no Deboche (bar 4) os índices usados são 1 e 3 (não 1 e 2).
- **Total autorizado é o valor central** — representa as notas efetivamente autorizadas (emitidas com sucesso). Cancelamentos aparecem à parte (subvalor vermelho) e **não** são descontados do total autorizado.
- **NFCe x NFe** — a maioria das notas é NFCe (nota de consumidor). NFe (B2B) aparece destacada em roxo dentro das células e nos subtextos. O total autorizado já inclui os dois tipos somados.
- **YoY só aparece quando há base de comparação.** Se não existir dado do mesmo mês no ano anterior (ou se o total anterior for zero), a coluna "vs ano ant." mostra "—".
- **Origem 100% automática.** Os dados chegam pela ingestão do ContaHub (`contahub-sync-automatico`, tipo `notasfiscais`), são processados para bronze/silver e a tela lê a view gold. Não há entrada manual de notas nesta página — o único ponto editável é o rótulo/documento do CNPJ na tabela `financial.nf_cnpj_labels`.
- **Estado vazio** — sem notas no período, a aba Diário mostra "Nenhuma nota fiscal no período." e a aba Mensal mostra "Sem dados."
- **Paginação** — a API pagina a leitura da view (padrão do projeto), então períodos com muitas linhas são lidos por completo, sem corte em 1000 registros.

## Dúvidas frequentes

**Por que o total daqui é diferente do faturamento em outras telas?**
Porque esta tela usa a data contábil de emissão da nota fiscal (`nf_dtcontabil`), enquanto o faturamento gerencial usa o dia gerencial da venda. Vendas após a meia-noite e diferenças de emissão explicam a divergência.

**O que significa "NFe" em roxo dentro das células?**
É a parcela do valor que foi emitida como NFe (nota B2B, entre empresas), separada da NFCe (nota de consumidor). O total já soma os dois.

**Os cancelamentos são descontados do total emitido?**
Não. O total autorizado mostra o que foi efetivamente emitido. O valor cancelado é exibido à parte (em vermelho) apenas como informação.

**Por que aparece "CNPJ 1" em vez do nome da empresa?**
Porque aquele índice de CNPJ ainda não tem rótulo cadastrado na tabela `financial.nf_cnpj_labels`. Basta cadastrar o rótulo e o documento para o nome aparecer.

**Como funciona a comparação "vs ano ant."?**
Ela pega o total emitido no mês e compara com o total do mesmo mês 12 meses antes, mostrando a variação percentual. Verde = cresceu, vermelho = caiu, "—" = sem ano anterior para comparar.

**Consigo exportar ou editar notas aqui?**
Não. A tela é só de consulta. Notas não são cadastradas nem editadas por aqui; elas vêm automaticamente do ContaHub.

## Fonte dos dados

- **Integração de origem:** ContaHub — relatório de Notas Fiscais (`qry=73`), ingerido por `contahub-sync-automatico` (data_type `notasfiscais`).
- **Pipeline (medallion):**
  - `bronze.bronze_contahub_notas_fiscais` — uma linha por CNPJ/dia contábil/tipo/série (processada por `process_notasfiscais_data`).
  - `silver.contahub_notas_fiscais` — view tipada e renomeada.
  - `gold.notas_fiscais_diaria` — consolidação diária por dia × CNPJ, com rótulo (fonte direta das duas APIs da tela).
- **Rótulos de CNPJ:** `financial.nf_cnpj_labels` (editável — nome amigável e número do documento por índice de CNPJ).
- **APIs consumidas pela tela:**
  - `GET /api/financeiro/notas-fiscais` (aba Diário — pivot por dia × CNPJ + resumo + meses disponíveis).
  - `GET /api/financeiro/notas-fiscais/mensal` (aba Mensal — série mensal por CNPJ + YoY).
