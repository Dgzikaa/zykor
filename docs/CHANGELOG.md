# Zykor - Changelog Arquitetural

## 2026-04-19 (Sessão domingo noite — P3)

### Fase P3: Silvers Yuzer reais

#### Contexto

Yuzer tinha 2 views cosméticas (`silver.silver_yuzer_pagamentos_evento`
e `silver.silver_yuzer_produtos_evento`) que eram SELECT direto
sobre bronze sem ETL nem persistência. Transformadas em tabelas
físicas com ETL real.

#### Novas tabelas

- **`silver.yuzer_pagamentos_evento`** (38 linhas, bar 3)
  - 1 linha por `(bar_id, evento_id)`
  - Consolida `bronze_yuzer_pagamentos_evento` + `bronze_yuzer_estatisticas_evento`
    + `bronze_yuzer_eventos` + `integrations.yuzer_pagamento` (descontos manuais)
  - Meios de pagamento (credito/debito/pix/dinheiro/producao/outros) como colunas
  - `valor_liquido = faturamento_bruto - total_descontos - aluguel_equipamentos`
  - Derivados: `pct_credito/debito/pix/dinheiro`, `average_ticket`,
    `cashless_consumed/inserted/residual`, `tag_price_total`
  - Top 5 eventos validados: Carnaval Ord. 01-04/03/25 (R$ 394.811 líquido,
    9.892 pedidos), CARNA VIRA LATA 13-16/02/26 (R$ 595.772 bruto / 4 noites)

- **`silver.yuzer_produtos_evento`** (1.698 linhas, bar 3)
  - 1 linha por `(bar_id, evento_id, produto_id)`
  - Enriquece com `data_evento`, `nome_evento` (denormalizado)
  - `eh_ingresso` detectado via ILIKE em subcategoria/produto_nome
  - `ranking_valor_evento` (`ROW_NUMBER OVER PARTITION BY evento ORDER BY valor DESC`)
  - `percentual_valor_evento` (% do faturamento do evento)

#### Views de compat (zero refactor frontend)

- `silver.silver_yuzer_pagamentos_evento` → view sobre `silver.yuzer_pagamentos_evento`
- `silver.silver_yuzer_produtos_evento` → view sobre `silver.yuzer_produtos_evento`

10 rotas frontend que consomem os nomes legacy continuam funcionando
sem alteração.

#### Cron

- `silver-yuzer-diario` (jobid 455, `45 11 * * *` = 08:45 BRT)
- Chama `etl_silver_yuzer_all_bars()` que processa ambos ETLs em sequência

#### Migrations aplicadas P3 (8)

27. `drop_views_yuzer_cosmeticas`
28. `create_silver_yuzer_pagamentos_e_produtos_evento`
29. `create_etl_silver_yuzer_full_e_wrapper`
30. `fix_etl_silver_yuzer_pagamentos_alias`
31. `fix_etl_yuzer_pagamentos_dedupe_integ`
32. `fix_etl_yuzer_produtos_using_join`
33. `fix_etl_yuzer_produtos_eh_ingresso_coalesce`
34. `create_views_compat_yuzer_e_cron`

#### Validações

- Backfill: bar 3 = 38 pag + 1.698 prod inseridos; bar 4 = 0 (sem Yuzer)
- Idempotência: 2ª rodada → 0 inseridos / 38 + 1.698 atualizados
- Counts tabela vs view compat: bate 100%
- Cross-check `SUM(produtos.valor_total)` vs `pagamentos.faturamento_bruto`:
  diferenças entre 0,2% e 6,2% (esperadas, anotadas como débito)

#### Débitos novos identificados

- 4 linhas órfãs em `integrations.yuzer_pagamento` sem evento
  bronze correspondente (investigar futuro)
- 3 eventos com múltiplos lançamentos manuais em `integrations.yuzer_pagamento`
  (evento_id 8448 com 4x, 12938 com 2x, 14414 com 2x); consolidados via SUM,
  validar se intencional
- Diferença 0-6% entre `SUM(produtos.valor_total)` vs
  `pagamentos.faturamento_bruto` por evento (cancelados? descontos manuais
  não atribuídos a produtos?)
