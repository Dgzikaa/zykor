---
title: Orçamentação
area: estrategico
slug: orcamentacao
route: /estrategico/orcamentacao
description: Painel anual (Jan-Dez) que compara Planejado, Projetado e Realizado mês a mês — receita, custos, breakeven e lucro líquido do bar.
order: 40
icon: DollarSign
---

# Orçamentação

## Visão geral

A Orçamentação é a versão **enxuta** do resultado do bar, pensada para planejar e acompanhar o ano inteiro numa tela só. Diferente da DRE (que detalha 100% do resultado), aqui o foco é o gerencial de metas:

- A **receita** aparece numa linha única (*Faturamento Meta*), sem quebrar por meio de recebimento.
- Os **Custos Variáveis** e o **CMV** entram só como **percentual** do faturamento (sem detalhar subcategorias).
- As **despesas fixas** aparecem em R$, linha a linha, agrupadas por bloco.
- Indicadores gerenciais como **Real Fixo, % Contribuição, BreakEven, Lucro Líquido e Margem** são calculados automaticamente.

Cada linha tem sempre **três colunas**: **Planejado** (o que foi orçado no BP), **Projetado** (a revisão da meta ao longo do mês) e **Realizado** (o que de fato aconteceu, puxado do Conta Azul). A tela mostra os **12 meses do ano corrente** (Jan a Dez) lado a lado, com o mês atual destacado em verde.

Quem usa: sócio/dono e o financeiro, para acompanhar se o mês está indo dentro da meta e ajustar a projeção semana a semana.

## Como acessar

No menu lateral: **Estratégico › Orçamentação** (ícone de cifrão), rota `/estrategico/orcamentacao`.

A permissão exigida no menu é o módulo **`home`** (acesso amplo — quem enxerga a Visão Geral enxerga a Orçamentação). As ações de **escrita** (salvar valor, atualizar) passam por autenticação de usuário e pelo guard de rota (`negarPorRota`), então a edição respeita a permissão do usuário.

Se nenhum bar estiver selecionado no seletor do topo, a tela pede para escolher um bar antes de carregar.

## Passo a passo

### Acompanhar o mês atual
1. Abra a tela. Ela já rola automaticamente para **centralizar o mês corrente** (destacado em verde).
2. Leia cada linha nas 3 colunas: azul = **Planejado**, preto = **Projetado**, colorido = **Realizado**.
3. No Realizado, **verde** significa que o resultado está melhor que o planejado e **vermelho** pior (para receita, mais é melhor; para despesa, menos é melhor).

### Expandir um bloco para ver o detalhe
1. Clique no nome de um bloco de despesa fixa (ex.: *Mão-de-Obra*, *Despesas Comerciais*) na coluna cinza da esquerda.
2. As subcategorias aparecem. Blocos com sublinhas (ex.: *CMO Fixo*, *Marketing*) têm uma seta — clique nela para abrir os filhos.
3. Use o botão **Expandir tudo / Recolher tudo** no topo para abrir/fechar todos os blocos de uma vez.

### Editar a Projeção (revisão da meta)
1. Passe o mouse sobre a célula da coluna **Projetado** de uma linha editável (mostra um lápis verde).
2. Clique, digite o novo valor (use vírgula ou ponto para decimais) e pressione **Enter** (ou clique no ✓). **Esc** ou ✗ cancela.
3. Nas linhas de **Custos Variáveis** e **CMV**, o valor editado é o **percentual** (%). Nas linhas de despesa fixa, é o **R$**.
4. O valor é salvo e a tela recarrega mantendo a posição do scroll.

> O **Planejado** é read-only na tela: ele vem do **BP (Financeiro › BP)**. A Projeção das linhas *Atrações Programação* e *Produção Eventos* também é read-only — vem do Planejamento Comercial.

### Editar o Realizado manual
Algumas linhas (marcadas com **bolinha azul**) têm Realizado digitado à mão, porque não existem no Conta Azul (ex.: *MKT Disparos*, *MKT Programa de Pontos*, *MKT Benefícios*). Clique na célula Realizado, digite e confirme.

### Ver os lançamentos que compõem um valor (drill-down)
1. Nas linhas cujo Realizado vem do Conta Azul, passe o mouse na célula Realizado (aparece um ícone de recibo).
2. Clique. Abre um popup listando **cada lançamento do Conta Azul** (data, descrição, categoria CA, valor) que somou naquele valor, com o total no rodapé.
3. Funciona também nos blocos % (Variáveis / CMV): o popup lista os lançamentos do bloco inteiro.

