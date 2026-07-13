---
title: Planejamento da Produção
area: producao-cmv
slug: plano-producao
route: /operacional/plano-producao
description: Sugere quanto produzir de cada preparo da semana pelo Ponto de Ressuprimento (estoque + histórico de saída) e transforma as decisões da reunião em calendário para o Controle de Produção.
order: 100
icon: CalendarDays
---

# Planejamento da Produção

## Visão geral

A tela **Planejamento da Produção** é onde a equipe decide, uma vez por semana, **o que produzir na cozinha e no bar, em que quantidade e em quais dias**.

Para cada preparo (item de produção), o sistema calcula uma **sugestão de quanto produzir** com base em dois fatores:

1. **Quanto o preparo costuma "sair"** — ou seja, quanto dele é consumido indiretamente através da venda dos pratos que o usam (uso indireto), olhando as últimas 6 semanas.
2. **Quanto tem em estoque hoje** — a última contagem do início da semana.

A partir disso, a tela mostra um **Ponto de Ressuprimento (PR)** — o nível de estoque abaixo do qual você precisa repor — e uma **Sugestão** em receitas (ex.: "3 receitas ≈ 12 kg"). Na reunião de planejamento, o gestor ajusta a sugestão, distribui a produção pelos dias da semana e **encerra** o plano. Ao encerrar, tudo que tem dia definido vira a **calendarização** que aparece na tela *Executar* do **Controle de Produção**.

É a ferramenta de quem planeja a operação: chef, gerente de produção e sócios. O modelo de cálculo reproduz a planilha de reposição usada pelo sócio (Ponto de Ressuprimento com nível de serviço).

## Como acessar

No menu lateral: **Operacional → Planejamento da Produção** (ícone de calendário), rota `/operacional/plano-producao`.

A tela exige a permissão de módulo **`gestao`**. Quem tem acesso apenas de leitura vê o selo **"Somente leitura"** no topo e consegue consultar os números, mas as ações de escrita (iniciar, decidir, encerrar) são bloqueadas pelo servidor.

Como toda tela do Zykor, os dados são sempre filtrados pelo **bar selecionado** no seletor de bar. Trocar de bar recarrega o planejamento daquele bar.

## Passo a passo

### 1. Escolher a semana

No topo, o seletor **"Semana"** lista as semanas que já têm contagem de estoque fechada, mais a próxima semana (que fica bloqueada com a marca "aguardando contagem"). O sistema abre por padrão na **semana mais recente com contagem** — que é a única que pode ser planejada. Semanas anteriores ficam disponíveis apenas para **consulta**.

O selo verde **"Contagem: DD/MM"** confirma que a contagem do início da semana existe. Se aparecer **"Contagem: pendente"** em vermelho, não há contagem para aquela semana e o estoque virá zerado — não dá para iniciar o planejamento.

### 2. Escolher a aba (Cozinha ou Bar)

Logo abaixo do resumo há duas abas: **Cozinha** e **Bar**. Cada uma tem seu próprio plano, independente. A separação é automática pelo código do preparo (códigos que começam com **PD** vão para o Bar; o restante para a Cozinha).

### 3. Iniciar o planejamento

Com a semana ativa e a contagem OK, clique em **"Iniciar planejamento (Cozinha)"** (ou Bar). Isso cria um rascunho da sessão daquela área. A partir daí surgem as colunas extras **Decidido** e **Dia**.

### 4. Ajustar os parâmetros de cada preparo (opcional)

Para cada linha você pode:
- Mudar o **Nível de Serviço** (quanto mais alto, mais folga de segurança no PR).
- Mudar a **Qtde x Semanas** (quantas semanas de receita produzir de uma vez).

Essas configurações ficam **salvas por preparo** e valem para as próximas semanas (não se perdem ao encerrar).

### 5. Decidir a quantidade

Na coluna **Decidido**, ajuste o número de receitas que a equipe realmente vai produzir. Por padrão ele já vem preenchido com a sugestão. Se você digitar um valor diferente da sugestão, o campo fica **destacado em âmbar** e aparece um campo para escrever o **motivo do override** (por que fugiu da sugestão).

