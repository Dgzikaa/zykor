-- Função: enviar_alerta_discord_sistema_dedup
CREATE OR REPLACE FUNCTION public.enviar_alerta_discord_sistema_dedup(p_bar_id integer, p_tipo text, p_categoria text, p_titulo text, p_mensagem text, p_cor integer DEFAULT 15158332, p_dedupe_key text DEFAULT NULL)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_key text; v_req_id bigint; v_ja_existe boolean;
BEGIN
  v_key := COALESCE(p_dedupe_key, md5(COALESCE(p_categoria,'') || '|' || COALESCE(p_titulo,'') || '|' || COALESCE(p_mensagem,'')));
  SELECT EXISTS (SELECT 1 FROM alertas_enviados WHERE categoria = p_categoria AND (dados->>'dedupe_key') = v_key AND criado_em::date = current_date) INTO v_ja_existe;
  IF v_ja_existe THEN RETURN 'SKIPPED_DUPLICATE key=' || v_key; END IF;
  SELECT public.enviar_alerta_discord_sistema(p_titulo, p_mensagem, p_cor) INTO v_req_id;
  INSERT INTO alertas_enviados (bar_id, tipo, categoria, titulo, mensagem, dados, enviado_discord) VALUES (COALESCE(p_bar_id, 3), COALESCE(p_tipo, 'info'), COALESCE(p_categoria, 'sistema'), p_titulo, p_mensagem, jsonb_build_object('dedupe_key', v_key, 'request_id', v_req_id, 'origem', 'sql_direct_discord'), (v_req_id IS NOT NULL));
  RETURN 'ENVIADO key=' || v_key || ' request_id=' || COALESCE(v_req_id::text, 'null');
END;
$$;
