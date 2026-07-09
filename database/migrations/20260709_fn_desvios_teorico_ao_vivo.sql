-- 2026-07-09 — fn_desvios: teórico lido AO VIVO (view silver.insumo_por_produto) em vez da
-- matview silver.consumo_teorico_insumo_dia.
--
-- BUG: a matview consumo_teorico_insumo_dia (= vendas_consolidada_dia × insumo_por_produto) só
-- é refrescada de hora em hora (cron 'silver-vendas-produto-dia' → silver.fn_refresh_consumo_teorico).
-- Como insumo_por_produto é VIEW ao vivo sobre a ficha, qualquer mudança de FICHA só batia no
-- desvio no próximo refresh (até 1h depois) — e nesse meio-tempo o Desvio DIVERGIA da tela de
-- Saída (/operacional/consumo-insumo), que já lê ao vivo. Sintoma: Michelob Ultra 330ml marcava
-- saída teórica 2,2 (710ml stale ÷ 330) em vez de 2,0 (660 ÷ 330).
--
-- FIX: o CTE teorico_ins do gold.fn_desvios passa a ler insumo_por_produto ao vivo (mesma lógica
-- da matview, sem o snapshot). Equivalente quando a matview está fresca; correto NA HORA quando a
-- ficha muda. Patch cirúrgico do CTE via regexp (não reescreve a função gigante à mão); aborta se
-- o padrão não for encontrado.
do $$
declare def text; novo text;
begin
  def := pg_get_functiondef('gold.fn_desvios'::regproc);
  novo := regexp_replace(def,
    'teorico_ins\s+as\s*\(\s*select\s+upper\(insumo_codigo\)\s+cod,\s*sum\(qtd_teorica\)\s+as\s+base\s+from\s+silver\.consumo_teorico_insumo_dia\s+where\s+bar_id=p_bar\s+and\s+data\s*>=\s*p_ini\s+and\s+data\s*<\s*p_fim\s+group\s+by\s+upper\(insumo_codigo\)\s*\)',
    'teorico_ins as (select upper(ipp.insumo_codigo) cod, sum(v.qtd_consumo * ipp.qtd_por_produto) as base from silver.vendas_consolidada_dia v join silver.insumo_por_produto ipp on ipp.bar_id=v.bar_id and ipp.produto_cod=v.cod_interno where v.bar_id=p_bar and v.data >= p_ini and v.data < p_fim group by upper(ipp.insumo_codigo))',
    'g');
  if novo = def then
    raise exception 'fn_desvios: padrao teorico_ins nao encontrado — abortando';
  end if;
  execute novo;
end $$;
