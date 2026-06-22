import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/beneficiarios/artistas/produtos?key=<artista_key>
 * O que mais vende nos dias do artista: top produtos + mix por grupo.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const key = (new URL(request.url).searchParams.get('key') || '').trim();
  if (!key) return NextResponse.json({ success: false, error: 'key obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const [prodRes, mixRes] = await Promise.all([
    (supabase as any).schema('gold').rpc('artista_top_produtos', { p_bar_id: user.bar_id, p_key: key, p_limit: 12 }),
    (supabase as any).schema('gold').rpc('artista_mix_grupo', { p_bar_id: user.bar_id, p_key: key }),
  ]);
  if (prodRes.error) return NextResponse.json({ success: false, error: prodRes.error.message }, { status: 500 });
  if (mixRes.error) return NextResponse.json({ success: false, error: mixRes.error.message }, { status: 500 });

  const produtos = (prodRes.data || []).map((r: any) => ({
    produto: r.prd_desc, grupo: r.grp_desc,
    qtd: Number(r.qtd) || 0, valor: Number(r.valor) || 0, share: Number(r.share) || 0,
  }));
  const grupos = (mixRes.data || []).map((r: any) => ({
    grupo: r.grp_desc, qtd: Number(r.qtd) || 0, valor: Number(r.valor) || 0, share: Number(r.share) || 0,
  }));

  return NextResponse.json({ success: true, produtos, grupos });
}
