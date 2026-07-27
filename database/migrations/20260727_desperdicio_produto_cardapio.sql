-- Desperdicio passa a aceitar PRODUTO do cardapio (hamburguer montado), alem de insumo/preparo.
--
-- Regra alinhada com o dono em 27/07: "hamburguer, quando a gente fala, e ele completo; quando e
-- so a carne, falamos blend". Entao jogar fora 1 Debochao debita blend, pao, queijo, cebola... e
-- o Molho Barbecoca.
--
-- A explosao PARA no preparo de proposito: preparo tem estoque proprio e e contado (Croquetao
-- PC0094, Dadinho PC0012 aparecem em silver.estoque_contagem), e o insumo cru dele ja saiu do
-- estoque quando foi produzido. Descer alem disso contaria o mesmo prejuizo duas vezes e criaria
-- desvio fantasma no insumo cru.

-- 1) origem do lancamento (o que a pessoa escolheu). A linha continua sendo por CODIGO DEBITADO
--    em insumo_codigo — que e o que o desvio consome —, entao nada quebra.
alter table operations.desperdicio_registro_item
  add column if not exists origem_tipo   text,
  add column if not exists origem_codigo text,
  add column if not exists origem_nome   text,
  add column if not exists origem_qtd    numeric;

comment on column operations.desperdicio_registro_item.origem_tipo is
  'O que a pessoa escolheu: insumo | preparo | produto. NULL = registro antigo (sempre insumo).';
comment on column operations.desperdicio_registro_item.origem_codigo is
  'Codigo do item escolhido. Igual a insumo_codigo quando nao houve explosao de ficha.';
comment on column operations.desperdicio_registro_item.origem_qtd is
  'Quantidade do item ESCOLHIDO (ex.: 1 hamburguer). insumo_codigo/qtd guardam o componente debitado.';

alter table operations.desperdicio_registro_item
  drop constraint if exists desperdicio_item_origem_tipo_check;
alter table operations.desperdicio_registro_item
  add constraint desperdicio_item_origem_tipo_check
  check (origem_tipo is null or origem_tipo in ('insumo','preparo','produto'));

create index if not exists idx_desperdicio_item_origem
  on operations.desperdicio_registro_item (origem_tipo, origem_codigo);

-- 2) explosao de 1 unidade do produto nos componentes que devem ser debitados.
--    Mesma fonte da ficha usada por gold.fn_plano_compras (produto_cardapio -> producao_ficha_item),
--    inclusive multiplicador do produto e fator de correcao do item.
create or replace function public.fn_desperdicio_explodir_produto(p_bar int, p_produto_id bigint)
returns table (
  componente_tipo text,   -- 'insumo' | 'preparo'
  codigo          text,   -- codigo do insumo OU do preparo (o que vai em insumo_codigo)
  nome            text,
  qtd_por_unidade numeric -- quanto sai do estoque por 1 unidade do produto
)
language sql
stable
security definer
set search_path = public, operations
as $$
  select
    case when fi.componente_tipo = 'producao' then 'preparo' else 'insumo' end::text,
    coalesce(upper(fi.insumo_codigo), upper(pb.codigo))::text,
    coalesce(i.nome, pb.nome)::text,
    ((coalesce(fi.quantidade, 0) / coalesce(nullif(fi.fator_correcao, 0), 1))
      * coalesce(pc.multiplicador, 1))::numeric
  from public.produto_cardapio pc
  join public.producao_ficha_item fi on fi.produto_id = pc.id
  left join public.producao_base pb on pb.id = fi.producao_ref
  left join operations.insumos i
         on i.bar_id = pc.bar_id and upper(i.codigo) = upper(fi.insumo_codigo)
  where pc.bar_id = p_bar
    and pc.id = p_produto_id
    and coalesce(upper(fi.insumo_codigo), upper(pb.codigo)) is not null
$$;

revoke all on function public.fn_desperdicio_explodir_produto(int, bigint) from public;
grant execute on function public.fn_desperdicio_explodir_produto(int, bigint) to service_role;
