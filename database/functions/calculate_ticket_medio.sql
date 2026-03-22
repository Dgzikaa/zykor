-- Função: calculate_ticket_medio (trigger function)
-- Calcula ticket_medio e atingimento em desempenho_semanal

CREATE OR REPLACE FUNCTION public.calculate_ticket_medio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    IF NEW.ticket_medio IS NULL OR NEW.ticket_medio = 0 THEN
        IF NEW.clientes_atendidos > 0 THEN
            NEW.ticket_medio = NEW.faturamento_total / NEW.clientes_atendidos;
        ELSE
            NEW.ticket_medio = 0;
        END IF;
    END IF;
    
    IF NEW.meta_semanal > 0 THEN
        NEW.atingimento = (NEW.faturamento_total / NEW.meta_semanal) * 100;
    ELSE
        NEW.atingimento = 0;
    END IF;
    
    RETURN NEW;
END;
$function$;
