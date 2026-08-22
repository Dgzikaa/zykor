-- =====================================================================================
-- gold.fn_drinks_painel — painel da Chefe de Bar
--
-- Pedido da Mafê (22/08/2026): faturamento de drinks, quantidade, % do faturamento total,
-- ticket médio, CMV médio, ranking (qtd / faturamento / margem), mix de vendas, vendas por dia
-- da semana e faixa de horário, tempo médio de saída, evolução semanal, e a classificação
-- automática em Destaques / Alto giro / Oportunidades / Baixa performance.
--
-- ── A decisão que define tudo: o que É um drink ────────────────────────────────────────
-- O ContaHub cria um `prd` SEPARADO pra cada variação de preço e joga em OUTRO grupo:
-- "[50%] Moscow Mule" está no grupo "50%", "[DD] Aperol" no grupo "Dose Dupla",
-- "[PP] Negroni" em "Pegue e Pague". Filtrar por `grp_desc ilike '%drink%'` — o caminho
-- óbvio — perderia **2.190 drinks e R$ 44,7 mil** em 52 dias no Ordinário (17% do volume).
-- É o mesmo erro que já mordeu na lista de artistas: agrupar pela variação em vez do item.
--
-- Então: o drink é o NOME BASE, sem o prefixo entre colchetes. O cardápio de drinks (quais
-- nomes são drink) sai dos grupos de drink numa janela larga; as VENDAS vêm de qualquer
-- grupo, desde que o nome base esteja no cardápio. Assim o Moscow Mule é UM drink com o
-- preço médio real — cheio e promo misturados, que é o que de fato entra no caixa.
--
-- ── Custo ──────────────────────────────────────────────────────────────────────────────
-- Vem da ficha técnica do drink (via `produto_contahub_map` → `fn_cmv_teorico_produto_preco`).
-- O custo é o MESMO em todas as variações — a receita do [50%] é idêntica à do cheio, só o
-- preço muda. É justamente isso que faz o CMV% ficar honesto: drink que vende metade do
-- volume em promoção tem CMV real muito pior que o da ficha, e o painel mostra isso.
--
-- ── Tempo ──────────────────────────────────────────────────────────────────────────────
-- `silver.tempos_producao`, métrica do bar (t0_t3), teto de outlier 1h — mesmo padrão de
-- todos os motores (ver project_atraso_teto_outlier_1h_padronizado). Deboche usa t0_t2
-- antes de 07/03/2026.
--
-- ── Classificação ──────────────────────────────────────────────────────────────────────
-- Engenharia de cardápio: eixo X = quantidade vendida, eixo Y = margem de contribuição
-- UNITÁRIA em R$ (não %). Margem em R$ é o que paga a conta: um drink de CMV 40% que
-- deixa R$ 18 vale mais que um de CMV 20% que deixa R$ 6. O corte é a MEDIANA dos dois
-- eixos — robusta a outlier e fácil de explicar pra equipe.
-- =====================================================================================

create or replace function gold.fn_drinks_painel(
  p_bar integer,
  p_ini date,
  p_fim date
) returns jsonb
language sql
stable
as $fn$
with
per as (
  select p_bar::int bar, p_ini ini, p_fim fim,
         (p_fim - p_ini + 1)::int dias,
         (p_ini - (p_fim - p_ini + 1))::date ini_ant,
         (p_ini - 1)::date fim_ant
),

-- Quais nomes são drink. Janela de 180 dias pra que um drink que no período só saiu em
-- promoção continue reconhecido (o grupo dele naquele período é "50%", não "Drinks").
cardapio as (
  select distinct btrim(regexp_replace(prd_desc, '^\s*(\[[^\]]*\]\s*)+', '')) nome
  from bronze.bronze_contahub_avendas_porproduto_sinteticoporhorario, per
  where bar_id = per.bar
    and grp_desc ilike '%drink%'
    and vd_dtgerencial between per.fim - 180 and per.fim
    and btrim(regexp_replace(prd_desc, '^\s*(\[[^\]]*\]\s*)+', '')) <> ''
),

