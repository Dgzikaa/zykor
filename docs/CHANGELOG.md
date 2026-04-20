# Zykor - Changelog Arquitetural

## 2026-04-20 (Fix tela /analitico/clientes)

### Bug corrigido: totais zerados em /analitico/clientes

**Sintoma:** Cards de topo (Total visitas, Ticket médio, 
Ticket entrada, Ticket consumo) exibiam R$ 0. Valores 
individuais por cliente também zerados.

**Causa raiz:** Rota /api/analitico/clientes lia colunas 
que não existem no silver.cliente_estatisticas:
- c.telefone → correto: cliente_fone_norm
- c.nome → correto: cliente_nome
- c.total_gasto, c.total_entrada → não existiam
- c.ticket_medio, c.ticket_medio_entrada → não existiam
- c.tempo_medio_minutos → correto: tempo_medio_estadia_min

**Fix (Opção B - solução completa):**

1. 3 colunas novas em silver.cliente_estatisticas:
   - valor_total_entrada (soma couvert)
   - ticket_medio_entrada
   - visitas_pagaram_entrada

2. ETL etl_silver_cliente_estatisticas_full atualizado 
   (versao_etl=2) agregando valor_couvert de cliente_visitas.

3. Rebuild completo: 
   - Bar 3: 100.170 clientes em 15.4s
   - Bar 4: 8.585 clientes em 1.4s

4. Rota /api/analitico/clientes com mapper correto.

5. RPC get_cliente_stats_agregado criada (totais do topo).

**Validação:**
- Totais bar 3: R$ 19M geral (R$ 3M entrada + R$ 16M consumo)
- Laiz Palhares: 54 visitas, R$ 5.291 total

**Migrations aplicadas (3):**
- add_silver_cliente_estatisticas_entrada_columns
- fix_etl_silver_cliente_estatisticas_add_entrada
- create_rpc_cliente_stats_agregado

---

## 2026-04-20 (Complemento — Fixes de qualidade bronze/silver)

### Triagem e fixes de 9 bugs bronze/silver

Investigação dirigida categorizou bugs: FIX VIÁVEL (3), UPSTREAM (3), ACEITAR (1), JÁ RESOLVIDO (3).

#### Fixes aplicados

