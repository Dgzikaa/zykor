---
title: Checklist de Validação
area: configuracoes
slug: checklist-validacao
route: /checklist-validacao
description: Roteiro guiado de testes para o dono/gestor passear pelo Zykor, marcar o que está certo, anotar o que está errado e exportar o feedback em um arquivo.
order: 90
icon: CheckSquare
---

# Checklist de Validação

## Visão geral

A Checklist de Validação é uma tela de **conferência guiada**: um roteiro pronto de testes que leva o dono ou gestor a passear pelas principais telas do Zykor e responder, em cada uma, uma pergunta simples — "isso aqui bate com a realidade do meu bar?".

A ideia é validar se os números e as telas do sistema fazem sentido antes de confiar cegamente neles. Cada teste diz **o que fazer** (qual tela abrir e o que olhar) e **o que esperar** (o resultado que deveria aparecer se estiver tudo certo). Você marca como feito, anota o que achou estranho e, no fim, exporta tudo num arquivo para mandar de volta ao time de produto.

Ponto importante: **esta tela não calcula nada e não puxa dado de nenhuma tabela**. A lista de testes é fixa, escrita direto no código. O único dado que ela guarda é o seu progresso e as suas anotações — e isso fica salvo apenas no **navegador que você está usando** (armazenamento local), não no banco de dados nem na nuvem. Se você trocar de computador ou limpar o navegador, o progresso não vai junto.

Quem usa: o dono e o time que está validando o sistema, tipicamente ao longo de 3 a 5 dias, marcando os itens aos poucos.

## Como acessar

No menu lateral: **Configurações → Checklist Validação**.

- **Permissão necessária:** módulo `configuracoes`. É a mesma permissão do restante da área de Configurações (Notificações, Bares, Integrações, Administração, Auditoria etc.). Sem essa permissão, o item nem aparece no menu.
- A tela **não depende do bar selecionado** — a lista de testes é a mesma independente de qual bar está ativo no seletor. Vários testes, porém, pedem para você olhar o Ordinário (Ord) ou o Deboche (Deb) especificamente, então na hora de conferir cada tela de destino é você quem escolhe o bar.

## Passo a passo

### Rodar um teste do checklist
1. Abra **Configurações → Checklist Validação**.
2. Escolha uma área (ex.: **Vendas e Operação**) e leia o primeiro teste.
3. Leia o campo **Fazer** — ele diz qual tela abrir e o que olhar.
4. Clique no **link em rosa** logo abaixo do teste (ex.: `/estrategico/desempenho`). Ele abre a tela de destino em uma **nova aba**, para você não perder o checklist.
5. Na tela de destino, confira o resultado contra o campo **Esperar**.
6. Volte para a aba do checklist. Se estiver tudo certo, clique no **círculo à esquerda** do teste para marcá-lo como feito (vira um check verde e o título fica riscado).
7. Se algo destoou, escreva na **caixa de anotação** ("O que deu errado? O que faltou? O que surpreendeu?").

### Testar o Assistente de IA
1. Vá até a área **Assistente IA — perguntas reais**.
2. Cada teste traz uma **pergunta pronta** destacada em rosa (ex.: *"Quanto faturamos no Ordi semana passada?"*).
3. Clique no link `/assistente-zykor` para abrir o assistente.
4. Faça a pergunta exatamente como sugerida (ou copie a frase destacada).
5. Compare a resposta com o campo **Esperar** — se veio o número, o breakdown e o insight esperados, marque o teste.

### Anotar um problema
1. Em qualquer teste, escreva na caixa de texto o que percebeu de errado, faltando ou surpreendente.
2. A anotação salva sozinha enquanto você digita. O contador **Com nota** no topo aumenta.
3. Não precisa marcar o teste como feito para a anotação valer — as duas coisas são independentes.

