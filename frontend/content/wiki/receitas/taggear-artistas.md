---
title: Taggear Artistas
area: receitas
slug: taggear-artistas
route: /analitico/atracoes/tagging
description: Tela operacional para vincular os artistas que tocaram em cada evento e casar o cachê pago no Conta Azul ao artista certo, alimentando todas as análises de atração.
order: 70
icon: Tag
---

# Taggear Artistas

## Visão geral

Esta é a tela onde você diz **quem tocou em cada noite**. O sistema sabe o faturamento, o público e quanto foi pago de cachê (via Conta Azul), mas ele não sabe automaticamente qual artista corresponde a cada show nem a cada pagamento. Taggear é justamente amarrar essas pontas: para cada evento do mês, você marca o(s) artista(s) que se apresentaram e confirma que o cachê caiu no artista correto.

Esse trabalho é a base de praticamente todas as análises de atração do Zykor. Sem tag, o painel "Visão do Artista" (`/analitico/atracoes`), os rankings de ROI, o retorno por cachê e a análise por label ficam vazios ou incompletos. Quem usa no dia a dia é normalmente o responsável pela programação/booking ou o dono, geralmente uma vez por mês fechando o histórico de shows.

A tela trabalha **um mês de cada vez** e lista todos os eventos daquele mês, do mais recente para o mais antigo, com um resumo no topo: quantos eventos existem, quantos já foram taggeados e quantos estão pendentes.

## Como acessar

- Menu lateral: **Receitas → Taggear Artistas**.
- Também há um atalho a partir da tela **Visão do Artista** (`/analitico/atracoes`), pelo botão que leva ao tagging.
- **Permissão necessária:** o item exige o módulo `analitico_taggear_artistas`. Sem essa permissão, o item nem aparece no menu. As telas de leitura de atração (Visão do Artista) usam a permissão `relatorios`, mas a edição de tags é separada porque grava dados.

## Passo a passo

### 1. Escolher o mês e ver os pendentes
1. Ao abrir, a tela carrega o mês mais recente com eventos (ou o mês que estava na URL, para sobreviver a um refresh).
2. Use o seletor **Mês** no topo à direita para trocar de período.
3. Clique em **Só pendentes** para esconder os eventos que já têm artista marcado e focar no que falta.
4. Use o campo **buscar** para filtrar por nome do evento ou pelo texto de artista.

### 2. Taggear um artista no evento
1. Localize a linha do evento (data, dia da semana e nome).
2. No campo **+ artista**, comece a digitar. Aparece o autocomplete com o cadastro de artistas do bar.
3. **Enter** cria/aplica o artista (permite nome novo, que é cadastrado na hora). **Clicar fora (blur)** só adiciona se o nome já existe no cadastro — isso evita criar "artista-lixo" a partir de um texto parcial digitado só para buscar.
4. O tipo (banda / dj / solo) é inferido: se o nome já está no cadastro, usa o tipo cadastrado; senão, vira `dj` quando há "dj" no nome, caso contrário `banda`.
5. Cada artista vira um selo (badge). Para remover, clique no **x** do selo.
6. O salvamento é automático a cada mudança. O status à direita mostra **salvando**, **salvo** (check verde) ou **erro**.

### 3. Aceitar a sugestão automática
1. Em eventos ainda sem tag, o sistema tenta adivinhar os artistas a partir do texto livre (campo antigo de artista ou o nome do evento após o hífen).
2. Se houver sugestão, aparece um selo tracejado roxo com os nomes propostos e um ícone de check.
3. Clique nele para **aceitar a sugestão** — os artistas propostos são taggeados de uma vez. Você pode ajustar depois.

### 4. Propagar para eventos iguais
1. Depois de taggear um evento, se existirem outros eventos **com o mesmo nome no mesmo mês**, aparece o botão **iguais**.
2. Clique nele para copiar os mesmos artistas para todos esses eventos. Um aviso confirma a quantidade antes de aplicar. Útil para eventos recorrentes (mesma festa que se repete).

