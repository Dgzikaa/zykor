-- Função: admin_upsert_api_credentials
CREATE OR REPLACE FUNCTION public.admin_upsert_api_credentials(p_bar_id integer, p_sistema character varying, p_ambiente character varying, p_client_id character varying, p_client_secret character varying, p_redirect_uri character varying DEFAULT NULL, p_scopes text DEFAULT NULL, p_base_url character varying DEFAULT NULL)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id integer;
BEGIN
  INSERT INTO api_credentials (bar_id, sistema, ambiente, client_id, client_secret, redirect_uri, scopes, base_url, ativo, criado_em, atualizado_em) VALUES (p_bar_id, p_sistema, p_ambiente, p_client_id, p_client_secret, p_redirect_uri, p_scopes, p_base_url, true, NOW(), NOW())
  ON CONFLICT (bar_id, sistema, ambiente) DO UPDATE SET client_id = p_client_id, client_secret = p_client_secret, redirect_uri = COALESCE(p_redirect_uri, api_credentials.redirect_uri), scopes = COALESCE(p_scopes, api_credentials.scopes), base_url = COALESCE(p_base_url, api_credentials.base_url), atualizado_em = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
