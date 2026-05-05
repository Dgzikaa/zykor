-- 2026-05-04: extrair cadastro de cliente (dt_nasc, cpf, sexo) do raw_json ContaHub
--
-- Problema: filtro "mês de aniversário" na lista quente sempre retornava ZERO porque
-- a view public.visitas tinha `NULL::date AS cliente_dtnasc` hardcoded — nenhum ETL
-- extraía esse campo, embora ele venha no raw_json do endpoint `getTurnoVendas`
-- (data_type='vendas' em bronze.bronze_contahub_raw_data).
--
-- Confirmado: 110.119 vendas Ord (61% das vendas dos ultimos 30 dias) chegam com
-- cli_dtnasc preenchido pelo ContaHub. So precisava extrair.
--
-- Fix:
--   1. Adicionar 4 colunas em silver.cliente_estatisticas (tabela canonica de cliente)
--   2. Criar funcao public.silver_atualizar_cadastro_clientes_contahub() que extrai
--      do raw_json e UPDATEa silver.cliente_estatisticas (preserva valores ja
--      preenchidos via COALESCE).
--   3. Adicionar a chamada ao cron silver-cliente-estatisticas-diario (jobid 447)
--   4. Atualizar view public.visitas pra fazer LEFT JOIN com silver.cliente_estatisticas
--      e expor cliente_dtnasc real.
--
-- Validacao pos-aplicacao:
--   - Ord: 67.130 clientes com aniversario / 5.909 aniversariam em maio
--   - Deb: 3 clientes (Deb nao usa cadastro de cliente no PDV - esperado)
--   - Visitas Ord ult 7d: 2.455/3.167 (78%) com cliente_dtnasc populado

-- ==========================================================
-- 1. Adicionar colunas em silver.cliente_estatisticas
-- ==========================================================
ALTER TABLE silver.cliente_estatisticas
  ADD COLUMN IF NOT EXISTS cliente_dtnasc date,
  ADD COLUMN IF NOT EXISTS cliente_cpf text,
  ADD COLUMN IF NOT EXISTS cliente_sexo text,
  ADD COLUMN IF NOT EXISTS cliente_dtcadastro_contahub date;

CREATE INDEX IF NOT EXISTS idx_cliente_estatisticas_mes_aniv
  ON silver.cliente_estatisticas (bar_id, EXTRACT(MONTH FROM cliente_dtnasc))
  WHERE cliente_dtnasc IS NOT NULL;