- Umbler permanece deferido — bug em bronze (`direcao` NULL em todas as
  mensagens) bloqueia construção de `silver.umbler_atendimento_diario`

#### Estado final do Silver layer

- **15 tabelas silver físicas reais** (vendas_diarias, vendas_item,
  produtos_top, faturamento_hora, faturamento_pagamentos, tempos_producao,
  cliente_visitas, cliente_estatisticas, google_reviews_diario,
  getin_reservas_diarias, sympla_bilheteria_diaria, nps_diario,
  contaazul_lancamentos_diarios, yuzer_pagamentos_evento,
  yuzer_produtos_evento)
- **13 crons sequenciais** automatizados (07:30 adapters → 08:00-08:45 silvers)
- Pipeline silver completo 08:00 → 08:45 BRT com 10 jobs encadeados
- Medallion bronze → silver funcionando para 8 domínios externos
  (ContaHub, Sympla, Falae, Google Reviews, Getin, ContaAzul, Yuzer +
  Umbler deferido)

---

## 2026-04-19 (Sessão domingo noite — continuação P1.5 + P2)

### Fase P1.5 + P2: Refactor final + Silvers externas

#### P1.5 — Refactor 23 rotas operations.* → silver.* explícito

- 45 queries migradas em 23 arquivos
- Padrão: `.from('X')` → `.schema('silver' as never).from('X')`
- 4 tabelas afetadas: `vendas_item`, `faturamento_hora`,
  `faturamento_pagamentos`, `tempos_producao`
- Views compat em `operations.*` preservadas (futuro drop quando adapters
  forem refatorados para escrever silver direto)
- Cast `as never` necessário porque tipos TS gerados ainda não expõem schema silver
- Type-check + lint OK, zero regressões
- Commit: `e95a4dd1`

#### P2 — 5 Silvers de domínios externos construídas

- **`silver.google_reviews_diario`** (1.341 linhas, 2 bares — 5 anos histórico bar 4)
  - Stars distribution, sub-ratings food/service/atmosphere, top 5 reviews exemplares JSONB
- **`silver.getin_reservas_diarias`** (370 linhas, bar 3 only)
  - Status breakdown, taxa comparecimento, distribuição por hora, top ocasiões
- **`silver.sympla_bilheteria_diaria`** (23 linhas, bar 3 only)
  - Granularidade por data DO EVENTO, lead time, UTM sources, cupons usados
- **`silver.nps_diario`** (166 linhas, consolida Falae + nps_reservas)
  - Multi-source (falae + getin_reservas), criterios médios, top 5 comentários
- **`silver.contaazul_lancamentos_diarios`** (15.072 combos, 2 bares)
  - DRE por data_competencia, granularidade (categoria, tipo)
  - **Paridade R$ 0,00 vs bronze validada** centavo a centavo

#### Pipeline diário consolidado (12 crons sequenciais)

| Hora BRT | Cron | Função |
|---|---|---|
| 07:00 | `contahub-sync-7h-ambos` | bronze ContaHub |
| 07:30 | `adapters-diarios` | popula 4 silvers do contahub |
| 08:00 | `silver-vendas-diarias-diario` | oráculo agregado |
| 08:00 | `alerta-contahub-sync-falhou` | monitoring |
| 08:05 | `silver-cliente-visitas-diario` | granular visita |
| 08:10 | `silver-cliente-estatisticas-diario` | 360 cliente |
| 08:15 | `silver-produtos-top-diario` | ranking produtos |
| 08:20 | `silver-google-reviews-diario` | reviews por dia |
| 08:25 | `silver-getin-reservas-diario` | reservas + checkin |
| 08:30 | `silver-sympla-bilheteria-diario` | bilheteria por evento |
| 08:35 | `silver-nps-diario` | NPS multi-source |
| 08:40 | `silver-contaazul-diario` | DRE por competência |

**Total**: pipeline completo em 1h40 de execução diária.

#### NPS consolidado

- `crm.nps_falae_diario` (silver disfarçada legacy) virou view sobre
  `silver.nps_diario` filtrada apenas Falae
- Backup: `crm.nps_falae_diario_legacy_backup` (30 dias para rollback)
- Silver mais abrangente que legacy: 102 dias bar 3 vs 37 do legacy

#### Achados de qualidade (P2)

