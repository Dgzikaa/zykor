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
      // Re-sincroniza o ano por mês (custom, captura re-categorizações). Em PARALELO pra
      // caber no limite da Vercel (em série estourava → 504 → "falha"). Retry 1x nos que falham.
      const t0 = Date.now();
      const ano = Number(body.ano) || new Date().getFullYear();
      const anoAtual = new Date().getFullYear();
      const ultimoMes = ano === anoAtual ? (new Date().getMonth() + 1) : 12;
      const syncMes = (m: number) => chamarSync({
        sync_mode: 'custom',
        date_from: `${ano}-${pad(m)}-01`,
        date_to: `${ano}-${pad(m)}-${pad(lastDay(ano, m))}`,
      }).then(r => ({ m, ok: !!(r.ok && r.json?.success), lanc: Number(r.json?.stats?.lancamentos ?? 0) }))
        .catch(() => ({ m, ok: false, lanc: 0 }));

      const meses = Array.from({ length: ultimoMes }, (_, i) => i + 1);
      const map = new Map<number, { m: number; ok: boolean; lanc: number }>();
      (await Promise.all(meses.map(syncMes))).forEach(r => map.set(r.m, r));
      // retry 1x nos que falharam (transiente: 429/rede)
      const falhou = [...map.values()].filter(r => !r.ok).map(r => r.m);
      if (falhou.length) {
        await new Promise(res => setTimeout(res, 2500));
        (await Promise.all(falhou.map(syncMes))).forEach(r => map.set(r.m, r));
      }
      const vals = [...map.values()];
      const mesesOk = vals.filter(r => r.ok).map(r => r.m);
      const mesesErro = vals.filter(r => !r.ok).map(r => r.m);
      const totalLanc = vals.reduce((s, r) => s + r.lanc, 0);
      result = {
        success: mesesOk.length > 0, // sucesso se a maioria foi; 1 mês transiente não derruba
        bar_id: barId, sync_mode: syncMode,
        stats: { lancamentos: totalLanc },
        meses_ok: mesesOk.length, meses_erro: mesesErro,
        duration_seconds: Math.round((Date.now() - t0) / 1000),
      };
      if (mesesOk.length === 0) {
        return NextResponse.json({ success: false, error: 'Falha ao sincronizar Conta Azul (todos os meses)' }, { status: 502 });
      }
    } else if (syncMode === 'alteracao_incremental') {
      // 'rapido' = re-varre os ultimos 90 dias de ALTERACOES, quebrado em 3 chunks
      // mensais disparados em PARALELO (cada um leve). Reduz o wall-clock vs 1 chamada
      // unica de 90 dias (~2min -> ~1min) e tira risco de timeout. Nao mexe no cursor
      // (o cron horario cuida disso via alteracao_incremental no edge).
      const t0 = Date.now();
      const dia = 24 * 60 * 60 * 1000;
      const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
      const agora = Date.now();
      const chunks = [0, 1, 2].map(i => ({
        from: iso(agora - (i + 1) * 30 * dia),
        to: iso(agora - i * 30 * dia),
        cats: i === 0, // so o chunk mais recente refresca o cadastro de categorias
      }));
      const syncChunk = (c: { from: string; to: string; cats: boolean }) =>
        chamarSync({ sync_mode: 'alteracao_range', date_from: c.from, date_to: c.to, sync_categorias: c.cats })
          .then(r => ({ ok: !!(r.ok && r.json?.success), lanc: Number(r.json?.stats?.lancamentos ?? 0), c }))
          .catch(() => ({ ok: false, lanc: 0, c }));

      let resultados = await Promise.all(chunks.map(syncChunk));
      const refazer = resultados.filter(r => !r.ok).map(r => r.c);
      if (refazer.length) {
        await new Promise(res => setTimeout(res, 2000));
        const retry = await Promise.all(refazer.map(syncChunk));
        resultados = resultados.map(r => (r.ok ? r : (retry.find(x => x.c === r.c) ?? r)));
      }
      const okCount = resultados.filter(r => r.ok).length;
      if (okCount === 0) {
        return NextResponse.json({ success: false, error: 'Falha ao sincronizar Conta Azul (incremental)' }, { status: 502 });
      }
      result = {
        success: true, bar_id: barId, sync_mode: syncMode,
        period: { from: chunks[2].from, to: chunks[0].to },
        stats: { lancamentos: resultados.reduce((s, r) => s + r.lanc, 0) },
        chunks_ok: okCount, chunks_total: chunks.length,
        duration_seconds: Math.round((Date.now() - t0) / 1000),
      };
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
