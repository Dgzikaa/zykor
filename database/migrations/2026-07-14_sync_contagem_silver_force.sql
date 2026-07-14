-- 2026-07-14 — BUG: contagem lançada/sincronizada DEPOIS da sua data não entrava no silver
-- (aparecia no operations mas não no estoque inicial dos Desvios; o botão "Atualizar estoque"
-- não resolvia). Ex.: contagem semanal do Ordinário do dia 13/07 sincronizada em 14/07 → os
-- Ambev (Lata) sumiam do estoque inicial.
--
-- CAUSA: operations.fn_refresh_contagem_estoque (que o sync-contagem-sheets chama) chamava
-- silver.fn_refresh_estoque_contagem SEM p_force → o silver só processa a data de HOJE
-- (data_contagem >= current_date). Qualquer contagem de data passada que chega depois é pulada.
--
-- FIX: passar p_force=true. O silver reprocessa a janela inteira (p_dias); o freeze + o
-- on-conflict (where congelado=false) protegem o PREÇO das contagens já congeladas, e a linha
-- que faltava é inserida. Assim contagem atrasada sempre entra no silver.
CREATE OR REPLACE FUNCTION operations.fn_refresh_contagem_estoque(p_bar integer, p_dias integer DEFAULT 14)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'operations', 'public'
AS $function$
declare v int;
begin
  with cad as (
    select id, upper(codigo) as cod_u, lower(public.unaccent(nome)) as nome_n,
           categoria, tipo_local, unidade_medida, coalesce(custo_unitario,0) as custo_unitario,
           coalesce(curva_a,false) as curva_a, coalesce(classe,'insumo') as classe
    from operations.insumos where bar_id = p_bar
  ),
  prod as (
    select upper(codigo) as cod_u, coalesce(curva_a,false) as curva_a
    from public.producao_base where bar_id = p_bar and codigo is not null
  ),
  src as (
    select b.bar_id, b.data_contagem, upper(b.insumo_codigo) as cod, b.insumo_nome,
           b.estoque_fechado, b.estoque_flutuante, b.entrada_compra,
           coalesce(b.estoque_fechado,0) + coalesce(b.estoque_flutuante,0) as estoque_final,
           case when extract(day from b.data_contagem) = 1 then 'mensal'
                when extract(dow from b.data_contagem) = 1 then 'semanal'
                else 'diaria' end as tipo_contagem
    from public.bronze_contagem_sheet b
    where b.bar_id = p_bar and b.data_contagem >= current_date - p_dias
  ),
  resolved as (
    select s.*,
           coalesce(cc.id, cn.id) as insumo_id,
           coalesce(cc.categoria, cn.categoria) as categoria,
           coalesce(cc.tipo_local, cn.tipo_local) as tipo_local,
           coalesce(cc.unidade_medida, cn.unidade_medida) as unidade_medida,
           coalesce(cc.custo_unitario, cn.custo_unitario, 0) as custo_unitario,
           coalesce(cc.curva_a, cn.curva_a, pr.curva_a, false) as curva_a,
           case when s.cod ~ '^P[CD]' then 'producao'
                else coalesce(cc.classe, cn.classe, 'insumo') end as classe
    from src s
    left join lateral (select * from cad c where c.cod_u = s.cod limit 1) cc on true
    left join lateral (select * from cad c where c.nome_n = lower(public.unaccent(s.insumo_nome)) limit 1) cn on true
    left join lateral (select * from prod p where p.cod_u = s.cod limit 1) pr on true
  )
  insert into operations.contagem_estoque_insumos
    (bar_id, data_contagem, insumo_codigo, insumo_nome, tipo_contagem, classe,
     estoque_fechado, estoque_flutuante, estoque_final, entrada_compra,
     insumo_id, categoria, tipo_local, unidade_medida, custo_unitario, curva_a,
     usuario_contagem, observacoes, updated_at)
  select bar_id, data_contagem, cod, insumo_nome,
         case when classe in ('limpeza','utensilio') then 'semanal' else tipo_contagem end,
         classe,
         estoque_fechado, estoque_flutuante, estoque_final, entrada_compra,
         insumo_id, categoria, tipo_local, unidade_medida, custo_unitario, curva_a,
         'sync-contagem-sheets', 'medallion', now()
  from resolved
  on conflict (bar_id, data_contagem, insumo_codigo) do update set
    insumo_nome      = excluded.insumo_nome,
    tipo_contagem    = excluded.tipo_contagem,
    classe           = excluded.classe,
    estoque_fechado  = excluded.estoque_fechado,
    estoque_flutuante= excluded.estoque_flutuante,
    estoque_final    = excluded.estoque_final,
    entrada_compra   = excluded.entrada_compra,
    insumo_id        = excluded.insumo_id,
    categoria        = excluded.categoria,
    tipo_local       = excluded.tipo_local,
    unidade_medida   = excluded.unidade_medida,
    custo_unitario   = case when excluded.data_contagem >= current_date
                            then excluded.custo_unitario
                            else contagem_estoque_insumos.custo_unitario end,
    curva_a          = excluded.curva_a,
    usuario_contagem = excluded.usuario_contagem,
    observacoes      = excluded.observacoes,
    updated_at       = excluded.updated_at;
  get diagnostics v = row_count;

  delete from operations.contagem_estoque_insumos o
  where o.bar_id = p_bar
    and o.data_contagem >= current_date - p_dias
    and o.usuario_contagem = 'sync-contagem-sheets'
    and not exists (
      select 1 from public.bronze_contagem_sheet b
      where b.bar_id = o.bar_id and b.data_contagem = o.data_contagem
        and upper(b.insumo_codigo) = upper(o.insumo_codigo)
    );

  perform silver.fn_refresh_estoque_contagem(p_bar, p_dias, true);  -- ← force: pega contagem atrasada
  return v;
end $function$;