-- Todas as vendas do período, já com nome base e a tag da variação.
vendas_todas as (
  select v.vd_dtgerencial dia,
         nullif(split_part(v.hora, ':', 1), '')::int h,
         btrim(regexp_replace(v.prd_desc, '^\s*(\[[^\]]*\]\s*)+', '')) nome,
         coalesce(nullif(substring(v.prd_desc from '^\s*\[([^\]]*)\]'), ''), 'cheio') tag,
         v.qtd::numeric qtd,
         v.valorpago::numeric fat
  from bronze.bronze_contahub_avendas_porproduto_sinteticoporhorario v, per
  where v.bar_id = per.bar and v.vd_dtgerencial between per.ini and per.fim
),
vd as (select v.* from vendas_todas v join cardapio c on c.nome = v.nome),

-- Faturamento da casa inteira — mesma tabela, então o % não depende de reconciliar fonte.
casa as (select coalesce(sum(fat), 0) fat, coalesce(sum(qtd), 0) qtd from vendas_todas),

-- ── custo por drink ────────────────────────────────────────────────────────────────────
-- O de-para guarda o nome de quando foi mapeado e envelhece; por isso normalizamos os dois
-- lados e ficamos com o menor custo por nome quando há mais de um código (raro).
mapa as (
  select btrim(regexp_replace(m.prd_desc, '^\s*(\[[^\]]*\]\s*)+', '')) nome, m.cod_interno
  from public.produto_contahub_map m, per
  where m.bar_id = per.bar and m.cod_interno is not null
),
custo_cod as (
  select codigo, custo_unit
  from per, gold.fn_cmv_teorico_produto_preco(per.bar, per.ini, per.fim, per.fim)
  where custo_unit is not null and custo_unit > 0
),
custo as (
  select mp.nome, min(c.custo_unit) custo_unit
  from mapa mp join custo_cod c on c.codigo = mp.cod_interno
  group by 1
),

-- ── tempo por drink ────────────────────────────────────────────────────────────────────
tempo as (
  select btrim(regexp_replace(t.produto_desc, '^\s*(\[[^\]]*\]\s*)+', '')) nome,
         avg(case when per.bar = 4 and t.data_producao < date '2026-03-07' then t.t0_t2 else t.t0_t3 end) seg,
         count(*) obs
  from silver.tempos_producao t, per
  where t.bar_id = per.bar and t.data_producao between per.ini and per.fim
    and coalesce(case when per.bar = 4 and t.data_producao < date '2026-03-07' then t.t0_t2 else t.t0_t3 end, 0)
        between 1 and 3600
  group by 1
),

-- ── agregado por drink ─────────────────────────────────────────────────────────────────
por_drink as (
  select v.nome,
         sum(v.qtd) qtd,
         sum(v.fat) fat,
         sum(v.qtd) filter (where v.tag <> 'cheio') qtd_promo,
         c.custo_unit
  from vd v left join custo c on c.nome = v.nome
  group by v.nome, c.custo_unit
  having sum(v.qtd) > 0
),
tot as (select coalesce(sum(qtd), 0) qtd, coalesce(sum(fat), 0) fat from por_drink),
enriq as (
  select d.nome, d.qtd, d.fat, coalesce(d.qtd_promo, 0) qtd_promo, d.custo_unit,
         d.fat / nullif(d.qtd, 0) preco_medio,
         d.custo_unit * d.qtd custo_total,
         case when d.custo_unit is not null and d.fat > 0
              then (d.custo_unit * d.qtd) / d.fat * 100 end cmv_pct,
         case when d.custo_unit is not null
              then d.fat / nullif(d.qtd, 0) - d.custo_unit end margem_unit,
         case when d.custo_unit is not null
              then d.fat - d.custo_unit * d.qtd end margem_total,
         t.seg tempo_seg, t.obs tempo_obs
  from por_drink d left join tempo t on t.nome = d.nome
),
-- Mediana só entre quem tem ficha: drink sem custo não pode entrar no eixo da margem, e se
-- entrasse como zero puxaria o corte pra baixo e classificaria todo mundo como "boa margem".
cortes as (
  select (percentile_cont(0.5) within group (order by qtd))::numeric qtd_med,
         (percentile_cont(0.5) within group (order by margem_unit))::numeric margem_med
  from enriq where margem_unit is not null
),
classificado as (
  select e.*,
         case when e.margem_unit is null then null
              when e.qtd >= k.qtd_med and e.margem_unit >= k.margem_med then 'destaque'
              when e.qtd >= k.qtd_med then 'alto_giro'
              when e.margem_unit >= k.margem_med then 'oportunidade'
              else 'baixa' end classe
  from enriq e cross join cortes k
),

