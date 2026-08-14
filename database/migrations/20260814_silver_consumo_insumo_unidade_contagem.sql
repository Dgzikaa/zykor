-- Saídas × Desvios: a mesma saída teórica aparecia com números diferentes nas duas telas.
--
-- Relatado pelo dono em 14/08/2026: "as saidas estão marcando uma quantidade mas nos desvios
-- está marcando outra". Conferido no bar 3, semana de 04/08: as duas contas estão certas, o que
-- difere é a UNIDADE e a JANELA.
--
--   Saídas  -> ml/g (unidade base da ficha):        Original 600mL = 798.000 ml
--   Desvios -> unidade de contagem (garrafa/lata):  Original 600mL = 1.330 garrafas
--   798.000 ÷ 600 = 1.330 — bate na vírgula, item a item, em toda a lista.
--
--   Janela: Saídas usa [ini, fim] (os dois dias); Desvio usa [ini, fim), porque a contagem do dia
--   `fim` é feita de MANHÃ, antes do consumo daquele dia. Isso está sinalizado nas duas telas.
--
-- Aqui a Saída passa a devolver também a quantidade na unidade de contagem, tirada EXATAMENTE da
-- mesma fonte que o gold.fn_desvios usa (public.insumo_unidade.embalagem com fallback em
-- operations.derive_embalagem) — uma segunda derivação faria as telas voltarem a divergir.
--
-- Já aplicada no banco em 14/08/2026.

drop function if exists silver.fn_consumo_insumo_periodo(integer, date, date);

create function silver.fn_consumo_insumo_periodo(p_bar_id integer, p_ini date, p_fim date)
returns table(
  insumo_codigo    text,
  insumo_nome      text,
  categoria        text,
  unidade          text,
  qtd_base         numeric,
  dias             integer,
  embalagem        numeric,
  unidade_contagem text,
  qtd_contagem     numeric
)
language sql
stable
security definer
set search_path to 'silver', 'operations', 'public'
as $function$
  with emb as (
    -- mesma regra do gold.fn_desvios: a embalagem cadastrada manda; sem ela, deriva do nome
    select i.bar_id,
           i.codigo,
           coalesce(max(iu.embalagem), operations.derive_embalagem(max(i.nome), max(i.unidade_medida))) as embalagem,
           max(i.unidade_contagem) as unidade_contagem
    from operations.insumos i
    left join public.insumo_unidade iu on iu.bar_id = i.bar_id and iu.id_prod = -i.id
    where i.bar_id = p_bar_id
    group by i.bar_id, i.codigo
  )
  select c.insumo_codigo,
    coalesce(min(i.nome), (select b.nome from public.bronze_vmarket_produtos b
       where b.bar_id=p_bar_id and (b.codigo_planilha=c.insumo_codigo or b.cod_interno=c.insumo_codigo)
       order by (b.codigo_planilha=c.insumo_codigo) desc, b.synced_em desc nulls last limit 1))::text insumo_nome,
    coalesce(min(i.categoria), (select b.nome_secao from public.bronze_vmarket_produtos b
       where b.bar_id=p_bar_id and (b.codigo_planilha=c.insumo_codigo or b.cod_interno=c.insumo_codigo)
       order by (b.codigo_planilha=c.insumo_codigo) desc, b.synced_em desc nulls last limit 1))::text categoria,
    -- unidade igual à ficha (deriveUnid): override silver.base > derivação pelo NOME > unidade_medida
    coalesce(min(s.base), min(case
      when i.nome ~* '\d[.,]?\d*\s*(ml|litro|lt|l)\y' then 'ml'
      when i.nome ~* '\d[.,]?\d*\s*(kg|kilo|gr|grama|g)\y' then 'g'
      when i.nome ~* 'c/\s*\d' or i.nome ~* '\d\s*(und|unid|cx|caixa|pct|pacote|fardo)\y' then 'un'
      when i.nome ~* 'vinho|espumante|frisante|moscatel|prosecco|sparkling' then 'ml'
      when i.nome ~* 'whisky|vodka|\ygin\y|tequila|cacha|\yrum\y|licor|conhaque|brandy|aperol|campari|cynar|vermouth|jager|bitter|absinto|steinha|amarula|cointreau|frangelico|limoncello|domecq|netuno|presidente|bananinha|\yjambu\y' then 'ml'
      when lower(i.unidade_medida) in ('ml','l','litro') then 'ml'
      when lower(i.unidade_medida) in ('kg','g','grama') then 'g'
      else 'un'
    end))::text unidade,
    round(sum(c.qtd_teorica),2) qtd_base,
    count(distinct c.data)::int dias,
    max(e.embalagem) as embalagem,
    nullif(btrim(coalesce(max(e.unidade_contagem), '')), '')::text as unidade_contagem,
    round(sum(c.qtd_teorica) / nullif(max(e.embalagem), 0), 3) as qtd_contagem
  from silver.consumo_teorico_insumo_dia c
  left join operations.insumos i on i.bar_id=c.bar_id and i.codigo=c.insumo_codigo
  left join silver.insumo_catalogo s on s.bar_id=c.bar_id and s.codigo=c.insumo_codigo
  left join emb e on e.bar_id=c.bar_id and e.codigo=c.insumo_codigo
  where c.bar_id=p_bar_id and c.data between p_ini and p_fim
  group by c.insumo_codigo
  order by sum(c.qtd_teorica) desc;
$function$;

grant execute on function silver.fn_consumo_insumo_periodo(integer, date, date) to authenticated, service_role;
