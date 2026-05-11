-- ============================================================
-- 2026-05-11 — Discord canais por categoria + cleanup geral
-- ============================================================
-- Mudanças:
--   1. enviar_alerta_discord_sistema passa a buscar em
--      system.discord_webhooks (estava sem schema, falhava)
--   2. Aceita parâmetro p_tipo (alertas_criticos / relatorios_ia /
--      insights / sync_logs) — default alertas_criticos
--   3. enviar_alerta_discord_sistema_dedup repassa o tipo
--   4. Nova RPC public.get_discord_webhook(p_tipo) usada por
--      edge functions via .rpc() (schema system não é exposto
--      ao PostgREST por padrão)
--   5. Drop cron 275 — refresh_view_visao_geral_anual (view foi
--      removida; falhava todo dia 03:00 há semanas)
--   6. Drop cron 236 — atualizar-sympla-yuzer-diario (active=false
--      desde abril, integração legada)
--   7. Drop cron 395 — sympla-sync-semanal (Sympla desligado)
--   8. Drop 3 funções *_v1_backup (sem callers)
-- ============================================================

BEGIN;

-- ----------------------------------------------------------------
-- 1) Fix enviar_alerta_discord_sistema
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enviar_alerta_discord_sistema(
  p_titulo  text,
  p_mensagem text,
  p_cor      integer DEFAULT 16711680,
  p_bar_id   integer DEFAULT 3,
  p_tipo     text    DEFAULT 'alertas_criticos'
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_webhook_url TEXT;
  v_req_id      BIGINT;
BEGIN
  SELECT webhook_url INTO v_webhook_url
  FROM system.discord_webhooks
  WHERE tipo = p_tipo
    AND ativo = true
  ORDER BY (bar_id = p_bar_id) DESC, id
  LIMIT 1;

  IF v_webhook_url IS NULL THEN
    RAISE WARNING 'Discord webhook não encontrado para tipo=% bar_id=%', p_tipo, p_bar_id;
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'embeds', jsonb_build_array(
        jsonb_build_object(
          'title', p_titulo,
          'description', p_mensagem,
          'color', p_cor,
          'timestamp', now(),
          'footer', jsonb_build_object('text', 'Zykor — Bar ' || p_bar_id)
        )
      )
    ),
    timeout_milliseconds := 30000
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$function$;

-- ----------------------------------------------------------------
-- 2) enviar_alerta_discord_sistema_dedup — adiciona p_canal
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enviar_alerta_discord_sistema_dedup(
  p_bar_id     integer,
  p_tipo       text,
  p_categoria  text,
  p_titulo     text,
  p_mensagem   text,
  p_cor        integer DEFAULT 15158332,
  p_dedupe_key text    DEFAULT NULL,
  p_canal      text    DEFAULT 'alertas_criticos'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_key       text;
  v_req_id    bigint;
  v_ja_existe boolean;
BEGIN
  v_key := COALESCE(
    p_dedupe_key,
    md5(COALESCE(p_categoria,'') || '|' || COALESCE(p_titulo,'') || '|' || COALESCE(p_mensagem,''))
  );

  SELECT EXISTS (
    SELECT 1
    FROM system.alertas_enviados
    WHERE categoria = p_categoria
      AND (dados->>'dedupe_key') = v_key
      AND criado_em::date = current_date
  ) INTO v_ja_existe;

  IF v_ja_existe THEN
    RETURN 'SKIPPED_DUPLICATE key=' || v_key;
  END IF;

  SELECT public.enviar_alerta_discord_sistema(
    p_titulo,
    p_mensagem,
    p_cor,
    COALESCE(p_bar_id, 3),
    p_canal
  ) INTO v_req_id;

  INSERT INTO system.alertas_enviados (
    bar_id, tipo, categoria, titulo, mensagem, dados, enviado_discord
  ) VALUES (
    COALESCE(p_bar_id, 3),
    COALESCE(p_tipo, 'info'),
    COALESCE(p_categoria, 'sistema'),
    p_titulo,
    p_mensagem,
    jsonb_build_object(
      'dedupe_key', v_key,
      'request_id', v_req_id,
      'canal',      p_canal,
      'origem',     'sql_direct_discord'
    ),
    (v_req_id IS NOT NULL)
  );

  RETURN 'ENVIADO key=' || v_key || ' request_id=' || COALESCE(v_req_id::text, 'null');
END;
$function$;

-- ----------------------------------------------------------------
-- 3) RPC pública: get_discord_webhook(p_tipo) usada via PostgREST
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_discord_webhook(p_tipo text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT webhook_url
  FROM system.discord_webhooks
  WHERE tipo = p_tipo AND ativo = true
  ORDER BY id
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_discord_webhook(text) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------
-- 4) Drops de cron jobs órfãos
-- ----------------------------------------------------------------
-- jobid 275: refresh_view_visao_geral_anual — view não existe mais
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 275) THEN
    PERFORM cron.unschedule(275);
  END IF;
END $$;

-- jobid 236: atualizar-sympla-yuzer-diario — já inativo, integração legada
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 236) THEN
    PERFORM cron.unschedule(236);
  END IF;
END $$;

-- jobid 395: sympla-sync-semanal — Sympla desligado por completo
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 395) THEN
    PERFORM cron.unschedule(395);
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 5) Drop de funções *_v1_backup sem callers
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.calcular_clientes_ativos_periodo_v1_backup(integer, date, date, date);
DROP FUNCTION IF EXISTS public.etl_silver_cliente_visitas_dia_v1_backup(integer, date);
DROP FUNCTION IF EXISTS public.get_count_base_ativa_v1_backup(integer, date, date);

COMMIT;