### 6. Distribuir por dia

Clique no botão **"+ dias"** (coluna **Dia**) para abrir o modal. Marque em quais dias da próxima semana produzir e informe **quantas receitas em cada dia** (ex.: pastel Seg 2 · Ter 3). O total da semana passa a ser a **soma dos dias**. Quando há distribuição por dia, o campo **Decidido** fica travado — o total é definido pelos dias.

### 7. Encerrar e calendarizar

Com tudo decidido, clique em **"Encerrar e calendarizar"**. Isso:
- **Congela** todos os números da área (vira uma foto que não recalcula mais).
- Envia os itens com dia definido para a **calendarização** do Controle de Produção — aparecem na tela *Executar* no respectivo dia.

Se precisar corrigir, use **"Reabrir"** (volta para rascunho) ou, para descartar tudo, **"Cancelar planejamento"** (apaga o plano e as decisões daquela área e semana).

### 8. Atualizar

O botão **"Atualizar estoque"** (canto superior direito) recarrega a contagem e recalcula as sugestões ao vivo.

## Abas e seções

| Aba | O que mostra |
|---|---|
| **Cozinha** | Preparos cuja produção é da cozinha (código não começa com PD). Plano próprio. |
| **Bar** | Preparos de bar/drinks — códigos que começam com **PD**. Plano próprio, independente da Cozinha. |

Cada aba tem seu próprio ciclo (iniciar → decidir → encerrar) e pode estar em estado diferente da outra (ex.: Cozinha encerrada, Bar ainda em rascunho).

Há ainda uma **linha expansível** por preparo: ao clicar no valor da **Média 6s**, abre-se a lista das 6 semanas que formam a média, cada uma com seu valor e peso (semanas em branco aparecem riscadas, fora do cálculo).

## Colunas e cálculos

Os valores são exibidos na **unidade de contagem** do preparo (kg, L, unid etc.). "rend/receita" abaixo do nome é quanto uma receita rende naquela unidade.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Produção** (nome, código, curva A) | Nome do preparo, código e o quanto rende por receita | Cadastro do preparo. Selo **A** = curva A. O ponto colorido liga/desliga o item no Controle de Produção. `rend/receita = rendimento ÷ fator de contagem` | `producao_base` |
| **Uso Indireto** | Quanto do preparo saiu (foi consumido via vendas) na **última** das 6 semanas | Último valor do vetor de saídas semanais | `fn_plano_producao` (saídas) |
| **Média 6s** | Média ponderada do uso indireto das 6 semanas | Média **ponderada por recência**: `Σ(saída_semana × peso) ÷ Σ(peso)`, onde o peso cresce da semana mais antiga (1) até a mais recente (6). **Semanas em branco (saída 0) ficam de fora** | `fn_plano_producao` + cálculo no servidor |
| **Desv. padrão** | Dispersão do uso indireto entre as 6 semanas | Desvio padrão **amostral** das 6 saídas: `√(Σ(v−média)² ÷ (n−1))`, com n = 6 semanas | Cálculo no servidor |
| **Nível de Serviço** | Fator de segurança escolhido (%) | Editável (50% a 99,9%; padrão **95%**). Converte para um **fator de serviço** (z-score da normal): 90%→1,282; 95%→1,645; 98%→2,055; 99%→2,325 etc. | `producao_plano_config` |
| **Qtde x Semanas** | Quantas semanas de receita produzir de uma vez | Editável (padrão **1**). Cada semana extra repõe uma **Média 6s** a mais (não um PR cheio) | `producao_plano_config` |
| **PR** (Ponto de Ressuprimento) | Nível de estoque a partir do qual repor | `PR = Média 6s + Desv. padrão × fator de serviço` | Cálculo (ao vivo) |
| **Estoque Atual** | Estoque no início da semana planejada | Estoque final da **contagem mais antiga** dentro da semana planejada `[segunda, segunda+7)`. Sem contagem = 0 | `silver.estoque_contagem` |
| **Dias de Estoque** | Por quantos dias o estoque atual cobre o consumo | `Estoque ÷ (Média 6s ÷ 6)` — ritmo diário. Fica **vermelho quando < 3 dias** | Cálculo |
| **Qtde p/ pais** (consumo) | **Aviso**: quanto deste preparo a produção planejada dos preparos "pais" vai consumir | Cascata pela ficha técnica: `Σ (receitas planejadas do pai × qtd do filho por receita)`. Um "⚠" aparece se `consumo > estoque + produção planejada` (falta cobrir os pais). **Não altera a sugestão** | Ficha técnica (`producao_ficha_item`) |
| **Sugestão** (receitas ≈ qtd) | Quanto o sistema recomenda produzir | Ver "Lógica da Sugestão" abaixo. Se não precisa produzir, mostra **"Não produzir"** | Cálculo |
| **Decidido** *(só em planejamento)* | Receitas que a equipe decidiu produzir | Editável; padrão = sugestão. Diferença da sugestão fica **âmbar** e pede motivo. Travado quando há distribuição por dia | `producao_plano_item` |
| **Dia** *(só em planejamento)* | Dias em que o preparo será produzido | Botão que abre o modal de distribuição por dia (receitas por dia). Resumo mostra "Seg 2 · Ter 3" ou "N dias" | `producao_plano_item_dia` |

