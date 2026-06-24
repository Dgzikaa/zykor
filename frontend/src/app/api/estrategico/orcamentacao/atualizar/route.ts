import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/estrategico/orcamentacao/atualizar
 *
 * Atualiza a Orçamentação on-demand (botão "Atualizar"):
 *  1. Sincroniza o Conta Azul (delta incremental) -> bronze fresco.
 *  2. Reprocessa silver+gold da orçamentação do ANO exibido (não só dos últimos 6
 *     meses do cron) -> pega alterações antigas quando o sócio precisar.
 *
 * Diferente da DRE (que lê o bronze ao vivo), a Orçamentação lê a camada gold —
 * por isso o botão precisa forçar o refresh do gold, senão o realizado só mudaria
 * no cron (2x/dia).
 *
 * Body: { bar_id: number, ano?: number }  (ano default = ano corrente)
 */
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body.bar_id);
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    const ano = Number(body.ano) || new Date().getFullYear();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuração Supabase ausente' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Sync Conta Azul (delta) -> bronze fresco
    let syncStats: unknown = null;
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/contaazul-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify({ bar_id: barId, sync_mode: 'alteracao_full_ano' }),
      });
      const r = await resp.json().catch(() => ({}));
      syncStats = r?.stats ?? null;
    } catch (e) {
      console.warn('[orcamentacao/atualizar] sync CA falhou:', e);
    }

    // 2. Reprocessa silver+gold da orçamentação do ANO exibido (cobre alterações > 6 meses)
    const { error: rpcErr } = await (supabase as any).rpc('refresh_orcamentacao_ano', {
      p_bar_id: barId,
      p_ano: ano,
    });
    if (rpcErr) {
      return NextResponse.json(
        { success: false, error: `Refresh do gold falhou: ${rpcErr.message}`, sync: syncStats },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, ano, sync: syncStats });
  } catch (error: any) {
    console.error('[orcamentacao/atualizar] erro:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
