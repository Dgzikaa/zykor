CREATE OR REPLACE FUNCTION gold.fn_vendido_fora_depara(p_bar_id integer, p_ini date, p_fim date)
 RETURNS TABLE(prd integer, prd_desc text, qtd numeric, valor numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'gold', 'silver', 'public'
AS $function$
  select v.prd, max(v.prd_desc), sum(v.qtd_consumo), sum(v.valor)
  from silver.vendas_produto_dia v
  where v.bar_id=p_bar_id and v.data between p_ini and p_fim
    and (v.qtd_consumo>0 or v.valor>0)
    and (v.cod_interno is null
         or not exists (select 1 from public.produto_cardapio pc where pc.bar_id=p_bar_id and pc.codigo=v.cod_interno))
  group by v.prd
  order by sum(v.valor) desc, sum(v.qtd_consumo) desc;
$function$;
