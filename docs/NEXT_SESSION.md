# SAVE POINT — Próxima sessão Gold Layer

## DECISAO ARQUITETURAL PENDENTE — Gold por TELA vs por DOMINIO

### Problema

Hoje temos 2 filosofias misturadas:
- `gold.clientes_ativos_diario` (por domínio)
- `gold.planejamento_comercial_diario` (por tela/uso)

Isso gera 3 problemas:
1. Tela `/estrategico/planejamento` não tem dados de clientes_ativos
2. Tela `/relatorios/clientes-ativos` usa Gold #1 (só métrica específica)
3. Futuras Golds: qual filosofia adotar?

### Decisão proposta: Filosofia B (por tela/uso)

Motivo: matches como gestor pensa (por dashboard/uso), 
não por domínio abstrato. UI não precisa fazer JOINs.

### Refactor proposto (4-5h descansado)

1. ALTER TABLE `gold.planejamento_comercial_diario` adicionar:
   - `total_visitas_dia`
   - `total_clientes_unicos_dia`
   - `novos_clientes_dia`
   - `retornantes_dia`
   - `total_ativos` (snapshot base 90d)
   - Perfis de ativos (cervejeiros, drinkeiros, etc)
   - Deltas 7/30/90/365 de ativos

2. Atualizar ETL `planejamento_comercial_diario_full` 
   para calcular essas métricas

3. Rebuild backfill (~30min)

4. Migrar `/api/clientes-ativos` para consumir 
   `gold.planejamento_comercial_diario` (não mais `clientes_ativos_diario`)

5. Depreciar `gold.clientes_ativos_diario`:
   - Criar view compat temporária
   - Drop programado 30 dias

### Implicação para Gold #3 desempenho_semanal

Ela agrega `gold.planejamento_comercial_diario` por semana.
Se planejamento tiver todas métricas, desempenho consolida 
tudo num lugar só.

### Filosofia adotada daqui pra frente

Golds diárias pensadas por **TELA/USO**, não domínio:
- `gold.planejamento_comercial_diario` = tudo que telas diárias precisam
- `gold.desempenho_semanal` = tudo que telas semanais precisam
- `gold.cmv_semanal_calculado` = específico CMV (caso único)

### Rollback do commit 57a088c1?

**NÃO fazer rollback**. Próxima sessão o refactor vai 
re-apontar `/api/clientes-ativos` para planejamento 
diretamente (pulando `gold.clientes_ativos_diario`).

### Priorização próxima sessão

1. Gold #3 `desempenho_semanal` ETL (6-7h) -- **prioridade**
2. Refactor expansão `planejamento_comercial_diario` (4-5h)
3. Depreciar `clientes_ativos_diario`

**Total próxima sessão dedicada:** dia inteiro (12h+) 
OU dividir em 2 sessões.

---

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
