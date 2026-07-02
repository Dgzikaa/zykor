-- Normalização de artistas duplicados (Beco da Rainha/Beco das Rainha, Dj X/X, acentos…).
-- Ferramenta self-serve: lista pares parecidos e mescla um no outro repointando tudo.

-- pares que o usuário marcou como "não é duplicata" (some da lista)
create table if not exists operations.artista_dup_ignorar (
  bar_id integer not null,
  id_a   integer not null,   -- sempre o menor id
  id_b   integer not null,
  created_at timestamptz default now(),
  primary key (bar_id, id_a, id_b)
);
grant select, insert, delete on operations.artista_dup_ignorar to service_role;

-- candidatos a duplicata por similaridade (trigram, acento/caixa-insensível)
create or replace function operations.fn_artistas_duplicados(p_bar_id integer)
returns table(id_a integer, nome_a text, uso_a bigint, id_b integer, nome_b text, uso_b bigint, sim numeric)
language sql stable security definer
set search_path = extensions, operations, public
as $$
  select
    a.id, a.nome,
    (select count(*) from operations.evento_artistas ea where ea.artista_id = a.id),
    b.id, b.nome,
    (select count(*) from operations.evento_artistas ea where ea.artista_id = b.id),
    round(similarity(lower(unaccent(a.nome)), lower(unaccent(b.nome)))::numeric, 2)
  from operations.bar_artistas a
  join operations.bar_artistas b on a.bar_id = b.bar_id and a.id < b.id
  where a.bar_id = p_bar_id and a.ativo and b.ativo
    and similarity(lower(unaccent(a.nome)), lower(unaccent(b.nome))) > 0.55
    and not exists (
      select 1 from operations.artista_dup_ignorar ig
      where ig.bar_id = p_bar_id and ig.id_a = a.id and ig.id_b = b.id
    )
  order by round(similarity(lower(unaccent(a.nome)), lower(unaccent(b.nome)))::numeric, 2) desc, a.nome;
$$;
revoke all on function operations.fn_artistas_duplicados(integer) from public, anon;
grant execute on function operations.fn_artistas_duplicados(integer) to service_role;

-- mescla p_from -> p_into: repointa tags, cachês (override), de-para; soma histórico; desativa o from
create or replace function operations.fn_merge_artista(p_bar_id integer, p_from integer, p_into integer)
returns void language plpgsql security definer
set search_path = operations, public
as $$
begin
  if p_from = p_into then return; end if;
  if not exists (select 1 from operations.bar_artistas where id = p_from and bar_id = p_bar_id)
     or not exists (select 1 from operations.bar_artistas where id = p_into and bar_id = p_bar_id) then
    raise exception 'artista de outro bar ou inexistente';
  end if;

  -- evento_artistas: eventos onde os DOIS estão taggeados -> soma o cachê no into e apaga o from
  update operations.evento_artistas i
    set c_art = coalesce(i.c_art, 0) + coalesce(f.c_art, 0)
    from operations.evento_artistas f
    where f.evento_id = i.evento_id and f.artista_id = p_from
      and i.artista_id = p_into and i.bar_id = p_bar_id
      and (i.c_art is not null or f.c_art is not null);
  delete from operations.evento_artistas f
    where f.artista_id = p_from
      and exists (select 1 from operations.evento_artistas i
                  where i.evento_id = f.evento_id and i.artista_id = p_into);
  -- eventos só com o from -> repointa pro into
  update operations.evento_artistas
    set artista_id = p_into,
        artista_nome = (select nome from operations.bar_artistas where id = p_into)
    where artista_id = p_from;

  -- cachês corrigidos (override) e de-para favorecido
  update operations.ca_atracao_override set artista_id = p_into where bar_id = p_bar_id and artista_id = p_from;
  update operations.artista_ca_pessoa   set artista_id = p_into where bar_id = p_bar_id and artista_id = p_from;

  -- desativa o duplicado (soft, preserva FK/histórico)
  update operations.bar_artistas set ativo = false where id = p_from;
end $$;
revoke all on function operations.fn_merge_artista(integer, integer, integer) from public, anon;
grant execute on function operations.fn_merge_artista(integer, integer, integer) to service_role;
