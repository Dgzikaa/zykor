# DIAGNÓSTICO COMPLETO + PROMPTS HOTFIX — 06 de Abril 2026

## Resumo Executivo

A investigação revelou **12 problemas interconectados** causando instabilidade sistêmica. A causa raiz principal é que o **deploy v20 da edge function `contahub-sync-automatico`** adicionou um mecanismo de lock (`acquire_job_lock`) que **nunca foi criado no banco de dados**, bloqueando TODOS os syncs desde o deploy.

### O que já foi corrigido via SQL (Cowork, 06/04 14:30 BRT):
1. ✅ Criadas funções `acquire_job_lock()` e `release_job_lock()` no banco
2. ✅ Limpos 4 heartbeats órfãos com status "running" desde 19/03
3. ✅ Sync ContaHub 05/04 executado (bar 3: 362 registros, bar 4: 61 registros)
4. ✅ Valores financeiros corrigidos no contahub_periodo de 05/04 (bar 3: R$34.258,55)
5. ✅ Evento 1005 (04/04) corrigido: te_real de 21.725 → 22,97 e tb_real de 68.716 → 72,64
6. ✅ Eventos S14 marcados com `precisa_recalculo = true`

### O que ainda precisa ser corrigido pelo Cursor (URGENTE):
- 🔴 Tabela `nibo_agendamentos` não existe → bloqueia TODO `calculate_evento_metrics`
- 🔴 `processar_raw_data_pendente()` não mapeia campos `$`-prefixed corretamente
- 🔴 `recalcular-desempenho-v2` retornando 503 → desempenho parado desde 02/04
- 🔴 `sync-dispatcher` retornando 404 → cliente_estatisticas desatualizado
- 🔴 Schema `contahub_pagamentos` faltando coluna `bandeira`
- 🔴 Schema `contahub_tempo` com tipo errado na coluna `dia`

---

## PROMPT 1: Criar tabela nibo_agendamentos (CRÍTICO — BLOQUEIA TUDO)

### Contexto:
A função `calculate_evento_metrics` referencia `nibo_agendamentos` que NÃO existe.
Isso faz com que `auto_recalculo_eventos_pendentes()` falhe com erro em 100% dos eventos:
`"relation nibo_agendamentos does not exist"`

Sem isso, NENHUM evento pode ser recalculado, e o desempenho semanal não é atualizado.

### O que fazer:

1. Buscar a definição de `calculate_evento_metrics` no banco:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'calculate_evento_metrics';
```

2. Identificar EXATAMENTE como `nibo_agendamentos` é referenciada (colunas, joins, etc.)

3. Opção A (preferível): Se a tabela é para dados do Nibo (sistema financeiro), criar a tabela:
```sql
CREATE TABLE IF NOT EXISTS public.nibo_agendamentos (
  id serial PRIMARY KEY,
  -- colunas baseadas no que calculate_evento_metrics espera
  created_at timestamptz DEFAULT now()
);
```

4. Opção B: Se Nibo não está integrado ainda, remover a referência de `calculate_evento_metrics`:
```sql
-- Editar a função para não depender de nibo_agendamentos
-- Usar COALESCE ou fallback para dados de custo artístico
```

### Validação:
```sql
-- Deve retornar sucesso
SELECT * FROM auto_recalculo_eventos_pendentes('teste');
-- Verificar se evento 1006 (05/04) agora tem real_r > 0
SELECT id, data_evento, real_r, cl_real FROM eventos_base WHERE id = 1006;
```

---

## PROMPT 2: Corrigir processar_raw_data_pendente (campos $-prefixed)

### Contexto:
A função `processar_raw_data_pendente()` insere registros em `contahub_periodo` com valores financeiros ZERADOS.
O raw data do ContaHub tem campos com prefixo `$`:
- `$vr_pagamentos` → deve mapear para `vr_pagamentos`
- `$vr_produtos` → `vr_produtos`
- `$vr_couvert` → `vr_couvert`
- `$vr_desconto` → `vr_desconto`
- `$vr_repique` → `vr_repique`

Também há 2 erros de schema:
- `contahub_pagamentos`: coluna `bandeira` não existe
- `contahub_tempo`: coluna `dia` é do tipo `date` mas recebe `text`

### O que fazer:

1. Ver a função atual:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'processar_raw_data_pendente';
```

2. Na parte de processamento do tipo `periodo`, trocar os mapeamentos de:
```sql
(item->>'vr_pagamentos')::numeric
```
Para:
```sql
COALESCE((item->>'$vr_pagamentos'), (item->>'vr_pagamentos'), '0')::numeric
```

3. Para `contahub_pagamentos`, adicionar coluna `bandeira`:
```sql
ALTER TABLE contahub_pagamentos ADD COLUMN IF NOT EXISTS bandeira text;
```

