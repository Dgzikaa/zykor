-- ============================================================
-- ROLLBACK 2026-05-11 — Discord canais por categoria
-- ============================================================
-- Atenção: este rollback restaura apenas a assinatura/comportamento
-- antigos das funções públicas. Os crons removidos (275, 236, 395)
-- e as funções *_v1_backup precisam ser recriados manualmente caso
-- necessário — eles já estavam órfãos antes do drop.

BEGIN;

-- Restaurar assinatura antiga de enviar_alerta_discord_sistema (sem p_tipo)
DROP FUNCTION IF EXISTS public.enviar_alerta_discord_sistema(text, text, integer, integer, text);

CREATE OR REPLACE FUNCTION public.enviar_alerta_discord_sistema(
  p_titulo text, p_mensagem text, p_cor integer DEFAULT 16711680, p_bar_id integer DEFAULT 3
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_webhook_url TEXT;
  v_req_id BIGINT;
BEGIN
  SELECT webhook_url INTO v_webhook_url
  FROM discord_webhooks
  WHERE bar_id = p_bar_id AND tipo = 'alertas' AND ativo = true
  LIMIT 1;

  IF v_webhook_url IS NULL THEN RETURN NULL; END IF;

  SELECT net.http_post(
    url := v_webhook_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('embeds', jsonb_build_array(jsonb_build_object(
      'title', p_titulo, 'description', p_mensagem, 'color', p_cor,
      'timestamp', now(), 'footer', jsonb_build_object('text','Zykor - Monitoramento')
    ))),
    timeout_milliseconds := 30000
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$function$;

-- Restaurar assinatura antiga de enviar_alerta_discord_sistema_dedup (sem p_canal)
DROP FUNCTION IF EXISTS public.enviar_alerta_discord_sistema_dedup(integer, text, text, text, text, integer, text, text);

CREATE OR REPLACE FUNCTION public.enviar_alerta_discord_sistema_dedup(
  p_bar_id integer, p_tipo text, p_categoria text, p_titulo text,
  p_mensagem text, p_cor integer DEFAULT 15158332, p_dedupe_key text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_key text; v_req_id bigint; v_ja_existe boolean;
BEGIN
  v_key := COALESCE(p_dedupe_key, md5(COALESCE(p_categoria,'')||'|'||COALESCE(p_titulo,'')||'|'||COALESCE(p_mensagem,'')));
  SELECT EXISTS (
    SELECT 1 FROM system.alertas_enviados
    WHERE categoria=p_categoria AND (dados->>'dedupe_key')=v_key AND criado_em::date=current_date
  ) INTO v_ja_existe;
  IF v_ja_existe THEN RETURN 'SKIPPED_DUPLICATE key='||v_key; END IF;

  SELECT public.enviar_alerta_discord_sistema(p_titulo, p_mensagem, p_cor) INTO v_req_id;

  INSERT INTO system.alertas_enviados (bar_id, tipo, categoria, titulo, mensagem, dados, enviado_discord)
  VALUES (COALESCE(p_bar_id,3), COALESCE(p_tipo,'info'), COALESCE(p_categoria,'sistema'),
          p_titulo, p_mensagem,
          jsonb_build_object('dedupe_key',v_key,'request_id',v_req_id,'origem','sql_direct_discord'),
          (v_req_id IS NOT NULL));

  RETURN 'ENVIADO key='||v_key||' request_id='||COALESCE(v_req_id::text,'null');
END;
$function$;

-- Remover RPC nova
DROP FUNCTION IF EXISTS public.get_discord_webhook(text);

COMMIT;
