-- v2 da detecção de duplicados: normaliza mais forte antes de comparar
-- (tira acento, caixa, "dj " no início, espaços e pontuação) pra pegar casos
-- como "7 na Roda" = "7naRoda" e "Dj Vinny" = "Vinny". Aplicado no banco via MCP;
-- versionado aqui p/ o source control refletir o schema.

create or replace function operations.fn_norm_artista(p text)
returns text language sql stable
set search_path = extensions, public
as $$
  select regexp_replace(
           regexp_replace(lower(unaccent(coalesce(p, ''))), '^\s*dj\s+', ''),
           '[^a-z0-9]', '', 'g');
$$;
revoke all on function operations.fn_norm_artista(text) from public, anon;
grant execute on function operations.fn_norm_artista(text) to service_role;

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
    round(similarity(operations.fn_norm_artista(a.nome), operations.fn_norm_artista(b.nome))::numeric, 2)
  from operations.bar_artistas a
  join operations.bar_artistas b on a.bar_id = b.bar_id and a.id < b.id
  where a.bar_id = p_bar_id and a.ativo and b.ativo
    and operations.fn_norm_artista(a.nome) <> '' and operations.fn_norm_artista(b.nome) <> ''
    and similarity(operations.fn_norm_artista(a.nome), operations.fn_norm_artista(b.nome)) > 0.5
    and not exists (
      select 1 from operations.artista_dup_ignorar ig
      where ig.bar_id = p_bar_id and ig.id_a = a.id and ig.id_b = b.id
    )
  order by round(similarity(operations.fn_norm_artista(a.nome), operations.fn_norm_artista(b.nome))::numeric, 2) desc, a.nome;
$$;
revoke all on function operations.fn_artistas_duplicados(integer) from public, anon;
grant execute on function operations.fn_artistas_duplicados(integer) to service_role;