4. Para `contahub_tempo`, corrigir casting na função:
```sql
-- Onde está:
(item->>'dia')::date
-- Trocar para:
(item->>'dia')::timestamp with time zone AT TIME ZONE 'America/Sao_Paulo'
-- Ou simplesmente:
LEFT(item->>'dia', 10)::date
```

### Validação:
```sql
-- Marcar raw data de 05/04 como não processados para reprocessar
UPDATE contahub_raw_data SET processed = false WHERE data_date = '2026-04-05';
-- Rodar processamento
SELECT processar_raw_data_pendente();
-- Verificar que agora tem valores financeiros
SELECT bar_id, sum(vr_pagamentos) as fat FROM contahub_periodo WHERE dt_gerencial::date = '2026-04-05' GROUP BY bar_id;
```

---

## PROMPT 3: Corrigir recalcular-desempenho-v2 (retornando 503)

### Contexto:
A edge function `recalcular-desempenho-v2` está retornando 503 (Service Unavailable).
O cron `desempenho-v2-diario` (09:00 BRT) chama `executar_recalculo_desempenho_v2()` que usa `net.http_post` para chamar essa função.
O desempenho_semanal S14 está parado em R$87.456 desde 02/04 (faltam dados de 02/04 a 05/04).

A função SQL `executar_recalculo_desempenho_v2()` ainda usa JWT hardcoded em vez de `get_service_role_key()`.

### O que fazer:

1. Verificar a edge function no Supabase Dashboard:
```bash
cd backend
cat supabase/functions/recalcular-desempenho-v2/index.ts
```

2. Verificar se faz deploy corretamente:
```bash
npx supabase functions deploy recalcular-desempenho-v2 --project-ref uqtgsvujwcbymjmvkjhy
```

3. Atualizar a função SQL para usar `get_service_role_key()`:
```sql
CREATE OR REPLACE FUNCTION public.executar_recalculo_desempenho_v2()
-- ... substituir JWT hardcoded por get_service_role_key()
```

4. Após o fix, disparar manualmente:
```sql
SELECT executar_recalculo_desempenho_v2();
```

### Validação:
```sql
-- S14 deve ter faturamento_total > 300K (somando todos os dias 30/03 a 05/04)
SELECT numero_semana, faturamento_total, updated_at
FROM desempenho_semanal
WHERE numero_semana = 14 AND ano = 2026 AND bar_id = 3;
```

---

## PROMPT 4: Corrigir sync-dispatcher (retornando 404)

### Contexto:
O cron `sync-cliente-estatisticas-diario` chama `sync-dispatcher` que retorna 404.
Isso impede a atualização da tabela `cliente_estatisticas`, usada pela Lista Quente.

A tabela `cliente_estatisticas` tem dados até 04/04 (95.505 clientes bar 3).
O filtro "última visita 1-7 dias" retorna 2.935 clientes DIRETAMENTE no banco.

### O que fazer:

1. Verificar se a função existe:
```bash
cd backend
ls supabase/functions/sync-dispatcher/
```

2. Se não existir, pode ter sido deletada. Verificar no git:
```bash
git log --oneline --all -- supabase/functions/sync-dispatcher/
```

3. Se existir, fazer deploy:
```bash
npx supabase functions deploy sync-dispatcher --project-ref uqtgsvujwcbymjmvkjhy
```

4. Se foi removida intencionalmente, atualizar o cron para chamar a função correta:
```sql
UPDATE cron.job SET command = '...' WHERE jobid = 390;
```

### Validação:
```sql
-- Chamar manualmente
SELECT net.http_post(
  url := get_supabase_url() || '/functions/v1/sync-dispatcher',
  headers := jsonb_build_object('Authorization', 'Bearer ' || get_service_role_key(), 'Content-Type', 'application/json'),
  body := jsonb_build_object('action', 'clientes')
);
```

---

## PROMPT 5: Investigar Lista Quente retornando 0 clientes

### Contexto:
A página Clientes → Lista Quente retorna 0 clientes com filtros NPS (última visita 1-7 dias, 1+ visitas, window 90 dias).
MAS: a query direta no banco retorna **2.935 clientes** com esses filtros.

O route handler está em:
`frontend/src/app/api/crm/lista-quente/route.ts`

A lógica de filtragem (linhas 439-457) usa:
- `ultimaVisitaMinDias`: `ultimaVisita < (hoje - X dias)` (inativo há X+ dias)
- `ultimaVisitaMaxDias`: `ultimaVisita >= (hoje - X dias)` (ativo nos últimos X dias)

