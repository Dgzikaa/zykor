-- ============================================================================
-- Autoria de custo de produto (quem editou e quando) + features da aba Custos
-- ----------------------------------------------------------------------------
-- - produto_custo_manual / _historico ganham editado_por_id/_nome e editado_em.
-- - set_produto_custo_manual grava autor (vindo do usuario autenticado na API).
-- - sync_custo_planilha marca autoria 'Planilha (sync)'.
-- - snapshot e a view de mudancas carregam autor + timestamp.
-- - cardapio_custo_mudancas retorna editado_por_nome / editado_em (aba Historico).
-- Edicao restrita a admin|financeiro e feita na API /api/cardapio/custo-manual.
-- ============================================================================

ALTER TABLE operations.produto_custo_manual
  ADD COLUMN IF NOT EXISTS editado_por_id   text,
  ADD COLUMN IF NOT EXISTS editado_por_nome text;

ALTER TABLE operations.produto_custo_historico
  ADD COLUMN IF NOT EXISTS editado_por_nome text,
  ADD COLUMN IF NOT EXISTS editado_em       timestamptz;

DROP FUNCTION IF EXISTS public.set_produto_custo_manual(integer, text, text, numeric, numeric);
CREATE OR REPLACE FUNCTION public.set_produto_custo_manual(
  p_bar_id integer, p_produto_codigo text, p_produto_desc text,
  p_custo numeric, p_preco_venda numeric DEFAULT NULL,
  p_autor_id text DEFAULT NULL, p_autor_nome text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public','operations'
AS $function$
BEGIN
  IF p_custo IS NULL OR p_custo < 0 THEN
    DELETE FROM operations.produto_custo_manual
     WHERE bar_id = p_bar_id AND produto_codigo = p_produto_codigo;
    RETURN;
  END IF;
  INSERT INTO operations.produto_custo_manual
    (bar_id, produto_codigo, produto_desc, custo_manual, preco_venda_planilha,
     codigo_planilha, match_tipo, fonte, editado_por_id, editado_por_nome, atualizado_em)
  VALUES
    (p_bar_id, p_produto_codigo, p_produto_desc, p_custo, p_preco_venda,
     NULL, 'manual', 'manual', p_autor_id, p_autor_nome, now())
  ON CONFLICT (bar_id, produto_codigo) DO UPDATE SET
    produto_desc         = COALESCE(EXCLUDED.produto_desc, operations.produto_custo_manual.produto_desc),
    custo_manual         = EXCLUDED.custo_manual,
    preco_venda_planilha = COALESCE(EXCLUDED.preco_venda_planilha, operations.produto_custo_manual.preco_venda_planilha),
    match_tipo           = 'manual',
    fonte                = 'manual',
    editado_por_id       = EXCLUDED.editado_por_id,
    editado_por_nome     = EXCLUDED.editado_por_nome,
    atualizado_em        = now();
END;
$function$;
GRANT EXECUTE ON FUNCTION public.set_produto_custo_manual(integer, text, text, numeric, numeric, text, text) TO authenticated, service_role;

-- sync_custo_planilha: autoria 'Planilha (sync)'
CREATE OR REPLACE FUNCTION public.sync_custo_planilha(p_bar_id integer, p_items jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public','operations'
AS $function$
DECLARE v_n integer;
BEGIN
  UPDATE operations.produto_custo_manual m
  SET custo_manual = i.custo, preco_venda_planilha = COALESCE(i.preco, m.preco_venda_planilha),
      editado_por_nome = 'Planilha (sync)', editado_por_id = NULL, atualizado_em = now()
  FROM jsonb_to_recordset(p_items) AS i(codigo_planilha text, custo numeric, preco numeric)
  WHERE m.bar_id = p_bar_id AND m.codigo_planilha = i.codigo_planilha AND m.fonte = 'planilha_cardapio'
    AND i.custo IS NOT NULL AND i.custo > 0 AND m.custo_manual IS DISTINCT FROM i.custo;
  GET DIAGNOSTICS v_n = ROW_COUNT; RETURN v_n;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.sync_custo_planilha(integer, jsonb) TO service_role;

-- snapshot carrega autor + timestamp
CREATE OR REPLACE FUNCTION operations.snapshot_produto_custo(p_date date DEFAULT CURRENT_DATE)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'operations'
AS $function$
DECLARE v_n integer;
BEGIN
  INSERT INTO operations.produto_custo_historico
    (bar_id, produto_codigo, codigo_planilha, produto_desc, custo_manual, preco_venda_planilha,
     fonte, editado_por_nome, editado_em, snapshot_date)
  SELECT bar_id, produto_codigo, codigo_planilha, produto_desc, custo_manual, preco_venda_planilha,
         fonte, editado_por_nome, atualizado_em, p_date
  FROM operations.produto_custo_manual
  ON CONFLICT (bar_id, produto_codigo, snapshot_date) DO UPDATE SET
    codigo_planilha=EXCLUDED.codigo_planilha, produto_desc=EXCLUDED.produto_desc,
    custo_manual=EXCLUDED.custo_manual, preco_venda_planilha=EXCLUDED.preco_venda_planilha,
    fonte=EXCLUDED.fonte, editado_por_nome=EXCLUDED.editado_por_nome, editado_em=EXCLUDED.editado_em,
    captured_at=now();
  GET DIAGNOSTICS v_n = ROW_COUNT; RETURN v_n;
END;
$function$;

CREATE OR REPLACE VIEW operations.produto_custo_mudancas AS
WITH h AS (
  SELECT bar_id, produto_codigo, produto_desc, snapshot_date, custo_manual, preco_venda_planilha,
         fonte, editado_por_nome, editado_em,
         lag(custo_manual) OVER w AS custo_anterior,
         lag(preco_venda_planilha) OVER w AS preco_anterior,
         lag(snapshot_date) OVER w AS data_anterior
  FROM operations.produto_custo_historico
  WINDOW w AS (PARTITION BY bar_id, produto_codigo ORDER BY snapshot_date)
)
SELECT bar_id, produto_codigo, produto_desc, snapshot_date AS data_mudanca, data_anterior,
       custo_anterior, custo_manual AS custo_novo, preco_anterior, preco_venda_planilha AS preco_novo,
       fonte, editado_por_nome, editado_em
FROM h
WHERE custo_manual IS DISTINCT FROM custo_anterior OR preco_venda_planilha IS DISTINCT FROM preco_anterior;
GRANT SELECT ON operations.produto_custo_mudancas TO authenticated, anon, service_role;

DROP FUNCTION IF EXISTS public.cardapio_custo_mudancas(integer, integer);
CREATE OR REPLACE FUNCTION public.cardapio_custo_mudancas(p_bar_id integer, p_dias integer DEFAULT 90)
 RETURNS TABLE(produto_codigo text, produto_desc text, data_mudanca date, data_anterior date,
               custo_anterior numeric, custo_novo numeric, preco_anterior numeric, preco_novo numeric,
               fonte text, editado_por_nome text, editado_em timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','operations'
AS $function$
  SELECT produto_codigo, produto_desc, data_mudanca, data_anterior, custo_anterior, custo_novo,
         preco_anterior, preco_novo, fonte, editado_por_nome, editado_em
  FROM operations.produto_custo_mudancas
  WHERE bar_id = p_bar_id AND data_mudanca >= CURRENT_DATE - (p_dias || ' days')::interval
  ORDER BY data_mudanca DESC, produto_desc;
$function$;
GRANT EXECUTE ON FUNCTION public.cardapio_custo_mudancas(integer, integer) TO authenticated, anon, service_role;
