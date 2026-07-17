---
title: Controle de Consumação
area: producao-cmv
slug: controle-consumacao
route: /operacional/consumacao
description: Analisa linha a linha as consumações internas (cortesias e descontos) do bar, classificadas em 9 categorias, com o custo real de cada item.
order: 40
icon: Coffee
---

# Controle de Consumação

## Visão geral

A tela de **Controle de Consumação** mostra, item a item, tudo o que foi **consumido internamente sem cobrança cheia** — ou seja, os descontos e cortesias lançados no ContaHub. São as bebidas e comidas destinadas a **funcionários, sócios, artistas, aniversariantes, influencers, programa de pontos, relacionamento** e afins.

Cada lançamento aparece com dois valores lado a lado:

- **Bruto**: o valor que foi descontado (o "quanto valeria" na venda cheia).
- **Custo real**: o quanto aquilo efetivamente custou ao bar — usando a **ficha técnica** do produto quando ela existe, ou uma **estimativa por fator** quando não existe ficha.

O objetivo é dar ao gestor/dono a visão de **quanto a "casa" está gastando com consumação**, para quem, com quais produtos e em quais dias — número que também alimenta o CMV. É a mesma classificação usada na Gestão CMV, mas aqui detalhada por linha, por mesa/pessoa e por categoria.

## Como acessar

No menu lateral: **Produção - CMV › Controle de Consumação** (ícone de xícara).

- Rota: `/operacional/consumacao`
- Permissão necessária: módulo **Gestão** (`gestao`).

A tela sempre respeita o **bar selecionado** no seletor do topo — todos os números são filtrados por `bar_id`. Ao trocar de bar, os dados recarregam.

## Passo a passo

### Consultar a consumação de um período
1. Abra **Produção - CMV › Controle de Consumação**.
2. No topo, escolha um **atalho de período** (Hoje, Ontem, Semana atual, Mês atual, Mês passado, Últimos 30 dias) ou defina manualmente as datas em **De** e **Até**. O padrão ao abrir é o **mês atual**.
3. Os cards por categoria, os totais e a tabela recarregam automaticamente. Use o botão de **atualizar** (ícone circular) para forçar recarga.

### Filtrar e investigar
1. Clique em um **card de categoria** (ex.: Artistas) para filtrar a tabela só por aquela categoria — o card fica destacado e vira um chip azul de "filtro ativo".
2. Restrinja por **dia da semana** clicando nos botões Dom…Sáb.
3. Use **Motivo** e **Produto** (campos com busca) para filtrar por um motivo de desconto específico ou por um produto.
4. Use a **Busca livre** para procurar em motivo, produto e mesa ao mesmo tempo.
5. Nos cabeçalhos **Categoria, Mesa, Motivo e Produto** da tabela há um ícone de funil: clique para abrir a lista de valores (com contagem) e marcar só os que quer ver.
6. Todos os filtros somam e aparecem como **chips**. Clique no "x" de um chip para removê-lo ou em **Limpar tudo**.

### Agrupar por mesa/pessoa
1. O botão **Agrupado por mesa** (ligado por padrão) consolida todas as consumações da mesma mesa/pessoa no período em uma única linha. Clique na linha para **expandir** e ver os produtos.
2. Com o agrupamento ligado, o botão **Categoria › Mesa** organiza em duas camadas: primeiro a categoria, e ao expandir, as mesas dentro dela (ordenadas por custo).
3. Desligue o agrupamento para ver o lançamento cru, linha a linha.

### Corrigir/definir o vínculo de uma mesa
Serve para consertar classificações erradas na origem (ex.: uma mesa que veio como "Funcionário Operação" mas é artista) e para dar um nome canônico à pessoa.
1. Na linha da mesa (modo agrupado), clique no ícone de **etiqueta** ao lado do nome da mesa.
2. No modal **Vincular mesa**, escolha o **Tipo** (Artista, Sócio, Funcionário, Cliente, Outro).
3. Para artista ou sócio, selecione o cadastro na busca. É possível **criar um sócio novo** ali mesmo pelo campo "Novo sócio…".
4. Opcionalmente, force a **Categoria** (deixe "Automática" para usar o tipo/motivo).
5. Clique em **Salvar**. Para desfazer, reabra e use **Remover vínculo** (a mesa volta a ser classificada pelo motivo original).