**Bronze quality issues:**
- ContaAzul `metodo_pagamento` NULL em 100% das linhas (sync incompleto)
- ContaAzul `conciliado` sempre false (bronze não popula)
- 22 lançamentos ContaAzul com `valor_pago + valor_nao_pago > valor_bruto`
  (juros/multa, não bug do ETL)
- Falae `data_visita` NULL em 43% (workaround via `COALESCE(data_visita, created_at)`)
- Umbler `direcao` NULL em todas mensagens (silver.umbler deferida para P3)
- Reviews bar 3 média 4.81★ (4.59★ bar 4 com 5 anos histórico)

**Achados operacionais:**
- Reservas Getin: **40-52% no-show** em dias de alto volume (overbooking?)
- Sympla: cortesias dominam top eventos (75% dos tickets), receita fraca proporcionalmente
- ContaAzul: Carnaval Vira-Lata gerou R$ 652k em 1 lançamento (20/02/2026)
- NPS criterios: TEMPO DE ENTREGA (3.0/5) e Tempo Espera (3.9) são pontos fracos

#### Migrations aplicadas (P2)

18. `create_silver_google_reviews_diario` (DDL + ETL + wrapper)
19. `fix_etl_google_reviews_ambiguous_column`
20. `fix_etl_google_reviews_rename_cte_columns`
21. `create_silver_getin_reservas_diarias` (DDL + ETL + wrapper)
22. `create_silver_sympla_bilheteria_diaria_v2` (DDL + ETL + wrapper)
23. `create_silver_nps_diario` (DDL + ETL + wrapper)
24. `fix_etl_nps_diario_coalesce_data_visita`
25. `migrate_crm_nps_falae_diario_to_silver_view`
26. `create_silver_contaazul_lancamentos_diarios` (DDL + ETL + wrapper)

> Crons agendados via `cron.schedule` (não conta como migration).

#### Estado FINAL Silver Layer (14 tabelas reais)

| # | Tabela | Linhas | Tamanho |
|---:|---|---:|---:|
| 1 | `silver.vendas_item` | 868k | 399 MB |
| 2 | `silver.cliente_estatisticas` | 108k | 211 MB |
| 3 | `silver.tempos_producao` | 676k | 207 MB |
| 4 | `silver.cliente_visitas` | 225k | 137 MB |
| 5 | `silver.faturamento_pagamentos` | 237k | 51 MB |
| 6 | `silver.contaazul_lancamentos_diarios` | **15.072** | **7.5 MB** ⭐ |
| 7 | `silver.contahub_stockout_processado` | — | 3.2 MB |
| 8 | `silver.produtos_top` | 1.132 | 2.3 MB |
| 9 | `silver.faturamento_hora` | 8.3k | 1.7 MB |
| 10 | `silver.google_reviews_diario` | **1.341** | **1.6 MB** ⭐ |
| 11 | `silver.vendas_diarias` | 795 | 392 kB |
| 12 | `silver.getin_reservas_diarias` | **370** | <1 MB ⭐ |
| 13 | `silver.nps_diario` | **166** | <1 MB ⭐ |
| 14 | `silver.sympla_bilheteria_diaria` | **23** | <1 MB ⭐ |

⭐ = criadas em S1+S2+P1+P2 hoje

**~1.13 GB total Silver** / 12 crons sequenciais

#### Views de compatibilidade ativas (5 + 4 = 9)

- `crm.cliente_perfil_consumo` → silver.cliente_estatisticas (S1)
- `public.cliente_estatisticas` → silver.cliente_estatisticas (S1)
- `public.view_top_produtos` → silver.produtos_top (S2)
- `crm.nps_falae_diario` → silver.nps_diario (P2)
- `operations.{vendas_item, faturamento_hora, faturamento_pagamentos, tempos_producao}` → silver.* (P1)
- `public.visitas` → silver.cliente_visitas (sessão sábado)

#### P3 pendente (próxima sessão)

- `silver.yuzer_pagamentos_evento` e `silver.yuzer_produtos_evento`
  (ainda existem como views cosméticas, virar ETL real)
- `silver.umbler_atendimento_diario` (após fix bronze `direcao` NULL)
- `crm.nps_agregado_semanal` (silver disfarçada inconsistente, investigar)

---

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
