-- Função: processar_eventos_mes
-- MIGRADO: vendas_item (domain table) em vez de contahub_analitico
CREATE OR REPLACE FUNCTION public.processar_eventos_mes(p_bar_id integer, p_data_inicio date, p_data_fim date)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  evento_rec RECORD;
  valor_bebidas NUMERIC;
  valor_drinks NUMERIC;
  valor_comida NUMERIC;
  valor_happy_hour NUMERIC;
  valor_total NUMERIC;
  v_percent_b NUMERIC;
  v_percent_c NUMERIC;
  v_percent_d NUMERIC;
  v_percent_happy NUMERIC;
BEGIN
  FOR evento_rec IN
    SELECT id, bar_id, data_evento
    FROM eventos_base
    WHERE bar_id = p_bar_id
      AND data_evento >= p_data_inicio
      AND data_evento <= p_data_fim
  LOOP
    -- MIGRADO: vendas_item (domain table) com colunas: valor, local_desc, grupo_desc, data_venda
    SELECT
      COALESCE(SUM(CASE WHEN local_desc IN ('Chopp', 'Bar', 'Pegue e Pague', 'Venda Volante', 'Baldes') THEN valor ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN local_desc IN ('Preshh', 'Montados', 'Mexido', 'Drinks', 'Drinks Autorais', 'Shot e Dose', 'Batidos') THEN valor ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN local_desc IN ('Cozinha', 'Cozinha 1', 'Cozinha 2') THEN valor ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN grupo_desc = 'Happy Hour' THEN valor ELSE 0 END), 0)
    INTO valor_bebidas, valor_drinks, valor_comida, valor_happy_hour
    FROM vendas_item
    WHERE bar_id = evento_rec.bar_id
      AND data_venda = evento_rec.data_evento;

    valor_total := valor_bebidas + valor_drinks + valor_comida;

    IF valor_total > 0 THEN
      v_percent_b := ROUND((valor_bebidas / valor_total * 100)::numeric, 2);
      v_percent_d := ROUND((valor_drinks / valor_total * 100)::numeric, 2);
      v_percent_c := ROUND((valor_comida / valor_total * 100)::numeric, 2);
      v_percent_happy := ROUND((valor_happy_hour / valor_total * 100)::numeric, 2);
    ELSE
      v_percent_b := 0;
      v_percent_d := 0;
      v_percent_c := 0;
      v_percent_happy := 0;
    END IF;

    UPDATE eventos_base
    SET
      percent_b = v_percent_b,
      percent_d = v_percent_d,
      percent_c = v_percent_c,
      percent_happy_hour = v_percent_happy
    WHERE id = evento_rec.id;
  END LOOP;
END;
$$;