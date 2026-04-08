# PROMPTS HOTFIX - 05 de Abril 2026

## Contexto Crítico
O deploy do FIN-2 quebrou a edge function `contahub-sync-automatico` (v17 retornando 500).
O Cursor adicionou `requireAuth(req)` no handler mas NÃO adicionou o import.
Isso impediu o sync de dados do ContaHub para 04/04 (sábado).

---

## HOTFIX-1: Deploy contahub-sync-automatico corrigido

### O que foi corrigido (já feito no arquivo):
- Adicionado `import { requireAuth } from '../_shared/auth-guard.ts';` na linha 7

### O que você precisa fazer:
1. Commitar a correção:
```bash
cd backend
git add supabase/functions/contahub-sync-automatico/index.ts
git commit -m "hotfix: adicionar import requireAuth faltando no contahub-sync-automatico

O FIN-2 adicionou requireAuth(req) mas esqueceu o import, causando 500 em v17.
Isso impediu sync de dados do ContaHub desde o deploy."
```

2. Fazer deploy da edge function:
```bash
cd backend
npx supabase functions deploy contahub-sync-automatico --project-ref uqtgsvujwcbymjmvkjhy
```

3. Validar que a função voltou a funcionar:
```bash
curl -X POST https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"bar_id": 3, "data_date": "2026-04-04", "source": "hotfix-manual"}'
```

4. Espere ~30 segundos e faça o mesmo para bar 4:
```bash
curl -X POST https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"bar_id": 4, "data_date": "2026-04-04", "source": "hotfix-manual"}'
```

### Validação:
Após o sync, verificar no Supabase SQL:
```sql
SELECT bar_id, dt_gerencial::date as data, count(*) as comandas, sum(vr_pagamentos) as faturamento
FROM contahub_periodo
WHERE dt_gerencial::date = '2026-04-04'
GROUP BY bar_id, dt_gerencial::date;
```
Deve retornar registros para bar_id 3 e 4.

---

## HOTFIX-2: Criar cron de retry para evitar recorrência

### Problema estrutural:
O sync do ContaHub roda UMA VEZ por dia às 07:00 BRT. Se o ContaHub não tiver fechado o dia gerencial (sábados/feriados), os dados ficam zerados até o dia seguinte.

### Solução:
Criar uma função SQL que verifica se o dia anterior tem dados e, se não tiver, dispara o sync novamente.

Execute no Supabase SQL Editor:

```sql
-- Função que re-sincroniza o ContaHub se o dia anterior está sem dados
CREATE OR REPLACE FUNCTION public.retry_contahub_sync_dia_anterior()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  data_ontem date := current_date - interval '1 day';
  registros_bar3 int;
  registros_bar4 int;
BEGIN
  -- Verificar se há registros do ContaHub para ontem
  SELECT count(*) INTO registros_bar3
  FROM contahub_periodo
  WHERE dt_gerencial::date = data_ontem AND bar_id = 3;

  SELECT count(*) INTO registros_bar4
  FROM contahub_periodo
  WHERE dt_gerencial::date = data_ontem AND bar_id = 4;

  -- Se bar 3 não tem dados, re-sincronizar
  IF registros_bar3 = 0 THEN
    RAISE NOTICE 'Retry ContaHub bar 3 para %', data_ontem;
    PERFORM net.http_post(
      url := get_supabase_url() || '/functions/v1/contahub-sync-automatico',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_service_role_key()
      ),
      body := jsonb_build_object(
        'bar_id', 3,
        'data_date', data_ontem::text,
        'automated', true,
        'source', 'pgcron-retry-14h'
      ),
      timeout_milliseconds := 120000
    );
  END IF;

  -- Aguardar entre chamadas
  PERFORM pg_sleep(5);

  -- Se bar 4 não tem dados, re-sincronizar
  IF registros_bar4 = 0 THEN
    RAISE NOTICE 'Retry ContaHub bar 4 para %', data_ontem;
    PERFORM net.http_post(
      url := get_supabase_url() || '/functions/v1/contahub-sync-automatico',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_service_role_key()
      ),
      body := jsonb_build_object(
        'bar_id', 4,
        'data_date', data_ontem::text,
        'automated', true,
        'source', 'pgcron-retry-14h'
      ),
      timeout_milliseconds := 120000
    );
  END IF;

  -- Log do resultado
  IF registros_bar3 > 0 AND registros_bar4 > 0 THEN
    RAISE NOTICE 'Retry não necessário - dados já existem (bar3: %, bar4: %)', registros_bar3, registros_bar4;
  END IF;
END;
$function$;

-- Agendar retry diário às 14:00 BRT (17:00 UTC)
SELECT cron.schedule(
  'contahub-retry-14h-se-vazio',
  '0 17 * * *',
  'SELECT retry_contahub_sync_dia_anterior();'
);
```

### Por que isso resolve:
- Às 07:00: sync normal roda (funciona para dias da semana)
- Às 14:00: retry verifica se há dados; se não houver (sábados/feriados), re-sincroniza
- O retry é inteligente: NÃO faz chamada se os dados já existem
- Custo zero em dias normais (apenas 2 SELECTs count)
