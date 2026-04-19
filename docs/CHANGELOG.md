# Zykor - Changelog Arquitetural

## 2026-04-19 (Sessão domingo tarde/noite)

### Fase S1 + S2 + P1: Silver layer consolidada

#### S1 — silver.cliente_estatisticas (nova)

- 49 colunas, 9 índices, 7 constraints
- 108.147 perfis (99.650 bar 3 + 8.497 bar 4)
- Cross-domain: Getin reservas, Umbler WhatsApp, Falae NPS
- Mata fantasma `cliente_estatisticas` (rota crm/clientes-vip)
- Migra `crm.cliente_perfil_consumo` para view de compat
- Cron: silver-cliente-estatisticas-diario (08:10 BRT)

#### S2 — silver.produtos_top (nova)

- 22 colunas, 6 índices, 4 constraints
- 1.132 produtos (695 bar 3 + 437 bar 4)
- Agregados totais + JSONB DOW + janelas 30d/60d/90d
- Categoria + status (ativo/declinando/fora_de_linha)
- Substitui matview legacy `public.view_top_produtos` (sem cron)
- Cron: silver-produtos-top-diario (08:15 BRT)

#### P1 — Rename 4 silvers disfarçadas (operations → silver)

- silver.vendas_item (399 MB, 868k linhas)
- silver.tempos_producao (207 MB, 676k linhas)
- silver.faturamento_pagamentos (51 MB, 236k linhas)
- silver.faturamento_hora (1.7 MB, 8k linhas)
- SET SCHEMA (metadata-only, sem cópia física)
- 4 views compat em operations (rotas frontend continuam funcionando via auto-updatable views)
- Adapters continuam escrevendo via auto-updatable views

#### Cronograma otimizado

- `adapters-diarios` movido de 08:15 BRT (conflito) para **07:30 BRT**
- Pipeline sequencial: sync (07:00) → adapters (07:30) → 4 Silvers (08:00–08:15)

### Migrations aplicadas (17)

1. `create_silver_cliente_estatisticas`
2. `create_etl_silver_cliente_estatisticas_full`
3. `fix_etl_cliente_estatisticas_frequencia_mensal`
4. `fix_cli_id_contahub_integer_consistency`
5. `fix_etl_cliente_estatisticas_joins_using_to_on`
6. `fix_perfil_check_remove_accent`
7. `create_normalizar_telefone_11d`
8. `fix_etl_silver_cliente_estatisticas_cross_refs`
9. `create_etl_silver_cliente_estatisticas_all_bars`
10. `migrate_crm_perfil_consumo_to_silver_view`
11. `create_silver_produtos_top`
12. `create_etl_silver_produtos_top_full`
13. `create_etl_silver_produtos_top_all_bars`
14. `migrate_view_top_produtos_to_silver`
15. `move_4_operations_tables_to_silver`
16. `create_compat_views_operations`
17. `fix_etl_silver_produtos_top_read_silver`

> Cron `adapters-diarios` reagendado via `cron.unschedule` + `cron.schedule` (não conta como migration).

### Fantasmas mortos

- `cliente_estatisticas` (era fantasma, agora view sobre silver)
- `view_top_produtos` (era matview sem cron, agora view sobre silver)

### Débitos técnicos documentados

#### Refactor pendente

- ~25-30 rotas frontend usam `.from('vendas_item')` etc sem schema prefix.
  Funcionam via view compat, mas refactor explícito para silver é desejável (onda P1.5 futura).
- Drop redundante `idx_cliente_estatisticas_bar_fone` (duplicata da UNIQUE constraint
  `uq_cliente_estatisticas_natural`) — não aplicado nesta sessão, fica para limpeza futura.

#### CRM

- `crm/clientes-vip` ainda escreve em crm legacy via `sync_cliente_perfil_consumo`.
  Deve escrever em `silver.cliente_estatisticas` direto (refactor futuro).

#### Qualidade de dados

- 8 produtos com margem negativa (custo mal cadastrado em bronze):
  Spaten evento, Adicional Molho, Garrafa Vodka Smirnoff, Dose Whisky Chivas 12 Anos,
  Ballena Dose, Ballena, Espumante Unus Moscatel, Dose Gin Gordon's.
- 31 produtos sem `categoria_mix` (bar 3) — todos com valor_total = 0.
- 3.550 clientes só no crm legacy (normalizações históricas divergentes).

#### Integrações externas

- Bar 4 sem WhatsApp/Getin/NPS (gap de integração).
- `cliente_contahub_id` vazio em `bronze.bronze_umbler_conversas` (19.494 conversas
  sem ID — JOIN feito por telefone como fallback).
- JSONBs de `cliente_estatisticas` (produtos_favoritos, tags, etc) importados do crm v1
  (v2 futuro: recalcular do silver+vendas_item).

#### Cleanup 30 dias

- Drop `crm.cliente_perfil_consumo_legacy_backup` após validação em produção.
- Drop `public.view_top_produtos_legacy_snapshot` após validação em produção.

### Estado final do sistema

- 9 tabelas silver reais (~1 GB)
- 4 views compat em operations
- 4 views compat em public/crm (`cliente_perfil_consumo`, `cliente_estatisticas`,
  `view_top_produtos`, `visitas` — esta última de sessão anterior)
- 7 crons sequenciais (07:00 → 08:15 BRT)
- Pipeline medallion funcional com 3 camadas populadas

#### Pipeline diário consolidado

| Hora BRT | Cron | Função |
|---|---|---|
| 07:00 | `contahub-sync-7h-ambos` | bronze atualizado do ContaHub |
| 07:30 | `adapters-diarios` | popula silver.vendas_item, faturamento_*, tempos_producao |
| 08:00 | `silver-vendas-diarias-diario` | oráculo agregado |
| 08:00 | `alerta-contahub-sync-falhou` | monitoring |
| 08:05 | `silver-cliente-visitas-diario` | granular por visita |
| 08:10 | `silver-cliente-estatisticas-diario` | 360 cliente |
| 08:15 | `silver-produtos-top-diario` | ranking produtos |

---

## 2026-04-19 (Sessão domingo manhã/tarde)

### Fase: refactor 31 rotas + ETAPAS 1-9 silver.cliente_visitas

#### Silver layer inicial

- `silver.cliente_visitas` (49 cols, 7 idx, 6 checks, 225.027 linhas, 137 MB)
- ETL `etl_silver_cliente_visitas_dia` + wrappers `_intervalo` e `_all_bars`
- Backfill: 225.027 linhas históricas inseridas em ~24s, 0 erros
- Cron `silver-cliente-visitas-diario` (08:05 BRT)

#### Refactor 29 rotas API (Onda A-F)

- 58 queries migradas de `public.visitas` (view fantasma) para `silver.cliente_visitas`
- 14 otimizações sargable (tem_telefone, tem_estadia_calculada, tem_nome)
- Speedup médio 3.8x, picos de 39x em queries de tempo de estadia
- Commit: `c6c54842`

---

## 2026-04-18 (Sessão sábado)

### Fase 1: descoberta de fantasmas + criação silver.vendas_diarias

- Auditoria identificou tabelas fantasmas: `public.visitas`, `cliente_estatisticas`, `view_top_produtos`
- `silver.vendas_diarias` criada como oráculo agregado (795 linhas)
- Cron `silver-vendas-diarias-diario` (08:00 BRT)
- Fix de rotas `cmv-semanal/recalcular-todos`, `eventos/bulk-insert`, etc.
- Commit: `8afbce99`
