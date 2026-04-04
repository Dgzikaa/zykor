-- ============================================================================
-- MIGRAÇÃO DE SEGURANÇA: Reabilitar JWT e Adicionar Auth para Crons
-- Data: 04/04/2026
-- ============================================================================

CREATE OR REPLACE FUNCTION call_edge_function_with_cron_auth(
  p_function_url TEXT,
  p_body JSONB DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response http_response;
  v_service_role_key TEXT;
  v_cron_secret TEXT;
BEGIN
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  v_cron_secret := current_setting('app.settings.cron_secret', true);
  
  IF v_service_role_key IS NULL OR v_cron_secret IS NULL THEN
    RAISE EXCEPTION 'Service role key ou cron secret não configurados';
  END IF;
  
  SELECT * INTO v_response
  FROM net.http_post(
    url := p_function_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key,
      'Content-Type', 'application/json',
      'x-cron-secret', v_cron_secret
    ),
    body := p_body
  );
  
  RAISE NOTICE 'Edge Function chamada: % - Status: %', p_function_url, v_response.status;
  
  RETURN v_response.content::jsonb;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao chamar Edge Function: %', SQLERRM;
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
