-- Buckets do CMV (cozinha/bebidas/drinks/funcionarios) a partir da contagem de UMA
-- data em silver.estoque_contagem, classificados pela MESMA lógica areaDe do Desvios
-- (frontend/src/lib/estoque/area-contagem.ts). Fonte única p/ CMV semanal e Desvios.
CREATE OR REPLACE FUNCTION silver.fn_estoque_contagem_buckets(p_bar_id integer, p_data date)
 RETURNS TABLE(cozinha numeric, bebidas numeric, drinks numeric, funcionarios numeric, n_itens integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'silver', 'public'
AS $function$
  with cls as (
    select valor,
      case
        when insumo_codigo in ('i0298','i0085','i0328','i0191','i0563') then 'drinks'
        when upper(coalesce(categoria,'')) ~ '\(F\)' then 'funcionarios'
        when upper(coalesce(categoria,'')) ~ '\(C\)' or upper(coalesce(categoria,'')) like '%PÃES%'
             or upper(coalesce(categoria,'')) like '%PAES%' or upper(coalesce(categoria,'')) like '%FEIJOADA%' then 'cozinha'
        when upper(coalesce(categoria,'')) ~ '\(S\)' or upper(coalesce(categoria,'')) like '%MERCADO (S)%' then 'bebidas'
        when upper(coalesce(categoria,'')) ~ '\(B\)' or upper(coalesce(categoria,'')) like '%DESTILADOS%'
             or upper(coalesce(categoria,'')) like '%IMPÉRIO%' or upper(coalesce(categoria,'')) like '%IMPERIO%'
             or upper(coalesce(categoria,'')) like '%POLPAS%' or upper(coalesce(categoria,'')) like '%PRÉ-BATCH%'
             or upper(coalesce(categoria,'')) like '%PRE-BATCH%' or upper(coalesce(categoria,'')) like '%OUTROS%' then 'drinks'
        when upper(coalesce(categoria,'')) like '%ARTESANAL%' or upper(coalesce(categoria,'')) like '%LATA%'
             or upper(coalesce(categoria,'')) like '%LONG NECK%' or upper(coalesce(categoria,'')) like '%RETORNÁVEIS%'
             or upper(coalesce(categoria,'')) like '%RETORNAVEIS%' or upper(coalesce(categoria,'')) like '%VINHOS%' then 'bebidas'
        when upper(coalesce(categoria,'')) like '%ALCÓOLICOS%' or upper(coalesce(categoria,'')) like '%ALCOOLICOS%' then 'bebidas'
        else 'cozinha'
      end as bucket
    from silver.estoque_contagem
    where bar_id = p_bar_id and data_contagem = p_data and classe = 'insumo'
  )
  select
    coalesce(round(sum(valor) filter (where bucket='cozinha')::numeric, 2), 0),
    coalesce(round(sum(valor) filter (where bucket='bebidas')::numeric, 2), 0),
    coalesce(round(sum(valor) filter (where bucket='drinks')::numeric, 2), 0),
    coalesce(round(sum(valor) filter (where bucket='funcionarios')::numeric, 2), 0),
    count(*)::int
  from cls;
$function$;
