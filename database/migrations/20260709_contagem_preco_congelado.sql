-- 2026-07-09 — CONGELAR o preço da contagem de estoque (bug: contagem antiga mudava de valor
-- quando o preço do VMarket/planilha/cadastro era alterado depois).
--
-- MODELO CORRETO (confirmado com o Rodrigo):
--   Cada contagem usa o preço vigente NA DATA dela:
--     1) VMarket: último pedido com data <= data_contagem (date-anchored) — JÁ era assim.
--     2) sem compra no VMarket até a data → PLANILHA (preço que subimos), congelado.
--     3) assim que aparece 1ª compra no VMarket, contagens daquela data pra frente usam VMarket;
--        as de antes ficam na planilha.
--   Compra nova NUNCA reescreve contagem de data passada.
--
-- COMO CONGELAR:
--   - coluna `congelado`: contagem de data < hoje é imutável; o refresh (cron/sync/botão) só mexe
--     na contagem de HOJE (que ainda pode receber compra do dia).
--   - coluna `preco_unitario`: preço efetivo usado, gravado explícito (auditável).
--   - `p_force`: reprocessa datas passadas de propósito (reconstrução única / correção pontual);
--     o guard `where not congelado` no ON CONFLICT ainda protege linhas já congeladas, então
--     force só afeta datas que foram DES-congeladas antes (ver operations.contagem_salvar).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) SCHEMA (aditivo)
-- ─────────────────────────────────────────────────────────────────────────────
alter table silver.estoque_contagem
  add column if not exists preco_unitario numeric,
  add column if not exists congelado      boolean not null default false,
  add column if not exists congelado_em    timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) silver.fn_refresh_estoque_contagem — date-anchored + congelamento
--    Dropa a versão antiga (2 args) pra não virar overload ambíguo com a nova (3 args).
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists silver.fn_refresh_estoque_contagem(integer, integer);
create or replace function silver.fn_refresh_estoque_contagem(
  p_bar integer, p_dias integer default 14, p_force boolean default false)
 returns integer
 language plpgsql
 security definer
 set search_path to 'silver', 'operations', 'public'
