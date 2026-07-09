-- Atualização SOB DEMANDA das compras VMarket (botão "Atualizar agora" na tela /operacional/compras).
-- Roda o subconjunto que faz um pedido novo aparecer: cabeçalho (últimos 10 dias) + itens + reconciliação
-- de códigos. NÃO puxa insumos/cotações/estoque (isso fica no cron 5x/dia) — mantém a chamada rápida.
-- statement_timeout local pra não pendurar o request caso a API do VMarket demore.
CREATE OR REPLACE FUNCTION public.fn_vmarket_sync_pedidos_now(p_bar_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cab   jsonb;
  v_itens jsonb;
  v_recon integer;
BEGIN
  IF p_bar_id IS NULL THEN
    RAISE EXCEPTION 'p_bar_id obrigatorio';
  END IF;
  SET LOCAL statement_timeout = '150s';

  v_cab   := public.fn_vmarket_sync_pedidos_cab(p_bar_id, 10);
  v_itens := public.fn_vmarket_sync_pedidos_itens(p_bar_id, 400);
  v_recon := public.fn_vmarket_reconciliar_codigos(p_bar_id);

  RETURN jsonb_build_object(
    'ok', true,
    'cab', v_cab,
    'itens', v_itens,
    'reconciliados', v_recon
  );
END;
$function$;