-- ── período anterior, mesmo tamanho ────────────────────────────────────────────────────
vd_ant as (
  select v.vd_dtgerencial dia,
         btrim(regexp_replace(v.prd_desc, '^\s*(\[[^\]]*\]\s*)+', '')) nome,
         v.qtd::numeric qtd, v.valorpago::numeric fat
  from bronze.bronze_contahub_avendas_porproduto_sinteticoporhorario v, per
  where v.bar_id = per.bar and v.vd_dtgerencial between per.ini_ant and per.fim_ant
),
ant_drinks as (select a.* from vd_ant a join cardapio c on c.nome = a.nome),
ant_casa as (select coalesce(sum(fat), 0) fat from vd_ant),
ant_custo as (
  select codigo, custo_unit
  from per, gold.fn_cmv_teorico_produto_preco(per.bar, per.ini_ant, per.fim_ant, per.fim_ant)
  where custo_unit is not null and custo_unit > 0
),
ant_custo_nome as (
  select mp.nome, min(c.custo_unit) custo_unit
  from mapa mp join ant_custo c on c.codigo = mp.cod_interno group by 1
),
ant_resumo as (
  select coalesce(sum(a.qtd), 0) qtd,
         coalesce(sum(a.fat), 0) fat,
         coalesce(sum(a.qtd * cn.custo_unit), 0) custo,
         coalesce(sum(a.fat) filter (where cn.custo_unit is not null), 0) fat_com_custo
  from ant_drinks a left join ant_custo_nome cn on cn.nome = a.nome
),
ant_tempo as (
  select avg(case when per.bar = 4 and t.data_producao < date '2026-03-07' then t.t0_t2 else t.t0_t3 end) seg
  from silver.tempos_producao t
  cross join per
  join cardapio c on c.nome = btrim(regexp_replace(t.produto_desc, '^\s*(\[[^\]]*\]\s*)+', ''))
  where t.bar_id = per.bar and t.data_producao between per.ini_ant and per.fim_ant
    and coalesce(case when per.bar = 4 and t.data_producao < date '2026-03-07' then t.t0_t2 else t.t0_t3 end, 0)
        between 1 and 3600
),

