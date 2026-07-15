-- Ajuste (backlog 15/07): a decomposição do Estoque Final do CMV agora devolve INSUMO e PRODUÇÃO
-- já SEM a alimentação (F) — igual às abas Insumo/Produção da tela Estoque (estoque-historico),
-- que passaram a excluir o (F). Antes: insumo (com F) − alimentação + produção; agora: insumo (sem F)
-- + produção (sem F). A SOMA (= Estoque Final do CMV) NÃO muda — só a decomposição do tooltip, que
-- passa a reconciliar 1:1 com "Insumo + Produção" da tela Estoque. Mantém a coluna `alimentacao`
-- (o total (F)) por retrocompatibilidade da API, mas o tooltip não a exibe mais.

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
    -- insumo e producao SEM as linhas (F); alimentacao = total (F) (só p/ retrocompat da API).
    -- insumo (sem F) + producao (sem F) = Estoque Final do CMV, batendo com a tela Estoque.
    select
      coalesce(round(sum(valor) filter (where classe = 'insumo'   and upper(coalesce(categoria,'')) !~ '\(F\)')::numeric, 2), 0),
      coalesce(round(sum(valor) filter (where classe = 'producao' and upper(coalesce(categoria,'')) !~ '\(F\)')::numeric, 2), 0),
      coalesce(round(sum(valor) filter (where upper(coalesce(categoria,'')) ~ '\(F\)')::numeric, 2), 0)
      into insumo, producao, alimentacao
    from silver.estoque_contagem
    where bar_id = p_bar_id and data_contagem = v_data and classe in ('insumo','producao');
    return next;
  end loop;
end
$function$;

grant execute on function silver.fn_estoque_composicao_ano(integer, integer) to anon, authenticated, service_role;
