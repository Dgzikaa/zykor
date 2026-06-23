-- Aba "Pendências" da conciliação Stone: lista os dias divergentes (leve/verificar)
-- de um período, classificando em real / gap_stone / gap_contahub, com o resumo
-- das transações sem par (via public.stone_dia_divergencias).

create or replace function public.stone_pendencias(p_bar_id integer, p_de date, p_ate date)
returns jsonb
language sql
stable
security definer
set search_path = public, silver
as $$
with dias as (
  select bar_id, data, diferenca, status, contahub_cartao, stone_bruto
  from gold.stone_conciliacao_diaria
  where bar_id = p_bar_id and status in ('leve','verificar')
    and data between coalesce(p_de, current_date - 90) and coalesce(p_ate, current_date)
),
dv as (select d.*, public.stone_dia_divergencias(d.bar_id, d.data) j from dias d)
select coalesce(jsonb_agg(jsonb_build_object(
  'data', data, 'status', status, 'diferenca', diferenca,
  'contahub', contahub_cartao, 'stone', stone_bruto,
  'classificacao', case when stone_bruto < 1 then 'gap_stone'
                        when contahub_cartao < 1 then 'gap_contahub'
                        else 'real' end,
  'so_stone_qtd', (j->'resumo'->>'so_stone_qtd')::int,
  'so_stone_valor', round((j->'resumo'->>'so_stone_valor')::numeric, 2),
  'so_ch_qtd', (j->'resumo'->>'so_ch_qtd')::int,
  'so_ch_valor', round((j->'resumo'->>'so_ch_valor')::numeric, 2)
) order by abs(diferenca) desc), '[]')
from dv;
$$;

grant execute on function public.stone_pendencias(integer, date, date) to authenticated, service_role, anon;