CREATE OR REPLACE FUNCTION public.enviar_alerta_discord_sistema(p_titulo text, p_mensagem text, p_cor integer DEFAULT 16711680, p_bar_id integer DEFAULT 3)
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
  WHERE bar_id = p_bar_id
    AND tipo = 'alertas'
    AND ativo = true
  LIMIT 1;

  IF v_webhook_url IS NULL THEN
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
          'footer', jsonb_build_object('text', 'Zykor - Monitoramento')
        )
      )
    ),
    timeout_milliseconds := 30000
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$function$;
