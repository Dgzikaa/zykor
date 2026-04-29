-- 2026-04-29: Alerta sync silencioso ContaAzul + Falae
--
-- Contexto: padrao recorrente de sync diario que para silenciosamente sem
-- alerta. Casos recentes:
--   - ContaAzul: parado 12 dias (16-28/04) — fix em PR #41
--   - Falae: parou hoje (cron Vercel falhou silenciosamente)
--
-- Solucao em 2 niveis:
--   1. Auto-heal: cron pg_cron 09:30 BRT diario tenta sync manual via http()
--      antes de alertar. Se sync recuperar, nao alerta.
--   2. Alerta Discord: se auto-heal falhou, dispara alerta com deduplicacao
--      via enviar_alerta_discord_sistema_dedup (infra existente).
--
-- Thresholds (idade do ultimo created_at no bronze/integrations):
--   ContaAzul: > 16h sem dados novos (cron 354 roda a cada 8h, max esperado 8h)
--   Falae: > 30h sem dados novos (cron Vercel diario 03:00 BRT)
--
-- Cron pg_cron: 09:30 BRT (12:30 UTC) — depois dos crons que devem rodar
-- de manha mas antes do horario de almoco onde sócio pode olhar dashboard.

CREATE OR REPLACE FUNCTION public.verificar_sync_silencioso_falae_contaazul()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_falae_max timestamptz;
  v_falae_idade_h numeric;
  v_contaazul_max timestamptz;
  v_contaazul_idade_h numeric;
  v_msg text := '';
  v_data text := current_date::text;
  v_resp jsonb;
  v_falae_recovered boolean := false;
  v_ca_recovered boolean := false;
BEGIN
  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '120000');

  -- Falae: idade do ultimo created_at em bronze
  SELECT MAX(created_at), EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/3600
  INTO v_falae_max, v_falae_idade_h
  FROM bronze.bronze_falae_respostas;

  IF v_falae_idade_h > 30 THEN
    -- Auto-heal: sync manual com days_back=10
    BEGIN
      SELECT content::jsonb INTO v_resp
      FROM extensions.http((
        'POST',
        'https://zykor.com.br/api/falae/sync',
        ARRAY[extensions.http_header('Content-Type', 'application/json')],
        'application/json',
        '{"bar_id":3,"days_back":10}'::text
      ));

      IF (v_resp->'respostas'->>'inseridas_atualizadas')::int > 0 THEN
        v_falae_recovered := true;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falae auto-heal falhou: %', SQLERRM;
    END;

    IF NOT v_falae_recovered THEN
      v_msg := v_msg || format(
        '• **Falae** parado ha %sh (ultimo: %s) — sync manual nao recuperou.' || E'\n',
        ROUND(v_falae_idade_h::numeric, 1),
        TO_CHAR(v_falae_max, 'DD/MM HH24:MI')
      );
    END IF;
  END IF;

  -- ContaAzul: idade do ultimo created_at em integrations
  SELECT MAX(created_at), EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/3600
  INTO v_contaazul_max, v_contaazul_idade_h
  FROM integrations.contaazul_lancamentos;

  IF v_contaazul_idade_h > 16 THEN
    BEGIN
      SELECT content::jsonb INTO v_resp
      FROM extensions.http((
        'POST',
        get_supabase_url() || '/functions/v1/contaazul-sync',
        ARRAY[
          extensions.http_header('Authorization', 'Bearer ' || get_service_role_key()),
          extensions.http_header('Content-Type', 'application/json')
        ],
        'application/json',
        '{"bar_id":3,"sync_mode":"daily_incremental"}'::text
      ));

      IF v_resp->>'success' = 'true' THEN
        v_ca_recovered := true;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'ContaAzul auto-heal falhou: %', SQLERRM;
    END;

    IF NOT v_ca_recovered THEN
      v_msg := v_msg || format(
        '• **ContaAzul** parado ha %sh (ultimo: %s) — sync manual nao recuperou.' || E'\n',
        ROUND(v_contaazul_idade_h::numeric, 1),
        TO_CHAR(v_contaazul_max, 'DD/MM HH24:MI')
      );
    END IF;
  END IF;

  -- Disparar alerta Discord se houver problema apos auto-heal
  IF v_msg <> '' THEN
    RETURN public.enviar_alerta_discord_sistema_dedup(
      3,
      'erro',
      'sync_silencioso',
      '🚨 Sync diario parado',
      'Pipelines criticos sem dados recentes em ' || v_data || ':' || E'\n\n' || v_msg
        || E'\nVerifique cron Vercel (Falae) e Supabase cron 354 (ContaAzul).',
      15158332,
      'sync_silencioso_' || v_data
    );
  END IF;

  RETURN 'OK_SEM_ALERTA';
END;
$function$;

-- Cron pg_cron diario 09:30 BRT
SELECT cron.schedule(
  'alerta-sync-silencioso-falae-contaazul',
  '30 12 * * *',
  $$SELECT public.verificar_sync_silencioso_falae_contaazul();$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname='alerta-sync-silencioso-falae-contaazul'
);