> O botão de **etiqueta** é só para o **vínculo de pessoa** (artista/sócio/funcionário). Para trocar **só a categoria**, use o lápis na coluna Categoria (abaixo).

### Reclassificar a categoria — tirar do "Outros" (somente admin)
A categoria **"Outros"** é justamente o balde do que o sistema não conseguiu classificar sozinho — e **"Outros" NÃO entra no CMV** (o fechamento não lança essa categoria). Então tudo que ficar em Outros vira a **diferença** que some do CMV. Por isso o ideal é zerar o Outros reclassificando cada mesa na categoria correta.

1. Quando há valor em Outros, aparece um **aviso âmbar no topo** ("R$ X em 'Outros' — não entra no CMV") com um botão **"Ver só Outros"** que filtra a tabela.
2. Cada mesa/linha em Outros mostra uma etiqueta **RECLASSIFICAR**.
3. **Admin:** clique no **lápis** ao lado da categoria (na coluna Categoria, tanto na visão agrupada quanto na lista) → escolha a categoria correta no modal → salva na hora.
4. Isso grava um **override de categoria** da mesa (preservando o vínculo de pessoa, se houver) e **reflete no painel e no fechamento/CMV**. Use "Voltar ao automático" no modal para limpar.

> Só **admin** vê o lápis e pode alterar a categoria; o servidor também bloqueia a mudança de categoria por quem não é admin. Quem não é admin ainda consegue editar o vínculo de pessoa (etiqueta).

### Vincular consumação de artista ao cadastro (tela dedicada)
1. Clique em **Por artista** (canto superior direito) para ir a `/operacional/consumacao/artistas`.
2. Cada comanda de artista aparece com um seletor. O sistema já resolve sozinho pelo **nome** ou pelo **show da noite**; ajuste manualmente quando necessário (ex.: noite com mais de uma banda).
3. O rótulo indica a origem: **manual**, **auto (nome)** ou **auto (noite)**. Use o botão **Só revisar** para ver apenas os que precisam de conferência.

### Ignorar consumações lançadas erradas
Serve para tirar do controle lançamentos claramente equivocados (ex.: consumação lançada como aniversário mas era outro motivo) **sem apagar do bruto** — o registro do ContaHub permanece intocado, só some das somas do painel.

1. Na coluna **Ações** (última coluna) de cada linha há um ícone de olho cortado ("EyeOff"). Clique para marcar aquela linha como ignorada.
2. No modo agrupado, o botão fica no header da mesa e marca **todas as linhas daquela mesa** de uma vez (com prompt de motivo opcional).
3. Um aviso âmbar no topo mostra quantas ignoradas existem e o valor "escondido" quando você está no modo padrão.
4. No topo há um seletor de **modo de visão das ignoradas**:
   - **Ativas** (padrão) — esconde as ignoradas; somas e cards refletem só o que entra no controle.
   - **Todas** — mostra tudo; ignoradas aparecem tachadas em vermelho.
   - **Só ignoradas** — vê e restaura o que já foi marcado.
5. Para restaurar, entre em **Só ignoradas** (ou **Todas**) e clique no ícone de **RotateCcw** ("desfazer") na linha.

O motivo digitado no prompt fica salvo e aparece no tooltip da linha, útil pra auditar depois.

### Exportar
Clique em **CSV** para baixar os lançamentos filtrados (respeita a ordenação atual). O arquivo sai como `consumacao_<inicio>_a_<fim>.csv`, com separador `;` e vírgula decimal (pt-BR).

## Abas e seções

A tela tem duas abas:

- **Lançamentos**: cards por categoria, totais, e a tabela detalhada (com agrupamento e filtros). É a aba principal.
- **Análises**: KPIs e gráficos calculados sobre o **mesmo conjunto já filtrado** na aba Lançamentos — se você filtrou por Artistas, os gráficos refletem só Artistas.

## Colunas e cálculos

### Cards de resumo por categoria (topo da aba Lançamentos)
Um card para cada uma das 9 categorias padronizadas + **Outros**.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Valor em destaque (card) | Custo real acumulado da categoria | Soma de `custo` das linhas da categoria | `resumo[].custo` da API |
| % | Fatia do custo total | `custo da categoria ÷ custo total × 100` | cálculo no cliente |
| Nº de lançamentos | Quantas linhas caíram na categoria | Contagem de linhas | `resumo[].linhas` |
| bruto | Valor descontado acumulado | Soma de `valor_bruto` | `resumo[].bruto` |

