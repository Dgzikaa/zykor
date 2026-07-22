-- FIX drill-down da DRE: aplicar o SINAL por tipo (RECEITA=+, DESPESA=-), igual à célula
-- (public.get_dre_por_ano). Antes o valor vinha sempre positivo → devoluções/estornos (RECEITA)
-- somavam em vez de abater no modal de lançamentos, "duplicando" o valor (caso reportado:
-- devolução Sarkis 04-06/07/2026 no bar 3 — despesa cancelada + devolução deveriam dar líquido).
-- Aplicada em produção via Supabase migration de mesmo nome.
CREATE OR REPLACE FUNCTION financial.get_dre_lancamentos(p_bar_id integer, p_ano integer, p_mes integer, p_categoria_macro text, p_categoria_canon text)
 RETURNS TABLE(data_competencia date, data_pagamento date, descricao text, pessoa_nome text, categoria_nome text, tipo text, status text, valor numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'financial', 'bronze', 'public', 'pg_catalog'
AS $function$
  with grupo as (
    select categoria_macro, ordem_sub
    from financial.dre_categoria_macro
    where categoria_macro = p_categoria_macro
    group by categoria_macro, ordem_sub
    having min(categoria_nome) = p_categoria_canon
  ),
  cats as (
    select public.normcat(d.categoria_nome) as nc
    from financial.dre_categoria_macro d
    join grupo g on g.categoria_macro = d.categoria_macro and g.ordem_sub = d.ordem_sub
  )
  select
    l.data_competencia, l.data_pagamento, l.descricao,
    l.pessoa_nome, l.categoria_nome, l.tipo, l.status,
    -- MESMA convenção da célula: RECEITA soma, DESPESA subtrai → total do modal = líquido.
    (case when l.tipo = 'RECEITA' then 1 else -1 end)
      * round(coalesce(nullif(l.valor_bruto,0), l.valor_pago), 2) as valor
  from bronze.bronze_contaazul_lancamentos l
  where l.bar_id = p_bar_id
    and l.excluido_em is null
    and l.data_competencia >= make_date(p_ano, p_mes, 1)
    and l.data_competencia <  (make_date(p_ano, p_mes, 1) + interval '1 month')
    and (
      public.normcat(l.categoria_nome) in (select nc from cats)
      or (not exists (select 1 from grupo)
          and public.normcat(coalesce(nullif(btrim(l.categoria_nome),''),'Sem categoria')) = public.normcat(p_categoria_canon))
    )
  order by l.data_competencia, abs(coalesce(nullif(l.valor_bruto,0), l.valor_pago)) desc;
$function$;
