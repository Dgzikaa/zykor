---
title: Fidelização
area: receitas
slug: fidelizacao
route: /receitas/fidelidade
description: Espelha, dentro do Zykor, o Programa de Fidelidade do bar operado pelo parceiro Go!Bar — base de clientes, pontos, resgates e status, com KPIs e gráficos.
order: 25
icon: Gift
---

# Fidelização

## Visão geral

A tela de **Fidelização** traz para dentro do Zykor os números do **Programa de Fidelidade** do bar. O programa em si roda no parceiro **Go!Bar** (para onde o Zykor já envia a base de clientes); aqui a gente **consome de volta** esses dados e mostra, em Receitas, quem são os clientes, quantos pontos têm, o que resgatam e como está a saúde da base.

Serve para o dono/marketing acompanhar: tamanho da base fidelizada, quantos pontos estão "na rua" (saldo a resgatar), quanto o programa já devolveu em benefícios, quais produtos as pessoas trocam por pontos e como a geração × uso de pontos evolui no tempo.

> Hoje só o **Ordinário** tem programa integrado. Outros bares mostram um aviso de "programa não integrado".

## Como acessar

- **Menu lateral:** Receitas → **Fidelização** (ícone de presente).
- **Rota:** `/receitas/fidelidade`.
- **Permissão:** `relatorios`.

Tudo respeita o **bar selecionado** no topo.

## Filtro de período (topo)

Acima dos KPIs há os presets **Hoje**, **7 dias**, **Mês**, **Ano**, **Tudo** e **Custom** (data inicial e final). Padrão ao abrir é **Tudo** (visão lifetime).

O filtro **só afeta os dados que têm data de referência** — o parceiro entrega `vw_ordi_clientes` já consolidada por cliente (sem histórico), então KPIs de base (clientes na base, saldo, consumo total, ticket médio) são sempre snapshot atual. Já os movimentos (pontos gerados/utilizados, resgates, valor em benefícios, gráfico mensal, produtos resgatados, taxa de resgate e clientes com pontos/resgates) são recalculados no período escolhido. Um banner azul explica isso quando o filtro está ativo.

Os labels dos KPIs ganham sufixo **"(período)"** ou **"(atual)"** conforme o escopo, pra deixar claro cada número.

## Colunas e cálculos

### KPIs (topo)

| Indicador | Sufixo | O que mostra | Como é calculado |
|---|---|---|---|
| Clientes na base | (atual) | Total de clientes no programa | Contagem de clientes; sub = quantos têm cadastro |
| Com pontos | (período/total) | Clientes que ganharam pontos | Sem filtro: contagem lifetime. Com filtro: `cliente_id` DISTINCT na `vw_ordi_pontos` do período |
| Saldo de pontos | (atual) | Pontos ainda não resgatados | Σ do saldo atual (não muda com filtro); sub mostra gerados × usados **no escopo escolhido** |
| Resgates | (período/total) | Nº de resgates e clientes que resgataram | Sem filtro: lifetime. Com filtro: contagem em `vw_ordi_resgates` no período + `cliente_id` DISTINCT |
| Consumo total | (atual) | Consumo acumulado dos clientes | Σ do total consumido — sempre lifetime, o parceiro não entrega recortado |
| Ticket médio | (atual) | Consumo médio por cliente | Média do ticket dos clientes com consumo — lifetime |
| **Valor em benefícios** | (período/total) | Quanto o programa devolveu em resgates | Σ do valor estimado dos resgates do período |
| Pontos utilizados | (período/total) | % dos pontos gerados que foram usados | pontos usados ÷ pontos gerados **no escopo escolhido** |

### Gráficos

| Gráfico | O que mostra |
|---|---|
| Clientes por status | Rosca da composição da base (Ativo, Em risco, Inativo, Sem visita…) |
| Top clientes por saldo de pontos | Maiores saldos acumulados |
| **Pontos por mês** | Linha de pontos **gerados × utilizados** ao longo do tempo |
| **Produtos mais resgatados** | Ranking dos produtos trocados por pontos |

### Tabela de clientes

Nome, telefone, visitas, consumo, saldo de pontos, resgates e status. Busca por nome ou telefone; mostra os **200 maiores consumidores** por padrão (use a busca para achar alguém específico).

## Regras e detalhes importantes

- **Fonte externa (parceiro Go!Bar):** os dados vêm da API do parceiro (leitura), agregados **no servidor** do Zykor. A chave de acesso é somente-leitura e fica no back-end (nunca no navegador).
- **De-para por bar:** cada bar do Zykor aponta para um "estabelecimento" no sistema do parceiro. Hoje só o Ordinário está mapeado.
- **Resiliente a falha do parceiro:** os resgates e a evolução de pontos são carregados em separado; se o parceiro ficar indisponível para essas partes, a tela **continua mostrando os clientes** e exibe um aviso discreto, em vez de quebrar. Quando essas views caem, os KPIs de movimento fazem fallback para o valor lifetime da `vw_ordi_clientes` para não zerar sem motivo.
- **Escopo dos KPIs (`escopo` no response):** a API responde com `escopo: 'lifetime' | 'periodo'` e o range aplicado. A UI usa isso para trocar os sufixos dos labels e sinalizar o banner.
- **Números do programa, não do caixa:** consumo, ticket e pontos refletem o que o parceiro registra no programa, que pode diferir do faturamento contábil do bar.

## Fonte dos dados

- **Página:** `/receitas/fidelidade`. **API (agrega no servidor):** `/api/receitas/fidelidade`.
- **Parceiro (Go!Bar, via PostgREST):** views `vw_ordi_clientes` (consolidado por cliente), `vw_ordi_resgates` (resgates) e `vw_ordi_pontos` (movimentos de pontos).
- **Integração:** `lib/receitas/fidelidade-parceiro.ts` (fetch paginado, chave server-side).
