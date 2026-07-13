---
title: Histórico CA
area: ferramentas-financeiro
slug: historico-ca
route: /financeiro/ca-historico
description: Auditoria unificada de tudo que o Zykor lançou automaticamente no Conta Azul — por origem, com receita, despesa e líquido no período.
order: 70
icon: History
---

# Histórico CA

## Visão geral

A tela **Histórico CA** é o extrato de auditoria de tudo que o **Zykor lançou dentro do Conta Azul** de forma automática. Sempre que o sistema empurra um lançamento para o Conta Azul — um fechamento de estoque, uma consumação, um imposto, uma bonificação, uma entrada ou saída de dinheiro do caixa, um repasse Sympla ou um recebível Stone — esse envio fica registrado em um log. Esta tela junta todos esses logs num único lugar, num formato comum, para você conferir **o que foi lançado, de qual origem veio, quanto, quando e por quem**.

Serve principalmente para **conferência e rastreabilidade**: descobrir se um lançamento realmente foi para o Conta Azul, entender de onde veio um valor que apareceu no financeiro, ou auditar o total lançado por origem num período. Quem mais usa no dia a dia é o **financeiro / controladoria** e a **direção**, especialmente ao fechar o mês ou ao investigar divergências entre o Zykor e o Conta Azul.

Importante: esta tela é **somente leitura**. Ela não cria, edita nem apaga nada — apenas mostra o que já foi lançado.

## Como acessar

No menu lateral, abra o grupo **Ferramentas Financeiras** e clique em **Histórico CA** (ícone de relógio/histórico). A rota direta é `/financeiro/ca-historico`.

A tela é protegida por permissão. É preciso ter o acesso **`ferramentas financeiro_historico_ca`** (ferramenta financeira "Histórico", ação **ver**). Sem essa permissão a API responde "Sem permissão" e o item nem aparece no menu.

## Passo a passo

### Consultar o histórico de um período

1. Entre em **Ferramentas Financeiras → Histórico CA**.
2. Confirme que o **bar selecionado** (no seletor de bar do topo do sistema) é o que você quer auditar — a tela sempre filtra pelo bar ativo.
3. A tela já abre com os **últimos 30 dias** carregados por padrão.
4. Ajuste a **data inicial** e a **data final** nos dois campos de calendário no canto superior direito. A busca recarrega sozinha ao mudar as datas.
5. Consulte os **quatro cards** no topo (Receitas, Despesas, Líquido e Lançamentos) para o resumo do período e a **tabela** abaixo para os lançamentos individuais.

### Filtrar por origem

1. Use o seletor **"Todas as origens"** no topo direito e escolha uma origem específica (Consumação, Imposto, Bonificação, Stone etc.). A lista recarrega mostrando só aquela origem.
2. Alternativamente, clique em um dos **chips/pílulas de origem** que aparecem logo abaixo dos cards. Cada chip mostra o nome da origem e a **quantidade** de lançamentos daquela origem no período.
3. Clicar num chip já ativo (ou voltar o seletor para "Todas as origens") **limpa o filtro** e volta a mostrar todas as origens.

### Conferir quem e quando lançou

1. Na tabela, olhe a coluna **Lançado** (última à direita). Ela mostra a data e a hora em que o Zykor registrou o envio ao Conta Azul.
2. Logo abaixo da data, quando disponível, aparece **quem** originou o lançamento (usuário ou processo responsável).

## Colunas e cálculos

Todos os dados vêm da view **`financial.v_ca_lancamentos_zykor`**, que unifica os logs de envio ao Conta Azul de cada fluxo num formato comum. Abaixo, os cards de resumo e as colunas da tabela.

### Cards de resumo (topo)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Receitas** | Total de entradas lançadas no Conta Azul no período/filtro | Soma do `valor` de todos os lançamentos com `sinal = RECEITA`, arredondado a 2 casas | `financial.v_ca_lancamentos_zykor` |
| **Despesas** | Total de saídas lançadas no período/filtro | Soma do `valor` de todos os lançamentos com `sinal = DESPESA`, arredondado a 2 casas | `financial.v_ca_lancamentos_zykor` |
| **Líquido** | Saldo do período | `total_receita − total_despesa` (calculado na tela) | derivado dos dois cards |
| **Lançamentos** | Quantidade de lançamentos no período/filtro | Contagem de linhas retornadas (`total`) | `financial.v_ca_lancamentos_zykor` |

