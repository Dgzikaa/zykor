-- Faturamento BRUTO Stone (sum gross_amount) por RELÓGIO REAL (capture_local_dt, hora local SP naive)
-- num intervalo [ini, fim). Usado no Ajuste Receita Virada do Mês: janela 00:00-06:00 do último dia
-- do mês (a madrugada que o dt_gerencial — corte 6h — joga pro dia operacional anterior).
create or replace function public.fn_stone_bruto_intervalo(p_bar int, p_ini timestamp, p_fim timestamp)
returns numeric language sql stable security definer set search_path = public, silver
as $$
  select coalesce(sum(gross_amount),0)::numeric
  from silver.stone_transacoes
  where bar_id = p_bar and capture_local_dt >= p_ini and capture_local_dt < p_fim;
$$;

comment on function public.fn_stone_bruto_intervalo(int,timestamp,timestamp) is
  'Faturamento BRUTO Stone (sum gross_amount) por capture_local_dt num intervalo. Ajuste Receita Virada do Mês.';
