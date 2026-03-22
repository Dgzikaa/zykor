CREATE OR REPLACE FUNCTION public.validar_ano_desempenho()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ano_atual INTEGER;
  max_semanas INTEGER;
  v_ano_inicio INTEGER;
BEGIN
  ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);
  
  IF NEW.ano > ano_atual + 1 THEN
    RAISE EXCEPTION 'Ano invalido: %. Ano atual: %', NEW.ano, ano_atual;
  END IF;
  
  IF NEW.ano < 2020 THEN
    RAISE EXCEPTION 'Ano muito antigo: %', NEW.ano;
  END IF;
  
  max_semanas := get_iso_weeks_in_year(NEW.ano);
  IF NEW.numero_semana < 1 OR NEW.numero_semana > max_semanas THEN
    RAISE EXCEPTION 'Semana invalida: %. O ano % tem apenas % semanas ISO.', 
      NEW.numero_semana, NEW.ano, max_semanas;
  END IF;
  
  SELECT ano_inicio_operacao INTO v_ano_inicio
  FROM bar_regras_negocio
  WHERE bar_id = NEW.bar_id;
  
  IF v_ano_inicio IS NOT NULL AND NEW.ano < v_ano_inicio THEN
    RAISE EXCEPTION 'Bar % so tem dados de %+', NEW.bar_id, v_ano_inicio;
  END IF;
  
  NEW.ano_sistema := ano_atual;
  RETURN NEW;
END;
$function$;