### 5. Conferir e corrigir o pagamento (cachê)
1. Abaixo da linha, quando o dia tem pagamentos de atração no Conta Azul, aparece o painel colapsável **Pagamentos CA** com o total e a quantidade de lançamentos. Ele **abre sozinho** quando há algum pagamento "sem match".
2. Cada linha mostra o favorecido/descrição, o valor e para qual artista o pagamento casou (ou "sem match").
3. Se um pagamento não casou, clique em **corrigir** e:
   - **atribuir a… (mesmo dia):** escolha um artista já taggeado naquela noite — cria um vínculo permanente favorecido → artista.
   - ou escolha o **dia** (show) e o **artista** para apontar aquele pagamento ao evento/artista certo, mesmo que a competência do pagamento caia em outro dia.
4. Um pagamento já ajustado ganha a marca **corrigido**; o botão **desfazer** volta para o casamento automático.

### 6. Registrar horários do show (opcional)
1. Em eventos com artistas do cadastro, aparece o painel colapsável **Horários do show**.
2. Para cada artista, preencha **início**, **fim** e o tempo **combinado** (aceita formatos como `1h30`, `1:30` ou `90`).
3. O sistema calcula a **duração real** (fim − início, tratando virada de meia-noite) e compara com o combinado, mostrando déficit em vermelho ou um check verde quando bate. Cada campo salva ao sair (blur).

## Abas e seções

A tela não tem abas horizontais; é uma lista única de eventos do mês. Cada linha, porém, expande em duas seções auxiliares:

- **Pagamentos CA** — todos os lançamentos de atração do Conta Azul daquele dia, com o casamento a cada artista e os controles de correção. Abre automaticamente quando há pagamento sem match.
- **Horários do show** — início/fim/duração por artista, para alimentar rankings de pontualidade e de tempo de palco.

Há ainda um botão **Normalizar** no topo, que leva à tela `/analitico/atracoes/normalizar` (unificação de nomes duplicados de artistas) — não é parte desta tela, mas é o próximo passo natural quando o cadastro tem grafias repetidas.

