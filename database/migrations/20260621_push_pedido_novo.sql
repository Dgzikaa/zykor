-- 2026-06-21 — #3 Aprovação em tempo real: push na hora que um pedido é criado.
-- Trigger de STATEMENT com tabela de transição (NEW TABLE) → 1 pedido = 1 push,
-- lote de N = 1 push só ("N novos pedidos"). Push nunca quebra a criação (EXCEPTION→NULL).
CREATE OR REPLACE FUNCTION financial.fn_push_pedido_novo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','financial','net','pg_temp' AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT bar_id, count(*) AS n, COALESCE(sum(valor),0) AS total
    FROM novos WHERE status = 'aguardando_aprovacao' GROUP BY bar_id
  LOOP
    PERFORM net.http_post(
      url := 'https://zykor.com.br/api/push/send',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.get_service_role_key()),
      body := jsonb_build_object(
        'bar_id', r.bar_id,
        'title', CASE WHEN r.n = 1 THEN '💸 Novo pedido de pagamento' ELSE '💸 '||r.n||' novos pedidos de pagamento' END,
        'body', 'R$ '||to_char(r.total,'FM999G990D00')||' aguardando aprovação — toque pra aprovar.',
        'url', '/financeiro/pedidos-pagamento'),
      timeout_milliseconds := 4000);
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;$$;
DROP TRIGGER IF EXISTS trg_push_pedido_novo ON financial.pedidos_pagamento;
CREATE TRIGGER trg_push_pedido_novo
  AFTER INSERT ON financial.pedidos_pagamento
  REFERENCING NEW TABLE AS novos
  FOR EACH STATEMENT EXECUTE FUNCTION financial.fn_push_pedido_novo();
