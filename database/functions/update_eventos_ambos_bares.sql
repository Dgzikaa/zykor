-- Função: update_eventos_ambos_bares
CREATE OR REPLACE FUNCTION public.update_eventos_ambos_bares() RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$ DECLARE data_ontem DATE; resultado_ordinario TEXT; resultado_deboche TEXT;
BEGIN data_ontem := CURRENT_DATE - INTERVAL '1 day'; RAISE NOTICE 'Atualizando eventos para %', data_ontem;
BEGIN resultado_ordinario := update_eventos_base_from_contahub_batch(data_ontem, 3); RAISE NOTICE 'Ordinário: %', resultado_ordinario; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Erro ao atualizar Ordinário: %', SQLERRM; END;
BEGIN resultado_deboche := update_eventos_base_from_contahub_batch(data_ontem, 4); RAISE NOTICE 'Deboche: %', resultado_deboche; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Erro ao atualizar Deboche: %', SQLERRM; END;
END; $$;
