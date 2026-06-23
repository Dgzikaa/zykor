-- Ajustes da Orçamentação/Planejamento pedidos pelos sócios (jun/2026).
-- Aplicado em produção 2026-06-23 via MCP. Arquivo p/ registro/histórico.

-- ── Item 1: Produção Mensal Fixo passa a ter realizado (vinha só manual/orcOnly) ──
-- Faltava no de-para da Orçamentação (já existia na DRE). Refrescar gold depois:
--   select public.cron_refresh_gold_orcamentacao_diario();
insert into meta.categoria_zykor_map (categoria_ca, categoria_zykor, bloco_dre, tipo_zykor, ignorar, observacao)
values ('Produção Mensal Fixo', 'Produção Mensal Fixo', 'Despesas Comerciais', 'despesa', false, 'item1 socios jun26')
on conflict do nothing;

-- ── Item 4.1: projeção de custos pré-lançados NÃO conta dias com custo zerado ──
-- A média das últimas 4 mesmas-semanas usava real_r>0 mas incluía dias com c_art=0
-- (ex: quinta sem atração, real_r alto) → razão 0 derrubava a média e projetava
-- artístico menor que o real. Agora art e prod têm médias SEPARADAS, cada uma
-- excluindo o próprio custo zerado. O cron projetar_custos_rolling (08:10) usa esta.
create or replace function public.projetar_custos_pre_lancado(p_bar_id integer, p_data_inicio date, p_data_fim date)
 returns integer language plpgsql security definer
 set search_path to 'public', 'operations', 'pg_temp'
as $function$
declare v_ev record; v_pct_art numeric; v_pct_prod numeric; v_n int := 0;
begin
  for v_ev in
    select id, data_evento, m1_r, extract(dow from data_evento)::int as dow
    from operations.eventos_base
    where bar_id = p_bar_id and data_evento between p_data_inicio and p_data_fim
  loop
    select avg(c_art / real_r) into v_pct_art from (
      select c_art, real_r from operations.eventos_base
      where bar_id = p_bar_id and extract(dow from data_evento)::int = v_ev.dow
        and data_evento < v_ev.data_evento and real_r > 0 and c_art > 0
      order by data_evento desc limit 4) a;
    select avg(c_prod / real_r) into v_pct_prod from (
      select c_prod, real_r from operations.eventos_base
      where bar_id = p_bar_id and extract(dow from data_evento)::int = v_ev.dow
        and data_evento < v_ev.data_evento and real_r > 0 and c_prod > 0
      order by data_evento desc limit 4) p;
    update operations.eventos_base
    set c_art_projecao  = round(coalesce(v_pct_art, 0)  * coalesce(v_ev.m1_r, 0), 2),
        c_prod_projecao = round(coalesce(v_pct_prod, 0) * coalesce(v_ev.m1_r, 0), 2)
    where id = v_ev.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$function$;
