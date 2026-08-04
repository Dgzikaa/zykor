---
title: NPS por Área
area: ferramentas
slug: nps-por-area
route: /analitico/nps
description: Nota de cada área da experiência (atendimento, tempo de espera, música, comida…) recortada pela data da visita — mostra qual área caiu e em que dia caiu.
order: 150
icon: Star
---

# NPS por Área

## Visão geral

O Falaê já pergunta ao cliente uma nota de **1 a 5 para cada área** da experiência, além da nota de 0 a 10 do NPS. O problema: no painel do Falaê dá pra ver o horário em que a pessoa **respondeu**, mas para descobrir o **dia em que ela esteve no bar** é preciso abrir resposta por resposta. Resultado: dava pra saber que "tempo de entrega" andava ruim, mas não em que noite isso aconteceu.

Esta tela resolve exatamente isso: toda a base é recortada pela **data da visita**, então dá para responder *"a nota de tempo de espera caiu — em que dia, em que evento, e o que as pessoas escreveram naquele dia?"*.

Quem usa: **marketing, operação e sócios** — na reunião semanal, para transformar reclamação difusa em dia, evento e área concretos.

## Como ler

**Os números do topo**

- **NPS** — % de promotores (nota 9-10) menos % de detratores (0-6), como manda o padrão.
- **Nota média** — média simples das notas de 0 a 10.
- **Promotores / Detratores / Comentários** — volume de cada grupo e quantas respostas trouxeram texto livre.
- **Sem data da visita** — respostas do período que **não** informaram o dia em que a pessoa esteve no bar. Elas contam no NPS geral do Falaê, mas ficam fora dos cortes por dia (não dá pra saber a que noite pertencem). Hoje a cobertura é de ~80% no Ordinário e ~94% no Deboche.

**Nota por área** — média de 1 a 5 por área, **com o gargalo em primeiro**. Verde ≥ 4,5, âmbar ≥ 4,0, vermelho abaixo disso.

**Reclamações por área** — logo abaixo dos números do topo, um chip por área com **quantas pessoas deram nota 3 ou menos** ali (3 é o meio da escala; quem gostou dá 4 ou 5).

Clicar no chip **abre o dia a dia daquela reclamação**: um bloco por dia, com data, evento, quantas pessoas reclamaram, a nota média do dia e — o que interessa de verdade — **o comentário de cada uma**. Cada pessoa aparece com a nota que deu naquela área, o NPS dela e as **outras áreas de que também reclamou** (é assim que se descobre que "custo-benefício ruim" naquele dia vinha junto de "tempo de espera ruim"). Quem não escreveu nada aparece como "sem comentário", para o total continuar batendo.

Ao fechar o modal, a tela continua filtrada naquela reclamação: o gráfico mensal mostra "quantas reclamaram por mês" e a tabela de dias, as reclamações de cada dia. É o caminho completo de *"o custo-benefício piorou"* até *"foram 5 pessoas no Pé no Ordi de 14/05, nota média 2,2, e olha o que 3 delas escreveram"*.

**Dia a dia** — a tabela lista cada dia com o número de respostas, o NPS do dia, a nota média e a **pior área daquele dia**. Clicar numa linha filtra a lista de respostas para aquele dia — é o caminho de "a nota caiu" até "foi isso que escreveram".

## Filtros

- **Período** — 30 / 90 dias, ano corrente ou tudo.
- **Data da visita × Data da resposta** — muda qual data define o recorte. *Data da visita* é o padrão e é o que responde "em que noite foi ruim". *Data da resposta* reproduz o corte do Falaê e o do Desempenho semanal.
- **Dia da semana** — isola sábado, quarta etc.
- **Área** — ao escolher uma área, os gráficos de evolução mensal e dia a dia passam a mostrar a nota **daquela** área, e a tabela troca "pior área do dia" pela nota dela.
- Na lista de respostas ainda dá pra filtrar por promotor / neutro / detrator, por **"só quem reclamou"** (nota ≤ 3 na área escolhida, ou em qualquer área se nenhuma estiver escolhida) e buscar dentro do comentário, do nome do cliente ou do evento.

> **Reclamou de área ≠ detrator.** Uma pessoa pode dar NPS 9 (promotor) e mesmo assim nota 2 em "tempo de espera" — e é justamente esse cliente que vale ouvir. Os dois filtros são independentes de propósito.

## De onde vem o dado

Fonte: pesquisas do **Falaê** (`bronze.bronze_falae_respostas`), pelas views `silver.v_nps_resposta` (uma linha por resposta) e `silver.v_nps_area` (uma linha por resposta × área).

- Entram as pesquisas **NPS**, **NPS Digital** (mesmo formulário, nome usado até 29/03/2026) e **Salão** (presencial) — é a regra canônica do NPS do sistema. Fidelidade e Aniversário **não** são NPS.
- A **data da visita** vem da pergunta "Data da Visita" do formulário (formulários antigos usavam "Data do pedido"; os dois são lidos).
- Como essa data é **digitada pelo cliente**, existe um guarda-corpo: data futura ou mais de 60 dias antes da resposta é descartada — a resposta continua na base, só não entra nos cortes por dia.
- Os rótulos das áreas mudam entre pesquisas e bares ("Tempo de Espera", "TEMPO DE ENTREGA", "TEMPO DE ESPERA DOS PEDIDOS" são a mesma coisa; "Limpeza" e "Limpeza do espaço" também). A tela unifica tudo em áreas estáveis.

## Cuidado

- **Amostra pequena engana**: um dia com 2 respostas pode mostrar nota 2,0 sem significar nada. A coluna de respostas do dia está lá justamente para isso.
- **Área ≠ NPS**: a nota de área é de 1 a 5 e a do NPS é de 0 a 10 — não compare os dois números diretamente.
- Para o NPS ligado a **artista/atração**, veja *Artistas (visão da casa)*; aqui o corte é por área e por dia.
