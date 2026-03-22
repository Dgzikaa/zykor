CREATE OR REPLACE FUNCTION public.update_eventos_base_from_contahub()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bar_id INTEGER;
  v_data_evento DATE;
  v_publico INTEGER;
  v_faturamento NUMERIC;
  v_evento_id INTEGER;
BEGIN
  v_bar_id := NEW.bar_id;
  v_data_evento := NEW.data_visita;
  
  SELECT 
    SUM(pessoas)::INTEGER,
    SUM(valor_pagamentos)
  INTO v_publico, v_faturamento
  FROM visitas
  WHERE bar_id = v_bar_id
    AND data_visita = v_data_evento;
  
  SELECT id INTO v_evento_id
  FROM eventos_base
  WHERE bar_id = v_bar_id
    AND data_evento = v_data_evento;
  
  IF v_evento_id IS NOT NULL THEN
    UPDATE eventos_base
    SET 
      publico_real = COALESCE(v_publico, publico_real),
      yuzer_liquido = COALESCE(v_faturamento, yuzer_liquido),
      atualizado_em = NOW()
    WHERE id = v_evento_id;
    
    RAISE NOTICE 'Evento % atualizado: publico=%, faturamento=%', v_evento_id, v_publico, v_faturamento;
  END IF;
  
  RETURN NEW;
END;
$function$;
