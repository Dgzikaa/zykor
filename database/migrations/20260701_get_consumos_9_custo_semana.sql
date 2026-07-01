-- Agregado por categoria (9 + outros) do CUSTO REAL da ficha, reusando o detalhado.
-- Mantém o corte 12/06 (pré-corte cai em 'outros') — breakdown de EXIBIÇÃO do CMV semanal.
-- Usado pela edge cmv-semanal-auto pra montar consumacoes_9 em custo real (não mais ×0,35).
create or replace function public.get_consumos_9_custo_semana(
  input_bar_id integer, input_data_inicio date, input_data_fim date, p_fator numeric default 0.35
)
returns table(categoria text, bruto numeric, custo_real numeric)
language sql
stable
set search_path to 'public','pg_catalog'
as $function$
  select categoria,
    round(sum(valor_desconto)::numeric, 2) as bruto,
    round(sum(custo_real)::numeric, 2) as custo_real
  from public.get_consumos_9_detalhes_custo_semana(input_bar_id, input_data_inicio, input_data_fim, null, p_fator, null, 0)
  group by categoria;
$function$;

revoke execute on function public.get_consumos_9_custo_semana(integer, date, date, numeric) from public, anon;
grant execute on function public.get_consumos_9_custo_semana(integer, date, date, numeric) to service_role, authenticated;