**1. Umbler direcao (fix #1)**
- Criada função `public.umbler_derivar_direcao(tipo_remetente)`
- Bronze já tinha direcao populada como 'saida'/'entrada' (bug reportado era info errada)
- Função disponível para uso futuro em `silver.umbler_atendimento_diario`

**2. ContaAzul proxies de conciliação (fix #4)**
- Adicionadas colunas: `lancamentos_liquidados` (derivada de status=ACQUITTED), `valor_juros_multas` (pago-bruto quando positivo)
- Schema atualizado, ETL rebuild pendente (cron diário)
- ~93% dos lançamentos = ACQUITTED (proxy de conciliado)

**3. Flag margem_suspeita produtos_top (fix #7)**
- Adicionada coluna `silver.produtos_top.margem_suspeita`
- TRUE quando margem < -50% ou > 100%
- UPDATE histórico: 17 produtos flagados (8 bar 3 + 9 bar 4)
- ETL update pendente (cron diário)
- Protege dashboards de margens ilusórias (-824%)

#### Documentado como débito upstream

**BUG #2 (Bar 4 comida custo zero):** Cadastro seletivo em AMBOS bares. Bar 3 "Pratos Individuais" R$ 211k sem custo. Bar 4 sandubas/petiscos R$ 644k. Gestores precisam cadastrar custos no ContaHub. Técnica OK (cervejas têm custo).

**BUG #3 (ContaAzul metodo_pagamento NULL):** API não retorna. Conceito diferente de ContaHub `meio` (caixa vs contábil). Não crítico.

**BUG #6 (22 lançamentos pago > bruto):** Juros/multas acumulados (0,03%). Capturados em `valor_juros_multas`.

#### Já resolvidos

- BUG #5: Falae data_visita — COALESCE em silver.nps_diario
- BUG #8: Yuzer órfãs — consolidadas P3
- BUG #9: nps_agregado_semanal — tabela funcional

### Migrations aplicadas (52 total)

50. `fix_umbler_direcao_derive_from_tipo_remetente`
51. `add_silver_contaazul_conciliado_e_juros`
52. `add_silver_produtos_top_margem_suspeita`

---

## 2026-04-20 (Sessão domingo madrugada — INÍCIO GOLD LAYER)

### Primeira Gold em produção: `gold.clientes_ativos_diario`

**Objetivo**: fornecer série temporal diária do indicador crítico "clientes
ativos" com drilldown multidimensional.

**Definição unificada adotada**: cliente ativo = 2+ visitas nos últimos 90 dias
(resolve divergência semântica histórica entre 2 RPCs legacy).

#### Fase 1.1 — Fix RPCs pre-Gold

Refatoradas 2 RPCs críticas que liam `public.visitas` (view legacy) para
`silver.cliente_visitas`:

- `calcular_clientes_ativos_periodo(bar_id, inicio, fim, data_90d_atras)` → v2
- `get_count_base_ativa(bar_id, data_inicio, data_fim)` → v2

Backup v1 preservado (drop 2026-04-27 se v2 estável).

Paridade v1 vs v2: divergência -0,9% a -5,6% (explicada: v1 inflava por
dedup falsa na view legacy usando `DISTINCT ON (..., valor_consumo, mesa_desc)`.
v2 mais preciso, conta visitas reais de `cliente_visitas.id` único).

#### Fase 1.2 — `gold.clientes_ativos_diario`

**Estrutura:**

- 31 colunas, 1 linha por `(bar_id, data_referencia)`
- **Core**: `total_ativos`, `total_ativos_7d/30d/90d/365d_atras`,
  `delta_7d/30d/90d/365d`, `delta_7d/30d/90d/365d_pct`
- **Dimensão Perfil**: `ativos_cervejeiros`, `ativos_drinkeiros`,
  `ativos_comiloes`, `ativos_ecleticos`, `ativos_sem_perfil`
- **Dimensão Valor**: `ativos_vip` (percentil > 89), `ativos_regulares`
  (p10-89), `ativos_casuais` (< p10)
- **Dimensão Canais**: `ativos_com_whatsapp`, `ativos_com_email`,
  `ativos_com_reservas_getin`
- **Dimensão Tempo**: `ativos_novos` (primeira_visita < 30d),
  `ativos_consolidados` (>= 30d)
- **Base**: `total_clientes_base`, `pct_ativos_vs_base`

**Cobertura backfill (histórico completo):**

- Bar 3: 444 dias (2025-01-31 → 2026-04-19)
- Bar 4: 473 dias (2025-01-02 → 2026-04-19)

**Validações (100% sanidade):**

- Paridade Gold vs RPC v2: diff = 0 em 6/7 snapshots mensais (1 diff=-1,
  0,02% em 5.552 — desprezível)
- Soma perfis = total_ativos: 0 erros em 917 linhas
- Soma valor (VIP+reg+cas) = total_ativos: 0 erros (fix: `> 89` vs `>= 90`)
- Soma novos = total_ativos: 0 erros
- ativos_com_whatsapp < total_ativos: 0 violações

**Evolução temporal bar 3 (crescimento realista):**

| Mês | Média ativos | Pico | YoY (abr/26) |
|-----|--------------|------|--------------|
| 2025-02 | 144 | 357 | — |
| 2025-06 | 1.802 | 1.993 | — |
| 2025-10 | 3.436 | 3.626 | — |
| 2025-12 | 5.124 | 5.648 | — |
| 2026-01 | 5.567 | 5.687 | — |
| 2026-04 | 5.093 | 5.149 | +265-356% |

**ETL iterativa (evita timeout):**

Abordagem dia-a-dia (loop PL/pgSQL chamando `get_count_base_ativa` + enriquecimento
por `array_agg` + JOIN silver.cliente_estatisticas) ao invés de CTE gigante com
CROSS JOIN LATERAL (que causava timeout > 30 dias).

Backfill bar 3 completo: ~1,5min (11 blocos).  
Backfill bar 4 completo: ~30s (11 blocos).

**Cron diário:**

- `gold-clientes-ativos-diario` (jobid 456, `50 11 * * *` = 08:50 BRT)
- Chama `etl_gold_clientes_ativos_diario_all_bars(7)` — recalcula últimos 7 dias

**Impacto:**

- KPI "clientes ativos" agora disponível para drilldown por perfil, valor,
  canal, tempo, com comparativos WoW/MoM/QoQ/YoY pré-calculados
- Elimina necessidade de calcular on-the-fly nas rotas `/clientes-ativos`,
  `/desempenho`, `/planejamento-comercial` (otimização futura)
- Base para campanhas de retenção segmentadas ("VIPs ativos caindo WoW",
  "cervejeiros sem WhatsApp", etc.)

#### Migrations aplicadas (10)

40. `backup_rpcs_clientes_ativos_v1`
41. `create_rpcs_clientes_ativos_v2_unified`
42. `fix_rpcs_clientes_ativos_v2_compat_criterio`
43. `create_gold_clientes_ativos_diario`
44. `create_etl_gold_clientes_ativos_diario_full` (v1)
45. `rewrite_etl_gold_clientes_ativos_light`
46. `fix_etl_gold_clientes_ativos_optimized`
47. `simplify_etl_gold_clientes_ativos_remove_valor_breakdown`
48. `restore_etl_gold_clientes_ativos_valor_breakdown_fixed`
49. `create_etl_gold_clientes_ativos_all_bars_e_cron`

#### Débitos Gold #1

- Drop RPCs `_v1_backup` em 2026-04-27 se v2 estável
- Dimensão "ativos_sem_perfil" + "ativos_ecleticos" revisão futura
  (pode consolidar com threshold)

#### Próximas Golds planejadas (prioridade)

1. 🔴 `gold.planejamento_comercial_diario` (substitui `meta.eventos_base` 152 cols)
2. 🟠 `gold.desempenho_consolidado_semanal` (substitui `meta.desempenho_semanal`)
3. 🟠 `gold.cmv_historizado_semanal` (consolida CMV + comparativos)
4. 🟡 `gold.clientes_360_snapshot` (otimiza `/analitico/clientes`)
5. 🟡 `gold.segmentacao_clientes_pre_agregada` (Lista Quente + Filtros)
6. 🟢 `gold.reservantes_agregado_historico`

### Estado final sessão domingo (10h trabalho)

**Commits no main (10):**

- `8afbce99` — Fase 1: fantasmas + silver.vendas_diarias
- `c6c54842` — Refactor 29 rotas visitas
- `0f8e34c0` — CHANGELOG S1+S2+P1
- `e95a4dd1` — Refactor 23 rotas operations
- `eb66f0a1` — CHANGELOG P1.5+P2
- `dafa381d` — CHANGELOG P3 Yuzer
- `82feaeea` — fix tempo_estadia
- `9862f6e8` — Fase C refactor
- `705c6244` — CHANGELOG Fase C
- **[NEW]** — Gold #1: clientes_ativos_diario

**Arquitetura Medallion completa:**

- **Bronze**: 8 domínios externos integrados
- **Silver**: 16 tabelas reais (~1,13 GB), 13 crons (07:00 → 08:45 BRT)
- **Gold**: 1 tabela produtiva (917 linhas), 1 cron (08:50 BRT)

**Pipeline diário automatizado**: 07:00 adapters → 08:50 última Gold

**Linhas impactadas sessão**: ~3.500+ linhas (migrations + refactors + fixes)  
**Migrations banco**: 49 totais  
**Rotas frontend refatoradas**: 56

---

## 2026-04-19 (Fase C — Refactor frontend final)

### Eliminação de antipattern: writes em views legacy

4 rotas refatoradas consolidando arquitetura medallion no frontend:

#### A.1 — `analitico/clientes/perfil-consumo/sync` (REWIRE)

378 linhas → 73 linhas.  
Wrapper RPC chamando `etl_silver_cliente_estatisticas_full`.  
Elimina cálculo JS duplicado (tags + grouping) que divergia da lógica
PL/pgSQL do cron `silver-cliente-estatisticas-diario`.  
Botão UI "Sincronizar perfis" mantém UX.

#### A.2 — `falae/sync` (REWIRE PARCIAL)

Removidas funções `upsertDailyNps` e `upsertDailyNpsFromDatabase` (67
linhas) que duplicavam `silver.nps_diario`.  
Mantido: fetch API Falae + upsert `integrations.falae_respostas` (essenciais
para ingestão bronze).  
Atualizado: leitura `desempenho_semanal` de `crm.nps_falae_diario` para
`silver.nps_diario` com filtro JSONB `respostas_por_source.falae`.  
Validados 3 callers internos (`falae/sync-retroativo`, `cron/falae-reconciliacao`,
`desempenho/recalculo-diario`) — nenhum dependia dos side effects removidos.

#### B.1 — `crm/clientes-vip` (CONSOLIDAÇÃO)

2 queries paralelas → 1 query única em `silver.cliente_estatisticas`.  
Elimina merge `Map<telefone>` em JS (antes lia `crm.cliente_perfil_consumo` +
`public.cliente_estatisticas` views separadas).  
Aliases preservados no mapper de compat UI: `telefone`, `nome`, `total_gasto`,
`ticket_medio`, `is_vip`, `is_frequente`, `is_regular`.  
169 → 144 linhas.

#### B.2 — `analitico/clientes/perfil-consumo` GET (STRAIGHT SWAP)

`.from('cliente_perfil_consumo')` → `.schema('silver' as never).from('cliente_estatisticas')`.  
Atualiza `.in('telefone', ...)` para `.in('cliente_fone_norm', ...)`.  
Mapper compat preservando `telefone`/`nome`/`email` no response para UI.

### Impacto consolidado

- 4 arquivos modificados
- -371 linhas líquido (175 inserções / 546 deleções)
- 100% das escritas em views legacy eliminadas
- 0 breakage funcional (validado)
- Type-check + lint: zero erros

### Débitos restantes pós-Fase C

- Drop `etl_silver_cliente_visitas_dia_v1_backup` em 2026-04-26 (validar
  v2 estável 7 dias)
- Drop 3 backups legacy em 2026-05-19 (30 dias validação):
  - `crm.cliente_perfil_consumo_legacy_backup`
  - `crm.nps_falae_diario_legacy_backup`
  - `public.view_top_produtos_legacy_snapshot`
- Refactor 10 reads `silver_yuzer_*_evento` (ganho marginal, baixa prioridade)
- Bug Bronze ContaHub bar 4 (custos zerados — cadastro manual gestor)
- Bug Bronze Umbler `direcao` NULL (bloqueia `silver.umbler_atendimento_diario`)

### Commits da sessão domingo completa (8 total)

- `8afbce99` — Fase 1: fantasmas + silver.vendas_diarias
- `c6c54842` — Refactor 29 rotas visitas→silver
- `0f8e34c0` — CHANGELOG S1+S2+P1
- `e95a4dd1` — Refactor 23 rotas operations→silver
- `eb66f0a1` — CHANGELOG P1.5+P2
- `dafa381d` — CHANGELOG P3 (Yuzer silvers)
- `82feaeea` — fix tempo_estadia (bug captura bancária)
- `9862f6e8` — Fase C refactor frontend

### Estado final Silver Layer

- 16 tabelas silver físicas (~1.123 MB)
- 13 crons sequenciais (07:00 → 08:45 BRT)
- 8 domínios integrados via Medallion (ContaHub, Sympla, Falae, Google
  Reviews, Getin, ContaAzul, Yuzer + Umbler deferido)
- Bug crítico `tempo_estadia_minutos` corrigido em toda base (225.027 visitas)
- 52 rotas frontend refatoradas (Onda A-F: 29 visitas + Onda G: 23 operations + Fase C: 4 syncs/reads)
- Pipeline bronze → silver funcional e automatizado

---

## 2026-04-19 (Sessão domingo madrugada — Fase B + C + FIX tempo_estadia)

### Fase B — Análise exploratória 16 Silvers

Bateria de 25 queries descobertas em todas as Silvers para extrair
insights de negócio e detectar anomalias de dados.

**Achados de negócio acionáveis:**

- 20 dormentes high-value com WhatsApp prontos para campanha de retenção
  (todos R$ 1.000+ histórico, 30-74 dias off, 100% acionáveis via WhatsApp)
- Quarta é dia preferido de 9/20 VIPs cervejeiros (bar 3) — programação
  dedicada validada
- Sábado 38% maior que sexta em ambos bares
- Estadia prolongada correlaciona com gasto maior (visitas 5h+ gastam
  ~2x médio)
- NPS aponta "Tempo de Entrega" (4,43) e "Custo Benefício" (4,50) como
  pontos fracos consistentes
- Mix pagamento Yuzer estável: 53-61% crédito, 26-35% débito, 7-13% pix,
  <2% dinheiro (pode virar regra de negócio)
- Bar 4 negativo em 7 dos 12 meses (alerta P&L crítico)
- Carnaval 2026: 3.000-4.100 cortesias/dia vs 100-600 ingressos pagos —
  modelo financeiro depende inteiramente da conversão F&B no balcão
- IMPOSTO bar 3: R$ 333k em aberto (44% pago) — risco fiscal

**Bugs descobertos em Bronze (upstream, não no Silver):**

- Bar 4 COMIDA: todos 66 produtos com custo R$ 0 no ContaHub
  (gestor bar 4 não cadastrou custos — bug de cadastro, não de ETL)
- Bar 3 bebidas/drinks/comida: alguns produtos com margem negativa
  (custo cadastrado acima do preço)
- ContaAzul: `metodo_pagamento` NULL em 100%, `conciliado` sempre false
- Falae: `data_visita` NULL em 43% (já tratado via COALESCE no ETL)
- Umbler: `direcao` NULL em todas mensagens (bloqueia silver.umbler_atendimento_diario)

### Fase C (parcial) — Consolidação arquitetural

**C.1 — Safety drops adiados:**

- 3 backups com idade <30 dias (criados em 2026-04-19): manter até 2026-05-19
- `operations.vendas_item` e `operations.faturamento_pagamentos`: zero
  consumers ativos (frontend só comentário, banco zero functions/views)
  mas mantidos como compat por enquanto

**C.2 — Refactor frontend pendente (próxima sessão):**

- 4 reads `crm.nps_falae_diario` → `silver.nps_diario` (mapping de colunas)
- 10 reads `silver_yuzer_*_evento` → `.schema('silver').from('yuzer_*_evento')`
- 2 rotas `sync` que escrevem em views legacy (CRÍTICO — antipattern):
  - `analitico/clientes/perfil-consumo/sync` (duplica cron silver, descontinuar)
  - `falae/sync` (upsert em `crm.nps_falae_diario` view; redirecionar ou deprecar)

**C.3 — Bugs investigados:**

- Bar 4 COMIDA 100% margem: confirmado bug Bronze (custo zerado em
  3.597 linhas Batata Deboche, etc). Comparativo: [HH]Spaten 600ml tem
  R$ 89k de custo total, comida tem zero.
- Clientes sem perfil (756 bar 3): NÃO é bug — todos têm `total_itens=0`
  (couvert puro / sem produtos classificáveis). NULL é correto.

### FIX CRÍTICO — `tempo_estadia_minutos`

**Bug identificado e corrigido nesta sessão:**

ETL v1 (bug): lia `hr_lancamento`/`hr_transacao` de
`bronze_contahub_financeiro_pagamentosrecebidos` como proxy de
abertura/fechamento de mesa. Esses campos são **timestamps do processo
de captura bancária** — adquirentes Cielo/Stone/Pix fazem batch ~3h
após cada transação. Resultado: 98% das visitas com `tempo_estadia`
concentrado em 178-182min (107.206 em 180min exatos no bar 3).

Investigação forense (5 etapas) confirmou:

- Pix Auto: P50 da diff `hr_transacao - hr_lancamento` = 179,5min (fixo)
- Crédito/Débito Auto: P50 = 179,6min (batch noturno)
- Bronze tem 2 fontes temporais reais: `pagamentosrecebidos` (errada
  para estadia) e `produtos_temposproducao` (correta — t0_lancamento
  até t3_entrega, timestamps reais de pedido/entrega)

ETL v2 (fix): lê `t0_lancamento` e `t3_entrega` de
`bronze_contahub_produtos_temposproducao` agregado por
`(bar_id, dia, vd_mesadesc)`. Exclui mesas com rotação (vd distinto
mesmo dia, 0,4% bar 3 / 3,8% bar 4) via NOT EXISTS. Flag
`tem_estadia_calculada` agora exige `fechamento > abertura` (fix de 17
casos com abertura=fechamento — pedidos PP instantâneos).

**Validação do fix em produção:**

- 225.027 visitas recalculadas em 127 segundos (~2min backfill total)
- 915 dias processados (443 bar 3 + 472 bar 4)
- Mediana passou de 180min → 70min
- Visitas em 180min: 107.206 → 1.354 (-98,7%)
- Distribuição agora realista:
  - <15min: 30% bar 3, 21% bar 4 (PP rápido)
  - 30-60min: 11% bar 3, 14% bar 4
  - 1-2h: 20% bar 3, 23% bar 4
  - 2-3h: 14% bar 3, 14% bar 4
  - 3-5h: 14% bar 3, 12% bar 4
  - >5h: 6-7% (sessões longas/festas)

**Impacto downstream:**

- `silver.cliente_visitas`: 100% rebuildado, `versao_etl = 2`
- `silver.cliente_estatisticas`: rebuildado (108k clientes em 12s)
  - Bar 3: média 92min, P50 72min, P95 263min (era ~180min em todos)
  - Bar 4: média 111min, P50 86min, P95 313min
- Análises Fase B sobre "estadia 5h+ gasta 2x" mantêm direção mas
  com bases absolutas corretas; faixas precisam ser revistas

**Migrations aplicadas (35-39):**

35. `backup_etl_cliente_visitas_v1` (rename → `_v1_backup`)
36. `create_etl_cliente_visitas_v2_with_flag_fix`
37. `create_backfill_cliente_visitas_range_helper`
38. `drop_shadow_v2_objects` (limpeza shadow + helper)
39. (rebuild `cliente_estatisticas` via RPC `etl_silver_cliente_estatisticas_all_bars`)

**Estratégia de rollout:**

- Shadow table + função paralela testadas com 1 dia (15/04 bar 3)
- Comparação v1 vs v2 + 10 spot checks manuais validados
- Backfill em 10 blocos de ~60-90 dias (checkpoints intermediários)
- Cron diário (`silver-cliente-visitas-diario` jobid 446) continua
  funcionando — agora com lógica v2

**Débito remanescente:**

- Drop `etl_silver_cliente_visitas_dia_v1_backup` em 2026-04-26 após
  validar v2 estável em produção por 7 dias
- Análises downstream (dashboards, relatórios) podem agora usar faixas
  reais de estadia em vez do colapso 180min

---

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
