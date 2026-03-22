-- Função: calcular_consumo_insumo (trigger function)
-- Calcula consumo em contagem_estoque_insumos

CREATE OR REPLACE FUNCTION public.calcular_consumo_insumo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estoque_inicial IS NOT NULL THEN
    NEW.consumo_periodo = COALESCE(NEW.estoque_inicial, 0) + COALESCE(NEW.quantidade_pedido, 0) - NEW.estoque_final;
    NEW.valor_consumo = NEW.consumo_periodo * NEW.custo_unitario;
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