### Exportar o feedback
1. Quando terminar (ou no meio do caminho), clique no botão rosa **Exportar feedback** no topo da tela.
2. O navegador baixa um arquivo `.md` com o nome `checklist-zykor-AAAA-MM-DD.md` (a data de hoje).
3. Esse arquivo lista, área por área, cada teste com ✅ (feito) ou ⬜ (não feito) e a anotação (📝) embaixo, quando houver.
4. Envie o arquivo para o time de produto — é ele que será lido para priorizar correções.

### Retomar depois
- O progresso e as anotações ficam salvos automaticamente no navegador. Basta reabrir a tela **no mesmo navegador/computador** para continuar de onde parou.

## Abas e seções

A tela não tem abas. O conteúdo é dividido em **6 áreas temáticas**, cada uma um bloco com seus testes:

| Área | Emoji | Testes | Foco |
|---|---|---|---|
| Vendas e Operação | 💰 | 4 | Faturamento, mapa de calor, performance de garçom e combos |
| Clube Ordi | 👑 | 4 | Distribuição de níveis RFM, top clientes, clientes em queda e no-show |
| Instagram | 📱 | 2 | Reels e demografia do público |
| Auditoria/Integridade | 🛡️ | 4 | Alertas de fraude, quality scorecard, previsão de demanda e fluxo de caixa 90d |
| Assistente IA — perguntas reais | 🤖 | 4 | Perguntas prontas para testar o assistente de IA |
| Quick wins novos | ⚡ | 3 | Aniversariantes, conciliação de pagamentos e relatório semanal IA |

No topo, antes das áreas, há uma faixa com **três cards** (Progresso, Com nota e o botão Exportar). No rodapé, um aviso lembrando de exportar o feedback ao terminar.

## Colunas e cálculos

Esta tela não tem tabelas de dados nem métricas calculadas a partir do banco. Os únicos "indicadores" são os **contadores de progresso** do topo, calculados a partir do que você marcou/anotou (e guardados no navegador). Abaixo, o que cada elemento mostra e como é obtido:

| Indicador / Elemento | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Progresso** (`feitos/total`) | Quantos testes você já marcou como feitos, sobre o total | Conta os testes com marca de "feito" ÷ total de testes da lista fixa. A barra rosa preenche na proporção `feitos ÷ total × 100%` | Estado local do navegador (localStorage, chave `checklist-validacao-v1`) |
| **Total de testes** | O denominador do progresso | Soma dos testes de todas as áreas da lista fixa no código (atualmente 21 testes) | Constante no código da página |
| **Com nota** | Quantos testes têm alguma anotação escrita | Conta os testes cuja caixa de anotação não está vazia (após remover espaços) | Estado local do navegador |
| **Círculo / check do teste** | Se aquele teste foi conferido | Alterna entre "feito" e "não feito" a cada clique; feito risca o título e pinta o cartão de verde | Estado local do navegador |
| **Fazer** (📋) | O passo a passo do teste — que tela abrir e o que olhar | Texto fixo de cada teste | Constante no código |
| **Esperar** (✅) | O resultado esperado se estiver tudo certo | Texto fixo de cada teste | Constante no código |
| **Link do teste** | Atalho para a tela de destino | URL fixa de cada teste; abre em nova aba | Constante no código |
| **Pergunta do assistente** (💬) | A frase pronta para testar a IA (só na área Assistente IA) | Texto fixo, aparece destacado em rosa | Constante no código |
| **Caixa de anotação** | O texto livre que você escreve sobre o teste | Digitado por você; salvo enquanto digita | Estado local do navegador |
| **Arquivo exportado** (.md) | Resumo do checklist com marcações e notas | Gerado na hora a partir do estado local: monta um markdown com ✅/⬜ por teste e 📝 com a nota | Estado local do navegador |

Observação: os **valores de referência que aparecem no texto** de cada teste (por exemplo "Ord ~25 diamante / ~327 ouro", "~85 reels", "Deb caiu pra 76-78 em S20-21", "Corpus Christi ajuste 0.55x") são **exemplos escritos manualmente** no roteiro para orientar a conferência. Eles **não** são puxados ao vivo do banco — servem apenas como parâmetro do que você deveria encontrar ao abrir a tela real.

