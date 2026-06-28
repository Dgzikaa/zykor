-- =====================================================================
-- Planejamento da Produção — Fases 2/3: persistência + ciclo de planejamento
-- Aplicada em prod via MCP em 2026-06-28 (migration plano_producao_persistencia).
-- Modelo do sócio (aba 'Lista - Preparos'): saída = uso indireto (explosão da
-- ficha, já feita por fn_plano_producao); PR = Média6s + DesvPad(n−1) × FatorServiço.
-- =====================================================================

-- 1) Config estável por produção (Nível de Serviço + Semanas de Receita).
--    A flag "entra no planejamento/controle" reaproveita public.producao_base.controle_producao.
create table if not exists operations.producao_plano_config (
  bar_id          integer     not null,
  producao_id     bigint      not null,
  producao_cod    text        not null,
  nivel_servico   integer     not null default 95,
  semanas_receita numeric     not null default 1,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text,
  primary key (bar_id, producao_id)
);

-- 2) Sessão de planejamento (header) — 1 por semana/bar.
create table if not exists operations.producao_plano (
  id            bigint generated always as identity primary key,
  bar_id        integer not null,
  semana_ini    date    not null,                 -- segunda da semana planejada
  status        text    not null default 'rascunho', -- rascunho | encerrado
  contagem_data date,                              -- data da contagem usada como base
  iniciado_por  text,
  iniciado_em   timestamptz default now(),
  encerrado_por text,
  encerrado_em  timestamptz,
  unique (bar_id, semana_ini)
);

-- 3) Decisão por item dentro da sessão (snapshot da sugestão + o que foi decidido).
create table if not exists operations.producao_plano_item (
  id                bigint generated always as identity primary key,
  plano_id          bigint not null references operations.producao_plano(id) on delete cascade,
  producao_id       bigint not null,
  producao_cod      text,
  producao_nome     text,
  media6            numeric,
  desvpad           numeric,
  nivel_servico     integer,
  fator_servico     numeric,
  ponto_ressupr     numeric,
  estoque           numeric,
  sugestao_qtd      numeric,
  sugestao_receitas integer,
  decidido_receitas numeric,
  decidido_qtd      numeric,
  seguiu_sugestao   boolean default true,
  motivo_override   text,
  dia_producao      text,                          -- ISO 'YYYY-MM-DD' (calendarização)
  atualizado_em     timestamptz default now(),
  unique (plano_id, producao_id)
);

create index if not exists ix_plano_item_plano on operations.producao_plano_item(plano_id);
create index if not exists ix_plano_bar_semana on operations.producao_plano(bar_id, semana_ini);

grant select, insert, update, delete on
  operations.producao_plano_config,
  operations.producao_plano,
  operations.producao_plano_item
to authenticated, service_role, anon;

-- 4) fn_plano_producao: adiciona producao_id + controle_producao ao retorno
--    (necessário p/ FK das tabelas acima e p/ a ligação com o Controle de Produção).
drop function if exists gold.fn_plano_producao(integer);
create function gold.fn_plano_producao(p_bar integer)
 returns table(producao_id bigint, producao_cod text, producao_nome text, rendimento numeric,
   fator_contagem numeric, unidade text, curva_a boolean, controle_producao boolean,
   estoque_atual numeric, semanas date[], saidas numeric[])
 language sql stable security definer
 set search_path to 'gold','public','silver','operations'
as $function$
  with recursive expl as (
    select fi.produto_id as raiz, fi.componente_tipo, fi.producao_ref, fi.quantidade::numeric as qtd, 1::numeric as fator, 0 as lvl
    from public.producao_ficha_item fi where fi.produto_id is not null
    union all
    select e.raiz, fi.componente_tipo, fi.producao_ref, fi.quantidade::numeric, e.fator*(e.qtd/nullif(pb.rendimento,0)), e.lvl+1
    from expl e join public.producao_base pb on pb.id=e.producao_ref
    join public.producao_ficha_item fi on fi.producao_id=e.producao_ref
    where e.componente_tipo='producao' and e.lvl < 6
  ),
  prod_base as (
    select id, upper(codigo) cod, nome, coalesce(rendimento,0) rendimento, coalesce(fator_contagem,1) fator_contagem,
           unidade_contagem, coalesce(curva_a,false) curva_a, coalesce(controle_producao,false) controle_producao
    from public.producao_base where bar_id=p_bar and codigo is not null
  ),
  ppp as (
    select e.raiz produto_id, pb.cod, sum(e.qtd*e.fator) qtd_cu
    from expl e join prod_base pb on pb.id=e.producao_ref
    where e.componente_tipo='producao' and e.producao_ref is not null group by 1,2
  ),
  semanas as (select (date_trunc('week', current_date)::date - (g*7))::date sem from generate_series(1,6) g),
  vendas as (
    select pc.id produto_id, date_trunc('week', v.data)::date sem, sum(v.qtd_venda) qtd
    from silver.vendas_consolidada_dia v
    join public.produto_cardapio pc on pc.bar_id=v.bar_id and pc.codigo=v.cod_interno
    where v.bar_id=p_bar and v.data >= date_trunc('week', current_date)::date - 42 and v.data < date_trunc('week', current_date)::date
    group by 1,2
  ),
  saida_raw as (select ppp.cod, vd.sem, sum(ppp.qtd_cu*vd.qtd) saida from ppp join vendas vd on vd.produto_id=ppp.produto_id group by 1,2),
  est as (select distinct on (upper(insumo_codigo)) upper(insumo_codigo) cod, estoque_final from silver.estoque_contagem where bar_id=p_bar order by upper(insumo_codigo), data_contagem desc),
  full_grid as (
    select pb.id, pb.cod, pb.nome, pb.rendimento, pb.fator_contagem, pb.unidade_contagem, pb.curva_a, pb.controle_producao, s.sem,
      coalesce(sr.saida,0)/nullif(pb.fator_contagem,0) saida
    from prod_base pb cross join semanas s left join saida_raw sr on sr.cod=pb.cod and sr.sem=s.sem
  )
  select fg.id, fg.cod, fg.nome::text, fg.rendimento, fg.fator_contagem, fg.unidade_contagem::text, fg.curva_a, fg.controle_producao,
    coalesce(e.estoque_final,0) as estoque_atual,
    array_agg(fg.sem order by fg.sem) semanas,
    array_agg(round(fg.saida,2) order by fg.sem) saidas
  from full_grid fg left join est e on e.cod=fg.cod
  group by fg.id, fg.cod, fg.nome, fg.rendimento, fg.fator_contagem, fg.unidade_contagem, fg.curva_a, fg.controle_producao, e.estoque_final
  having sum(fg.saida) > 0;
$function$;

grant execute on function gold.fn_plano_producao(integer) to authenticated, service_role, anon;

notify pgrst, 'reload schema';
