-- Função: executar_recalculo_desempenho_v2
-- Wrapper SQL para chamar a Edge Function recalcular-desempenho-v2
-- Criada em: 2026-03-19 (cutover V1 → V2)

CREATE OR REPLACE FUNCTION public.executar_recalculo_desempenho_v2()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_url TEXT;
  v_request_id BIGINT;
  v_semana_atual INT;
  v_ano_atual INT;
BEGIN
  -- Calcular semana anterior (fechada)
  SELECT EXTRACT(WEEK FROM CURRENT_DATE - INTERVAL '7 days')::INT INTO v_semana_atual;
  SELECT EXTRACT(ISOYEAR FROM CURRENT_DATE - INTERVAL '7 days')::INT INTO v_ano_atual;
  
  v_url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/recalcular-desempenho-v2';
  
  RAISE NOTICE 'Executando recálculo V2 para semana %/% (ambos bares, mode=write)...', v_semana_atual, v_ano_atual;
  
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := jsonb_build_object(
      'all_bars', true,
      'ano', v_ano_atual,
      'numero_semana', v_semana_atual,
      'mode', 'write'
    ),
    timeout_milliseconds := 120000
  ) INTO v_request_id;
  
  RAISE NOTICE 'Request ID: %', v_request_id;
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro ao executar recálculo V2: %', SQLERRM;
END;
$function$;
