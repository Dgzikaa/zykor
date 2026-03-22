-- Função: admin_save_tokens
CREATE OR REPLACE FUNCTION public.admin_save_tokens(p_bar_id integer, p_sistema character varying, p_ambiente character varying, p_access_token text, p_refresh_token text, p_expires_at timestamp with time zone)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE api_credentials SET access_token = p_access_token, refresh_token = COALESCE(p_refresh_token, refresh_token), expires_at = p_expires_at, last_token_refresh = NOW(), token_refresh_count = COALESCE(token_refresh_count, 0) + 1, atualizado_em = NOW()
  WHERE bar_id = p_bar_id AND sistema = p_sistema AND ambiente = p_ambiente;
END;
$$;
