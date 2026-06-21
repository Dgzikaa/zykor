-- 2026-06-21 — DFC por BAIXAS conciliadas (bate na vírgula com o extrato do CA).
-- Descoberta: o CA concilia por BAIXA (id_reconciliacao), não por parcela. O extrato do
-- Gonza ("Situação de Conciliação=Conciliado") = baixas com id_reconciliacao. O Zykor usava
-- o flag conciliado da PARCELA (errado quando uma parcela tem baixa em conta-ajustes).
-- Ver [[project_dfc_conciliacao_por_baixa]].

-- 1) tabela das baixas (uma por movimento, com id_reconciliacao)
CREATE TABLE IF NOT EXISTS bronze.bronze_contaazul_baixas (
  baixa_id uuid PRIMARY KEY, bar_id int, id_parcela uuid, data_pagamento date,
  valor_liquido numeric, conta_financeira uuid, banco text, id_reconciliacao uuid,
  conciliada boolean, metodo_pagamento text, origem text, tipo_evento text,
  categoria_nome text, synced_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_baixas_bar_data ON bronze.bronze_contaazul_baixas (bar_id, data_pagamento);
CREATE INDEX IF NOT EXISTS idx_baixas_parcela ON bronze.bronze_contaazul_baixas (id_parcela);

-- 2) marcador de backfill resumível das baixas
ALTER TABLE bronze.bronze_contaazul_lancamentos ADD COLUMN IF NOT EXISTS baixas_synced_em timestamptz;
CREATE INDEX IF NOT EXISTS idx_lanc_baixas_synced ON bronze.bronze_contaazul_lancamentos (bar_id, baixas_synced_em) WHERE baixas_synced_em IS NULL;

-- 3) get_dfc_por_ano agora soma BAIXAS (conciliada quando p_so_conciliado). Mesma assinatura/retorno.
CREATE OR REPLACE FUNCTION public.get_dfc_por_ano(p_bar_id integer, p_ano integer, p_so_conciliado boolean DEFAULT false)
RETURNS TABLE(mes date, grupo_dfc text, categoria text, categoria_macro text, ordem_macro smallint, ordem_sub smallint, entradas numeric, saidas numeric, net numeric)
LANGUAGE sql STABLE SET search_path TO 'public','meta','financial','bronze','pg_catalog' AS $$
  SELECT date_trunc('month', bx.data_pagamento)::date AS mes, m.grupo_dfc,
    COALESCE(NULLIF(TRIM(l.categoria_nome),''),'(sem categoria)') AS categoria,
    MAX(dm.categoria_macro), MAX(dm.ordem_macro), MAX(dm.ordem_sub),
    ROUND(SUM(CASE WHEN bx.tipo_evento='RECEITA' THEN bx.valor_liquido ELSE 0 END)::numeric,2),
    ROUND(SUM(CASE WHEN bx.tipo_evento='DESPESA' THEN bx.valor_liquido ELSE 0 END)::numeric,2),
    ROUND(SUM((CASE WHEN bx.tipo_evento='RECEITA' THEN 1 ELSE -1 END)*bx.valor_liquido)::numeric,2)
  FROM bronze.bronze_contaazul_baixas bx
  JOIN bronze.bronze_contaazul_lancamentos l ON l.contaazul_id = bx.id_parcela AND l.bar_id = bx.bar_id
  JOIN meta.categoria_dfc_map m ON upper(btrim(m.categoria_ca)) = upper(btrim(l.categoria_nome))
  LEFT JOIN financial.dre_categoria_macro dm ON upper(btrim(dm.categoria_nome)) = upper(btrim(l.categoria_nome))
  WHERE bx.bar_id = p_bar_id AND l.excluido_em IS NULL AND m.grupo_dfc <> 'AJUSTE'
    AND bx.data_pagamento >= make_date(p_ano,1,1) AND bx.data_pagamento < make_date(p_ano+1,1,1)
    AND (NOT p_so_conciliado OR bx.conciliada = true)
  GROUP BY 1,2,3;
$$;

-- 4) crons: drenador das baixas (backfill + novos) + re-checagem dos últimos 45 dias (conciliação tardia)
SELECT cron.unschedule('tmp-backfill-baixas-bar3') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='tmp-backfill-baixas-bar3');
SELECT cron.unschedule('sync-baixas-bar3') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='sync-baixas-bar3');
SELECT cron.schedule('sync-baixas-bar3', '*/15 * * * *', $cron$
  SELECT net.http_post(url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contaazul-baixas',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.get_service_role_key()),
    body := jsonb_build_object('bar_id',3,'modo','baixas','limit',5000), timeout_milliseconds := 350000);
$cron$);
SELECT cron.unschedule('rechecar-baixas-recentes-bar3') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='rechecar-baixas-recentes-bar3');
SELECT cron.schedule('rechecar-baixas-recentes-bar3', '40 8 * * *', $cron$
  UPDATE bronze.bronze_contaazul_lancamentos SET baixas_synced_em = NULL
  WHERE bar_id=3 AND valor_pago>0 AND data_competencia >= current_date - 45;
$cron$);