### Sincronizar com o Conta Azul (botão Atualizar)
1. Clique em **Atualizar** (ícone de refresh) no topo.
2. Isso dispara duas coisas: (a) sincroniza o Conta Azul (delta incremental) e (b) **reprocessa o realizado** (camada gold) do ano exibido.
3. Ao final a tela recarrega com os números atualizados. Use quando lançou algo novo no CA e quer ver refletido na hora (o cron automático roda só 2x/dia).

### Trocar de bar
Troque o bar no seletor do topo. A tela re-busca os dados do bar selecionado automaticamente (os números são sempre filtrados por `bar_id`).

## Abas e seções

A tela tem três abas no topo:

| Aba | O que faz |
|---|---|
| **Orçamentação** | O painel principal Plan/Proj/Real por mês (descrito nas seções abaixo). |
| **Categorias** | *Central de Categorias*: mapeia cada categoria do Conta Azul para um **bloco da DRE/Orçamentação** (Receita, CMV, Mão-de-Obra, etc.), muda de bloco, define tipo (receita/despesa) ou marca "Não mostrar". Filtra por ano e por "só não mapeadas", com busca. Salvar **reprocessa o ano na hora**. É aqui que categorias novas do CA passam a aparecer na Orçamentação. |
| **Histórico** | Log de auditoria de toda alteração em Planejado/Projetado/Realizado: quando, quem mudou, a origem (planilha ou DRE manual), o valor antes e depois, e a ação (insert/update). |

> As antigas abas **Business Plan** e **DRE** viraram páginas próprias em *Financeiro* (`/financeiro/bp` e `/financeiro/dre`). A aba **DRE Manual** foi escondida (o histórico continua no banco).

## Colunas e cálculos

A tela é uma matriz: **linhas** (indicadores, blocos e subcategorias) × **meses** (Jan–Dez), e cada célula-mês tem os 3 valores **Plan | Proj | Real**. Abaixo, o que cada linha representa e como cada coluna é calculada.

### Cards de resumo (topo)

| Card | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Receita Plan. | Faturamento planejado do ano | Σ do *Faturamento Meta Planejado* dos 12 meses | orcamento_planilha / gold.planejamento |
| Receita Real. | Faturamento realizado (até o mês atual) | Σ do *Faturamento Meta Realizado*, **somando só até o mês corrente** (meses futuros não entram) | gold.planejamento |
| Lucro Plan. | Lucro líquido planejado do ano | Σ do Lucro Líquido Planejado dos 12 meses | derivado |
| Lucro Proj. | Lucro líquido projetado do ano | Σ do Lucro Líquido Projetado dos 12 meses | derivado |
| Lucro Real. | Lucro líquido realizado (até o mês atual) | Σ do Lucro Líquido Realizado, **só até o mês corrente** | derivado |

### Indicadores agregados (topo da matriz)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Faturamento Meta** | A receita do mês (única linha de receita) | **Plan** = BP manual (categoria `FATURAMENTO META` da planilha); se vazio, cai no Σ M1 dos eventos. **Proj** = *Empilhamento M1*: dias já fechados (< hoje BRT, com faturamento > 0) usam o realizado; hoje e futuro usam o M1. **Real** = Σ do faturamento consolidado dos eventos do mês | orcamento_planilha; gold.planejamento (`m1_r`, `faturamento_total_consolidado`); overlay ao vivo de eventos_base.`m1_r` |
| **Real Fixo** | Total das despesas fixas do mês | Σ dos blocos **Mão-de-Obra + Comerciais + Administrativas + Operacionais + Ocupação** (Plan/Proj/Real cada). NÃO inclui Variáveis, CMV nem Não Operacionais | derivado das subcategorias |
| **BreakEven** | Faturamento necessário para cobrir os fixos | Real Fixo ÷ % Contribuição (MC) | derivado |
| **% CONTRIB** | Margem de Contribuição (%) | MC = 1 − (Custos Variáveis % + CMV %) | derivado dos % de Var e CMV |

### Blocos percentuais (Custos Variáveis e CMV)

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Custos Variáveis (Plan %) | Imposto + Taxa maquininha + Comissão, em % | Digitado no BP (%) | orcamento_planilha (`valor_planejado`) |
| Custos Variáveis (Proj %) | Revisão do % | Editável na tela (%) | orcamento_planilha (`valor_projetado`) |
| Custos Variáveis (Real %) | % realizado do bloco | (Σ net do bloco no Conta Azul − ajustes DRE Manual) ÷ Faturamento realizado | gold.orcamento_realizado_mensal (bloco *Custos Variáveis*); financial.dre_manual |
| CMV (Plan % / Proj %) | Custo de insumos, em % | Plan = BP; Proj = editável na tela | orcamento_planilha |
| CMV (Real %) | % de CMV realizado | (Σ net do bloco *Custo insumos (CMV)* − ajustes) ÷ Faturamento realizado | gold.orcamento_realizado_mensal; financial.dre_manual |