### Lógica da Sugestão

O cálculo da sugestão (idêntico entre tela e servidor) é:

1. **Gap** = `PR − Estoque Atual`.
2. **Aporte de estoque (AE)**:
   - Se `gap < 0` (estoque acima do PR): `AE = gap` (negativo → não produzir).
   - Se `gap ≥ 0`: `AE = gap + Média 6s × (Qtde x Semanas − 1)` — cada semana extra soma uma Média 6s.
3. **Não produzir** quando `AE ≤ 0`.
4. **Receitas sugeridas** = `arredonda para cima (AE ÷ rendimento por receita)`.
5. **Quantidade sugerida** = `receitas × rendimento por receita`.

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| **Semana** (seletor) | Escolhe qual semana planejar/consultar. Só a mais recente com contagem é planejável; as demais são consulta. |
| **Aba Cozinha / Bar** | Alterna entre os dois planos. Filtra os preparos por código (PD = Bar). |
| **Busca "Buscar produção…"** | Filtra por nome ou código do preparo. |
| **Todos / Produzir / Não produzir** | Mostra tudo, só o que o sistema recomenda produzir, ou só o que não precisa produzir. |
| **Sem dia** | Toggle que mostra só os itens **ainda sem dia cadastrado**. Combina com o filtro ao lado (ex.: Produzir + Sem dia = o que falta agendar). |

Além dos filtros, o topo mostra badges de contexto: **eventos/feriados** da semana (que podem justificar produzir mais) e o status da **contagem**.

O bloco de resumo traz três números: **Produções a fazer** (quantas linhas não são "Não produzir"), **Receitas sugeridas / decididas** (total de receitas — sugerido fora do planejamento, decidido durante) e **Itens no plano** (linhas visíveis após os filtros).

## Regras e detalhes importantes

