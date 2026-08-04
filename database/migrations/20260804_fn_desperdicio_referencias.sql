-- Referência por insumo pra tela de Desperdício avisar na hora do lançamento (04/08/2026).
--
-- Motivo: o campo de quantidade não diz unidade nenhuma, e o rótulo do cadastro
-- (operations.insumos.unidade_medida) MENTE — "Limão taiti (kg)" está como 'g', "Barril de Chopp
-- 30L" como 'ml'. No Deboche, 281 de 462 insumos nem têm unidade_contagem. Resultado no teste de
-- 02/08: digitaram 670 pensando em gramas e entrou 670 kg (R$ 4.549); 1500 ml de chopp viraram
-- 1.500 barris (R$ 521.925). Os dois foram parar na coluna Desperdício dos Desvios.
--
-- Em vez de confiar no rótulo, a tela passa a ancorar na REALIDADE do item: quanto ele costuma
-- ter em estoque e quanto custa. Com isso dá pra mostrar o R$ enquanto digita e gritar quando a
-- quantidade é ordens de grandeza acima do normal.

create or replace function operations.fn_desperdicio_referencias(p_bar_id integer)
returns table (
  codigo text,
  preco numeric,
  ultima_qtd numeric,
  ultima_data date
)
language sql
stable
security definer
set search_path to 'operations', 'public', 'silver'
as $function$
  select
    upper(i.codigo)::text,
    round(coalesce(p.preco_atual, 0), 4),
    c.estoque_final,
    c.data_contagem
  from operations.insumos i
  left join operations.v_insumo_preco_atual p
         on p.bar_id = i.bar_id and p.cod_u = upper(i.codigo)
  left join lateral (
    select s.estoque_final, s.data_contagem
    from silver.estoque_contagem s
    where s.bar_id = i.bar_id and upper(s.insumo_codigo) = upper(i.codigo)
      and s.estoque_final > 0 and s.data_contagem >= current_date - 90
    order by s.data_contagem desc
    limit 1
  ) c on true
  where i.bar_id = p_bar_id and i.ativo;
$function$;

revoke all on function operations.fn_desperdicio_referencias(integer) from public, anon;
grant execute on function operations.fn_desperdicio_referencias(integer) to service_role;
