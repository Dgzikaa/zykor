# Follow-ups deferidos — Sprint Perf+Sec abril 2026

> Items que **não estão prontos** para ataque imediato. Cada um tem razão clara e gatilho de revisita.

## #28 — RAM upgrade 8GB → 16GB

**Razão:** Decisão depende de **24-72h de dados Vercel Speed Insights** pós-merge do PR #17 (instrumentação Web Vitals). Decidir hoje seria chute — não há baseline de tempo de resposta real medido em produção.

**Gatilho de revisita:** 2026-04-29 (3 dias pós-merge #17).

**O que fazer ao revisitar:**
1. Pull dados de Vercel Speed Insights (LCP, FID, CLS, TTFB) das últimas 72h
2. Cross-check com `pg_stat_statements` — `mean_exec_time` em queries hot
3. Comparar com baseline conhecido (sem instrumentação prévia)
4. Decidir: upgrade RAM (~$50/mo) só se LCP p75 > 2.5s OU mean_exec_time > 200ms em queries críticas

---

## #30 — Dirty git tree (~104 arquivos)

**Razão:** Triagem manual de **alto risco** — 104 arquivos `D` (deletions) e `M` (modificações) acumulados ao longo da sprint. Misturados:
- Lixo legítimo (`.cursor/*.md`, `commit_*.txt`, snapshots temporários)
- Trabalho legítimo modificado mas não commitado (`PlanejamentoClient.tsx`, `package.json`)
- Arquivos arquivados em sub-pastas (`docs/historico/`)

Mandar tudo junto com 8 outras tasks vira soup. Risco de deletar trabalho real do usuário.

**Gatilho de revisita:** Sessão dedicada de 1-2h, **fora de outras tarefas concorrentes**.

**O que fazer ao revisitar:**
1. `git status -uall` para inventário completo
2. Triagem por categoria:
   - `.cursor/`: deletar tudo (notas pessoais antigas)
   - `commit_*.txt`: deletar tudo (rascunhos descartados)
   - `temp_*.json`, `*.csv`: deletar tudo
   - `package.json`, `package-lock.json`: revisar diff e commitar separado
   - `frontend/src/app/**/*.tsx` modificados: revisar com usuário antes
3. Commit em 3-4 PRs por categoria

---

## #41 — pg_repack / VACUUM FULL em operations.eventos_base

**Razão:** Operação **bloqueante para writes** (VACUUM FULL trava a tabela inteira) ou exige extensão `pg_repack` instalada. `eventos_base` é tabela hot do pipeline ETL — qualquer downtime impacta cron jobs em horário comercial.

**Estado atual:** `table_bloat` advisor flagga tabela como "excessive bloat" mas autovacuum tuning (perf/04 + reloptions out-of-band) já deve estar mantendo dead_pct baixo. Bloat físico (espaço em disco fragmentado) só é resolvido via VACUUM FULL ou pg_repack.

**Gatilho de revisita:** Janela de baixo tráfego (madrugada de domingo, 02h-05h BRT) **com monitoring ativo**.

**O que fazer ao revisitar:**
1. Pre-flight: medir bloat real via `pgstattuple` — calcular se vale o downtime
   ```sql
   SELECT * FROM pgstattuple('operations.eventos_base');
   ```
2. Se `tuple_percent < 60%`: **vale a pena**. Se `> 70%`: bloat baixo, pular.
3. Pausar crons que escrevem em `eventos_base` por ~10min:
   - `calculate_evento_metrics`
   - `contahub_processor`
4. Executar `VACUUM FULL operations.eventos_base;` (ou `pg_repack -t operations.eventos_base`)
5. Re-snapshot bloat após
6. Reativar crons

**Plano B (preferido):** instalar `pg_repack` extension via Supabase support — operação online sem lock pesado.

---

## Resumo

| # | Item | Por que diferido | Quando revisitar |
|---|------|------------------|------------------|
| #28 | RAM 8→16 GB | Sem dados Vercel pós-#17 ainda | 2026-04-29 |
| #30 | Dirty tree (104 arquivos) | Triagem requer foco solo | Sessão dedicada 1-2h |
| #41 | pg_repack eventos_base | Operação pesada, exige janela noturna | Domingo 02-05h BRT |

Estes itens são **conscientemente** mantidos no backlog — não são bug, são decisões de timing.