-- ==========================================================
-- 2. Funcao que extrai cadastro do raw_json e popula silver.cliente_estatisticas
-- ==========================================================
CREATE OR REPLACE FUNCTION public.silver_atualizar_cadastro_clientes_contahub(p_bar_id integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, silver, bronze, pg_catalog
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH cadastro AS (
    SELECT DISTINCT ON (rd.bar_id, public.normalizar_telefone_br(item->>'cli_fone'))
      rd.bar_id,
      public.normalizar_telefone_br(item->>'cli_fone') AS cliente_fone_norm,
      NULLIF(item->>'cli_dtnasc', '')::date AS cliente_dtnasc,
      NULLIF(item->>'cli_cpf', '') AS cliente_cpf,
      NULLIF(item->>'cli_sexo', '') AS cliente_sexo,
      NULLIF(LEFT(item->>'cli_dtcadastro', 10), '')::date AS cliente_dtcadastro_contahub
    FROM bronze.bronze_contahub_raw_data rd,
         jsonb_array_elements(rd.raw_json->'list') item
    WHERE rd.data_type = 'vendas'
      AND rd.raw_json IS NOT NULL
      AND (p_bar_id IS NULL OR rd.bar_id = p_bar_id)
      AND rd.created_at >= CURRENT_DATE - INTERVAL '60 days'
      AND item->>'cli_fone' IS NOT NULL
      AND public.normalizar_telefone_br(item->>'cli_fone') IS NOT NULL
      AND item->>'cli_dtnasc' IS NOT NULL
      AND item->>'cli_dtnasc' != ''
    ORDER BY rd.bar_id, public.normalizar_telefone_br(item->>'cli_fone'),
      NULLIF(LEFT(item->>'cli_dtcadastro', 10), '')::date DESC NULLS LAST,
      rd.created_at DESC
  )
  UPDATE silver.cliente_estatisticas ce SET
    cliente_dtnasc              = COALESCE(ce.cliente_dtnasc, c.cliente_dtnasc),
    cliente_cpf                 = COALESCE(ce.cliente_cpf, c.cliente_cpf),
    cliente_sexo                = COALESCE(ce.cliente_sexo, c.cliente_sexo),
    cliente_dtcadastro_contahub = COALESCE(ce.cliente_dtcadastro_contahub, c.cliente_dtcadastro_contahub)
  FROM cadastro c
  WHERE ce.bar_id = c.bar_id AND ce.cliente_fone_norm = c.cliente_fone_norm;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.silver_atualizar_cadastro_clientes_contahub(integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.silver_atualizar_cadastro_clientes_contahub(integer) TO authenticated, service_role;

-- ==========================================================
-- 3. Atualizar comando do cron silver-cliente-estatisticas-diario (jobid 447)
-- ==========================================================
SELECT cron.alter_job(
  job_id := 447,
  command := 'SELECT public.etl_silver_cliente_estatisticas_all_bars(); SELECT public.silver_atualizar_cadastro_clientes_contahub();'
);

-- ==========================================================
-- 4. Atualizar view public.visitas (LEFT JOIN cliente_estatisticas)
-- ==========================================================
CREATE OR REPLACE VIEW public.visitas AS
WITH estadia_por_venda AS (
  SELECT bar_id, dt_gerencial, vd::integer AS vd, trn::integer AS trn,
    min(hr_lancamento::timestamp) AS abertura,
    max(hr_transacao::timestamp) AS fechamento
  FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos
  WHERE hr_lancamento IS NOT NULL
  GROUP BY bar_id, dt_gerencial, vd, trn
)
SELECT v.id,
  v.bar_id,
  v.vd_dtgerencial AS data_visita,
  v.cli_fone AS cliente_fone,
  v.cli_nome AS cliente_nome,
  v.vd_vrpagamentos AS valor_pagamentos,
  v.vd_vrcouvert AS valor_couvert,
  v.vd_vrprodutos AS valor_produtos,
  v.vd_vrdescontos AS valor_desconto,
  v.vd_vrrepique AS valor_repique,
  v.vd_motivodesconto AS motivo_desconto,
  v.vd_pessoas AS pessoas,
  v.vd_mesadesc AS mesa_desc,
  v.tipovenda AS tipo_venda,
  v.vd_localizacao AS localizacao,
  e.abertura AS hora_abertura,
  CASE WHEN e.abertura IS NOT NULL AND e.fechamento IS NOT NULL AND e.fechamento > e.abertura
    THEN (EXTRACT(epoch FROM e.fechamento - e.abertura) / 60::numeric)::integer
    ELSE NULL::integer
  END AS tempo_estadia_minutos,
  COALESCE(v.vd_vrpagamentos, 0::numeric) - COALESCE(v.vd_vrcouvert, 0::numeric) AS valor_consumo,
  ce.cliente_email,
  ce.cliente_dtnasc AS cliente_dtnasc,
  normalizar_telefone_br(v.cli_fone) AS cliente_fone_norm
FROM bronze.bronze_contahub_avendas_vendasperiodo v
LEFT JOIN estadia_por_venda e
  ON e.bar_id = v.bar_id AND e.dt_gerencial = v.vd_dtgerencial AND e.vd = v.vd AND e.trn = v.trn
LEFT JOIN silver.cliente_estatisticas ce
  ON ce.bar_id = v.bar_id AND ce.cliente_fone_norm = normalizar_telefone_br(v.cli_fone);

-- ==========================================================
-- 5. Backfill inicial (rodar uma vez pra popular registros existentes)
-- ==========================================================
SELECT public.silver_atualizar_cadastro_clientes_contahub();
