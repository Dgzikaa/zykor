-- Estoque FINAL da semana: resolve a contagem da segunda-feira seguinte a data_fim
-- (fallback pra próxima contagem até +7 dias), igual à convenção da planilha/modal do CMV.
-- Retorna 0 linhas se não houver contagem (edge mantém o valor da planilha).
CREATE OR REPLACE FUNCTION silver.fn_estoque_contagem_final_semana(p_bar_id integer, p_data_fim date)
 RETURNS TABLE(cozinha numeric, bebidas numeric, drinks numeric, funcionarios numeric, n_itens integer, data_usada date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'silver', 'public'
AS $function$
declare
  dow int := extract(dow from p_data_fim)::int;  -- 0=domingo
  add int;
  v_alvo date;
  v_data date;
begin
  add := case when dow = 0 then 1 when dow = 6 then 2
              when ((8 - dow) % 7) = 0 then 7 else ((8 - dow) % 7) end;
  v_alvo := p_data_fim + add;

  if exists (select 1 from silver.estoque_contagem
             where bar_id = p_bar_id and data_contagem = v_alvo and classe = 'insumo') then
    v_data := v_alvo;
  else
    select min(data_contagem) into v_data from silver.estoque_contagem
    where bar_id = p_bar_id and classe = 'insumo'
      and data_contagem >= v_alvo and data_contagem <= v_alvo + 7;
  end if;

  if v_data is null then
    return;  -- sem contagem → 0 linhas (edge mantém o valor da planilha)
  end if;

  return query
  select b.cozinha, b.bebidas, b.drinks, b.funcionarios, b.n_itens, v_data
  from silver.fn_estoque_contagem_buckets(p_bar_id, v_data) b;
end $function$;