### Possíveis causas:
1. A função `getHojeBrasilia()` pode retornar data errada em produção Vercel (UTC vs BRT)
2. O fetch inicial pode não estar trazendo os clientes corretos
3. O campo `ultimaVisita` dos objetos pode não estar parseado como Date

### O que investigar:
1. Verificar se o route handler faz `new Date(c.ultimaVisita)` corretamente
2. Verificar se a comparação `c.ultimaVisita < dataCorte` funciona com o tipo correto
3. Testar localmente com os mesmos filtros da UI
4. Adicionar log temporário para ver quantos clientes passam por cada filtro

### Atenção:
Os logs da edge function mostram chamadas a `api-clientes-externa?ultima_visita_desde=2026-04-05&ultima_visita_ate=2026-04-05` — essas são chamadas DIFERENTES (busca por telefone/data específica), NÃO são da Lista Quente.

---

## PROMPT 6: Limpar funções e crons quebrados

### Edge functions retornando erro:
| Função | Status | Problema |
|--------|--------|----------|
| `sync-dispatcher` | 404 | Função não deployada |
| `desempenho-semanal-auto` | 404 | Função não existe |
| `sync-contagem` | 404 | Função não existe |
| `google-reviews-sync` | 404 | Função não existe |
| `google-sheets-dispatcher` | 404 | Função não existe |
| `sync-marketing-meta` | 404 | Função não existe |
| `agente-dispatcher` | 500 | Bug v12 |
| `recalcular-desempenho-v2` | 503 | Bug/crash |

### O que fazer:
1. Para cada função 404: verificar se existe no repo, fazer deploy ou desativar o cron
2. Para funções 500/503: investigar e corrigir
3. Atualizar crons que chamam funções inexistentes para evitar ruído nos logs

```sql
-- Listar TODOS os crons que chamam edge functions
SELECT jobid, jobname, active,
  CASE
    WHEN command ILIKE '%functions/v1/%' THEN regexp_replace(command, '.*functions/v1/([^''\"]+).*', '\1')
    ELSE 'SQL puro'
  END as function_called
FROM cron.job
WHERE active = true
ORDER BY jobname;
```

---

## PROMPT 7: Atualizar funções SQL com JWT hardcoded

### Contexto:
Várias funções SQL ainda usam JWT hardcoded em vez de `get_service_role_key()`.
Isso é um risco de segurança e dificulta rotação de chaves.

### Funções afetadas:
1. `sync_contahub_ambos_bares()` — usa `v_service_key text := 'eyJhbGci...'`
2. `executar_recalculo_desempenho_v2()` — usa JWT hardcoded no header

### O que fazer:
```sql
-- Para cada função, substituir:
-- DE: 'Authorization', 'Bearer eyJhbGciOiJI...'
-- PARA: 'Authorization', 'Bearer ' || get_service_role_key()

-- Verificar get_service_role_key() existe e funciona:
SELECT get_service_role_key();
```

---

## Ordem de Execução Recomendada

1. **PROMPT 1** (nibo_agendamentos) — desbloqueia recálculo de eventos
2. **PROMPT 2** (processar_raw_data) — corrige processamento financeiro
3. **PROMPT 3** (recalcular-desempenho-v2) — corrige desempenho semanal
4. **PROMPT 4** (sync-dispatcher) — corrige sync de cliente_estatisticas
5. **PROMPT 5** (Lista Quente) — investiga bug do frontend
6. **PROMPT 6** (limpeza geral) — remove ruído de funções 404
7. **PROMPT 7** (JWT hardcoded) — melhoria de segurança

Após os prompts 1-3, disparar recálculo completo:
```sql
-- Recalcular eventos pendentes
SELECT * FROM auto_recalculo_eventos_pendentes('hotfix-pos-nibo');
-- Recalcular desempenho
SELECT executar_recalculo_desempenho_v2();
```

---

## Dados de Referência

### Faturamento esperado S14 (30/03 a 05/04) — Ordinário (bar 3):
| Data | Evento | real_r |
|------|--------|--------|
| 30/03 SEG | Segunda da Resenha | R$ 13.496,52 |
| 31/03 TER | 7naRoda | R$ 21.686,89 |
| 01/04 QUA | Quarta de Bamba | R$ 52.407,46 |
| 02/04 QUI | Véspera Feriado | R$ 64.601,08 |
| 03/04 SEX | Feriado Pagode Vira Lata | R$ 82.523,66 |
| 04/04 SAB | Feijuca do Ordi | R$ 98.325,19 |
| 05/04 DOM | Uma Mesa e Um Pagode | R$ 34.258,55 (recém sincronizado) |
| **TOTAL** | | **~R$ 367.299** |

O desempenho_semanal S14 mostra R$87.456 (atualizado pela última vez em 02/04). Após correção, deve mostrar ~R$367K.
