-- Composição do Estoque Final do CMV por semana, pra reconciliar a Gestão CMV com a tela Estoque.
--
-- Contexto (#2 backlog reunião 13/07): o time via "estoque final ≠ contagem da tela Estoque".
-- Não é bug de cálculo nem valor stale — provado no banco em ~28 semanas: o valor gravado bate
-- EXATO com a RPC. A diferença é de ESCOPO:
--   Estoque Final CMV = Insumos (aba Estoque) − Alimentação (F, vai pro CMA) + Produções (aba Produção)
-- O time olhava só a aba "Insumos" e estranhava o total do CMV (que soma produções e tira a F).
--
-- Esta função devolve os 3 componentes por semana p/ o tooltip de decomposição da Gestão CMV,
-- tornando a reconciliação visível. Mesma resolução de data do fn_estoque_contagem_final_semana
-- (segunda-feira seguinte ao fim do período + fallback de 7 dias).

create or replace function silver.fn_estoque_composicao_ano(p_bar_id integer, p_ano integer)
returns table(semana integer, data_usada date, insumo numeric, producao numeric, alimentacao numeric)
language plpgsql
stable security definer
set search_path to 'silver','financial','public'
as $function$
declare
  r record; v_alvo date; v_data date; dow int; add int;
begin
  for r in
    select cs.semana as sem, cs.data_fim
    from financial.cmv_semanal cs
    where cs.bar_id = p_bar_id and cs.ano = p_ano and cs.data_fim is not null
  loop
    dow := extract(dow from r.data_fim)::int;
    add := case when dow = 0 then 1 when dow = 6 then 2
                when ((8 - dow) % 7) = 0 then 7 else ((8 - dow) % 7) end;
    v_alvo := r.data_fim + add;

    if exists (select 1 from silver.estoque_contagem
               where bar_id = p_bar_id and data_contagem = v_alvo and classe in ('insumo','producao')) then
      v_data := v_alvo;
    else
      select min(data_contagem) into v_data from silver.estoque_contagem
      where bar_id = p_bar_id and classe in ('insumo','producao')
        and data_contagem >= v_alvo and data_contagem <= v_alvo + 7;
    end if;

    if v_data is null then continue; end if;

    semana := r.sem;
    data_usada := v_data;
    select
      coalesce(round(sum(valor) filter (where classe = 'insumo')::numeric, 2), 0),
      coalesce(round(sum(valor) filter (where classe = 'producao')::numeric, 2), 0),
      coalesce(round(sum(valor) filter (where upper(coalesce(categoria,'')) ~ '\(F\)')::numeric, 2), 0)
      into insumo, producao, alimentacao
    from silver.estoque_contagem
    where bar_id = p_bar_id and data_contagem = v_data and classe in ('insumo','producao');
    return next;
  end loop;
end
$function$;

grant execute on function silver.fn_estoque_composicao_ano(integer, integer) to anon, authenticated, service_role;
