-- Participações de um artista em line-ups combinados (combos).
-- Ex: perfil do "Benzadeus" também lista "Bonsai, Dj Caju, Benzadeus e Boka de Sergipe".
-- NÃO entra no custo/headline dele (custo é compartilhado com o line-up) — seção à parte.
create or replace function gold.artista_participacoes(p_bar_id int, p_key text)
returns table (
  evento_id int, data_evento date, dia_semana text,
  artista_label text, fat numeric, custo_total numeric,
  cl_real int, ticket numeric, futuro boolean
) language sql stable as $$
  with exploded as (
    select e.*, gold.norm_artista(tok) as tok_key
    from gold.eventos_artista e,
      lateral regexp_split_to_table(e.artista_key, '\s*(,|/|&|\+| e | feat\.? | x )\s*') as tok
  )
  select evento_id, data_evento,
    trim(to_char(data_evento,'TMDy')) as dia_semana,
    artista_label, round(real_r) as fat, round(custo_total) as custo_total,
    cl_real,
    round(case when cl_real>0 then real_r/cl_real end,2) as ticket, futuro
  from exploded
  where bar_id = p_bar_id
    and tok_key = gold.norm_artista(p_key)
    and artista_key <> gold.norm_artista(p_key)   -- só combos; standalone já está no detalhe
  order by data_evento;
$$;
grant execute on function gold.artista_participacoes(int,text) to anon, authenticated, service_role;