## Colunas e cálculos

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Data / dia da semana | Data do evento e dia | Direto do evento, formatado `DD/MM/AAAA` sem conversão de fuso | `eventos_base.data_evento`, `dia_semana` |
| Nome do evento | Nome/título da noite | Direto do campo, com fallback "—" quando vazio | `eventos_base.nome` |
| Faturamento | Faturamento real da noite | Lê `real_r` do evento (número) | `eventos_base.real_r` |
| PAX (público) | Número de clientes | Lê `cl_real` | `eventos_base.cl_real` |
| Ticket | Ticket médio | `faturamento ÷ público`, só quando público > 0 (senão em branco) | derivado |
| Artistas (selos) | Artistas taggeados na noite | Vínculos gravados do evento; tipo resolvido pelo id do cadastro ou pelo nome | `operations.evento_artistas` |
| · Cachê do selo | Valor pago àquele artista | Soma dos lançamentos do CA da noite que casaram com o artista | derivado do CA (ver abaixo) |
| · Selo "principal" (estrela) | Marca o artista de maior cachê | Artista taggeado com o **maior** cachê da noite (cachê > 0) | derivado |
| · Selo vermelho / "sem R$" | Artista sem pagamento atrelado, mas a noite teve cachê | Verdadeiro quando `cachê do artista = 0` **e** `custo de atração total da noite > 0` | derivado |
| Sugestão (selo tracejado) | Palpite de artistas | Parser do texto livre: prioriza o campo antigo `artista`; senão o nome do evento após " - ". Quebra combos ("X e Dj Y", "A, Dj B") em entradas | `eventos_base.artista` / `nome` |
| Principal (nome) | Nome do artista principal | Artista de maior cachê da noite | derivado |
| Cachê do principal | Valor pago ao principal | Soma dos lançamentos casados a ele | derivado do CA |
| % do fat | Peso do cachê no faturamento | `cachê do principal ÷ faturamento`, exibido em % (só com faturamento > 0) | derivado |
| Retorno (Nx) | Quantas vezes o cachê "voltou" | `faturamento ÷ cachê do principal` (só com cachê > 0), exibido como `x.x×` | derivado |
| CA: nome · valor (sem match) | Maior cachê do dia que não casou | Mostrado quando nenhum artista taggeado casou; nome extraído do padrão "banda X" da descrição, senão favorecido/descrição | `bronze_contaazul_lancamentos` |
| atração R$ | Custo total de atração da noite | Soma de todos os lançamentos de atração do CA no dia | `fn_ca_atracao_lancamentos` |
| Status | Estado do salvamento | salvando / salvo / erro após cada edição | — |
| **Pagamentos CA — linha** | | | |
| · Favorecido / descrição | Quem recebeu / o que foi | Favorecido (`pessoa_nome`) e descrição do lançamento | `bronze_contaazul_lancamentos` |
| · Valor | Valor do lançamento | `valor_liquido` do lançamento | `bronze_contaazul_lancamentos` |
| · → artista (match) | Artista a que casou | 1º override "corrigir dia"; 2º de-para favorecido→artista; 3º match por tokens do nome (sem acento) | derivado |
| · "corrigido" | Marca de override manual | Existe um registro de override para o lançamento | `operations.ca_atracao_override` |
| · "sem match" | Pagamento não casou | Nenhuma das 3 regras encontrou artista | derivado |
| **Horários do show — linha** | | | |
| · início / fim | Horário do show por artista | Campos gravados por artista (tipo hora) | `operations.evento_artistas.horario_inicio/fim` |
| · combinado | Duração acordada | Minutos gravados; aceita `1h30`, `1:30`, `90` | `evento_artistas.duracao_combinada_min` |
| · real | Duração efetiva | `fim − início`, tratando virada de meia-noite: `((fim − início) + 1440) mod 1440` | derivado |
| · déficit / check | Cumpriu o combinado? | Vermelho quando `real + 2min < combinado`; check verde caso contrário | derivado |

### Como o cachê casa com o artista

Para cada pagamento de atração do dia (vindo do Conta Azul), o sistema tenta casá-lo com um artista taggeado, nesta ordem:

1. **Correção manual ("corrigir dia"):** se existe um override apontando aquele lançamento para um artista, ele vence.
2. **De-para favorecido → artista:** se você já mapeou aquele favorecido do CA a um artista (vínculo permanente), usa esse.
3. **Match por tokens:** compara as palavras significativas do nome do artista (ignorando conectores como "de/da/e", sem acento) com o texto do lançamento (descrição + favorecido). Se todas as palavras batem, casa; em empate, vence o nome mais longo.

O cachê de cada artista é a **soma** dos lançamentos que casaram com ele. O "principal" é o de maior cachê, e é sobre ele que saem o **% do faturamento** e o **retorno (×)**.

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| **Mês** | Troca o período. Só aparecem meses passados/corrente e meses futuros **100% preenchidos** no planejamento (sem dia em aberto em dia de operação). O mês fica salvo na URL. |
| **Só pendentes** | Mostra apenas eventos sem nenhum artista taggeado. |
| **buscar** | Filtra por nome do evento ou pelo texto de artista. |
| **Normalizar** | Atalho para a tela de unificação de nomes de artistas (fora desta tela). |

## Regras e detalhes importantes