Para os totais, o R$ desses blocos é reconstruído: **Plan R$ = Plan% × Faturamento Plan** e **Proj R$ = Proj% × Faturamento Proj**; o Real R$ vem direto do gold.

### Blocos de despesa fixa (em R$)

Cada subcategoria segue a mesma lógica. Blocos: **Mão-de-Obra** (CMO Fixo, CMO Freela e filhos), **Despesas Comerciais** (Marketing, Consumações Mkt, Artístico, Produção), **Despesas Administrativas**, **Despesas Operacionais**, **Despesas de Ocupação**.

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Planejado (R$) | Valor orçado da linha | Digitado no BP | orcamento_planilha (`valor_planejado`) |
| Projetado (R$) | Revisão do valor | Editável na tela | orcamento_planilha (`valor_projetado`) |
| Realizado (R$) | Gasto real da linha | Σ net das categorias do Conta Azul mapeadas para a linha **− ajustes da DRE Manual** (despesa subtrai; receita soma) | gold.orcamento_realizado_mensal (por `categoria_zykor`); financial.dre_manual |

**Casos especiais dentro dos fixos:**

| Linha | Regra específica |
|---|---|
| **CMO Fixo** / **CMO Freela** | Linhas-pai: o valor é a **soma dos filhos** (CUSTO-EMPRESA FUNCIONÁRIOS, Adicionais, Alimentação, Pró-labore; e os Freelas). Clique para expandir. |
| **CUSTO-EMPRESA FUNCIONÁRIOS** | Realizado = SALÁRIO + PROVISÃO TRABALHISTA + VALE TRANSPORTE somados do CA. |
| **Escritório Central** | É **% do faturamento** (default 4%). A célula mostra/edita o %, mas o R$ (= % × faturamento) é o que entra no Real Fixo e nos totais. |
| **Administrativo Local** | Nome varia por bar (no Deboche aparece como *Administrativo Deboche*); soma categorias `Administrativo Ordinário` / `Administrativo Local`. |
| **Atrações Programação** / **Produção Eventos** | **Projeção é read-only** — vem do Planejamento Comercial: Σ do custo artístico / produção dos eventos do mês (real do dia fechado, projeção do futuro). |
| **MKT Disparos, MKT Programa de Pontos, MKT Benefícios** | Realizado **manual** (bolinha azul), digitado na tela — não existe no Conta Azul. |

### Não Operacionais

| Linha | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Contratos Cashback Mensal | Cashback mensal Ambev (receita que não é da operação, não entra no BreakEven) | Realizado = Conta Azul (categoria_zykor `CONTRATOS`, só cashback mensal) + ajustes manuais. Contratos **anuais NÃO** entram aqui | gold.orcamento_realizado_mensal; financial.dre_manual |

### Rodapé (resultado)

| Linha | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Lucro Líquido** | Resultado do mês | (Faturamento − BreakEven) × %Contribuição + Não Operacionais *(fórmula do Excel do sócio: `=(BF2−BF4)*BF5+BF45`)* | derivado |
| **Margem** | Rentabilidade | Lucro Líquido ÷ Faturamento × 100 | derivado |

> **Surfacing automático:** qualquer categoria do Conta Azul mapeada (na aba Categorias) a um bloco, mas que não esteja na estrutura fixa, aparece automaticamente como uma linha extra naquele bloco. Assim a aba Categorias reflete na Orçamentação sem precisar mexer no código.

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| **Seletor de bar** (topo global) | Define o `bar_id`. Todos os números são desse bar; trocar re-busca os dados. |
| **Período** | Fixo: sempre os **12 meses (Jan–Dez) do ano corrente**. Não há seletor de período na aba principal. |
| **Expandir tudo / Recolher tudo** | Abre ou fecha todos os blocos de despesa fixa. |
| **Clique no nome da linha** | Destaca (amarelo) a linha ao longo dos 12 meses; clique de novo desmarca. |
| **Atualizar** | Sincroniza o Conta Azul e reprocessa o realizado do ano. |
| **Aba Categorias — Ano** | Escolhe o ano do mapeamento (últimos 4 anos). |
| **Aba Categorias — Busca / Só não mapeadas** | Filtra a lista de categorias do CA por texto ou mostra só as ainda não mapeadas. |

## Regras e detalhes importantes