as $function$
declare v int;
begin
  with relevant as (
    select * from operations.contagem_estoque_insumos o
    where o.bar_id = p_bar
      and o.data_contagem >= current_date - p_dias
      -- SEM force: só a contagem de HOJE é (re)calculada; passado fica intocado.
      and (p_force or o.data_contagem >= current_date)
  ),
  precos as materialized (
    select bb.bar_id, upper(coalesce(bb.codigo_planilha, bb.cod_interno)) as cod,
           pp.data::date as ddata, pi.preco
    from gold.vmarket_pedido_item pi
    join gold.vmarket_pedido pp on pp.id_pedido = pi.id_pedido and pp.bar_id = pi.bar_id
    join public.bronze_vmarket_produtos bb on bb.id_produto_sisfood_cotacao = pi.id_produto_sisfood_cotacao and bb.bar_id = pi.bar_id
    where pi.bar_id = p_bar and pp.data::date <= current_date
      and coalesce(pi.preco, 0) > 0
  ),
  px as (
    select distinct on (o.bar_id, o.data_contagem, o.insumo_codigo)
      o.bar_id, o.data_contagem, o.insumo_codigo, p.preco
    from relevant o
    join precos p on p.cod = upper(o.insumo_codigo) and p.ddata <= o.data_contagem
    order by o.bar_id, o.data_contagem, o.insumo_codigo, p.ddata desc, p.preco desc
  ),
  planp as (
    select distinct on (bar_id, data_contagem, insumo_codigo)
      bar_id, data_contagem, insumo_codigo, preco_planilha
    from public.bronze_contagem_sheet
    where bar_id = p_bar and data_contagem >= current_date - p_dias
    order by bar_id, data_contagem, insumo_codigo, preco_planilha desc nulls last
  ),
  resolved as (
    select o.*,
      pl.preco_planilha as plan_price,
      (case when px.preco is not null
              and not (coalesce(nullif(o.custo_unitario,0), pl.preco_planilha, 0) > 0
                       and px.preco > coalesce(nullif(o.custo_unitario,0), pl.preco_planilha) * 5)
            then px.preco end) as vm
    from relevant o
    left join px on px.bar_id = o.bar_id and px.data_contagem = o.data_contagem and px.insumo_codigo = o.insumo_codigo
    left join planp pl on pl.bar_id = o.bar_id and pl.data_contagem = o.data_contagem and pl.insumo_codigo = o.insumo_codigo
  )
  insert into silver.estoque_contagem
    (bar_id, data_contagem, insumo_codigo, insumo_id, insumo_nome, tipo_contagem,
     categoria, tipo_local, unidade_medida, estoque_fechado, estoque_flutuante, estoque_final,
     preco_vmarket, preco_fonte, preco_unitario, valor, curva_a, congelado, congelado_em, atualizado_em)
  select r.bar_id, r.data_contagem, r.insumo_codigo, r.insumo_id, r.insumo_nome, r.tipo_contagem,
         r.categoria, r.tipo_local, r.unidade_medida, r.estoque_fechado, r.estoque_flutuante, r.estoque_final,
         r.vm,
         case when r.vm is not null then 'vmarket'
              when coalesce(r.plan_price,0) > 0 then 'planilha'
              when coalesce(r.custo_unitario,0) > 0 then 'cadastro'
              else 'sem_preco' end,
         coalesce(r.vm, r.plan_price, r.custo_unitario, 0),                        -- preco_unitario efetivo
         coalesce(r.estoque_final,0) * coalesce(r.vm, r.plan_price, r.custo_unitario, 0),
         coalesce(r.curva_a, false),
         false, null, now()
  from resolved r
  on conflict (bar_id, data_contagem, insumo_codigo) do update set
    insumo_id=excluded.insumo_id, insumo_nome=excluded.insumo_nome, tipo_contagem=excluded.tipo_contagem,
    categoria=excluded.categoria, tipo_local=excluded.tipo_local, unidade_medida=excluded.unidade_medida,
    estoque_fechado=excluded.estoque_fechado, estoque_flutuante=excluded.estoque_flutuante, estoque_final=excluded.estoque_final,
    preco_vmarket=excluded.preco_vmarket, preco_fonte=excluded.preco_fonte, preco_unitario=excluded.preco_unitario,
    valor=excluded.valor, curva_a=excluded.curva_a, atualizado_em=excluded.atualizado_em
    where estoque_contagem.congelado = false;   -- NUNCA reescreve contagem congelada
  get diagnostics v = row_count;

  -- congela tudo que já é passado (data < hoje). Hoje fica aberto pra compra do dia.
  update silver.estoque_contagem
     set congelado = true, congelado_em = now()
   where bar_id = p_bar and data_contagem < current_date and congelado = false;

  -- remove órfãos só entre linhas ainda abertas (nunca apaga congelada)
  delete from silver.estoque_contagem s
  where s.bar_id = p_bar and s.data_contagem >= current_date - p_dias
    and s.congelado = false
    and not exists (select 1 from operations.contagem_estoque_insumos o
                    where o.bar_id = s.bar_id and o.data_contagem = s.data_contagem and o.insumo_codigo = s.insumo_codigo);
  return v;
end $function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) operations.fn_refresh_contagem_estoque — não sobrescreve custo_unitario de data passada
--    (protege o fallback 'cadastro' do /contagem/resultado e dos desvios). Quantidade da
--    planilha continua sincronizando normalmente; só o PREÇO fica travado no passado.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function operations.fn_refresh_contagem_estoque(p_bar integer, p_dias integer default 14)
 returns integer
 language plpgsql
 security definer
 set search_path to 'operations', 'public'
as $function$
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
    -- PREÇO: só atualiza no dia corrente; data passada mantém o custo já gravado (congelado)
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

  perform silver.fn_refresh_estoque_contagem(p_bar, p_dias);
  return v;
end $function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) operations.contagem_salvar — correção manual de contagem ANTIGA pelo app:
--    des-congela só aquela data e reprocessa com force (as outras datas ficam travadas).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function operations.contagem_salvar(p_bar_id integer, p_data date, p_usuario text, p_itens jsonb)
 returns integer
 language plpgsql
 set search_path to 'operations', 'public', 'pg_catalog'