- **Só aparece o que está no Controle de Produção.** A tela lista apenas preparos com a flag `controle_producao` ligada (o ponto colorido na coluna Produção liga/desliga). Preparos fora do controle não entram no planejamento.
- **Filtragem por bar.** Todo o cálculo é feito para o bar selecionado; contagem, vendas, config e planos são sempre por `bar_id`.
- **Estoque preso ao início da semana.** Planejar 29/06–05/07 usa obrigatoriamente a contagem a partir de 29/06. Sem essa contagem, o estoque vem 0 e a semana fica "aguardando contagem".
- **Uso Indireto = saída explodida pela ficha técnica.** A saída não é a venda direta do preparo, e sim quanto dele foi consumido indiretamente pelos pratos vendidos, explodindo a ficha técnica (inclusive preparo-dentro-de-preparo, até 6 níveis). Recalcula sempre com a ficha atual.
- **Consumo inclui cortesia.** A saída usa a **quantidade de consumo** (que inclui cortesias / "100% desconto"), não só a venda paga — cortesia também consome insumo e produção. Lançamentos internos do tipo "Insumo" ficam de fora.
- **Média ignora semanas em branco, dá mais peso à recente.** Uma semana sem saída não puxa a média para baixo; ela é desconsiderada. As semanas mais recentes pesam mais.
- **Semana encerrada é foto (read-only).** Ao encerrar, todos os números da área são congelados em snapshot e não recalculam mais, mesmo que a ficha, o estoque ou as vendas mudem depois. Só reabrindo volta a recalcular ao vivo.
- **Override registra motivo.** Quando o Decidido difere da sugestão, o sistema marca `seguiu_sugestao = false` e guarda o motivo — vira histórico da decisão.
- **Distribuição por dia manda no total.** Se um preparo tem receitas por dia, o total (Decidido) é a soma dos dias e o campo direto fica travado. Um dia único é mantido também no campo legado `dia_producao` para compatibilidade.
- **Config é persistente.** Nível de serviço e Qtde x Semanas ficam salvos por preparo e valem nas semanas seguintes.
- **Ao encerrar → Controle de Produção.** Só os itens com dia definido e quantidade > 0 entram na calendarização exibida na tela *Executar* do dia.

## Dúvidas frequentes

**Por que um preparo não aparece na lista?**
Ou ele não está ligado no Controle de Produção (ponto apagado), ou não teve nenhuma saída nas 6 semanas, ou está na outra aba (Cozinha × Bar), ou foi filtrado pela busca/filtros.

**Não consigo iniciar o planejamento — por quê?**
Só a semana mais recente com contagem é planejável, e ela precisa ter a contagem do início fechada. Se o selo mostra "Contagem: pendente", a contagem daquela semana ainda não entrou.

**O que significa "Não produzir"?**
O estoque atual já está acima (ou no) Ponto de Ressuprimento considerando as semanas de cobertura escolhidas — não há necessidade de produzir agora.

**Por que o Decidido ficou amarelo e pede motivo?**
Porque o valor digitado é diferente da sugestão do sistema (override). O motivo fica registrado para explicar a decisão da reunião.

**Mudei a ficha técnica depois de encerrar. A tela atualiza?**
Não. A semana encerrada é uma foto congelada. Para refletir a ficha nova, é preciso reabrir o plano (ou planejar a próxima semana).

**Para que serve a coluna "Qtde p/ pais" com ⚠?**
É um aviso: mostra quanto deste preparo os outros preparos que o usam vão consumir conforme o plano. O ⚠ indica que estoque + produção planejada não cobrem essa demanda dos "pais". Não muda a sugestão — é sinal para você aumentar manualmente.

## Fonte dos dados

- **`gold.fn_plano_producao`** — função SQL que monta os itens ao vivo: explode a ficha técnica, calcula a saída (uso indireto) das 6 semanas, o estoque do início da semana, unidade e rendimento.
- **`gold.fn_semanas_com_contagem`** — semanas que têm contagem de estoque (alimenta o seletor).
- **`silver.estoque_contagem`** — contagens de estoque (origem: contagens do estoque no app / integração de estoque).
- **`silver.vendas_consolidada_dia`** — vendas/consumo diário por produto (origem: **ContaHub**), cruzado com `produto_cardapio`.
- **`public.producao_base`** — cadastro dos preparos (código, rendimento, fator de contagem, curva A, flag de controle de produção).
- **`public.producao_ficha_item`** — fichas técnicas (explosão pai→filho e a cascata de demanda).
- **`operations.producao_plano`** — sessões de planejamento por bar/semana/área (status rascunho/encerrado).
- **`operations.producao_plano_item`** — decisões por preparo + snapshot ao encerrar.
- **`operations.producao_plano_item_dia`** — distribuição da produção por dia.
- **`operations.producao_plano_config`** — nível de serviço e semanas de receita por preparo.
- **`operations.feriados_eventos`** — eventos/feriados da semana exibidos como aviso.
