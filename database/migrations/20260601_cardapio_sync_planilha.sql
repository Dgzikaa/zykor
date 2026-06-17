-- ============================================================================
-- Re-sync diario das planilhas de Engenharia de Cardapio
-- ----------------------------------------------------------------------------
-- Config (1 planilha por bar) + RPC que atualiza o custo por codigo_planilha.
-- Lida pelo edge function backend/supabase/functions/sync-cardapio-custo.
-- Pre-requisito: cada planilha compartilhada com o service account do Google
-- (o mesmo de GOOGLE_SERVICE_ACCOUNT_KEY, usado tambem no sync de CMV).
-- ============================================================================

CREATE TABLE IF NOT EXISTS operations.cardapio_planilha_config (
  bar_id         integer PRIMARY KEY,
  spreadsheet_id text NOT NULL,
  aba            text,            -- nome da aba; NULL = autodetect (procura 'cardapio'/'engenharia')
  ativo          boolean NOT NULL DEFAULT true,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE operations.cardapio_planilha_config IS
  'IDs das planilhas Google de Engenharia de Cardapio por bar (edge function sync-cardapio-custo).';

INSERT INTO operations.cardapio_planilha_config (bar_id, spreadsheet_id, aba) VALUES
  (3, '1klPn-uVLKeoJ9UA9TkiSYqa7sV7NdUdDEELdgd1q4b8', NULL),
  (4, '13U8O2hdCqiRrBTfcAcgliS_VrCIE4MNdJRR5NRh7R3k', NULL)
ON CONFLICT (bar_id) DO UPDATE SET
  spreadsheet_id = EXCLUDED.spreadsheet_id, aba = EXCLUDED.aba, atualizado_em = now();

GRANT SELECT ON operations.cardapio_planilha_config TO authenticated, anon, service_role;

-- Atualiza custo/preco das linhas vindas da planilha (por codigo_planilha),
-- so onde mudou e SEM tocar nas linhas preenchidas manualmente (fonte='manual').
CREATE OR REPLACE FUNCTION public.sync_custo_planilha(p_bar_id integer, p_items jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public','operations'
AS $function$
DECLARE v_n integer;
BEGIN
  UPDATE operations.produto_custo_manual m
  SET custo_manual         = i.custo,
      preco_venda_planilha = COALESCE(i.preco, m.preco_venda_planilha),
      atualizado_em        = now()
  FROM jsonb_to_recordset(p_items) AS i(codigo_planilha text, custo numeric, preco numeric)
  WHERE m.bar_id = p_bar_id
    AND m.codigo_planilha = i.codigo_planilha
    AND m.fonte = 'planilha_cardapio'
    AND i.custo IS NOT NULL AND i.custo > 0
    AND m.custo_manual IS DISTINCT FROM i.custo;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sync_custo_planilha(integer, jsonb) TO service_role;

-- Cron diario (08:00 BRT) — chama o edge function que le as planilhas e snapshota.
-- SELECT cron.schedule('cardapio-custo-sync-diario', '0 11 * * *', $$
--   SELECT net.http_post(
--     url := get_supabase_url() || '/functions/v1/sync-cardapio-custo',
--     headers := jsonb_build_object('Authorization','Bearer ' || get_service_role_key(),'Content-Type','application/json'),
--     body := '{}'::jsonb, timeout_milliseconds := 120000);
-- $$);