## Filtros e opções

A tela **não tem filtros** (nem de bar, nem de período, nem de categoria). É um roteiro estático. As únicas ações disponíveis são:

- **Marcar/desmarcar** um teste (clique no círculo).
- **Anotar** um teste (caixa de texto).
- **Abrir a tela de destino** (link em nova aba).
- **Exportar feedback** (baixa o `.md`).

## Regras e detalhes importantes

- **Nada é filtrado por `bar_id`** aqui, porque a tela não consulta dados. O bar entra em jogo só quando você abre as telas de destino de cada teste.
- **Persistência é só local.** Progresso e notas ficam em `localStorage` (chave `checklist-validacao-v1`). Consequências: não sincroniza entre dispositivos, não vai para o banco, e some se você limpar os dados do navegador ou usar aba anônima.
- **Marcar como feito e anotar são independentes.** Você pode anotar sem marcar, e marcar sem anotar. Os dois contadores do topo contam coisas diferentes.
- **A lista é 100% fixa (hardcoded).** Para incluir, remover ou mudar um teste, é preciso alterar o código da página — não há cadastro pela interface.
- **Os links abrem em nova aba** (`target="_blank"`) de propósito, para você conferir a tela sem perder o checklist.
- **O arquivo exportado só contém título, marcação e nota** — não inclui os textos de "Fazer" e "Esperar", para ficar enxuto como feedback.
- **A contagem de tela vs. real:** o subtítulo da página menciona "22 testes", mas a lista atual soma 21 (a área Instagram tem os testes `ig1` e `ig3`, sem `ig2`). É apenas um detalhe do texto — o contador de progresso usa o total real da lista.

## Dúvidas frequentes

**Meu progresso sumiu, por quê?**
O progresso é salvo só no navegador atual. Se você limpou o histórico/dados do site, trocou de computador ou usou aba anônima, ele se perde. Não há backup no servidor.

**Preciso escolher um bar antes de usar?**
Não para a checklist em si. Mas vários testes pedem para olhar o Ordinário ou o Deboche na tela de destino — lá, sim, escolha o bar correto.

**Os números que aparecem no texto do teste são os do meu bar hoje?**
Não. São valores de referência escritos como exemplo, para você saber o que esperar. Os números reais estão nas telas de destino que os links abrem.

**Marquei um teste sem querer, dá para desfazer?**
Sim. Clique de novo no círculo para desmarcar. O estado alterna a cada clique.

**Para que serve o botão Exportar feedback?**
Ele gera um arquivo `.md` com tudo que você marcou e anotou, para você enviar ao time de produto. É a forma de transformar sua conferência em uma lista de correções priorizáveis.

**Consigo adicionar meus próprios testes?**
Não pela tela. A lista é fixa no código; novos itens só entram via alteração de código.

## Fonte dos dados

Esta tela **não consome nenhuma tabela, view ou função do banco**, nem integrações externas (ContaHub, NIBO, Conta Azul, Stone, Yuzer, Sympla etc.). Todo o conteúdo é estático:

- **Lista de testes:** constante `CHECKLIST` no arquivo `frontend/src/app/checklist-validacao/page.tsx`.
- **Progresso e anotações:** armazenamento local do navegador (`localStorage`, chave `checklist-validacao-v1`).
- **Telas de destino** que os testes mandam validar (essas, sim, têm suas próprias fontes de dados, documentadas em seus próprios artigos): Desempenho, Mapa de Calor Vendas, Performance Garçom, Combos, Clube Ordi, Clientes em queda, No-Show, Reels, Demografia (Instagram), Integridade, Quality Scorecard, Previsão de Demanda, Fluxo de Caixa 90d, Assistente Zykor, Aniversariantes, Conciliação de Pagamentos e Relatório Semanal IA.
