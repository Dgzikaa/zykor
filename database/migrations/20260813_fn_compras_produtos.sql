-- gold.fn_compras_produtos — quanto de CADA produto foi comprado no período (qtd + R$)
--
-- Pedido do Gonza (13/08/2026): na tela de Compras ele precisa responder "quantas unidades e quantos
-- R$ de Smirnoff a gente comprou mês passado / no acumulado do ano". Hoje só existe o Top 50 de
-- fn_compras_analises — a Smirnoff aparece, mas o Old Parr (R$ 237 no Ordinário) não entra no corte.
-- Aqui vai a lista COMPLETA agregada por produto, pra busca achar qualquer item por menor que seja.
--
-- Agrupa por cod_interno (o código do cadastro, que é o que amarra o de-para). Item sem código cai
-- num grupo pelo nome, pra não sumir da lista. Itens recusados já ficam de fora porque
-- gold.vmarket_pedido_item não os traz (ver 20260813_vmarket_item_recusado_nao_entra.sql).
create or replace function gold.fn_compras_produtos(p_bar integer, p_ini date, p_fim date)
returns jsonb
language sql
stable
security definer
set search_path to 'gold', 'public', 'operations'
as $function$
  with ficha as (
    select distinct upper(fi.insumo_codigo) cod
    from public.producao_ficha_item fi
    where fi.componente_tipo = 'insumo' and fi.insumo_codigo is not null
      and (exists (select 1 from public.produto_cardapio pc where pc.id = fi.produto_id and pc.bar_id = p_bar)
        or exists (select 1 from public.producao_base pb where pb.id = fi.producao_id and pb.bar_id = p_bar))
  ),
  itens as (
    select
      coalesce(nullif(upper(pi.cod_interno), ''),
               'nome:' || upper(coalesce(nullif(pi.nome_cotacao, ''), nullif(pi.produto_fornecedor, ''), '(sem nome)'))) as chave,
      -- nome do cadastro na frente: o VMarket manda nome_cotacao em branco em ~70% dos itens
      coalesce(nullif(i.nome, ''), nullif(pi.nome_cotacao, ''), nullif(pi.produto_fornecedor, ''), '(sem nome)') as nome,
      nullif(upper(pi.cod_interno), '') as cod,
      -- unidade de COMPRA (a qtd é na unidade do pedido, não na unidade base do cadastro: a Smirnoff
      -- é 'ml' no cadastro mas se compra por garrafa). O VMarket suja esse campo — às vezes vem a
      -- marca ('Seara', 'Fleury / Piracanjuba') — então só aceita o que tem cara de unidade.
      case when pi.gramatura_cotacao ~* '^\s*(un|und|unid|unidade|kg|g|gr|l|lt|ml|cx|caixa|pct|pacote|fd|fardo|dz|duzia|pc|peca|sc|saco|bd|bandeja)\s*$'
           then lower(trim(pi.gramatura_cotacao)) end as unidade_compra,
      nullif(i.unidade_medida, '') as unidade_cadastro,
      nullif(pi.nome_secao, '') as secao,
      coalesce(i.curva_a, false) as curva_a,
      (i.codigo is not null) as cadastrado,
      (f.cod is not null) as tem_ficha,
      pi.preco, pi.quantidade, pi.total, p.fornecedor, p.id_pedido, p.data
    from gold.vmarket_pedido_item pi
    join gold.vmarket_pedido p on p.id_pedido = pi.id_pedido and p.bar_id = pi.bar_id
    left join operations.insumos i on i.bar_id = pi.bar_id and upper(i.codigo) = upper(pi.cod_interno)
    left join ficha f on f.cod = upper(pi.cod_interno)
    where pi.bar_id = p_bar and p.data between p_ini and p_fim
  ),
  forn as (
    select chave, jsonb_agg(jsonb_build_object('fornecedor', fornecedor, 'valor', valor, 'qtd', qtd, 'n_pedidos', n_pedidos)
                            order by valor desc nulls last) js
    from (
      select chave, fornecedor, round(sum(total), 2) valor, round(sum(quantidade), 2) qtd,
             count(distinct id_pedido) n_pedidos
      from itens group by chave, fornecedor
    ) t group by chave
  ),
  mes as (
    select chave, jsonb_agg(jsonb_build_object('mes', mes, 'valor', valor, 'qtd', qtd) order by mes) js
    from (
      select chave, to_char(data, 'YYYY-MM') mes, round(sum(total), 2) valor, round(sum(quantidade), 2) qtd
      from itens group by chave, to_char(data, 'YYYY-MM')
    ) t group by chave
  ),
  agg as (
    select
      i.chave,
      max(i.nome) as nome,
      max(i.cod) as cod,
      mode() within group (order by i.unidade_compra) filter (where i.unidade_compra is not null) as unidade,
      max(i.unidade_cadastro) as unidade_cadastro,
      max(i.secao) as secao,
      bool_or(i.curva_a) as curva_a,
      bool_or(i.cadastrado) as cadastrado,
      bool_or(i.tem_ficha) as tem_ficha,
      round(sum(i.quantidade), 2) as qtd,
      round(sum(i.total), 2) as valor,
      count(*) as n_compras,
      count(distinct i.id_pedido) as n_pedidos,
      count(distinct i.fornecedor) as n_fornecedores,
      -- preço médio ponderado pela quantidade (não média simples de preço de nota)
      round(sum(i.total) filter (where i.preco > 0) / nullif(sum(i.quantidade) filter (where i.preco > 0), 0), 4) as preco_medio,
      round(min(i.preco) filter (where i.preco > 0), 2) as preco_min,
      round(max(i.preco) filter (where i.preco > 0), 2) as preco_max,
      (array_agg(i.preco order by i.data desc, i.id_pedido desc) filter (where i.preco > 0))[1] as ultimo_preco,
      min(i.data) as primeira_compra,
      max(i.data) as ultima_compra
    from itens i group by i.chave
  )
  select coalesce(jsonb_agg(to_jsonb(a) - 'chave' || jsonb_build_object(
           'fornecedores', coalesce(f.js, '[]'::jsonb),
           'meses', coalesce(m.js, '[]'::jsonb)
         ) order by a.valor desc nulls last), '[]'::jsonb)
  from agg a
  left join forn f on f.chave = a.chave
  left join mes m on m.chave = a.chave;
$function$;

comment on function gold.fn_compras_produtos(integer, date, date) is
  'Compras agregadas por produto no período (qtd, R$, preço médio ponderado, fornecedores e meses). Lista completa — sem corte de top N.';
