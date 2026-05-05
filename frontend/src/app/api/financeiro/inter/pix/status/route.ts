import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/financeiro/inter/pix/status?bar_id=X&codigos=A,B,C
 * (ou ?zykor_ids=z1,z2,z3 pra correlacionar pelos ids locais)
 *
 * Retorna o status atual de cada PIX vindo do webhook Inter.
 * O frontend faz polling nesse endpoint pra atualizar a lista em tempo real.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = Number(searchParams.get('bar_id'));
    const codigos = (searchParams.get('codigos') || '').split(',').filter(Boolean);
    const zykorIds = (searchParams.get('zykor_ids') || '').split(',').filter(Boolean);

    if (!Number.isFinite(barId)) {
      return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
    }
    if (codigos.length === 0 && zykorIds.length === 0) {
      return NextResponse.json({ pix: [] });
    }

    const supabase = getSupabaseAdmin();

    let query = (supabase
      .schema('financial' as any) as any)
      .from('pix_enviados')
      .select(
        'id, txid, inter_codigo_solicitacao, pagamento_zykor_id, valor, status, inter_status, last_webhook_at, data_pagamento, data_envio, beneficiario, created_at'
      )
      .eq('bar_id', barId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (codigos.length > 0 && zykorIds.length > 0) {
      const codigosOr = codigos.map(c => `inter_codigo_solicitacao.eq.${c},txid.eq.${c}`).join(',');
      const zykorOr = zykorIds.map(z => `pagamento_zykor_id.eq.${z}`).join(',');
      query = query.or(`${codigosOr},${zykorOr}`);
    } else if (codigos.length > 0) {
      query = query.or(
        codigos.map(c => `inter_codigo_solicitacao.eq.${c},txid.eq.${c}`).join(',')
      );
    } else if (zykorIds.length > 0) {
      query = query.in('pagamento_zykor_id', zykorIds);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      pix: data || [],
      total: (data || []).length,
      polled_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[INTER-PIX-STATUS] Erro:', err);
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 });
  }
}