- **Filtragem por bar:** toda consulta é filtrada por `bar_id`; a tela nunca mistura bares (Ordinário = 3, Deboche = 4).
- **Competência, não pagamento:** o realizado do Conta Azul é agregado por **data de competência** (`data_competencia`), não pela data de pagamento.
- **Planejado é read-only:** vem do **BP (Financeiro › BP)**. Editar meta é feito na página de BP, não aqui.
- **Realizado mês corrente vs mês fechado (Faturamento):** no mês em andamento a receita usa a venda consolidada em tempo real (ContaHub/Yuzer/Sympla via gold.planejamento), porque o cartão de crédito só cai no Conta Azul depois. Meses fechados seguem o oficial.
- **Empilhamento (Projeção):** só o dia **já fechado** (< hoje, no fuso America/Sao_Paulo) usa o realizado; hoje e futuro usam o M1. Evita que um dia em andamento ou evento futuro com M1 baixo distorça a projeção.
- **M1 ao vivo:** a projeção da meta usa o M1 editado no Planejamento Comercial na hora (overlay de `eventos_base`), sem esperar o cron do gold (que roda 1x/dia).
- **Total do ano só até o mês atual:** os cards de *Receita Real.* e *Lucro Real.* somam o realizado **apenas até o mês corrente** — meses futuros não têm realizado e, se entrassem, jogariam o lucro para muito negativo.
- **Ajustes da DRE Manual:** somam ao realizado do CA — em despesa o ajuste **subtrai** (positivo reduz o gasto), em receita **soma**.
- **Manual vs automático:** bolinha **azul** = Realizado digitado na tela; bolinha/valor **verde** = automático (Conta Azul). O botão Atualizar só afeta os automáticos.
- **Cores:** Realizado fica verde quando bate/supera a meta (receita) ou fica abaixo dela (despesa), e vermelho no contrário. Lucro Líquido é verde se positivo, vermelho se negativo.
- **Casamento de categorias insensível a acento/maiúscula:** o de-para às vezes grava em maiúsculo, às vezes em título; a agregação normaliza os dois lados para não zerar a linha.
- **A camada gold é reprocessada por cron 2x/dia;** para ver algo lançado agora, use o botão Atualizar.

## Dúvidas frequentes

**Por que o Planejado não deixa editar?**
Porque ele vem do BP (Business Plan). Ajuste a meta em *Financeiro › BP*; aqui você só revisa a **Projeção**.

**Cliquei em Atualizar e o número não mudou. Por quê?**
O Atualizar sincroniza o Conta Azul e recalcula o realizado do ano. Se o lançamento não estava no CA (ou ainda não foi liquidado), ele não aparece. Confira também se a categoria do CA está mapeada na aba **Categorias**.

**Uma categoria do Conta Azul não aparece na tela. O que faço?**
Vá na aba **Categorias**, encontre a categoria (use "Só não mapeadas"), escolha o **Bloco DRE** e o tipo, e salve. Ela passa a aparecer na Orçamentação (surfacing automático) e o ano é reprocessado na hora.

**Qual a diferença entre esta tela e a DRE?**
A DRE detalha 100% do resultado (por meio de recebimento, todas as linhas). A Orçamentação é o gerencial enxuto: receita numa linha, Variáveis e CMV como %, e o foco em meta × projeção × realizado com breakeven e margem.

**Por que o Lucro Real. do ano parece "faltar" meses?**
De propósito: o realizado só é somado até o mês corrente. Meses futuros ainda não aconteceram e entrariam só com custos, distorcendo o total.

**O que é o "% CONTRIB"?**
É a Margem de Contribuição: quanto sobra de cada real vendido depois dos custos variáveis e do CMV. Entra no cálculo do BreakEven e do Lucro.

## Fonte dos dados

| Fonte | Papel |
|---|---|
| **meta.orcamento_planilha** (view `orcamento_planilha`) | Planejado (BP) e Projetado de cada linha; realizado manual; % de Variáveis/CMV. |
| **gold.orcamento_realizado_mensal** | Realizado por categoria/bloco (net) vindo do Conta Azul. |
| **gold.planejamento** | Faturamento Meta: M1 (Plan), empilhamento (Proj) e consolidado (Real) — inclui ContaHub + Yuzer + Sympla. |
| **operations.eventos_base** | Custo artístico/produção (projeção de *Atrações*/*Produção*) e M1 ao vivo. |
| **financial.dre_manual** | Ajustes manuais (consumo de estoque, bonificações) que somam/subtraem do realizado do CA. |
| **silver.consumacao_artistas** | Base para linhas de consumação de artistas (comp do ContaHub). |
| **silver.lancamento_classificado** | Drill-down: lançamentos individuais do Conta Azul que compõem cada realizado. |
| **bronze_contaazul_lancamentos** | Origem bruta dos lançamentos (Conta Azul), a montante do gold. |

**Integrações de origem:** Conta Azul (lançamentos financeiros → realizado e categorias), ContaHub / Yuzer / Sympla (faturamento consolidado via Planejamento Comercial).
