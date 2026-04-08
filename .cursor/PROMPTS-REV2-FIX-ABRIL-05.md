# REV-2-FIX — Correção de regressão dos cron jobs

**Data**: 05/04/2026
**Status**: EXECUTADO DIRETAMENTE via Supabase MCP (Cowork)
**Contexto**: A migração REV-2 corrigiu o JWT hardcoded mas QUEBROU bodies, actions e URLs de 25 dos 29 cron jobs

## O que aconteceu

A migration REV-2 (migrar JWT hardcoded para `get_service_role_key()`) foi executada pelo Cursor, mas além de trocar o header de Authorization, o Cursor TAMBÉM modificou incorretamente:

1. **Action names** — ex: `processar_pendentes` virou `processar-alertas`, `proativos` virou `alertas-proativos`
2. **URLs de edge functions** — ex: `google-reviews-apify-sync` virou `google-reviews-sync` (404)
3. **Parâmetros do body** — ex: `bar_ids: [3,4]` virou `bar_id: 3`, `dias_anteriores: 7` foi removido
4. **timeout_milliseconds** foram removidos de todos os jobs

## Impacto

- `alertas-dispatcher` → HTTP 500 a cada 30min (action errada)
- `sync-dispatcher` → HTTP 400 (action errada, params faltando)
- `integracao-dispatcher` → HTTP 400 (action errada, params faltando)
- 7 jobs com 404 (URLs de edge functions erradas)
- 7 jobs com params faltantes (data_date, dias_anteriores, todas_semanas, bar_ids)

## Correção aplicada (25 jobs)

Todos os 25 jobs foram corrigidos diretamente via SQL no Supabase em 05/04/2026.

### Jobs corrigidos — alertas-dispatcher (4):
| Job | Action corrigida |
|-----|-----------------|
| processar-alertas-discord | `processar_pendentes` + bar_id:3 |
| alertas-proativos-manha | `proativos` + bar_id:3 |
| alertas-proativos-tarde | `proativos` + bar_id:3 |
| relatorio-matinal-discord | `relatorio_matinal` + bar_id:3 |

### Jobs corrigidos — sync-dispatcher/agente-dispatcher (5):
| Job | Action corrigida | Params restaurados |
|-----|-----------------|-------------------|
| relatorio-metas-semanal | `metas` | bar_id:3 |
| sync-cliente-estatisticas-diario | `clientes` | (sem bar_id) |
| sync-conhecimento-diario | `conhecimento` | barId:3 (camelCase), forceUpdate:false |
| sync-eventos-diario | `eventos` | source, timestamp dinâmico |
| sync-marketing-meta-diario | `marketing` | bar_id, semana, ano dinâmicos |

### Jobs corrigidos — integracao-dispatcher (3):
| Job | Action corrigida | Params restaurados |
|-----|-----------------|-------------------|
| getin-sync-continuo | `getin` | automated:true, source:pg_cron_continuo |
| sympla-sync-semanal | `sympla` | start_date, end_date, automated, source |
| yuzer-sync-semanal | `yuzer` | start_date, end_date, automated, source |

### Jobs corrigidos — URLs erradas (7):
| Job | URL errada | URL correta |
|-----|-----------|-------------|
| google-reviews-daily-sync | google-reviews-sync | google-reviews-apify-sync |
| google-sheets-sync-diario | google-sheets-dispatcher | google-sheets-sync |
| sync-contagem-ordinario | sync-contagem | sync-contagem-sheets?dias_atras=1&bar_id=3 |
| sync-contagem-deboche | sync-contagem | sync-contagem-sheets?dias_atras=1&bar_id=4 |
| umbler-sync-diario-11h-20h | umbler-sync | umbler-sync-incremental |
| stockout-processar-auto-ordinario | stockout-processar-auto | stockout-processar |
| stockout-processar-auto-deboche | stockout-processar-auto | stockout-processar |

### Jobs corrigidos — params faltantes (6):
| Job | Params restaurados |
|-----|-------------------|
| stockout-sync-diario-correto-v2 | data_date: CURRENT_DATE |
| stockout-sync-diario-deboche | data_date: CURRENT_DATE |
| contahub-resync-semanal-ordinario | dias_anteriores: 7 |
| contahub-resync-semanal-deboche | dias_anteriores: 7 |
| cmv-semanal-auto-diario | todas_semanas:true, ano dinâmico, timeout:300s |
| monitor-concorrencia-diario | bar_ids:[3,4] (ambos bares), timeout:120s |

### Jobs que estavam OK (4):
- agente-analise-mensal
- agente-analise-semanal
- watchdog-15min
- sync-cmv-sheets-diario

## Validação pós-correção

```sql
-- 0 jobs com JWT hardcoded ✅
SELECT COUNT(*) FROM cron.job WHERE command ILIKE '%eyJhbGciOi%'; -- 0

-- 29 jobs com auth seguro ✅
SELECT COUNT(*) FROM cron.job WHERE command ILIKE '%get_service_role_key%'; -- 29

-- Todas as URLs corretas ✅
-- Todos os actions corretos ✅
-- Todos os params restaurados ✅
```
