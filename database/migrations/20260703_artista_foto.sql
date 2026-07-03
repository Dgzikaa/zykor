-- Foto do artista (hero + card compartilhável). Coluna no cadastro + expõe na lista do dropdown.
alter table operations.bar_artistas add column if not exists foto_url text;

drop function if exists operations.fn_artista_lista(int);
create function operations.fn_artista_lista(p_bar int)
returns table(artista_id int, nome text, tipo text, foto_url text, shows bigint, primeiro date, ultimo date)
language sql stable security definer set search_path to 'operations','public','pg_catalog' as $$
  select ea.artista_id,
         coalesce(max(ba.nome), max(ea.artista_nome)) as nome,
         coalesce(max(ba.tipo),'banda') as tipo,
         max(ba.foto_url) as foto_url,
         count(*) as shows, min(eb.data_evento::date) as primeiro, max(eb.data_evento::date) as ultimo
  from operations.evento_artistas ea
  join public.eventos_base eb on eb.id = ea.evento_id
  left join operations.bar_artistas ba on ba.id = ea.artista_id
  where ea.bar_id = p_bar and ea.artista_id is not null and eb.data_evento::date <= current_date
  group by ea.artista_id
  order by count(*) desc;
$$;
revoke execute on function operations.fn_artista_lista(int) from anon, public;
grant execute on function operations.fn_artista_lista(int) to service_role, authenticated;