### Chips de origem

| Elemento | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Chip por origem** | Nome amigável da origem + contagem | Agrupa os lançamentos por `origem`; o número é a contagem `n` de lançamentos daquela origem no período | `financial.v_ca_lancamentos_zykor` |

### Tabela de lançamentos

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Competência** | Data de competência do lançamento (dd/mm/aaaa) | Campo `competencia` da view. A definição varia por origem (ver seção "Origens" abaixo): fechamentos usam a competência do fechamento; entradas/saídas de dinheiro usam `dt_gerencial`; Sympla usa `dt_evento`; Stone usa `data_venda` | `v_ca_lancamentos_zykor.competencia` |
| **Origem** | De qual fluxo veio o lançamento (pílula) | Campo `origem`, traduzido por um mapa de rótulos (ex.: `consumacao` → "Consumação", `saida_dinheiro` → "Saída Dinheiro") | `v_ca_lancamentos_zykor.origem` |
| **Descrição** | Texto descritivo do lançamento | Campo `descricao` da view (montado por origem — ex.: "Bonificação {fornecedor}", "Dinheiro recebido", "Stone {natureza}") | `v_ca_lancamentos_zykor.descricao` |
| **Categoria** | Categoria financeira no Conta Azul (ou "—") | Campo `categoria` da view. Vem da categoria do fechamento, da categoria de receita/despesa da bonificação, ou de um rótulo fixo ("Dinheiro", "Sympla", natureza Stone). Saídas de dinheiro não têm categoria | `v_ca_lancamentos_zykor.categoria` |
| **Valor** | Valor do lançamento, com sinal | Campo `valor`. Exibido com **+** e em verde quando `sinal = RECEITA`, e com **−** em vermelho quando `sinal = DESPESA` | `v_ca_lancamentos_zykor.valor` / `sinal` |
| **Lançado** | Data/hora do envio ao Conta Azul + quem | Campo `quando` (data e hora), com `criado_por` exibido logo abaixo quando existe. `quando` corresponde ao `created_at`/momento de lançamento do log de cada origem | `v_ca_lancamentos_zykor.quando` / `criado_por` |

> Observação: a view também traz os campos `ca_protocol_id` e `ca_status` (protocolo e status do lançamento no Conta Azul). Eles são carregados pela API mas **não têm coluna própria na tabela** desta tela.

## Filtros e opções

| Filtro | Efeito |
|---|---|
| **Bar** | Automático pelo bar selecionado no topo do sistema. Todas as somas e a lista são filtradas por `bar_id`. Não há como ver dois bares juntos. |
| **Data inicial / Data final** | Definem o período. O filtro é por **competência** (`competencia >= de` e `competencia <= ate`), não pela data de envio ao Conta Azul. Padrão: últimos 30 dias. |
| **Origem (seletor)** | Restringe a lista e os totais a uma única origem. As origens disponíveis no seletor são: Variação Estoque, Consumação, Imposto, Ajuste Virada, Bonificação, Entrada Dinheiro, Saída Dinheiro, Sympla e Stone. |
| **Chips de origem** | Mesmo efeito do seletor, em um clique. Clicar de novo no chip ativo remove o filtro. |

Qualquer mudança em data ou origem **recarrega os dados automaticamente** (não há botão "buscar").

## Origens e o significado de cada linha

A view unifica sete fluxos. Entender cada um ajuda a interpretar competência, sinal e categoria:

- **Fechamentos** (`variacao_estoque`, `consumacao`, `imposto`, `ajuste_virada`): vêm do log de lançamento manual do fechamento (`lancamento_manual_ca_log`). Trazem o `sinal`, a competência e a categoria já definidos no fechamento.
- **Bonificação** (`bonificacao`): cada bonificação lançada gera **duas linhas** — uma perna **RECEITA** (competência de receita) e uma perna **DESPESA** (competência de despesa). Só aparecem as pernas que **realmente foram lançadas** no Conta Azul (têm protocolo).
- **Entrada Dinheiro** (`entrada_dinheiro`): dinheiro recebido no caixa (ContaHub). Sempre **RECEITA**, categoria "Dinheiro", competência = `dt_gerencial`.
- **Saída Dinheiro** (`saida_dinheiro`): sangria/saída do caixa. Sempre **DESPESA**, sem categoria, competência = `dt_gerencial`.
- **Sympla** (`sympla`): repasse Sympla. **RECEITA**, categoria "Sympla", competência = data do evento.
- **Stone** (`stone`): recebíveis/taxas Stone. O **sinal** é decidido automaticamente: se a natureza/tipo contiver "desp" ou "taxa" vira **DESPESA**, senão **RECEITA**. Competência = `data_venda`.

