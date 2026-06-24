-- Central de Categorias da Orçamentação (aba em /estrategico/orcamentacao).
-- Permite o sócio listar categorias do CA, mapear para blocos da DRE, mover de bloco
-- ou marcar "não mostrar" (ignorar) sem depender de SQL manual.
-- De-para é GLOBAL: o classifier silver casa categoria_ca = categoria_nome (sem escopo de bar).

CREATE OR REPLACE FUNCTION public.get_categorias_orcamentacao(p_bar_id integer, p_ano integer)
 RETURNS TABLE(categoria_ca text, n bigint, total numeric, tipo_ca text,
               map_id integer, categoria_zykor text, bloco_dre text, tipo_zykor text, ignorar boolean)
 LANGUAGE sql STABLE
 SET search_path TO 'public','bronze','meta','pg_catalog'
AS $function$
  select l.categoria_nome,
    count(*)::bigint,
    round(sum(coalesce(nullif(l.valor_bruto,0), l.valor_pago))::numeric, 2),
    mode() within group (order by l.tipo),
    m.id, m.categoria_zykor, m.bloco_dre, m.tipo_zykor, m.ignorar
  from bronze.bronze_contaazul_lancamentos l
  left join meta.categoria_zykor_map m on m.categoria_ca = l.categoria_nome
  where l.bar_id = p_bar_id and l.excluido_em is null
    and l.data_competencia >= make_date(p_ano,1,1)
    and l.data_competencia <  make_date(p_ano+1,1,1)
  group by l.categoria_nome, m.id, m.categoria_zykor, m.bloco_dre, m.tipo_zykor, m.ignorar
  order by 3 desc nulls last;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_categoria_orcamentacao(
  p_bar_id integer, p_ano integer, p_categoria_ca text,
  p_categoria_zykor text, p_bloco_dre text, p_tipo_zykor text, p_ignorar boolean)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public','meta','silver','gold','pg_catalog'
AS $function$
DECLARE m integer;
BEGIN
  insert into meta.categoria_zykor_map
    (categoria_ca, categoria_zykor, bloco_dre, tipo_zykor, ignorar, bar_id, atualizado_em)
  values
    (p_categoria_ca, nullif(p_categoria_zykor,''), nullif(p_bloco_dre,''),
     nullif(p_tipo_zykor,''), coalesce(p_ignorar,false), null, now())
  on conflict (categoria_ca, coalesce(bar_id,0)) do update set
    categoria_zykor = excluded.categoria_zykor,
    bloco_dre       = excluded.bloco_dre,
    tipo_zykor      = excluded.tipo_zykor,
    ignorar         = excluded.ignorar,
    atualizado_em   = now();

  perform silver.fn_refresh_silver_orcamento(p_bar_id, make_date(p_ano,1,1), make_date(p_ano,12,31));
  for m in 1..12 loop
    perform gold.fn_refresh_gold_orcamento(p_bar_id, p_ano, m);
  end loop;
END;
$function$;

grant execute on function public.get_categorias_orcamentacao(integer,integer) to anon, authenticated, service_role;
grant execute on function public.salvar_categoria_orcamentacao(integer,integer,text,text,text,text,boolean) to authenticated, service_role;
