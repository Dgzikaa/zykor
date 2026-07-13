---
title: Win-back
area: receitas
slug: win-back
route: /analitico/clientes/win-back
description: Identifica clientes valiosos que estão sumindo (segmentação RFM) e permite disparar uma campanha de reativação por WhatsApp direto da tela.
order: 90
icon: HeartHandshake
---

# Win-back

## Visão geral

A tela **Win-back de Clientes** serve para **recuperar clientes que já foram bons e estão sumindo**. Ela usa a segmentação RFM (Recência, Frequência, Monetário) do bar para separar a base de clientes por comportamento — de "Campeões" (vêm sempre e gastam muito) até "Perdidos" (mais de 6 meses sem aparecer) — e destaca justamente os grupos que valem a pena reativar: **Em risco, Hibernando e Perdidos**.

Além de mostrar quem são esses clientes e quanto cada um já gastou, a tela permite **disparar uma campanha de WhatsApp** (via integração Umbler) para o grupo selecionado, com prévia antes do envio. É usada pelo dono, gerente ou responsável de marketing/CRM do bar para trazer gente de volta com um empurrãozinho personalizado.

Os dados vêm de uma "foto" atualizada **diariamente** da base de clientes (não é em tempo real dentro do dia).

## Como acessar

- Menu lateral: **Receitas → Win-back** (ícone de aperto de mãos).
- Rota: `/analitico/clientes/win-back`.
- Permissão necessária: módulo **`relatorios`**. Quem não tem esse acesso não vê o item no menu nem abre a página.

## Passo a passo

### 1. Escolher os segmentos-alvo
Ao abrir a tela, os cards de segmento aparecem no topo. Por padrão já vêm **pré-selecionados os três alvos primários do win-back**: **Em risco**, **Hibernando** e **Perdidos** (destacados com um anel rosa).

1. Clique em um card para **incluir ou remover** aquele segmento da seleção.
2. A tabela abaixo e o contador ("X clientes · Y com telefone") se ajustam à seleção na hora.

### 2. Refinar com os filtros de valor e recência
Logo abaixo dos cards há três campos:

1. **Valor mínimo (R$ gasto na vida)** — só mostra clientes que já gastaram pelo menos esse total.
2. **Dias sem vir (mín.)** — só clientes cuja última visita foi há pelo menos X dias.
3. **Dias sem vir (máx.)** — teto opcional; deixe em branco para "sem limite".

Esses três filtros são aplicados no servidor (recarregam a lista). A seleção de segmentos é aplicada em cima do resultado.

### 3. Exportar a lista
1. Clique em **Exportar (N)** no canto superior direito.
2. Baixa um **CSV** com os clientes filtrados (nome, telefone, segmento, visitas, dias sem vir, ticket médio, total gasto e última visita).

### 4. Disparar a campanha de WhatsApp
1. Clique em **Disparar WhatsApp** para abrir o painel de disparo.
2. Confira o resumo do alvo (segmentos, valor, recência e quantos têm telefone).
3. Escolha o **modo da mensagem**:
   - **Template aprovado** — usa um template do WhatsApp já aprovado na Umbler (recomendado para contato "frio", com quem não conversa com o bar há mais de 24h). Selecione o template e preencha as variáveis; use `{primeiro_nome}` para personalizar por cliente.
   - **Texto livre** — mensagem escrita na hora. **Só chega em quem tem conversa aberta nas últimas 24h**; para o resto, use template. Aceita `{primeiro_nome}` e `{nome}`.
4. Clique em **Simular (prévia)** para ver quantos envios sairiam, a divisão por segmento e um exemplo de mensagem já personalizada — **sem enviar nada**.
5. Quando estiver certo, clique em **Disparar de verdade**, confirme no modal de aviso e o envio começa.
6. Ao final aparece o resultado: quantos foram **enviados**, quantas **falhas**, a divisão por segmento e o **ID da campanha** (usado depois para medir o efeito da ação).

> Aviso importante: o disparo real **não tem volta** — cada mensagem é enviada de fato pelo WhatsApp. Há um teto de segurança de **500 destinatários** por disparo; acima disso a lista é cortada e o sistema pede para estreitar o filtro.

## Abas e seções

A tela é única (sem abas), organizada em quatro blocos:

- **Cards de segmento** (topo): um card por segmento RFM, com contagem de clientes e valor total, todos clicáveis para montar o alvo.
- **Barra de filtros**: valor mínimo, dias sem vir (mín./máx.), contador e botão de disparo.
- **Painel de disparo** (abre sob demanda): escolha de template/texto, simulação e envio.
- **Tabela "Top clientes por valor"**: a lista ordenada dos clientes filtrados.

