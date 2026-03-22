-- Função: calcular_real_r (trigger)
-- MIGRADO: faturamento_pagamentos (domain table) em vez de contahub_pagamentos
CREATE OR REPLACE FUNCTION public.calcular_real_r()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contahub NUMERIC;
  v_sympla NUMERIC;
  v_yuzer NUMERIC;
  v_real_r NUMERIC;
  v_inclui BOOLEAN;
BEGIN
  v_sympla := COALESCE(NEW.sympla_liquido, 0);
  v_yuzer := COALESCE(NEW.yuzer_liquido, 0);
  
  -- MIGRADO: faturamento_pagamentos (domain table)
  SELECT COALESCE(SUM(valor_liquido), 0) INTO v_contahub
  FROM faturamento_pagamentos
  WHERE bar_id = NEW.bar_id
    AND data_pagamento = NEW.data_evento
    AND meio != 'Conta Assinada';
  
  SELECT COALESCE(inclui_sympla_yuzer, true) INTO v_inclui
  FROM bar_regras_negocio
  WHERE bar_id = NEW.bar_id;
  
  IF v_inclui THEN
    v_real_r := v_contahub + v_sympla + v_yuzer;
  ELSE
    v_real_r := v_contahub;
  END IF;
  
  NEW.real_r := v_real_r;
  
  RETURN NEW;
END;
$function$;