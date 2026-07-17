---
title: DRE — Categorias
area: relatorios-financeiros
slug: dre-categorias
route: /financeiro/dre
description: Aba "Categorias" dentro da DRE — agrupa as categorias do Conta Azul por grupo-pai e define a macro da DRE que os filhos herdam automaticamente.
order: 15
icon: FolderTree
---

# DRE — Categorias

## Visão geral

A aba **Categorias** dentro da **DRE** (chamada no sistema de "Central de Categorias") é onde você organiza o plano de contas do **Conta Azul** para que ele se encaixe na DRE do Zykor. As categorias de lançamento financeiro do Conta Azul chegam ao sistema em forma de árvore: cada categoria tem um **grupo-pai** (o nó de nível acima). Aqui você dá um **nome** a cada grupo-pai e escolhe a **macro da DRE** (Receita, Custo insumos, Mão-de-Obra, etc.). Feito isso, **todos os filhos daquele grupo herdam a macro** — inclusive categorias novas que forem criadas depois no Conta Azul sob o mesmo pai.

O objetivo é acabar com o trabalho manual de mapear categoria por categoria. Em vez de classificar dezenas de categorias uma a uma, você classifica o grupo e o sistema propaga.

Quem usa: dono, financeiro e quem cuida do fechamento contábil e da DRE.

## Como acessar

- Menu lateral: **Relatórios Financeiros → DRE**, aba **"Categorias"**.
- Rota: `/financeiro/dre` (aba **Categorias**).
- Permissão necessária: módulo **`financeiro_relatorios`** (mesmo da DRE). Essa checagem também protege a API de gravação `/api/financeiro/categorias`.

## Passo a passo

### Nomear um grupo e definir a macro da DRE

1. Selecione o **bar** no seletor do topo (todos os dados são filtrados por bar).
2. Escolha o **ano** no seletor superior direito (o total de cada categoria é somado por ano).
3. Cada cartão da lista é um **grupo-pai** do Conta Azul. Clique na seta (`>`) à esquerda para **expandir** e ver as categorias-filhas.
4. No campo de texto do cartão, digite o **nome do grupo** (a API do Conta Azul não expõe o nome do nó-pai, por isso você mesmo nomeia).
5. No seletor **"— macro da DRE —"**, escolha a macro correta (ex.: Receita, Custo insumos (CMV), Mão-de-Obra). Escolha **🚫 Fora da DRE** para o grupo não entrar na DRE.
6. Clique em **Salvar**. O sistema grava o grupo e imediatamente **expande a macro para todos os filhos ainda não mapeados**. O contador ao lado mostra "N filhos" e o total do grupo no ano.

### Trocar o ano de referência

1. Use o seletor de ano no canto superior direito (oferece o ano atual e os dois anteriores).
2. A lista recarrega e a coluna **Total** passa a somar os lançamentos daquele ano.

### Identificar categorias soltas

1. Procure o cartão amarelo **"Sem grupo (pai)"** (com ícone de alerta). Ele reúne categorias que não têm grupo-pai no Conta Azul.
2. Esse balde não pode ser nomeado nem receber macro em bloco — as categorias dentro dele precisam ser tratadas individualmente no de-para da DRE.

## Colunas e cálculos

Cada grupo mostra um cabeçalho (nome, macro, contagem de filhos e total) e, ao expandir, uma tabela com uma linha por categoria-filha.

### Cabeçalho do grupo

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome do grupo | Nome editável do grupo-pai | Valor salvo por você; herança do `nome_grupo` gravado | `meta.categoria_grupo.nome_grupo` |
| Macro da DRE | Macro escolhida no dropdown | Valor salvo por você (uma das macros fixas ou "Fora da DRE") | `meta.categoria_grupo.dre_macro` |
| N filhos | Quantidade de categorias sob o grupo | Contagem das categorias-filhas retornadas para aquele pai | `bronze.bronze_contaazul_categorias` |
| Total do grupo | Soma financeira do grupo no ano | Soma do `total` de todos os filhos do grupo | soma de `mov.total` (ver abaixo) |

### Tabela de categorias (ao expandir)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Categoria | Nome da categoria-filha no Conta Azul | Campo `nome` da categoria ativa | `bronze.bronze_contaazul_categorias.nome` |
| Total {ano} | Movimento financeiro da categoria no ano selecionado | Soma dos lançamentos: `sum(coalesce(nullif(valor_bruto,0), valor_pago))`, arredondado a 2 casas, filtrado por bar, ano de `data_competencia` e ignorando lançamentos excluídos (`excluido_em is null`). Exibido como `–` quando zero | `bronze.bronze_contaazul_lancamentos` |
| DRE atual | Como a categoria está classificada hoje na DRE | Busca a macro no de-para da DRE casando pelo nome normalizado (`normcat`), preferindo regra específica do bar sobre regra global. Verde = mapeada; "não mapeada" (âmbar) = sem regra; "fora da DRE" = macro `IGNORAR` | `financial.dre_categoria_macro` |
| Orç | Se a categoria já está no de-para de Orçamentação | `✓` se existe correspondência por nome normalizado no mapa de Orçamentação (bar específico ou global); senão `–` | `meta.categoria_zykor_map` |
| DFC | Se a categoria já está no de-para do DFC | `✓` se existe correspondência por nome normalizado no mapa do DFC (bar específico ou global); senão `–` | `meta.categoria_dfc_map` |

Observações sobre o cálculo:

