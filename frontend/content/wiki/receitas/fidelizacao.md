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

## Colunas e cálculos

### KPIs (topo)

| Indicador | O que mostra | Como é calculado |
|---|---|---|
| Clientes na base | Total de clientes no programa | Contagem de clientes; sub = quantos têm cadastro |
| Com pontos | Clientes com saldo de pontos | Contagem; sub = % da base |
| Saldo de pontos | Pontos ainda não resgatados | Σ do saldo; sub = pontos gerados × usados |
| Resgates | Nº de resgates e % de resgatadores | Contagem de resgates; taxa = resgatadores ÷ pontuadores |
| Consumo total | Consumo acumulado dos clientes | Σ do total consumido |
| Ticket médio | Consumo médio por cliente | Média do ticket dos clientes com consumo |
| **Valor em benefícios** | Quanto o programa devolveu em resgates | Σ do valor estimado dos benefícios resgatados |
| Pontos utilizados | % dos pontos gerados que já foram usados | pontos usados ÷ pontos gerados |

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
- **Resiliente a falha do parceiro:** os resgates e a evolução de pontos são carregados em separado; se o parceiro ficar indisponível para essas partes, a tela **continua mostrando os clientes** e exibe um aviso discreto, em vez de quebrar.
- **Números do programa, não do caixa:** consumo, ticket e pontos refletem o que o parceiro registra no programa, que pode diferir do faturamento contábil do bar.

## Fonte dos dados

- **Página:** `/receitas/fidelidade`. **API (agrega no servidor):** `/api/receitas/fidelidade`.
- **Parceiro (Go!Bar, via PostgREST):** views `vw_ordi_clientes` (consolidado por cliente), `vw_ordi_resgates` (resgates) e `vw_ordi_pontos` (movimentos de pontos).
- **Integração:** `lib/receitas/fidelidade-parceiro.ts` (fetch paginado, chave server-side).
