CREATE OR REPLACE FUNCTION public.get_categorias_custo(p_bar_id integer, p_tipo character varying DEFAULT 'atracao'::character varying)
 RETURNS TABLE(nome_categoria character varying)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT nome_categoria
  FROM bar_categorias_custo
  WHERE bar_id = p_bar_id 
    AND tipo = p_tipo 
    AND ativo = true
  ORDER BY nome_categoria;
$function$;