- **Total por competência.** A soma usa o ano de `data_competencia` (regime de competência), não de pagamento.
- **Valor considerado.** Usa `valor_bruto` quando ele é diferente de zero; caso contrário cai no `valor_pago`. O sinal (positivo/negativo) vem do próprio lançamento — por isso despesas aparecem negativas.
- **DRE atual usa nome, não ID.** O casamento com a DRE é feito pelo **nome normalizado** da categoria (`normcat`), que ignora acentuação e caixa. Se duas categorias tiverem o mesmo nome, elas caem na mesma regra.

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| Bar (seletor global) | Toda a árvore, os totais e os mapeamentos são por `bar_id`. Trocar de bar recarrega tudo. |
| Ano | Define o ano da soma da coluna **Total**. Opções: ano atual e os dois anteriores. Não altera a estrutura da árvore, só os valores. |
| Expandir / recolher grupo | Mostra ou esconde a tabela de categorias-filhas de cada grupo. |
| Campo de nome + dropdown de macro + Salvar | Grava o grupo e propaga a macro para os filhos. |

A ordenação é automática: dentro de cada grupo os filhos vêm do maior para o menor movimento (em módulo); os grupos com mais movimento aparecem primeiro e o balde "Sem grupo (pai)" fica por último.

## Regras e detalhes importantes

- **Filtragem por bar.** Nada aqui é global do ponto de vista de exibição: árvore, totais e mapeamentos respeitam o bar selecionado.
- **Herança pelo pai.** Ao salvar a macro de um grupo, a função `aplicar_grupos_dre` insere no de-para da DRE **apenas os filhos que ainda não têm mapeamento**. Categorias novas criadas depois no Conta Azul, sob um pai já mapeado, entram automaticamente na próxima aplicação.
- **Mapeamento manual sempre vence.** Se uma categoria já tiver uma regra direta no de-para da DRE, a herança do grupo **não sobrescreve** — o mapeamento específico prevalece.
- **Só categorias ativas.** A árvore lista apenas categorias com `ativo = true` no Conta Azul.
- **"Fora da DRE" (IGNORAR).** Escolher essa opção marca o grupo para não entrar na DRE. Na coluna DRE atual, categorias com macro `IGNORAR` aparecem como "fora da DRE".
- **Regra específica do bar vence a global.** Nos de-paras (DRE, Orçamentação, DFC) a busca prefere a regra do próprio bar; se não houver, usa a regra global (`bar_id is null`).
- **Ordem na DRE.** Ao salvar, o sistema também guarda a ordem da macro (menor `ordem_macro` existente para aquela macro), para posicionar o grupo corretamente na DRE.
- **Estado vazio.** Total zero é exibido como `–`. Grupos sem nome/macro aparecem, mas seus filhos ficam como "não mapeada" na coluna DRE atual.
- **Manual vs automático.** O **nome do grupo** e a **macro** são manuais (você define). A **propagação para os filhos** e o **recálculo dos totais** são automáticos.

## Dúvidas frequentes

**Preciso classificar cada categoria uma por uma?**
Não. Classifique o **grupo-pai** e a macro se propaga para todos os filhos. É esse o propósito da tela.

**Cadastrei uma categoria nova no Conta Azul e ela sumiu da DRE. E agora?**
Se ela ficou sob um grupo-pai já mapeado, ela é classificada automaticamente na próxima aplicação. Se caiu no balde "Sem grupo (pai)", trate-a individualmente.

**Por que eu preciso digitar o nome do grupo?**
Porque a API do Conta Azul não expõe o nome do nó-pai — só o identificador. O nome que você digita serve para você reconhecer o grupo na tela e na DRE.

**Mudei a macro de um grupo mas uma categoria continuou na macro antiga. É bug?**
Não. Se aquela categoria já tinha um mapeamento manual direto, ele prevalece sobre a herança do grupo. Ajuste-a no de-para da DRE se quiser mudar.

**O que significam as marcas ✓ nas colunas Orç e DFC?**
Que a categoria já está mapeada nos de-paras de Orçamentação e do DFC, respectivamente. São indicadores de cobertura — ajudam a ver o que ainda falta mapear nesses outros relatórios.

**O Total muda se eu trocar o ano?**
Sim. O total soma os lançamentos por ano de competência. Trocar o ano no seletor recarrega os valores; a estrutura de grupos permanece.

## Fonte dos dados

- **Integração de origem:** Conta Azul (categorias e lançamentos financeiros).
- **Função de leitura:** `meta.get_categorias_arvore(p_bar, p_ano)` — monta a árvore, os totais e os indicadores de cobertura.
- **Função de gravação:** `meta.set_categoria_grupo(p_bar, p_pai, p_nome, p_macro)` — salva o grupo e chama `meta.aplicar_grupos_dre(p_bar)` para propagar aos filhos.
- **Tabelas:**
  - `bronze.bronze_contaazul_categorias` — árvore de categorias do Conta Azul (pai, nome, tipo, ativo).
  - `bronze.bronze_contaazul_lancamentos` — lançamentos usados para o total por competência.
  - `meta.categoria_grupo` — nome e macro por grupo-pai (mapeamento salvo nesta tela).
  - `financial.dre_categoria_macro` — de-para da DRE (macro por categoria); origem da coluna "DRE atual".
  - `meta.categoria_zykor_map` — de-para de Orçamentação (coluna "Orç").
  - `meta.categoria_dfc_map` — de-para do DFC (coluna "DFC").
- **Função auxiliar:** `public.normcat(nome)` — normaliza o nome (sem acento/caixa) para casar categorias entre os de-paras.
- **API:** `GET`/`POST` em `/api/financeiro/categorias`.