## Regras e detalhes importantes

- **Sempre por bar.** A view e a API filtram por `bar_id`; a tela nunca mistura bares.
- **Filtro é por competência.** O período seleciona pela data de competência do lançamento, não pela data em que foi enviado ao Conta Azul. Um lançamento com competência antiga que foi enviado hoje só aparece se o período incluir a competência antiga.
- **Só o que foi lançado.** A tela mostra apenas registros que geraram log de envio ao Conta Azul. Bonificações sem protocolo (não lançadas) não aparecem; a perna de receita e a de despesa entram separadamente e só quando cada uma foi lançada.
- **Sinal define cor e soma.** RECEITA soma no card Receitas (verde, com +); DESPESA soma no card Despesas (vermelho, com −). O Líquido é a diferença.
- **Arredondamento.** Os totais de receita e despesa são arredondados a 2 casas decimais no servidor.
- **Ordenação.** Os lançamentos vêm ordenados do mais recente para o mais antigo pela data de envio (`quando`), com desempate pelo protocolo do Conta Azul.
- **Somente leitura.** Não há criação, edição, exclusão nem exportação nesta tela — é um extrato de auditoria.
- **Estado vazio.** Sem lançamentos no período/filtro, a tabela mostra "Nenhum lançamento no período." e os cards ficam zerados.

## Dúvidas frequentes

**Por que um lançamento que fiz não aparece aqui?**
Verifique o período (o filtro é por **competência**, não pela data de envio) e a origem selecionada. Se ainda assim não aparecer, pode ser que o envio ao Conta Azul não tenha gerado log/protocolo — nesse caso ele não entra na view.

**Esta tela lança algo no Conta Azul?**
Não. Ela apenas mostra o que **já foi** lançado. Os lançamentos são criados nas telas de origem (fechamentos, bonificações, entradas/saídas de dinheiro, etc.).

**Por que a bonificação aparece em duas linhas?**
Porque ela tem duas pernas no Conta Azul: uma de **receita** e uma de **despesa**, cada uma com sua competência e categoria. Ambas aparecem separadamente quando lançadas.

**Como o sistema decide se um lançamento Stone é receita ou despesa?**
Automaticamente pela natureza/tipo do movimento: se contiver "desp" ou "taxa" é tratado como **despesa**; caso contrário, como **receita**.

**O Líquido considera tudo?**
Sim, dentro do período e do filtro de origem aplicados: Líquido = total de receitas − total de despesas dos lançamentos exibidos.

**Consigo ver dois bares ao mesmo tempo?**
Não. A tela sempre mostra apenas o bar selecionado no topo. Para comparar, troque o bar e consulte de novo.

## Fonte dos dados

- **View principal:** `financial.v_ca_lancamentos_zykor` — unifica os logs de envio ao Conta Azul.
- **Logs de origem que a view junta:**
  - `financial.lancamento_manual_ca_log` — fechamentos (variação de estoque, consumação, imposto, ajuste de virada).
  - `financial.bonificacoes` — pernas de receita e despesa das bonificações lançadas.
  - `financial.entrada_caixa_ca_log` — entradas de dinheiro (origem ContaHub).
  - `financial.saida_caixa_ca_log` — saídas de dinheiro / sangria.
  - `financial.sympla_ca_log` — repasses Sympla.
  - `financial.stone_ca_lancamento_log` — recebíveis e taxas Stone.
- **API:** `GET /api/financeiro/ca-historico` (parâmetros `bar_id`, `de`, `ate`, `origem`).
- **Integração de destino:** todos os registros representam lançamentos empurrados para o **Conta Azul**, a partir de dados originados em **ContaHub** (dinheiro), **Sympla** e **Stone**, além dos fluxos internos de fechamento e bonificação do Zykor.
