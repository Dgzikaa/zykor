import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/contaazul/sync-manual
 *
 * Body: { bar_id, sync_mode?, ano? }
 *
 * Modos normais: repassa pro edge function contaazul-sync (1 chamada).
 * Modo 'alteracao_full_ano': re-sincroniza o ANO selecionado MÊS A MÊS (12 chamadas
 *   'custom' curtas) em vez de 1 ano numa tacada. O ano inteiro de uma vez estourava o
 *   timeout-safety interno do sync (parava 'partial' e não pegava re-categorizações).
 *   Mês a mês cada chamada é rápida, cabe no limite, e completa sempre.
 */
export const maxDuration = 300;

const lastDay = (ano: number, mes1a12: number) => new Date(ano, mes1a12, 0).getDate();
const pad = (n: number) => String(n).padStart(2, '0');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barId = Number(body.bar_id);
    const syncMode = body.sync_mode || 'daily_incremental';
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuração Supabase ausente' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const chamarSync = async (payload: Record<string, unknown>) => {
      const resp = await fetch(`${supabaseUrl}/functions/v1/contaazul-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify({ bar_id: barId, ...payload }),
      });
      const json = await resp.json().catch(() => ({}));
      return { ok: resp.ok, status: resp.status, json };
    };

    let result: any;

    if (syncMode === 'alteracao_full_ano') {
      // Re-sincroniza o ano MÊS A MÊS (custom por data_vencimento), captura re-categorizações.
      const t0 = Date.now();
      const ano = Number(body.ano) || new Date().getFullYear();
      const anoAtual = new Date().getFullYear();
      const mesAtual = new Date().getMonth() + 1;
      const ultimoMes = ano === anoAtual ? mesAtual : 12; // não puxa meses futuros do ano corrente
      let totalLanc = 0; const mesesOk: number[] = []; const mesesErro: number[] = [];
      for (let m = 1; m <= ultimoMes; m++) {
        if (Date.now() - t0 > 270_000) break; // margem de segurança do maxDuration
        const r = await chamarSync({
          sync_mode: 'custom',
          date_from: `${ano}-${pad(m)}-01`,
          date_to: `${ano}-${pad(m)}-${pad(lastDay(ano, m))}`,
        });
        if (r.ok && r.json?.success) { totalLanc += r.json?.stats?.lancamentos ?? 0; mesesOk.push(m); }
        else mesesErro.push(m);
      }
      result = {
        success: mesesErro.length === 0,
        bar_id: barId,
        sync_mode: syncMode,
        stats: { lancamentos: totalLanc },
        meses_ok: mesesOk.length,
        meses_erro: mesesErro,
        duration_seconds: Math.round((Date.now() - t0) / 1000),
      };
      if (mesesErro.length > 0 && mesesOk.length === 0) {
        return NextResponse.json({ success: false, error: 'Falha ao sincronizar Conta Azul (todos os meses)' }, { status: 502 });
      }
    } else {
      const r = await chamarSync({ sync_mode: syncMode });
      if (!r.ok || !r.json?.success) {
        return NextResponse.json({ success: false, error: r.json?.error || 'Erro no sync Conta Azul' }, { status: r.status || 500 });
      }
      result = r.json;
    }

    // Totais atuais das tabelas (estado após o sync)
    const contar = async (tabela: string) => {
      const { count } = await (supabase as any).schema('bronze').from(tabela)
        .select('*', { count: 'exact', head: true }).eq('bar_id', barId);
      return count ?? 0;
    };
    const [totLanc, totCat, totCC, totPes, totConta] = await Promise.all([
      contar('bronze_contaazul_lancamentos'),
      contar('bronze_contaazul_categorias'),
      contar('bronze_contaazul_centros_custo'),
      contar('bronze_contaazul_pessoas'),
      contar('bronze_contaazul_contas_financeiras'),
    ]);

    return NextResponse.json({
      success: true,
      bar_id: result.bar_id ?? barId,
      sync_mode: result.sync_mode ?? syncMode,
      period: result.period,
      stats: result.stats,
      meses_ok: result.meses_ok,
      meses_erro: result.meses_erro,
      totais: { lancamentos: totLanc, categorias: totCat, centros_custo: totCC, pessoas: totPes, contas_financeiras: totConta },
      duration_seconds: result.duration_seconds,
    });
  } catch (error: any) {
    console.error('[contaazul/sync-manual] erro:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
