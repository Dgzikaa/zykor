-- Cron diário dos golds da conciliação fiscal (últimos 60 dias, bares ativos).
CREATE OR REPLACE FUNCTION public.cron_refresh_conciliacao_fiscal()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_bar RECORD; v_de date; v_ate date; v_res jsonb := '[]'::jsonb;
BEGIN
  v_de := (now()::date - 60); v_ate := now()::date;
  FOR v_bar IN SELECT id FROM operations.bares WHERE ativo = TRUE ORDER BY id LOOP
    BEGIN
      v_res := v_res || gold.fn_refresh_conciliacao_fiscal(v_bar.id, v_de, v_ate);
    EXCEPTION WHEN OTHERS THEN
      v_res := v_res || jsonb_build_object('bar_id', v_bar.id, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('executado_em', now(), 'periodo', jsonb_build_object('de', v_de, 'ate', v_ate), 'bares', v_res);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.cron_refresh_conciliacao_fiscal() TO service_role;

SELECT cron.schedule('conciliacao-fiscal-diario', '20 11 * * *', 'SELECT public.cron_refresh_conciliacao_fiscal();');