### Cartões de totais
| Indicador | O que mostra | Como é calculado |
|---|---|---|
| Custo real (ficha + ×fator) | Custo total do período/filtro | Soma de `custo`. Com filtro ativo, soma só as linhas filtradas |
| bruto (sublinha) | Valor descontado total | Soma de `valor_bruto` |
| Lançamentos | Quantidade de linhas | Contagem de `linhasFiltradas` |

### Tabela de lançamentos
| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Data | Data gerencial do consumo | `trn_dtgerencial` | `bronze_contahub_avendas_porproduto_analitico` |
| Dia | Dia da semana da data | Derivado da data | cálculo no cliente |
| Categoria | Uma das 9 categorias + Outros | `classificar_consumo_padrao(motivo)` para datas ≥ 12/06/2026; antes disso, "Outros". Pode ser sobrescrita por vínculo de mesa | função SQL + `consumo_mesa_vinculo` |
| Mesa | Nome/descrição da mesa (pessoa) | `vd_mesadesc` | ContaHub |
| Motivo | Motivo do desconto | `vd_motivodesconto` da venda (pego pela mesa) | `bronze_contahub_avendas_vendasperiodo` |
| Produto | Descrição do item consumido | `prd_desc` | ContaHub |
| Qtd | Quantidade consumida | `qtd` | ContaHub |
| Bruto | Valor descontado (cortesia) | `desconto` (arredondado a 2 casas) | ContaHub |
| Custo | Custo real do item, com selo **FT** (ficha) ou **×fator** (estimado) | Ver fórmula abaixo | função SQL |

**Como o Custo é calculado (por linha):**
- Se o produto **tem ficha técnica** com custo apurado: `custo = custo_ficha × qtd × (desconto ÷ (desconto + valorfinal))`. Ou seja, o custo do produto multiplicado pela **proporção do que foi cortesia** dentro do valor total da linha. Nessas linhas aparece o selo **FT**.
- Se **não tem ficha**: `custo = desconto × fator` (fator padrão **0,35**, configurável por bar). Nessas linhas aparece o selo **×fator** (ex.: ×0.35).

O **custo da ficha** vem da explosão recursiva da ficha técnica (`producao_ficha_item`), multiplicando quantidades pelo preço unitário do insumo em `silver.insumo_catalogo`, e é ligado ao produto do ContaHub via `produto_contahub_map → produto_cardapio`.

### Linhas de grupo (modo "Agrupado por mesa")
| Coluna | O que mostra | Como é calculado |
|---|---|---|
| Data | Data mais recente do grupo | `max(data)` das linhas da mesa |
| Mesa (+ "N dias") | Rótulo mais recente da mesa; badge com nº de datas distintas | Agrupamento por mesa normalizada |
| Categoria | Categoria da mesa, ou "Vários" se mistura categorias | Consolidação das linhas |
| Motivo | Motivo, ou "Vários" | Consolidação |
| Produtos | Nº de itens (linhas) | Contagem |
| Qtd / Bruto / Custo | Somas do grupo | Soma das linhas |

> A **mesa é normalizada** (maiúsculas, só letras/números) para colapsar variações de grafia como "X Fidelidade", "X-Fidelidade" e "XFidelidade" no mesmo grupo.

### Linha de categoria (modo "Categoria › Mesa")
Mostra, por categoria: nº de mesas, nº de itens, **Bruto** e **Custo** somados; ao expandir, lista as mesas ordenadas por custo.

### Aba Análises — KPIs
| KPI | O que mostra | Como é calculado |
|---|---|---|
| Custo real | Custo total (com sub "bruto") | Soma de `custo` |
| Lançamentos | Nº de linhas | Contagem |
| Pessoas/mesas | Mesas distintas | Contagem de mesas normalizadas |
| Ticket médio/pessoa | Custo por mesa | `custo total ÷ pessoas` |
| % com ficha | Fatia de linhas com ficha técnica | `linhas com ficha ÷ total × 100` |
| Custo médio/lanç. | Custo por lançamento | `custo total ÷ nº de linhas` |

