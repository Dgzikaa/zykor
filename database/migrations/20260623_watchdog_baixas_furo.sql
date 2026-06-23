-- BUG do furo da DFC (descoberto 23/06/2026): parcelas PAGAS ficavam sem baixa no
-- bronze → a DFC (por baixa conciliada) não contava o pagamento → não batia com o CA.
--
-- CAUSA RAIZ: na edge contaazul-baixas, a extração da baixa da resposta do CA
-- (`const arr = Array.isArray(data) ? data : data?.itens : []`) tratava só 2 formatos,
-- enquanto extrairDataPagamento tratava 5. Quando o CA devolvia a baixa como objeto
-- único `{id,...}` ou `{baixas:[...]}`, pegava a data_pagamento mas NÃO gravava a baixa
-- — e ainda marcava baixas_synced_em, então nunca re-tentava. 43 parcelas afetadas.
-- FIX: alinhar a extração do `arr` com extrairDataPagamento (array/.itens/.baixas/.data/
-- objeto único) — ver backend/supabase/functions/contaazul-baixas/index.ts (v4).
--
-- Backfill aplicado: UPDATE ... SET baixas_synced_em=NULL onde pago+sem baixa (requeue).
--
-- WATCHDOG auto-curável (este cron): requeue diário de qualquer parcela paga sem baixa,
-- pro sync re-processar. Previne o furo de recorrer silenciosamente.
select cron.schedule('watchdog-baixas-furo', '50 8 * * *', $job$
  UPDATE bronze.bronze_contaazul_lancamentos l
  SET baixas_synced_em = NULL
  WHERE l.bar_id IN (3,4) AND l.excluido_em IS NULL AND l.valor_pago > 0
    AND l.data_pagamento IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM bronze.bronze_contaazul_baixas bx
      WHERE bx.id_parcela = l.contaazul_id AND bx.bar_id = l.bar_id
    );
$job$);
