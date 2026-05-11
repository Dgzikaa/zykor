import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/contaazul/sync-manual
 *
 * Dispara sync do Conta Azul para um bar e retorna:
 *   - stats: o que foi sincronizado AGORA (novos + atualizados)
 *   - totais: estado atual de cada tabela no banco
 *
 * Body: { bar_id: number, sync_mode?: 'daily_incremental' | 'full_sync' }
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barId = Number(body.bar_id);
    const syncMode = body.sync_mode || 'daily_incremental';

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuração Supabase ausente' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Disparar o sync
    const resp = await fetch(`${supabaseUrl}/functions/v1/contaazul-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
      body: JSON.stringify({ bar_id: barId, sync_mode: syncMode }),
    });

    const result = await resp.json().catch(() => ({}));

    if (!resp.ok || !result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Erro no sync Conta Azul' },
        { status: resp.status || 500 },
      );
    }

    // 2. Buscar totais atuais das tabelas (estado no banco APÓS o sync)
    const contar = async (tabela: string) => {
      const { count } = await (supabase as any)
        .schema('bronze')
        .from(tabela)
        .select('*', { count: 'exact', head: true })
        .eq('bar_id', barId);
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
      bar_id: result.bar_id,
      sync_mode: result.sync_mode,
      period: result.period,
      stats: result.stats,
      totais: {
        lancamentos: totLanc,
        categorias: totCat,
        centros_custo: totCC,
        pessoas: totPes,
        contas_financeiras: totConta,
      },
      duration_seconds: result.duration_seconds,
    });
  } catch (error: any) {
    console.error('[contaazul/sync-manual] erro:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno' },
      { status: 500 },
    );
  }
}
