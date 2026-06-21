-- 2026-06-20 — Lembrete de pedidos pendentes (aprovar no celular).
-- Push diário (09h local) pros bares com pedidos aguardando aprovação: "N pedidos, R$X,
-- abra pra aprovar". Push-only (não vai pro Discord). Ambos os bares.
CREATE OR REPLACE FUNCTION public.lembrar_pedidos_pendentes()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','financial','pg_temp' AS $$
DECLARE v_bar int; v_n int; v_total numeric; v_res text := '';
BEGIN
  FOREACH v_bar IN ARRAY ARRAY[3,4] LOOP
    SELECT count(*), COALESCE(sum(valor),0) INTO v_n, v_total FROM financial.pedidos_pagamento
     WHERE bar_id=v_bar AND status IN ('aguardando_aprovacao','erro_ca','erro_inter');
    IF v_n > 0 THEN
      PERFORM net.http_post(
        url := 'https://zykor.com.br/api/push/send',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.get_service_role_key()),
        body := jsonb_build_object('bar_id', v_bar, 'title', '📋 '||v_n||' pedido(s) aguardando aprovação',
                'body', 'Total R$ '||to_char(v_total,'FM999G990D00')||' — abra pra aprovar.', 'url', '/financeiro/pedidos-pagamento'),
        timeout_milliseconds := 4000);
      v_res := v_res || 'bar '||v_bar||': '||v_n||'; ';
    END IF;
  END LOOP;
  RETURN COALESCE(NULLIF(v_res,''), 'nenhum pendente');
END;$$;
SELECT cron.unschedule('lembrar-pedidos-pendentes') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='lembrar-pedidos-pendentes');
SELECT cron.schedule('lembrar-pedidos-pendentes', '0 12 * * *', $$SELECT public.lembrar_pedidos_pendentes()$$);
