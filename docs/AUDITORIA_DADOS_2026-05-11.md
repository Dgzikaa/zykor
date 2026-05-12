# Auditoria Completa de Pipelines — 2026-05-11

> Sessão noturna a pedido do Rodrigo após descoberta de que **Apify ficou 8 dias
> silenciosamente parado** e o monitoramento marcava "success" todos os dias.

## TL;DR

- **3 pipelines silenciosamente parados** há 3+ semanas: Umbler, Sympla, Yuzer
- **1 pipeline parcialmente bloqueado**: Inter (webhooks sem fluxo recente — pode ser real)
- **Watchdog universal de data freshness implementado** cobrindo 13 pipelines bronze
- **Página `/operacional/saude-pipeline`** agora consome essa visão + heartbeats antigos
- **Alerta Discord automático** 3x/dia (8h, 12h, 18h BRT) no canal `pipeline_saude`
- **Apify Google Reviews**: foi corrigido durante esta sessão (PR #98 mais cedo), está OK

## Achados por pipeline

### 🔴 Críticos — silenciosamente parados

| Pipeline | Última atividade | Tempo parado | Causa raiz | Status fix |
|---|---|:-:|---|---|
| **Umbler** (WhatsApp) | 16/04 11h | **25 dias** | Edge function `umbler-sync-incremental` dando timeout > 30min (auto-cleanup mata o heartbeat). Cron continua rodando mas todas execuções falham. Alerta `alerta-umbler-sync-falha` está com `jobid = 314` hardcoded, mas o job foi recriado e jobid mudou → alerta nunca dispara | Investigar amanhã. Provável: API Umbler ficou mais lenta ou volume aumentou demais |
| **Sympla** (ingressos online) | 17/04 03h | **24 dias** | **Não existe cron de sync no bronze**. Só existe `silver-sympla-bilheteria-diario` (ETL). Se bronze não atualiza, silver fica estagnado | Investigar amanhã — precisa criar cron de sync ou descobrir se a edge function existe e foi removida do cron |
| **Yuzer** (bilheteria física) | 19/04 03h | **22 dias** | Cron `yuzer-eventos-discovery` está ativo e roda função `yuzer_cron_descobrir_eventos` → chama `yuzer_sync_eventos(3, ...)` → retorna "0 eventos da api, 0 ins, 0 upd em 0.01s". 0.01s é instantâneo demais pra ter feito HTTP request real à API Yuzer | Investigar amanhã — provável: token Yuzer expirou ou config mudou |

### 🟠 Atenção

| Pipeline | Última atividade | Análise |
|---|---|---|
| Inter webhooks | 06/05 16h | 5 dias sem PIX. Pode ser real (não houve PIX) OU webhook do Inter parou de chegar. Difícil saber sem comparar com Conta Azul |
| ContaHub bar 4 (Deboche) | 10/05 07h | 40h atrás. Domingo 10/05 Deboche estava fechado, então parcial é esperado. SLA aumentado pra 48h |
| google-sheets-sync | 11/05 05h | 18h atrás — health_color `red` na matview antiga |
| agente-dispatcher | 11/05 17h | 5h atrás — health_color `red` (parece ser usado mas falhando) |

### 🟢 OK

- ContaHub bar 3 (sync hoje 7h)
- ContaAzul bar 3 e 4 (sync de hoje)
- GetIn (sync de hoje 23h)
- Falaê (sync de hoje)
- Google Reviews (corrigido hoje, 6751 reviews capturados)

## O que foi implementado nesta sessão

### 1. Watchdog universal — `system.data_freshness_config`

Tabela de configuração que define quais pipelines monitorar:

```sql
SELECT pipeline_name, categoria, sla_horas_max, criticidade
FROM system.data_freshness_config WHERE ativo = true;
```

**Pipelines monitoradas**:
contahub_raw · contaazul · getin · sympla · yuzer · google_reviews · falae · umbler · inter_webhooks · instagram_account

Adicionar nova pipeline = inserir 1 linha (sem código).

### 2. Função `verificar_data_freshness()`

Retorna status real de cada pipeline:

```sql
SELECT * FROM verificar_data_freshness();
-- Retorna: pipeline_name, bar_id, ultimo_em, horas_atras, volume_24h,
--          status (ok/atrasado/volume_baixo/sem_dados), problema, criticidade
```

### 3. Alerta Discord — `alertar_data_freshness_discord()`

Cron `data-freshness-watchdog` roda **3x/dia** (8h, 12h, 18h BRT) e dispara
notificação Discord no canal `pipeline_saude` com lista de pipelines
problemáticas, ordenadas por criticidade. Tem **dedup por dia** então não
spamma.

### 4. View `gold.v_pipeline_health_completo`

UNION entre:
- Matview antiga `gold.v_pipeline_health` (cobre só 34 edge functions com heartbeat)
- Pipelines bronze do watchdog universal (13 entries)

Total: **47 pontos de monitoramento** visíveis em `/operacional/saude-pipeline`.

### 5. Endpoint atualizado

`/api/operacional/saude-pipeline` agora lê da view nova → frontend
mostra todos os pipelines.

## Recomendações pra amanhã (em ordem)

1. **Investigar Umbler timeout**: ver edge function `umbler-sync-incremental`, identificar por que demora >30min. Provável fix: paginar/incrementalizar.
2. **Investigar Yuzer**: rodar manualmente `yuzer_sync_eventos` com debug pra entender por que retorna 0.
3. **Investigar Sympla**: descobrir se edge function `sympla-sync` existe e por que não tem cron ativo.
4. **Fix alerta `alerta-umbler-sync-falha`**: trocar `jobid = 314` hardcoded por lookup pelo nome (`WHERE jobname = '...'`).
5. **Replicar fix do PR #98** em todas edge functions de sync: garantir que `records_affected = 0` com volume esperado dispara erro (não silencia).

## Onde olhar a partir de agora

- **Página visual**: https://zykor.com.br/operacional/saude-pipeline (precisa selecionar bar)
- **SQL ad-hoc**: `SELECT * FROM verificar_data_freshness() WHERE status <> 'ok';`
- **Forçar alerta manual**: `SELECT alertar_data_freshness_discord();`
- **Cron**: `SELECT * FROM cron.job WHERE jobname = 'data-freshness-watchdog';`
- **Config**: `SELECT * FROM system.data_freshness_config;`

## Arquivos alterados

- `database/migrations/2026-05-11-data-freshness-watchdog.sql` (criação watchdog)
- `database/migrations/2026-05-11-v-pipeline-health-freshness.sql` (view nova)
- `frontend/src/app/api/operacional/saude-pipeline/route.ts` (consome view nova)