-- ── recortes ───────────────────────────────────────────────────────────────────────────
dia_semana as (
  select extract(dow from dia)::int dow, sum(qtd) qtd, sum(fat) fat, count(distinct dia) dias
  from vd group by 1
),
faixa_hora as (
  select h, sum(qtd) qtd, sum(fat) fat
  from vd where h between 0 and 30 group by 1
),
semanas as (
  select date_trunc('week', v.dia)::date semana,
         sum(v.qtd) qtd, sum(v.fat) fat,
         sum(v.qtd * c.custo_unit) custo,
         sum(v.fat) filter (where c.custo_unit is not null) fat_com_custo
  from vd v left join custo c on c.nome = v.nome
  group by 1
),
resumo as (
  select (select fat from tot) fat,
         (select qtd from tot) qtd,
         (select fat from casa) fat_casa,
         coalesce(sum(x.custo_total), 0) custo,
         coalesce(sum(x.fat) filter (where x.custo_unit is not null), 0) fat_com_custo,
         count(*) drinks,
         count(*) filter (where x.custo_unit is null) sem_ficha,
         sum(x.qtd_promo) qtd_promo,
         sum(x.tempo_seg * x.tempo_obs) / nullif(sum(x.tempo_obs), 0) tempo_seg
  from classificado x
)
select jsonb_build_object(
  'periodo', jsonb_build_object('ini', per.ini, 'fim', per.fim, 'dias', per.dias,
                                'ini_ant', per.ini_ant, 'fim_ant', per.fim_ant),
  'resumo', (select jsonb_build_object(
      'fat', round(r.fat, 2), 'qtd', r.qtd,
      'fat_casa', round(r.fat_casa, 2),
      'pct_fat', round(r.fat / nullif(r.fat_casa, 0) * 100, 2),
      'ticket_medio', round(r.fat / nullif(r.qtd, 0), 2),
      'custo', round(r.custo, 2),
      -- CMV só sobre o faturamento que TEM ficha: dividir por tudo diluiria o índice com
      -- drinks de custo desconhecido e ele apareceria melhor do que é.
      'cmv_pct', round(r.custo / nullif(r.fat_com_custo, 0) * 100, 2),
      'margem', round(r.fat_com_custo - r.custo, 2),
      'tempo_seg', round(r.tempo_seg),
      'drinks', r.drinks, 'sem_ficha', r.sem_ficha,
      'qtd_promo', r.qtd_promo,
      'pct_promo', round(r.qtd_promo / nullif(r.qtd, 0) * 100, 2)
    ) from resumo r),
  'anterior', (select jsonb_build_object(
      'fat', round(a.fat, 2), 'qtd', a.qtd,
      'pct_fat', round(a.fat / nullif((select fat from ant_casa), 0) * 100, 2),
      'ticket_medio', round(a.fat / nullif(a.qtd, 0), 2),
      'cmv_pct', round(a.custo / nullif(a.fat_com_custo, 0) * 100, 2),
      'tempo_seg', round((select seg from ant_tempo))
    ) from ant_resumo a),
  'cortes', (select jsonb_build_object('qtd', round(k.qtd_med, 1), 'margem', round(k.margem_med, 2)) from cortes k),
  'drinks', coalesce((select jsonb_agg(jsonb_build_object(
      'nome', x.nome, 'qtd', x.qtd, 'fat', round(x.fat, 2),
      'preco_medio', round(x.preco_medio, 2),
      'custo_unit', round(x.custo_unit, 4),
      'cmv_pct', round(x.cmv_pct, 2),
      'margem_unit', round(x.margem_unit, 2),
      'margem_total', round(x.margem_total, 2),
      'mix_qtd', round(x.qtd / nullif((select qtd from tot), 0) * 100, 2),
      'mix_fat', round(x.fat / nullif((select fat from tot), 0) * 100, 2),
      'qtd_promo', x.qtd_promo,
      'pct_promo', round(x.qtd_promo / nullif(x.qtd, 0) * 100, 2),
      'tempo_seg', round(x.tempo_seg),
      'tempo_obs', x.tempo_obs,
      'classe', x.classe
    ) order by x.fat desc) from classificado x), '[]'::jsonb),
  'dia_semana', coalesce((select jsonb_agg(jsonb_build_object(
      'dow', d.dow, 'qtd', d.qtd, 'fat', round(d.fat, 2), 'dias', d.dias,
      'qtd_dia', round(d.qtd / nullif(d.dias, 0), 1)
    ) order by d.dow) from dia_semana d), '[]'::jsonb),
  'hora', coalesce((select jsonb_agg(jsonb_build_object(
      'hora', f.h, 'qtd', f.qtd, 'fat', round(f.fat, 2)
    ) order by f.h) from faixa_hora f), '[]'::jsonb),
  'semanas', coalesce((select jsonb_agg(jsonb_build_object(
      'semana', s.semana, 'qtd', s.qtd, 'fat', round(s.fat, 2),
      'cmv_pct', round(s.custo / nullif(s.fat_com_custo, 0) * 100, 2),
      'ticket_medio', round(s.fat / nullif(s.qtd, 0), 2)
    ) order by s.semana) from semanas s), '[]'::jsonb)
)
from per;
$fn$;

grant execute on function gold.fn_drinks_painel(integer, date, date) to authenticated, service_role;