- **Sempre por bar.** Toda a tela filtra por `bar_id` (enviado no cabeçalho da requisição). Você só vê e edita os eventos e o cadastro de artistas do bar selecionado.
- **Dias fechados não contam como "vazio".** Ao decidir se um mês futuro pode aparecer, o sistema respeita os dias de operação do bar (ex.: Deboche fecha na segunda). Um dia fechado sem evento não impede o mês de aparecer.
- **Salvamento é replace-all.** Ao mudar os artistas de um evento, o conjunto inteiro é reescrito. Para não perder o cachê já corrigido, o `c_art` gravado por artista é **preservado** no reprocessamento.
- **Cachê corrigido é manual e persistente.** "Corrigir dia" grava um override (chave = bar + lançamento) e recalcula o `c_art` do artista como a soma dos overrides apontados a ele. Ao **desfazer**, o `c_art` volta a `null` e retoma o cálculo automático.
- **Competência × dia do show.** O pagamento pode cair em mês diferente do show (parcela adiantada ou atrasada). O sistema busca lançamentos numa janela ampliada e, quando há override, joga o pagamento para o dia do show correto. A lista de "dias" para corrigir cobre ~2 meses para trás e para frente, sempre limitada a eventos passados.
- **Sugestão nunca é gravada sozinha.** O parser de artistas só sugere; nada é salvo até você aceitar ou taggear manualmente.
- **Categoria de atração no CA.** Só entram lançamentos cuja categoria casa com `Atra%Programa%` (robusto a acento/variação de nome entre bares) e que não estejam excluídos, com valor diferente de zero.
- **Blur não cria artista novo.** Só o Enter cria nome novo; clicar fora só aplica se o nome já existe no cadastro — proteção contra lixo de digitação.

## Dúvidas frequentes

**Por que um selo de artista fica vermelho com "sem R$"?**
Porque a noite teve pagamento de atração no Conta Azul, mas nenhum valor casou com esse artista — provável sinal de que o cachê caiu em outro nome. Abra os **Pagamentos CA** e use "corrigir/atribuir" para amarrar.

**O cachê não bateu com o artista certo. Como arrumo?**
No painel **Pagamentos CA**, clique em **corrigir** (ou **trocar**) na linha do pagamento e escolha o dia e o artista corretos, ou atribua o favorecido a um artista do mesmo dia. O vínculo por favorecido fica valendo para o futuro.

**Taggeei o mês inteiro de uma festa recorrente, tem atalho?**
Sim. Taggeie um evento e clique em **iguais** para copiar os mesmos artistas para todos os eventos com o mesmo nome naquele mês.

**Um mês futuro não aparece no seletor. Por quê?**
Meses futuros só aparecem quando estão 100% preenchidos no planejamento — ou seja, todos os dias de operação têm evento com nome de verdade. Se há dia em aberto, o mês fica escondido até você completar o planejamento.

**Preciso preencher os horários do show?**
Não é obrigatório para taggear. Serve para as análises de pontualidade e tempo de palco. Preencha início/fim e o combinado quando quiser acompanhar se o artista cumpriu o acordado.

**O que significa "corrigido" numa linha de pagamento?**
Que aquele lançamento teve o casamento ajustado manualmente (override), em vez do casamento automático. Use **desfazer** para voltar ao automático.

## Fonte dos dados

- **Eventos, faturamento e público:** `eventos_base` (`real_r`, `cl_real`, `nome`, `data_evento`, `dia_semana`, `artista`).
- **Cadastro de artistas do bar:** `operations.bar_artistas` (nome, tipo, ativo).
- **Vínculos artista × evento (as tags):** `operations.evento_artistas` (inclui horários e `c_art`).
- **De-para favorecido do CA → artista:** `operations.artista_ca_pessoa`.
- **Correções de pagamento ("corrigir dia"):** `operations.ca_atracao_override`.
- **Dias de operação do bar:** `operations.bares_config`.
- **Custo de atração (cachê):** função `operations.fn_ca_atracao_lancamentos`, que lê `bronze.bronze_contaazul_lancamentos` (categoria `Atra%Programa%`), ou seja, a integração com o **Conta Azul**.
