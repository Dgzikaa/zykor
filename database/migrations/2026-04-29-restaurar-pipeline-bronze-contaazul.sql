-- 2026-04-29: Restaura pipeline medallion contaazul (integrations -> bronze -> silver)
--
-- Contexto: refatoração medallion fez o sync gravar em
-- integrations.contaazul_lancamentos, mas bronze.bronze_contaazul_lancamentos
-- ficou órfã. silver.contaazul_lancamentos_diarios continuava lendo de bronze
-- (parada desde 16/04). Resultado: gold.desempenho.atracoes_eventos zerado
-- pra S16/S17/2026 mesmo após o sync ContaAzul ter sido restaurado (PR #41).
--
-- Existe bronze_sync_integrations_to_bronze() que faria essa cópia, mas:
--   1. Está quebrada (tenta sync getin/umbler que não estão em integrations)
--   2. Nunca foi agendada como cron
--
-- Fix: função enxuta sync_contaazul_integrations_to_bronze() só pra
-- contaazul + cron diário 09:00 BRT (depois dos syncs ContaAzul).
--
-- Pipeline restaurado:
--   API ContaAzul -> integrations.contaazul_lancamentos (sync 8h em 8h)
--                 -> bronze.bronze_contaazul_lancamentos (sync diário 09:00)
--                 -> silver.contaazul_lancamentos_diarios (ETL diário 11:40)
--                 -> gold.desempenho (cron já existente)
--
-- Validação pós-deploy (Ord S15-S17):
--   atrações_eventos: R$ 104k / R$ 114k / R$ 86k
--   custo_atracao_faturamento: 27.32% / 24.24% / 22.62% ✓ todos >20%

CREATE OR REPLACE FUNCTION public.sync_contaazul_integrations_to_bronze()
 RETURNS TABLE(inseridos integer, atualizados integer, duracao_segundos numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_start timestamptz := clock_timestamp();
  v_ins int := 0;
  v_upd int := 0;
BEGIN
  WITH upsert AS (
    INSERT INTO bronze.bronze_contaazul_lancamentos (
      bar_id, contaazul_id, contaazul_evento_id, tipo, status, status_traduzido,
      descricao, observacao, valor_bruto, valor_liquido, valor_pago, valor_nao_pago,
      data_vencimento, data_competencia, data_pagamento, data_pagamento_previsto,
      data_alteracao_ca, data_criacao_ca, categoria_id, categoria_nome, todas_categorias,
      centro_custo_id, centro_custo_nome, todos_centros_custo, pessoa_id, pessoa_nome,
      conta_financeira_id, conta_financeira_nome, conta_financeira, metodo_pagamento,
      numero_documento, numero_parcela, total_parcelas, conciliado, renegociacao,
      origem, raw_data, synced_at
    )
    SELECT bar_id, contaazul_id::uuid, contaazul_evento_id, tipo, status, status_traduzido,
      descricao, observacao, valor_bruto, valor_liquido, valor_pago, valor_nao_pago,
      data_vencimento, data_competencia, data_pagamento, data_pagamento_previsto,
      data_alteracao_ca, data_criacao_ca, categoria_id, categoria_nome, todas_categorias,
      centro_custo_id, centro_custo_nome, todos_centros_custo, pessoa_id, pessoa_nome,
      conta_financeira_id, conta_financeira_nome, conta_financeira, metodo_pagamento,
      numero_documento, numero_parcela, total_parcelas, conciliado, renegociacao,
      origem, raw_data, COALESCE(updated_at, created_at, NOW())
    FROM integrations.contaazul_lancamentos
    ON CONFLICT (bar_id, contaazul_id) DO UPDATE SET
      tipo = EXCLUDED.tipo, status = EXCLUDED.status, status_traduzido = EXCLUDED.status_traduzido,
      descricao = EXCLUDED.descricao, observacao = EXCLUDED.observacao,
      valor_bruto = EXCLUDED.valor_bruto, valor_liquido = EXCLUDED.valor_liquido,
      valor_pago = EXCLUDED.valor_pago, valor_nao_pago = EXCLUDED.valor_nao_pago,
      data_vencimento = EXCLUDED.data_vencimento, data_competencia = EXCLUDED.data_competencia,
      data_pagamento = EXCLUDED.data_pagamento,
      categoria_id = EXCLUDED.categoria_id, categoria_nome = EXCLUDED.categoria_nome,
      raw_data = EXCLUDED.raw_data,
      synced_at = NOW()
    RETURNING xmax = 0 AS inserted
  )
  SELECT COUNT(*) FILTER (WHERE inserted), COUNT(*) FILTER (WHERE NOT inserted)
  INTO v_ins, v_upd FROM upsert;

  RETURN QUERY SELECT v_ins, v_upd,
    EXTRACT(EPOCH FROM (clock_timestamp() - v_start))::numeric(10,2);
END;
$function$;

-- Cron diário 09:00 BRT (12:00 UTC)
SELECT cron.schedule(
  'sync-contaazul-integrations-to-bronze',
  '0 12 * * *',
  $$SELECT public.sync_contaazul_integrations_to_bronze();$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname='sync-contaazul-integrations-to-bronze'
);
