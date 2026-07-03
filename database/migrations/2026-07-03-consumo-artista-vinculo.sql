-- Vínculo consumação (comanda) -> artista do cadastro. Manual (override) + auto (nome no motivo /
-- principal da noite). Alimenta a sub-tela /operacional/consumacao/artistas e o ranking de atrações.
-- Aplicado no banco via MCP; versionado aqui p/ o source control refletir o schema.
create table if not exists financial.consumo_artista_override (
  bar_id integer not null,
  vd bigint not null,
  artista_id integer references operations.bar_artistas(id) on delete set null,
  updated_at timestamptz default now(),
  primary key (bar_id, vd)
);
grant select, insert, update, delete on financial.consumo_artista_override to service_role;

create or replace function financial.fn_consumo_artistas_periodo(p_bar integer, p_ini date, p_fim date)
returns table(vd bigint, data date, mesa text, motivo text, valor numeric,
              artista_id integer, artista_nome text, origem text)
language sql stable security definer
set search_path = public, financial, bronze, operations, extensions
as $$
  with com as (
    select v.vd, v.trn_dtgerencial::date as data, v.vd_mesadesc as mesa,
           coalesce(v.vd_motivodesconto, '') as motivo, coalesce(v.vd_vrdescontos, 0) as valor,
           lower(coalesce(v.vd_motivodesconto, '')) as motivo_l
    from bronze.bronze_contahub_avendas_vendasperiodo v
    where v.bar_id = p_bar and v.trn_dtgerencial between p_ini and p_fim and coalesce(v.vd_vrdescontos, 0) > 0
  ),
  art as (
    select c.* from com c
    where (select k.categoria from financial.consumos_keywords k
           where k.ativo and (k.bar_id is null or k.bar_id = p_bar) and c.motivo_l ~ lower(k.pattern)
           order by k.prioridade asc limit 1) = 'artistas'
  )
  select a.vd, a.data, a.mesa, a.motivo, a.valor,
    coalesce(o.artista_id, an.id, nt.id) as artista_id,
    (select nome from operations.bar_artistas where id = coalesce(o.artista_id, an.id, nt.id)) as artista_nome,
    case when o.artista_id is not null then 'manual'
         when an.id is not null then 'auto_nome'
         when nt.id is not null then 'auto_noite' else null end as origem
  from art a
  left join financial.consumo_artista_override o on o.bar_id = p_bar and o.vd = a.vd
  left join lateral (
    select ba.id from operations.bar_artistas ba
    where ba.bar_id = p_bar and ba.ativo and length(ba.nome) >= 3
      and lower(public.unaccent(a.motivo)) like '%' || lower(public.unaccent(ba.nome)) || '%'
    order by length(ba.nome) desc limit 1
  ) an on true
  left join lateral (
    select ea.artista_id as id
    from operations.eventos_base e
    join operations.evento_artistas ea on ea.evento_id = e.id
    where e.bar_id = p_bar and e.data_evento = a.data and ea.artista_id is not null
    order by ea.c_art desc nulls last, ea.ordem asc limit 1
  ) nt on true;
$$;
revoke all on function financial.fn_consumo_artistas_periodo(integer, date, date) from public, anon;
grant execute on function financial.fn_consumo_artistas_periodo(integer, date, date) to service_role;

create or replace function financial.fn_consumo_por_artista(p_bar integer, p_ini date, p_fim date)
returns table(artista_id integer, valor numeric, comandas bigint)
language sql stable security definer set search_path = public, financial, operations
as $$
  select artista_id, sum(valor)::numeric, count(*)::bigint
  from financial.fn_consumo_artistas_periodo(p_bar, p_ini, p_fim)
  where artista_id is not null group by artista_id;
$$;
revoke all on function financial.fn_consumo_por_artista(integer, date, date) from public, anon;
grant execute on function financial.fn_consumo_por_artista(integer, date, date) to service_role;
