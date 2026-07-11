import { createServiceRoleClient } from '@/lib/supabase-admin';

const supabase = createServiceRoleClient();

/**
 * Pulso do negócio: DRE (receita/lucro YTD + mês), CMV, fluxo de caixa, RFM.
 * Agrega fontes que já existem; cada bloco é defensivo (falha isolada não derruba).
 *
 * Extraído do route.ts (verbatim) p/ ser chamado TAMBÉM pelo Server Component (RSC)
 * da página — assim o 1º paint já vem com dados (sem skeleton) e a rota continua igual.
 */
export async function getPainelExecutivo(barId: number): Promise<any> {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1; // 1-12
  const out: any = { ano, mes_atual: mesAtual };

  // ---- DRE (receita/lucro YTD fechado + faturamento do mês corrente) ----
  try {
    // gold.mv_dre_ano = DRE materializada (idêntica à função, refresh horário) — ~0,3ms vs ~2,1s
    const { data } = await (supabase as any).schema('gold').from('mv_dre_ano')
      .select('bar_id, mes, categoria_macro, ordem_macro, ordem_sub, categoria, sinal, valor_com_sinal, percentual_receita')
      .eq('bar_id', barId).eq('ano', ano);
    const rows = (data || []) as any[];
    const mesNum = (m: string) => Number(String(m).slice(5, 7));
    let receitaYtd = 0, lucroYtd = 0, fatMes = 0, receitaMes = 0, despMes = 0;
    for (const r of rows) {
      const m = mesNum(r.mes);
      const v = Number(r.valor_com_sinal) || 0;
      const om = Number(r.ordem_macro) || 99;
      const fechado = m < mesAtual; // mês corrente ainda aberto
      if (r.categoria_macro === 'Receita') {
        if (fechado) receitaYtd += v;
        if (m === mesAtual) { fatMes += v; receitaMes += v; }
      }
      if (om <= 9 && fechado) lucroYtd += v;           // resultado (exclui Invest/Dividendos/NãoMapeado)
      if (om <= 9 && m === mesAtual) despMes += (r.categoria_macro !== 'Receita' ? v : 0);
    }
    out.dre = {
      receita_ytd: Math.round(receitaYtd),
      lucro_ytd: Math.round(lucroYtd),
      margem_ytd: receitaYtd > 0 ? (lucroYtd / receitaYtd) * 100 : 0,
      faturamento_mes: Math.round(fatMes),
      lucro_mes: Math.round(receitaMes + despMes),
    };
  } catch { out.dre = null; }

  // ---- CMV (último mês fechado; fallback última semana) ----
  try {
    const mc = mesAtual === 1 ? 12 : mesAtual - 1;
    const ac = mesAtual === 1 ? ano - 1 : ano;
    const { data: cm } = await (supabase as any).schema('financial').from('cmv_mensal')
      .select('cmv_limpo_percentual, cmv_teorico_percentual, cmv_teorico_percentual_manual, mes, ano')
      .eq('bar_id', barId).eq('ano', ac).eq('mes', mc).maybeSingle();
    if (cm && Number(cm.cmv_limpo_percentual) > 0) {
      out.cmv = {
        pct: Number(cm.cmv_limpo_percentual),
        meta: Number(cm.cmv_teorico_percentual_manual || cm.cmv_teorico_percentual) || null,
        ref: `${String(mc).padStart(2, '0')}/${ac}`,
      };
    } else {
      const { data: cs } = await (supabase as any).schema('financial').from('cmv_semanal')
        .select('cmv_limpo_percentual, cmv_teorico_percentual, cmv_teorico_percentual_manual, semana, ano')
        .eq('bar_id', barId).not('cmv_limpo_percentual', 'is', null)
        .order('ano', { ascending: false }).order('semana', { ascending: false }).limit(1).maybeSingle();
      if (cs) out.cmv = { pct: Number(cs.cmv_limpo_percentual), meta: Number(cs.cmv_teorico_percentual_manual || cs.cmv_teorico_percentual) || null, ref: `S${cs.semana}/${cs.ano}` };
      else out.cmv = null;
    }
  } catch { out.cmv = null; }

  // ---- Fluxo de caixa (saldo acumulado base/pessimista + quando aperta) ----
  try {
    const { data } = await (supabase as any).schema('financial').from('fluxo_caixa_previsto')
      .select('data_referencia, cenario, saldo_dia').eq('bar_id', barId).order('data_referencia');
    const rows = (data || []) as any[];
    const dias = Array.from(new Set(rows.map(r => r.data_referencia))).sort();
    const m = (c: string) => new Map(rows.filter(r => r.cenario === c).map(r => [r.data_referencia, Number(r.saldo_dia) || 0]));
    const mB = m('base'), mP = m('pessimista');
    let aB = 0, aP = 0, aperta: string | null = null;
    for (const d of dias) {
      aB += mB.get(d) || 0; aP += mP.get(d) || 0;
      if (aP < 0 && !aperta) aperta = d;
    }
    out.fluxo = dias.length ? { saldo90_base: Math.round(aB), saldo90_pess: Math.round(aP), aperta } : null;
  } catch { out.fluxo = null; }

  // ---- RFM (Campeões + Em risco) ----
  try {
    const { data } = await (supabase as any).rpc('get_rfm_resumo', { p_bar_id: barId });
    const seg = (n: string) => (data || []).find((r: any) => r.segmento === n);
    const camp = seg('Campeões'), risco = seg('Em risco');
    out.rfm = {
      campeoes_n: Number(camp?.clientes || 0), campeoes_valor: Number(camp?.valor_total || 0),
      em_risco_n: Number(risco?.clientes || 0), em_risco_valor: Number(risco?.valor_total || 0),
    };
  } catch { out.rfm = null; }

  return out;
}
