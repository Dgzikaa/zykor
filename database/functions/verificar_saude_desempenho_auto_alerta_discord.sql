-- Função: verificar_saude_desempenho_auto_alerta_discord (LEGADO)
CREATE OR REPLACE FUNCTION public.verificar_saude_desempenho_auto_alerta_discord() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_data_ref date := current_date; v_ano int := EXTRACT(ISOYEAR FROM current_date)::int; v_semana int := EXTRACT(WEEK FROM current_date)::int; v_msg text := ''; v_bar int; v_exists bool; v_updated_today bool;
BEGIN
  FOR v_bar IN SELECT unnest(ARRAY[3,4]) LOOP
    SELECT EXISTS (SELECT 1 FROM desempenho_semanal ds WHERE ds.bar_id = v_bar AND ds.ano = v_ano AND ds.numero_semana = v_semana) INTO v_exists;
    IF NOT v_exists THEN v_msg := v_msg || format('• Bar %s: semana atual %s/%s não existe em desempenho_semanal.\n', v_bar, v_semana, v_ano); CONTINUE; END IF;
    SELECT EXISTS (SELECT 1 FROM desempenho_semanal ds WHERE ds.bar_id = v_bar AND ds.ano = v_ano AND ds.numero_semana = v_semana AND ds.updated_at::date = v_data_ref) INTO v_updated_today;
    IF NOT v_updated_today THEN v_msg := v_msg || format('• Bar %s: semana atual %s/%s não foi atualizada hoje (%s).\n', v_bar, v_semana, v_ano, v_data_ref); END IF;
  END LOOP;
  IF v_msg <> '' THEN RETURN public.enviar_alerta_discord_sistema_dedup(3, 'erro', 'desempenho_auto', 'Desempenho automático não atualizou', 'Falhas detectadas:\n\n' || v_msg, 15158332, 'desempenho_auto_' || v_data_ref::text); END IF;
  RETURN 'OK_SEM_ALERTA';
END;
$$;
