-- Função: admin_get_credentials_by_state
CREATE OR REPLACE FUNCTION public.admin_get_credentials_by_state(p_bar_id integer, p_sistema character varying, p_ambiente character varying, p_oauth_state character varying)
 RETURNS TABLE(id integer, bar_id integer, sistema character varying, ambiente character varying, client_id character varying, client_secret character varying, redirect_uri character varying, access_token text, refresh_token text, oauth_state character varying)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN QUERY SELECT ac.id, ac.bar_id, ac.sistema, ac.ambiente, ac.client_id, ac.client_secret, ac.redirect_uri, ac.access_token, ac.refresh_token, ac.oauth_state
  FROM api_credentials ac WHERE ac.bar_id = p_bar_id AND ac.sistema = p_sistema AND ac.ambiente = p_ambiente AND ac.oauth_state = p_oauth_state;
END;
$$;
