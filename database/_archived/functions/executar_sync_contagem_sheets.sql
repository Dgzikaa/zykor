-- Função: executar_sync_contagem_sheets
CREATE OR REPLACE FUNCTION public.executar_sync_contagem_sheets() RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE response extensions.http_response;
BEGIN
  SELECT * INTO response FROM extensions.http(('POST', 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/sync-contagem-sheets?dias_atras=7', ARRAY[extensions.http_header('Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true))], 'application/json', '{}')::extensions.http_request);
  RAISE NOTICE 'Sync Contagem Sheets executado. Status: %', response.status;
END;
$$;
