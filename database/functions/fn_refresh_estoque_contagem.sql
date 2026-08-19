-- silver.fn_refresh_estoque_contagem
--
-- Bronze/operations -> silver.estoque_contagem (contagem valorizada pelo preco DO DIA).
--
-- CONGELAMENTO (coluna `congelado`): toda contagem de dia passado e congelada no primeiro
-- refresh depois da meia-noite. O que o congelamento protege e a VALORIZACAO -- o preco que
-- valia no dia da contagem nao pode ser reescrito por um preco de hoje, senao o CMV e o desvio
-- de uma semana ja fechada mudam sozinhos.
--
-- O que o congelamento NAO pode travar e a QUANTIDADE contada. O time acha erro de contagem
-- depois (19/08/2026: o Quibe Vegano da contagem de 17/08 estava 47 e era 0) e corrige na
-- planilha -- essa correcao TEM que chegar na tela. Antes o `do update` inteiro tinha
-- `where congelado = false`, entao a linha congelada mantinha estoque_fechado/flutuante
-- velhos; so um UPDATE avulso mais abaixo remendava o estoque_final, deixando a linha
-- internamente inconsistente (fechado = 47, final = 0).
--
-- Agora: quantidade + metadados sempre seguem a planilha; preco (vmarket/fonte/unitario) so
-- muda enquanto a linha nao esta congelada; e o `valor` da linha congelada e recalculado como
-- quantidade NOVA x preco CONGELADO.
CREATE OR REPLACE FUNCTION silver.fn_refresh_estoque_contagem(p_bar integer, p_dias integer DEFAULT 14, p_force boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'silver', 'operations', 'public'
AS $function$
declare v int;
begin
  with relevant as (
    select * from operations.contagem_estoque_insumos o
    where o.bar_id = p_bar
      and o.data_contagem >= current_date - p_dias
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
     preco_vmarket, preco_fonte, preco_unitario, valor, curva_a, classe, congelado, congelado_em, atualizado_em)
  select r.bar_id, r.data_contagem, r.insumo_codigo, r.insumo_id, r.insumo_nome, r.tipo_contagem,
         r.categoria, r.tipo_local, r.unidade_medida, r.estoque_fechado, r.estoque_flutuante, r.estoque_final,
         r.vm,
         case when r.vm is not null then 'vmarket'
              when coalesce(r.plan_price,0) > 0 then 'planilha'
              when coalesce(r.custo_unitario,0) > 0 then 'cadastro'
              else 'sem_preco' end,
         coalesce(r.vm, r.plan_price, r.custo_unitario, 0),
         coalesce(r.estoque_final,0) * coalesce(r.vm, r.plan_price, r.custo_unitario, 0),
         coalesce(r.curva_a, false),
         coalesce(r.classe, 'insumo'),
         false, null, now()
  from resolved r
  on conflict (bar_id, data_contagem, insumo_codigo) do update set
    insumo_id=excluded.insumo_id, insumo_nome=excluded.insumo_nome, tipo_contagem=excluded.tipo_contagem,
    categoria=excluded.categoria, tipo_local=excluded.tipo_local, unidade_medida=excluded.unidade_medida,
    -- QUANTIDADE segue a planilha sempre, inclusive em linha congelada (correcao de contagem
    -- de um dia ja fechado precisa aparecer no Desvios / Estoque / CMV).
    estoque_fechado=excluded.estoque_fechado, estoque_flutuante=excluded.estoque_flutuante,
    estoque_final=excluded.estoque_final,
    -- PRECO so muda enquanto a linha nao congelou: o preco do dia da contagem e imutavel.
    preco_vmarket  = case when estoque_contagem.congelado then estoque_contagem.preco_vmarket  else excluded.preco_vmarket  end,
    preco_fonte    = case when estoque_contagem.congelado then estoque_contagem.preco_fonte    else excluded.preco_fonte    end,
    preco_unitario = case when estoque_contagem.congelado then estoque_contagem.preco_unitario else excluded.preco_unitario end,
    valor          = case when estoque_contagem.congelado
                          then round(coalesce(excluded.estoque_final,0) * coalesce(estoque_contagem.preco_unitario,0), 2)
                          else excluded.valor end,
    curva_a=excluded.curva_a, classe=excluded.classe, atualizado_em=excluded.atualizado_em
    -- Linha congelada so e tocada quando a QUANTIDADE mudou de fato. Sem isto todo sync (de
    -- hora em hora) reescreveria as ~2 mil linhas da janela e o `atualizado_em` deixaria de
    -- responder "quando esta contagem mudou pela ultima vez".
    where estoque_contagem.congelado = false
       or estoque_contagem.estoque_fechado   is distinct from excluded.estoque_fechado
       or estoque_contagem.estoque_flutuante is distinct from excluded.estoque_flutuante
       or estoque_contagem.estoque_final     is distinct from excluded.estoque_final;
  get diagnostics v = row_count;

  update silver.estoque_contagem
     set congelado = true, congelado_em = now()
   where bar_id = p_bar and data_contagem < current_date and congelado = false;

  -- Rede de seguranca do estoque_final: o upsert acima so enxerga `relevant`, que com
  -- p_force = false traz apenas o dia de hoje. Este UPDATE varre a janela inteira e realinha
  -- qualquer linha que tenha ficado pra tras (inclusive congelada).
  update silver.estoque_contagem s
     set estoque_final = o.estoque_final,
         valor = round(coalesce(o.estoque_final,0) * coalesce(s.preco_unitario,0), 2),
         atualizado_em = now()
  from operations.contagem_estoque_insumos o
  where o.bar_id = s.bar_id and o.data_contagem = s.data_contagem and o.insumo_codigo = s.insumo_codigo
    and s.bar_id = p_bar and s.data_contagem >= current_date - p_dias
    and round(coalesce(o.estoque_final,0),3) <> round(coalesce(s.estoque_final,0),3);

  delete from silver.estoque_contagem s
  where s.bar_id = p_bar and s.data_contagem >= current_date - p_dias
    and s.congelado = false
    and not exists (select 1 from operations.contagem_estoque_insumos o
                    where o.bar_id = s.bar_id and o.data_contagem = s.data_contagem and o.insumo_codigo = s.insumo_codigo);
  return v;
end $function$;
