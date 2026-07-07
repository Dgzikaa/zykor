-- Base p/ IMPOSTOS SIMULADOS por (bar, ano, mes). Agrega server-side (evita corte de 1000 do PostgREST).
--   faturamento_nf    = gold.notas_fiscais_diaria.total_autorizado (ContaHub qry=73, por nf_dtcontabil)
--   faturamento_stone = gold.stone_conciliacao_diaria.stone_bruto (Stone bruto, por dt_gerencial corte 6h)
--   couvert / gorjeta = public.get_comissao_couvert_periodo (bronze periodo: vd_vrcouvert / vd_vrrepique)
--   bebidas_frias     = gold.mix_produtos_diario.faturamento onde categoria_mix in (BEBIDA, DRINK) — monofásico
-- Faturamento usado no cálculo = MAIOR entre NF e Stone (regra do Gonza).
create or replace function public.fn_impostos_base_mensal(p_bar int, p_ano int, p_mes int)
returns table(faturamento_nf numeric, faturamento_stone numeric, couvert numeric, gorjeta numeric, bebidas_frias numeric)
language sql stable security definer
set search_path = public, gold, silver, bronze, extensions
as $$
  with lim as (
    select make_date(p_ano,p_mes,1) d0, (make_date(p_ano,p_mes,1)+interval '1 month')::date d1
  ),
  cc as (
    select * from public.get_comissao_couvert_periodo(
      p_bar, (select d0 from lim), (select (d1 - interval '1 day')::date from lim)
    )
  )
  select
    coalesce((select sum(total_autorizado) from gold.notas_fiscais_diaria n, lim
              where n.bar_id=p_bar and n.data>=lim.d0 and n.data<lim.d1),0)::numeric,
    coalesce((select sum(stone_bruto) from gold.stone_conciliacao_diaria s, lim
              where s.bar_id=p_bar and s.data>=lim.d0 and s.data<lim.d1),0)::numeric,
    coalesce((select couvert from cc),0)::numeric,
    coalesce((select comissao from cc),0)::numeric,
    coalesce((select sum(faturamento) from gold.mix_produtos_diario m, lim
              where m.bar_id=p_bar and m.categoria_mix in ('BEBIDA','DRINK')
                and m.dt_gerencial>=lim.d0 and m.dt_gerencial<lim.d1),0)::numeric;
$$;

comment on function public.fn_impostos_base_mensal(int,int,int) is
  'Base p/ impostos simulados por (bar,ano,mes): faturamento NF + Stone, couvert, gorjeta(repique), bebidas frias (BEBIDA+DRINK). Agrega server-side.';