## Colunas e cálculos

### Cards por segmento

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome do segmento | Um dos 7 grupos RFM: Campeões, Leais, Promissores, Novos, Em risco, Hibernando, Perdidos | Classificação por recência (dias desde a última visita) + frequência (nº de dias distintos com visita). Ver regra de segmentos abaixo | `crm.cliente_rfm` (coluna `segmento`) |
| Nº de clientes (número grande) | Quantos clientes daquele segmento passam nos filtros de valor/recência **e têm telefone** | Contagem das linhas do segmento após aplicar os filtros | Agregado no servidor a partir de `crm.cliente_rfm` |
| Valor total (linha menor, em R$) | Soma do valor de vida dos clientes daquele segmento (dentro do filtro) | `SUM(monetario)` por segmento | `crm.cliente_rfm.monetario` |

### Tabela "Top clientes por valor"

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Cliente | Nome do cliente ("sem nome" se vazio) | Último nome não-vazio registrado para aquele telefone | `crm.cliente_rfm.cliente_nome` |
| Telefone | Telefone normalizado do cliente | Telefone limpo/normalizado das visitas; só entram clientes com telefone | `crm.cliente_rfm.cliente_fone_norm` |
| Segmento | Grupo RFM do cliente (badge colorido) | Ver regra de segmentos abaixo | `crm.cliente_rfm.segmento` |
| Visitas | Quantas vezes o cliente veio | Contagem de **dias distintos** com visita (`count(DISTINCT data_visita)`) | `crm.cliente_rfm.frequencia` |
| Dias sem vir | Há quantos dias foi a última visita | `CURRENT_DATE − última_visita` (recalculado no refresh diário) | `crm.cliente_rfm.recencia_dias` |
| Última visita | Data da visita mais recente | `max(data_visita)` do cliente | `crm.cliente_rfm.ultima_visita` |
| Ticket méd. | Gasto médio por visita | Média do consumo por visita, ignorando visitas com valor zero (`AVG(NULLIF(valor_consumo,0))`) | `crm.cliente_rfm.ticket_medio` |
| Total gasto | Quanto o cliente já gastou na vida | Soma de todo o consumo do cliente (`SUM(valor_consumo)`) | `crm.cliente_rfm.monetario` |

A tabela vem **ordenada por Total gasto (maior primeiro)** e mostra até o limite configurado (a página pede 200 linhas de preview).

### Regra dos segmentos RFM

A classificação é feita no banco, por cliente (por telefone), usando **recência** (dias desde a última visita) e **frequência** (nº de dias distintos com visita):

| Segmento | Regra |
|---|---|
| **Campeões** | Veio há ≤ 30 dias **e** frequência ≥ 5 |
| **Leais** | Veio há ≤ 60 dias **e** frequência ≥ 3 |
| **Novos** | Frequência = 1 **e** veio há ≤ 30 dias |
| **Promissores** | Frequência ≤ 2 **e** veio há ≤ 60 dias |
| **Em risco** | Frequência ≥ 3 **e** última visita entre 61 e 180 dias |
| **Hibernando** | Última visita entre 61 e 180 dias (sem cair em "Em risco") |
| **Perdidos** | Demais casos (na prática, mais de 180 dias sem vir) |

> Cada regra é avaliada na ordem acima; a primeira que bate define o segmento.

### Prévia e resultado do disparo

| Indicador | O que mostra | Como é calculado |
|---|---|---|
| Prévia: N envios | Quantas mensagens sairiam com o filtro atual | Contagem de destinatários com telefone (teto 500) |
| Por segmento (badges) | Divisão dos envios por segmento | Contagem agrupada por `segmento` |
| Exemplo | Mensagem já personalizada para o 1º cliente da lista | `{primeiro_nome}`/`{nome}` substituídos pelo nome real |
| Disparo concluído: enviados / falhas | Resultado real do envio | Contagem de respostas OK vs. erro da API Umbler |
| Campanha (ID) | Identificador da campanha para medir depois | UUID gerado no disparo; gravado em cada mensagem enviada |

## Filtros e opções

