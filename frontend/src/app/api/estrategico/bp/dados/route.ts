import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

/**
 * GET /api/estrategico/bp/dados?bar_id=3&ano=2026&versao=Mai26
 * Linhas + indicadores de uma versão de BP (pro comparativo lado a lado).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = Number(sp.get('ano'));
    const versao = sp.get('versao');
    if (!barId || !ano || !versao) {
      return NextResponse.json({ error: 'bar_id, ano e versao obrigatórios' }, { status: 400 });
    }

    const [linhasRes, indRes] = await Promise.all([
      supabase.from('bp_linha').select('*').eq('bar_id', barId).eq('ano', ano).eq('versao', versao).eq('ativo', true).order('ordem', { ascending: true }),
      supabase.from('bp_indicador').select('*').eq('bar_id', barId).eq('ano', ano).eq('versao', versao).eq('ativo', true),
    ]);
    if (linhasRes.error) throw linhasRes.error;

    return NextResponse.json({ linhas: linhasRes.data ?? [], indicadores: indRes.data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
