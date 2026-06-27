/**
 * Recalcula o CMV teórico (gold.produto_cmv) de um bar após uma edição de ficha/insumo.
 * fn_cmv_teorico roda em ~150ms e é idempotente, então pode ser chamada a cada save
 * pra que a tela de CMV Teórico reflita a mudança na hora (sem depender do botão Recalcular).
 * O cron diário (cmv-teorico-diario) e o botão seguem como backstop.
 */
export async function recalcCmvTeorico(supabase: any, barId: number | null | undefined): Promise<void> {
  if (!barId) return;
  try {
    await supabase.schema('gold').rpc('fn_cmv_teorico', { p_bar_id: barId });
  } catch (e) {
    // Não derruba a edição que disparou — recompute é cache; backstop = cron + botão Recalcular.
    console.error('[recalcCmvTeorico] falhou para bar', barId, e);
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