### Aba Análises — gráficos
| Gráfico | O que mostra | Base |
|---|---|---|
| Custo por categoria | Barras horizontais de custo por categoria | Soma de `custo` por categoria |
| Evolução do custo por dia | Linha/área do custo diário | Soma de `custo` por data |
| Top 10 pessoas/mesas por custo | Ranking de mesas | Soma de `custo` por mesa |
| Custo por dia da semana | Barras por dia (Dom…Sáb) | Soma de `custo` por dia da semana |
| Real (ficha) × Estimado | Rosca comparando custo com ficha vs. estimado por fator | Soma separando `tem_ficha` |
| Top produtos consumidos | Barras dos 8 produtos de maior custo | Soma de `custo` por produto |
| 💡 Destaques | Frases automáticas (categoria dominante, quem mais consome, % estimado, dia de pico) | Derivado dos agregados acima |

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| Atalhos de período | Preenchem De/Até (Hoje, Ontem, Semana atual, Mês atual, Mês passado, Últimos 30 dias) |
| De / Até | Intervalo de datas manual (recarrega da API) |
| Cards de categoria | Clicar filtra a tabela pela categoria e já expande o grupo dela |
| Dia da semana | Mostra só os dias selecionados |
| Motivo | Filtra por motivo do desconto |
| Produto | Filtra por produto |
| Busca livre | Procura texto em motivo + produto + mesa |
| Filtros de coluna (funil) | Marca valores específicos de Categoria, Mesa, Motivo ou Produto |
| Agrupar por mesa | Consolida consumações da mesma mesa (ligado por padrão) |
| Categoria › Mesa | Duas camadas: categoria e depois mesas |
| Ordenar | Clique em Data, Qtd, Bruto ou Custo para ordenar |
| CSV | Exporta as linhas filtradas/ordenadas |

Período e datas recarregam os dados do servidor; os demais filtros são aplicados **no navegador** sobre os dados já carregados.

## Regras e detalhes importantes

- **Sempre filtra por `bar_id`** (o bar selecionado). Nenhum número mistura bares.
- **Corte de classificação (12/06/2026):** a partir dessa data o ContaHub padronizou os motivos nas 9 categorias fixas. Consumações **anteriores ao corte** caem todas em **"Outros"** de propósito, para não zerar/defasar o histórico — a soma total da consumação não muda, só o detalhamento.
- **As 9 categorias:** Funcionário Operação, Funcionário Escritório, Aniversário, Programa de Pontos, Benefício Cliente, Influencer, Artistas, Sócios, Relacionamento — mais "Outros".
- **Bruto ≠ Custo.** Bruto é o valor descontado (o que foi dado de cortesia); Custo é o gasto real do bar. O card de categoria e os totais destacam o **Custo**; o Bruto fica como referência.
- **Fator do custo estimado:** vem de `bar_regras_negocio.cmv_fator_consumo` por bar (padrão exibido 0,35). Só afeta itens **sem ficha técnica**.
- **Base do lançamento:** só entram linhas com `desconto > 0` (houve cortesia). Data usada é a **data gerencial** (`trn_dtgerencial`).
- **Vínculo de mesa é manual e sobrepõe a classificação:** a categoria efetiva segue a ordem **override explícito › tipo do vínculo › motivo original**. O tipo mapeia automaticamente: artista → Artistas, sócio → Sócios, funcionário → Funcionário Operação.
- **Vínculo é por mesa normalizada**, então corrigir uma mesa arruma todas as suas variações de grafia no período.
- **Arredondamentos:** custo e bruto são arredondados a 2 casas; os gráficos usam valores inteiros (arredondados) só para exibição.
- **Estados vazios:** sem lançamentos no período aparece "Nenhum lançamento no período/filtro."; a aba Análises mostra "Sem dados no período/filtro para analisar.".
- **Performance:** a API usa uma função agregada (`..._agg`) que roda a consulta pesada uma única vez e retorna tudo em um só bloco, evitando o corte de 1000 linhas do PostgREST.
- **Ignorar é por hash da linha:** cada linha tem um `chave_hash` (MD5 de `mesa_norm|data|motivo|produto|valor_bruto|qtd`). O que fica salvo em `financial.consumo_ignorados` é essa chave + bar_id + motivo opcional. Se duas linhas 100% idênticas existirem, marcar uma marca as duas (aceitável — em geral são erros duplicados). Filtros de coluna/dropdown do combobox **abrem para cima** quando não cabem embaixo, pra não ficar cortados no fim da tabela.

