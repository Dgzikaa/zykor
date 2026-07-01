-- Fichas vinculadas ("réplicas"): produtos/produções que compartilham a MESMA receita e só mudam o preço.
-- ficha_grupo_id agrupa os membros. A API de ficha (POST/PUT/DELETE) propaga a edição pros irmãos do grupo.
create sequence if not exists public.ficha_grupo_seq;
alter table public.produto_cardapio add column if not exists ficha_grupo_id bigint;
alter table public.producao_base  add column if not exists ficha_grupo_id bigint;
create index if not exists idx_produto_ficha_grupo  on public.produto_cardapio(bar_id, ficha_grupo_id) where ficha_grupo_id is not null;
create index if not exists idx_producao_ficha_grupo on public.producao_base(bar_id, ficha_grupo_id) where ficha_grupo_id is not null;
comment on column public.produto_cardapio.ficha_grupo_id is 'Fichas vinculadas: membros do mesmo grupo compartilham a receita (edicao propaga). NULL = ficha independente.';
comment on column public.producao_base.ficha_grupo_id  is 'Fichas vinculadas: membros do mesmo grupo compartilham a receita (edicao propaga). NULL = ficha independente.';

-- helper p/ o client pegar o proximo id de grupo
create or replace function public.nextval_ficha_grupo()
returns bigint language sql volatile as $$ select nextval('public.ficha_grupo_seq') $$;
