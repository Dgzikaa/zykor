-- 2026-05-03: RPC pra propagar estoque inicial em bulk (substitui N+1).
--
-- sync-contagem-sheets edge function fazia ~500 UPDATEs sequenciais
-- pra propagar estoque_final do dia anterior como estoque_inicial do
-- dia atual, contribuindo pra atingir WORKER_RESOURCE_LIMIT (546).
--
-- Esta RPC faz 1 UPDATE com JOIN por data, eliminando N+1.

CREATE OR REPLACE FUNCTION public.propagar_estoque_inicial_contagem(
  p_bar_id integer,
  p_datas date[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, operations, pg_catalog
AS $$
DECLARE
  v_data date;
  v_data_anterior date;
  v_count_total integer := 0;
  v_count_data integer;
BEGIN
  FOREACH v_data IN ARRAY p_datas LOOP
    v_data_anterior := v_data - INTERVAL '1 day';

    UPDATE operations.contagem_estoque_insumos hoje
    SET estoque_inicial = ontem.estoque_final
    FROM operations.contagem_estoque_insumos ontem
    WHERE hoje.bar_id = p_bar_id
      AND hoje.data_contagem = v_data
      AND ontem.bar_id = p_bar_id
      AND ontem.data_contagem = v_data_anterior
      AND hoje.insumo_codigo = ontem.insumo_codigo;

    GET DIAGNOSTICS v_count_data = ROW_COUNT;
    v_count_total := v_count_total + v_count_data;
  END LOOP;

  RETURN v_count_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.propagar_estoque_inicial_contagem(integer, date[])
  FROM PUBLIC, anon, authenticated;