as $function$
declare r jsonb; v_cod text; v_final numeric; v_n int := 0; v_ini numeric;
  v_preco numeric; v_cat text; v_loc text; v_un text; v_nome text; v_tipo text;
  v_classe text; v_dias int; v_id bigint; v_is_prod boolean;
begin
  for r in select * from jsonb_array_elements(p_itens) loop
    v_cod := upper(r->>'codigo');
    v_final := (r->>'estoque_final')::numeric;
    v_is_prod := v_cod ~ '^P[CD]';
    if v_is_prod then
      select null::bigint, pb.nome,
             case when v_cod like 'PD%' then 'Produção Drinks' else 'Produção Cozinha' end,
             case when v_cod like 'PD%' then 'Produção Drinks' else 'Produção Cozinha' end,
             pb.unidade, coalesce(pcu.custo_cu,0), 'producao'
        into v_id, v_nome, v_cat, v_loc, v_un, v_preco, v_classe
        from public.producao_base pb
        left join lateral (select case when pb.rendimento>0 then sum(coalesce(fi.custo_planilha,0))/pb.rendimento*coalesce(pb.fator_contagem,1) else null end as custo_cu
                           from public.producao_ficha_item fi where fi.producao_id=pb.id) pcu on true
        where pb.bar_id=p_bar_id and upper(pb.codigo)=v_cod limit 1;
    else
      select i.id, i.nome, i.categoria, i.tipo_local, i.unidade_medida,
             coalesce(pa.preco_atual, i.custo_unitario, 0), coalesce(i.classe,'insumo')
        into v_id, v_nome, v_cat, v_loc, v_un, v_preco, v_classe
        from operations.insumos i
        left join operations.v_insumo_preco_atual pa on pa.bar_id=p_bar_id and pa.cod_u=upper(i.codigo)
        where i.bar_id=p_bar_id and upper(i.codigo)=v_cod limit 1;
    end if;
    v_tipo := case when v_classe in ('limpeza','utensilio') then 'semanal'
                   when extract(day from p_data)=1 then 'mensal'
                   when extract(isodow from p_data)=1 then 'semanal' else 'diaria' end;
    select estoque_final into v_ini from operations.contagem_estoque_insumos
      where bar_id=p_bar_id and upper(insumo_codigo)=v_cod and data_contagem < p_data order by data_contagem desc limit 1;
    v_ini := coalesce(v_ini, 0);
    update operations.contagem_estoque_insumos
      set estoque_final=v_final, estoque_fechado=v_final, estoque_inicial=v_ini, tipo_contagem=v_tipo, classe=v_classe,
          insumo_id=v_id, insumo_nome=v_nome,
          consumo_periodo=v_ini - v_final, valor_consumo=(v_ini - v_final)*v_preco,
          observacoes=r->>'observacoes', usuario_contagem=p_usuario, updated_at=now()
      where bar_id=p_bar_id and upper(insumo_codigo)=v_cod and data_contagem=p_data;
    if not found then
      insert into operations.contagem_estoque_insumos
        (bar_id, data_contagem, tipo_contagem, classe, insumo_id, insumo_codigo, insumo_nome, estoque_inicial, estoque_final, estoque_fechado,
         consumo_periodo, valor_consumo, tipo_local, categoria, unidade_medida, custo_unitario, observacoes, usuario_contagem, created_at, updated_at)
      values (p_bar_id, p_data, v_tipo, v_classe, v_id, v_cod, v_nome, v_ini, v_final, v_final,
         v_ini - v_final, (v_ini - v_final)*v_preco, v_loc, v_cat, v_un, v_preco, r->>'observacoes', p_usuario, now(), now());
    end if;
    v_n := v_n + 1;
  end loop;
  -- correção manual pode ser de data passada: des-congela SÓ essa data e reprocessa com force.
  update silver.estoque_contagem set congelado = false
    where bar_id = p_bar_id and data_contagem = p_data;
  v_dias := least(120, greatest(3, (current_date - p_data) + 2));
  perform silver.fn_refresh_estoque_contagem(p_bar_id, v_dias, true);
  return v_n;
end;$function$;