| Filtro / opção | Onde aplica | Efeito |
|---|---|---|
| **Bar** | Automático (bar selecionado no topo) | Toda a tela é isolada por `bar_id`; nunca mistura bares |
| **Segmentos** (cards clicáveis) | Cliente (na tela) | Inclui/remove segmentos da seleção; afeta tabela, contador e alvo do disparo |
| **Valor mínimo (R$ na vida)** | Servidor | Só clientes com `monetario` ≥ valor |
| **Dias sem vir (mín.)** | Servidor | Só clientes com `recencia_dias` ≥ valor |
| **Dias sem vir (máx.)** | Servidor | Teto opcional de `recencia_dias`; em branco = sem limite |
| **Modo template × texto livre** | Painel de disparo | Template = contato frio (via WhatsApp Business); texto livre = só quem tem janela de 24h aberta |
| **Dry run (Simular)** | Painel de disparo | Conta e mostra a prévia sem enviar nada |

## Regras e detalhes importantes

- **Sempre por bar**: a lista, o resumo e o disparo filtram por `bar_id`. Nada é compartilhado entre bares.
- **Só clientes com telefone**: quem não tem telefone normalizado é excluído da tela (a campanha é por WhatsApp).
- **Atualização diária, não em tempo real**: os dados vêm da matview `crm.cliente_rfm`, que é recalculada **uma vez por dia (por volta das 06:30)**. Uma visita de ontem à noite pode só refletir na próxima atualização.
- **Recência e segmento mudam a cada refresh**: "dias sem vir" é calculado contra a data de hoje no momento do refresh.
- **Frequência conta dias, não comandas**: duas comandas no mesmo dia contam como 1 visita.
- **Ticket médio ignora zeros**: visitas com consumo zerado não entram na média (mas entram na contagem de visitas).
- **Teto de 500 por disparo**: proteção contra envio massivo acidental e timeout. Acima disso, a lista é truncada e o sistema sinaliza para estreitar o filtro.
- **Envio real é irreversível**: exige confirmação num modal. Cada envio (sucesso ou falha) é registrado com o `campanha_id` e o segmento, para medir o efeito da campanha depois.
- **Rate limit**: o envio respeita o limite por minuto configurado para o bar na Umbler (com pequeno intervalo entre mensagens).
- **Texto livre tem alcance limitado**: pela regra do WhatsApp, mensagem livre só chega a quem interagiu com o bar nas últimas 24h. Para reativar quem sumiu (o caso típico de win-back), use **template aprovado**.
- **Estado vazio**: se nenhum cliente passa no filtro, a tabela mostra "Sem clientes neste filtro."

## Dúvidas frequentes

**Por que "Em risco", "Hibernando" e "Perdidos" já vêm marcados?**
Porque são os alvos naturais de reativação: clientes que sumiram ou estão sumindo. Você pode desmarcar e escolher outros a qualquer momento.

**A lista está desatualizada, e agora?**
A base de RFM é recalculada uma vez por dia (madrugada). Visitas muito recentes só aparecem no próximo ciclo.

**Por que alguns clientes não aparecem?**
A tela só mostra quem **tem telefone** e passa nos filtros de valor e recência. Sem telefone, o cliente fica de fora.

**Qual a diferença entre "Simular" e "Disparar de verdade"?**
Simular só mostra a prévia (quantos, divisão por segmento e um exemplo), sem enviar. Disparar de verdade envia as mensagens pelo WhatsApp e não tem volta.

**Por que preciso de template para clientes antigos?**
O WhatsApp só permite mensagem livre para quem falou com o bar nas últimas 24h. Como win-back mira quem sumiu, o contato é "frio" e exige um template aprovado.

**Como sei se a campanha funcionou?**
Cada envio é gravado com um ID de campanha e o segmento do cliente, o que permite medir depois quem voltou a consumir após receber a mensagem.

## Fonte dos dados

- **`crm.cliente_rfm`** — matview de RFM por cliente (telefone), recalculada diariamente. Fornece segmento, frequência, monetário, ticket médio, recência e última visita.
  - Construída a partir de **`silver.cliente_visitas`** (visitas de clientes com telefone), que por sua vez tem origem nos dados de consumo do **ContaHub**.
- **`public.get_rfm_resumo(bar_id)`** — função SQL de resumo por segmento (mesma base RFM).
- **Umbler** — integração de WhatsApp usada no disparo:
  - `umbler_config` — organização, canal, telefone de origem e rate limit por bar.
  - `umbler_mensagens` — registro de cada envio da campanha (com `campanha_id` e segmento) para medição posterior.
  - Templates aprovados são buscados na API da Umbler (`/api/umbler/templates`).
