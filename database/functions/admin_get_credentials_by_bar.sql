-- Função: admin_get_credentials_by_bar (duas versões)
CREATE OR REPLACE FUNCTION public.admin_get_credentials_by_bar(p_bar_id integer)
 RETURNS TABLE(id integer, bar_id integer, nome text, client_id text, client_secret text, scope text, redirect_uri text, auth_url text, token_url text, expires_at timestamp with time zone, refresh_token text, access_token text, ativo boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.api_credentials ac WHERE ac.bar_id = p_bar_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_credentials_by_bar(p_bar_id integer, p_sistema character varying, p_ambiente character varying)
 RETURNS TABLE(id integer, bar_id integer, sistema character varying, ambiente character varying, client_id character varying, client_secret character varying, redirect_uri character varying, scopes text, base_url character varying, access_token text, refresh_token text, token_type character varying, expires_at timestamp with time zone, authorization_code character varying, oauth_state character varying, empresa_id character varying, empresa_nome character varying, empresa_cnpj character varying, last_token_refresh timestamp with time zone, token_refresh_count integer, ativo boolean, criado_em timestamp without time zone, atualizado_em timestamp without time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY SELECT ac.id, ac.bar_id, ac.sistema, ac.ambiente, ac.client_id, ac.client_secret, ac.redirect_uri, ac.scopes, ac.base_url, ac.access_token, ac.refresh_token, ac.token_type, ac.expires_at, ac.authorization_code, ac.oauth_state, ac.empresa_id, ac.empresa_nome, ac.empresa_cnpj, ac.last_token_refresh, ac.token_refresh_count, ac.ativo, ac.criado_em, ac.atualizado_em
  FROM public.api_credentials ac WHERE ac.bar_id = p_bar_id AND ac.sistema = p_sistema AND ac.ambiente = p_ambiente AND ac.ativo = true ORDER BY ac.atualizado_em DESC LIMIT 1;
END;
$$;