## Dúvidas frequentes

**Por que uma consumação antiga aparece como "Outros"?**
Porque é anterior a 12/06/2026, quando os motivos foram padronizados. Antes disso não dá para classificar com segurança, então tudo fica em "Outros".

**Qual a diferença entre "Bruto" e "Custo"?**
Bruto é o valor da cortesia (quanto valeria vendido). Custo é quanto o bar realmente gastou — pela ficha técnica, quando há, ou por estimativa (bruto × fator) quando não há ficha.

**O que significam os selos FT e ×0.35 na coluna Custo?**
**FT** = o custo veio da ficha técnica real do produto. **×0.35** (ou o fator do bar) = o produto não tem ficha, então o custo foi estimado multiplicando o desconto pelo fator.

**Corrigi a categoria de uma mesa; isso muda o histórico do CMV?**
O vínculo é resolvido na hora da exibição desta tela (override › tipo › motivo). Ele conserta como a mesa aparece aqui sem reprocessar o classificador pesado.

**Por que preciso zerar o "Outros"?**
Porque **"Outros" não entra no CMV** — o fechamento não lança essa categoria no Conta Azul. Tudo que ficar em Outros é custo de consumação que **desaparece do CMV**. O aviso âmbar e a etiqueta "RECLASSIFICAR" existem para lembrar o admin de reclassificar cada mesa na categoria certa (lápis na coluna Categoria). Feito isso, o valor passa a entrar no fechamento.

**Quem pode reclassificar a categoria?**
Só **admin**. O lápis na coluna Categoria só aparece para admin, e o servidor bloqueia a mudança por não-admin. O vínculo de pessoa (etiqueta) continua disponível para os demais.

**Por que várias comandas da mesma pessoa viram uma linha só?**
O agrupamento por mesa (ligado por padrão) consolida a mesma pessoa no período. Clique na linha para ver os itens; desligue "Agrupado por mesa" para o detalhe cru.

**A aba Análises considera meus filtros?**
Sim. Ela usa exatamente o conjunto já filtrado na aba Lançamentos.

**Por que a consumação daqui não bate com a coluna mensal do CMV Semanal?**
Porque são **fontes diferentes**. Esta tela (e o CMV **semanal**) lê o **ContaHub** — o desconto que saiu no PDV, classificado automático pelo motivo. Já a **coluna mensal** do CMV (e a DRE) lê o **Conta Azul** — as categorias `[Consumação]` lançadas **à mão** pelo financeiro, que é a base contábil. Quando o lançamento manual no CA fica incompleto num mês, a consumação do mensal aparece menor que a daqui. Unificar as duas numa fonte só é uma decisão em aberto (contábil).

## Fonte dos dados

Origem: **ContaHub** (vendas/descontos), enriquecido com fichas técnicas e cadastros internos.

- **Função principal:** `public.get_consumos_9_detalhes_custo_semana_agg` (wrapper de `get_consumos_9_detalhes_custo_semana`) — detalhe linha a linha com custo real.
- **Tabelas ContaHub (bronze):** `bronze.bronze_contahub_avendas_porproduto_analitico` (itens/descontos) e `bronze.bronze_contahub_avendas_vendasperiodo` (motivo do desconto).
- **Classificação:** `public.classificar_consumo_padrao(motivo)` e `public.consumo_padrao_cutoff()` (corte 12/06/2026).
- **Ficha técnica / custo:** `producao_ficha_item`, `producao_base`, `silver.insumo_catalogo`, `produto_contahub_map`, `produto_cardapio`.
- **Fator do bar:** `operations.bar_regras_negocio.cmv_fator_consumo`.
- **Vínculos e cadastros:** `financial.consumo_mesa_vinculo`, `financial.consumo_socio`, `operations.bar_artistas`.
- **Ignorados:** `financial.consumo_ignorados` (bar_id + chave_hash + motivo + criado_em/por). Endpoints `POST /api/operacional/consumacao/ignorar` e `DELETE ...?chaves=...`.
- **Tela "Por artista":** `financial.fn_consumo_artistas_periodo` e `financial.consumo_artista_override`.
