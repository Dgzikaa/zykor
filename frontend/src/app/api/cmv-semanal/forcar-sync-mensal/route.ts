import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/cmv-semanal/forcar-sync-mensal  { bar_id, ano, mes }
 *
 * Botão "Forçar atualização" do CMV mensal. Faz a cadeia inteira na hora, sem esperar o cron:
 *  1. Sync ContaAzul do MÊS em modo 'custom' (full sweep por vencimento) — isso ATUALIZA o bronze
 *     E dispara o soft-delete (marcar_excluidos_contaazul), pegando o que foi DELETADO no CA.
 *     (O incremental diário NÃO faz soft-delete — por isso deletes no CA não sumiam do bronze.)
 *  2. Re-agrega o cmv_mensal (agregar_cmv_mensal_auto) a partir do bronze já atualizado.
 *
 * Depois o front revalida e mostra o número novo.
 */
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (ano: number, mes1a12: number) => new Date(ano, mes1a12, 0).getDate();

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  try {
    const { bar_id, ano, mes } = await request.json();
    const barId = Number(bar_id), y = Number(ano), m = Number(mes);
    if (!barId || !y || !m) {
      return NextResponse.json({ success: false, error: 'bar_id, ano e mes são obrigatórios' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Configuração Supabase ausente' }, { status: 500 });
    }
    const supabase = createServiceRoleClient();

    // 1. Sync CA do mês (custom = full sweep → upsert + soft-delete das exclusões)
    const dateFrom = `${y}-${pad(m)}-01`;
    const dateTo = `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
    let syncOk = false; let syncErro: string | null = null;
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/contaazul-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify({ bar_id: barId, sync_mode: 'custom', date_from: dateFrom, date_to: dateTo }),
      });
      const json = await resp.json().catch(() => ({} as any));
      syncOk = !!(resp.ok && json?.success);
      if (!syncOk) syncErro = json?.error || `sync HTTP ${resp.status}`;
    } catch (e: any) {
      syncErro = e?.message || 'falha ao chamar o sync';
    }

    // 2. Re-agregar o mês (mesmo se o sync falhar parcialmente, agrega o que tiver no bronze)
    const { error: aggErr } = await (supabase as any).rpc('agregar_cmv_mensal_auto', {
      p_bar_id: barId, p_ano: y, p_mes: m,
    });

    return NextResponse.json({
      success: !aggErr,
      sync_ok: syncOk,
      sync_erro: syncErro,
      agregado: !aggErr,
      agregar_erro: aggErr?.message ?? null,
      bar_id: barId, ano: y, mes: m,
    }, { status: aggErr ? 500 : 200 });
  } catch (error: any) {
    console.error('[cmv-semanal/forcar-sync-mensal] erro:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
