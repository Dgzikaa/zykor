# SAVE POINT — Próxima sessão Gold Layer

## Estado em 20/04/2026 (segunda)

18 commits aplicados. 4 Golds criadas.

### Gold Layer atual

| Gold | Status | Dados |
|------|--------|-------|
| #1 clientes_ativos_diario | Completa + cron 08:50 | 917 linhas |
| #2 planejamento_comercial_diario | Completa + cron 08:50 + 1 tela refatorada | 950 linhas |
| #3 desempenho_semanal | **DDL pronta, ETL pendente** | 0 linhas |
| #4 cmv_semanal_calculado | Completa v1 + cron 08:55 | 137 semanas |

### Próxima tarefa: ETL Gold #3 desempenho_semanal

**DDL já aplicada** em commit 510d626e (110 colunas).

**Mapping fontes completo** (do diagnóstico):

- 90 cols auto-populáveis (Silver/Gold)
- 15 cols JOIN meta.marketing_semanal
- 17 cols deriváveis no ETL
- 29 cols manuais permanecem em meta.desempenho_semanal (LEFT JOIN frontend)
- 13 cols excluídas (obsoletas)

**ETL requer 11 JOINs:**

1. silver.vendas_diarias (faturamento base)
2. silver.cliente_visitas (clientes, tempos)
3. silver.tempos_producao (atrasos cozinha/bar)
4. silver.getin_reservas_diarias (reservas)
5. silver.nps_diario (NPS 8 dimensões)
6. silver.google_reviews_diario (Google ratings)
7. gold.planejamento_comercial_diario (agregação diária)
8. gold.clientes_ativos_diario (clientes_30d/60d/90d)
9. gold.cmv_semanal_calculado (CMV direto)
10. meta.marketing_semanal (Marketing Orgânico + Meta Ads)
11. bronze.bronze_contaazul_lancamentos (custos categorizados)

**Estimativa:** 6-7h dedicadas.

### Plano próxima sessão (6-7h)

1. ETL fase A — Silver core (2h)
   - Agregação vendas/clientes/tempos/reservas por semana ISO
   
2. ETL fase B — Gold JOIN (1h)
   - JOIN Gold #1, #2, #4 por semana
   
3. ETL fase C — NPS + Google + Marketing (1h)
   - Agregação silver.nps_diario (média por dimensão)
   - silver.google_reviews_diario agregado
   - JOIN meta.marketing_semanal
   
4. ETL fase D — Custos ContaAzul (1h)
   - Pattern matching categorias (imposto, comissão, cmo, etc)
   - 17 colunas de custos operacionais
   
5. Derivados (30min)
   - Percentuais (perc_bebidas, perc_drinks, etc)
   - Splits temporais (qui_sab_dom, ter_qua_qui, sex_sab)
   - lucro_rs = faturamento - custos_total
   
6. Backfill + wrapper + cron (1h)
   - 2025-2026, ~136 semanas x 2 bares
   - Cron 09:00 BRT
   
7. Validação + commit (30min)

### Refactors frontend aguardando Gold #3

- estrategico/desempenho/route.ts (758 linhas)
- estrategico/desempenho/mensal/route.ts (649 linhas)
- estrategico/desempenho/services/desempenho-mensal-service.ts (300 linhas)
- eventos/recalcular-eventos-base/route.ts (210 linhas)

Total: ~1.917 linhas JS a eliminar.

### Débitos técnicos ativos

**Drops programados:**
- 2026-04-26: RPCs clientes_ativos v1 backup
- 2026-04-27: ETL tempo_estadia v1 backup
- 2026-05-19: 3 backups legacy silver

**Gold #4 v2 pendente:**
- Consumos via pattern matching motivocancdesconto
- Schema correto: itm_vrcheio, motivocancdesconto
- Refactor rota buscar-dados-automaticos (609 linhas)

**Upstream (não atacável):**
- Bar 4 COMIDA custo zero
- Bar 4 cadastro telefone 17.8%
- ContaAzul metodo_pagamento NULL
- Umbler direcao (deferido)

### Golds futuras mapeadas

- gold.clientes_360 (snapshot por cliente, baseia /analitico/clientes)
- gold.segmentacao_clientes_janela (Lista Quente + Filtros Avançados)
- gold.reservantes_historico

### Arquitetura final confirmada

**Bronze:** ~35 tabelas (8 domínios)  
**Silver:** 16 tabelas (~1.13 GB)  
**Gold:** 4 tabelas (3 completas + 1 DDL)  
**Crons:** 15 automatizados

### Prompt pra colar no próximo chat

"voltei claude. Gold #3 desempenho_semanal. DDL já aplicada 
(commit 510d626e). Contexto completo em docs/NEXT_SESSION.md. 
Atacar ETL agora — Silver core primeiro, depois JOINs."
