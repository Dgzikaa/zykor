-- Recalcular Mix de Vendas para Deboche (bar_id 4)
-- Adiciona 'Salao' como local de Drinks

DO $$
DECLARE
  evento_record RECORD;
  total_eventos INT := 0;
  eventos_atualizados INT := 0;
BEGIN
  SELECT COUNT(*) INTO total_eventos 
  FROM eventos_base 
  WHERE bar_id = 4 AND data_evento >= '2025-01-01';
  
  RAISE NOTICE 'Total de eventos a processar: %', total_eventos;
  
  FOR evento_record IN 
    SELECT id, data_evento 
    FROM eventos_base 
    WHERE bar_id = 4 AND data_evento >= '2025-01-01'
    ORDER BY data_evento
  LOOP
    DECLARE
      valor_bebidas NUMERIC := 0;
      valor_comidas NUMERIC := 0;
      valor_drinks NUMERIC := 0;
      valor_outros NUMERIC := 0;
      total_valorfinal NUMERIC := 0;
      percent_b NUMERIC := 0;
      percent_c NUMERIC := 0;
      percent_d NUMERIC := 0;
    BEGIN
      SELECT 
        COALESCE(SUM(CASE 
          WHEN loc_desc IN ('Chopp', 'Baldes', 'Pegue e Pague', 'PP', 'Venda Volante', 'Bar') 
          THEN valorfinal ELSE 0 END), 0),
        COALESCE(SUM(CASE 
          WHEN loc_desc IN ('Cozinha', 'Cozinha 1', 'Cozinha 2') 
          THEN valorfinal ELSE 0 END), 0),
        COALESCE(SUM(CASE 
          WHEN loc_desc IN ('Preshh', 'Drinks', 'Drinks Autorais', 'Mexido', 'Shot e Dose', 'Batidos', 'Montados', 'Salao') 
          THEN valorfinal ELSE 0 END), 0),
        COALESCE(SUM(CASE 
          WHEN loc_desc NOT IN ('Chopp', 'Baldes', 'Pegue e Pague', 'PP', 'Venda Volante', 'Bar', 
                                'Cozinha', 'Cozinha 1', 'Cozinha 2',
                                'Preshh', 'Drinks', 'Drinks Autorais', 'Mexido', 'Shot e Dose', 'Batidos', 'Montados', 'Salao')
          THEN valorfinal ELSE 0 END), 0),
        COALESCE(SUM(valorfinal), 0)
      INTO valor_bebidas, valor_comidas, valor_drinks, valor_outros, total_valorfinal
      FROM contahub_analitico
      WHERE bar_id = 4 
        AND trn_dtgerencial = evento_record.data_evento
        AND valorfinal > 0;
      
      IF total_valorfinal > 0 THEN
        percent_b := ROUND(((valor_bebidas + valor_outros) / total_valorfinal * 100)::numeric, 2);
        percent_c := ROUND((valor_comidas / total_valorfinal * 100)::numeric, 2);
        percent_d := ROUND((valor_drinks / total_valorfinal * 100)::numeric, 2);
        
        UPDATE eventos_base
        SET 
          percent_b = percent_b,
          percent_c = percent_c,
          percent_d = percent_d
        WHERE id = evento_record.id;
        
        eventos_atualizados := eventos_atualizados + 1;
        
        IF eventos_atualizados % 50 = 0 THEN
          RAISE NOTICE 'Processados % eventos...', eventos_atualizados;
        END IF;
      END IF;
    END;
  END LOOP;
  
  RAISE NOTICE 'Concluído! % eventos atualizados de % total', eventos_atualizados, total_eventos;
END $$;
