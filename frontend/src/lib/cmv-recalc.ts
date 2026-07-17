/**
 * Recalcula o CMV teórico (gold.produto_cmv) de um bar após uma edição de ficha/insumo.
 * fn_cmv_teorico roda em ~150ms e é idempotente, então pode ser chamada a cada save
 * pra que a tela de CMV Teórico reflita a mudança na hora (sem depender do botão Recalcular).
 * O cron diário (cmv-teorico-diario) e o botão seguem como backstop.
 */
export async function recalcCmvTeorico(supabase: any, barId: number | null | undefined): Promise<void> {
  if (!barId) return;
  // 1) gold.produto_cmv (rápido, ~150ms) — CMV Teórico do cardápio reflete na hora.
  // 2) matviews de consumo teórico (silver.*_dia + gold.cmv_teorico_dia) — Saída Teórica em
  //    /operacional/desvios e /operacional/consumo-insumo refletem na hora. Sem isso a matview
  //    só atualizava no cron horário e o socio via valor antigo depois de editar a ficha.
  // Roda em paralelo — refresh de matview é lento, não deve segurar o recalc.
  await Promise.all([
    (async () => {
      try { await supabase.schema('gold').rpc('fn_cmv_teorico', { p_bar_id: barId }); }
      catch (e) { console.error('[recalcCmvTeorico] fn_cmv_teorico falhou para bar', barId, e); }
    })(),
    refreshConsumoTeorico(supabase),
  ]);
}

/**
 * Refresca as matviews de consumo teórico (silver.consumo_teorico_insumo_dia e cascata).
 * Sem isso, a coluna "Saída teórica" em /operacional/desvios e a tela /operacional/consumo-insumo
 * ficam com o valor antigo até o próximo cron horário. Best-effort: não bloqueia a edição.
 * REFRESH CONCURRENTLY roda sem lock — pode demorar segundos em background.
 */
export async function refreshConsumoTeorico(supabase: any): Promise<void> {
  try {
    await supabase.schema('silver').rpc('fn_refresh_consumo_teorico');
  } catch (e) {
    console.error('[refreshConsumoTeorico] falhou', e);
  }
}

/** Deriva o bar a partir do parent do item de ficha (produto/produção) e recalcula. */
export async function recalcCmvFromFichaParent(
  supabase: any,
  parent: { producao_id?: number | null; produto_id?: number | null },
): Promise<void> {
  let barId: number | null = null;
  if (parent.produto_id) {
    const { data } = await supabase.from('produto_cardapio').select('bar_id').eq('id', parent.produto_id).single();
    barId = data?.bar_id ?? null;
  } else if (parent.producao_id) {
    const { data } = await supabase.from('producao_base').select('bar_id').eq('id', parent.producao_id).single();
    barId = data?.bar_id ?? null;
  }
  await recalcCmvTeorico(supabase, barId);
}
