import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/conciliacao -> conciliação diária Stone × ContaHub do bar. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any)
    .schema('gold')
    .from('stone_conciliacao_diaria')
    .select('*')
    .eq('bar_id', user.bar_id)
    .order('data', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const rows = (data || []) as any[];
  const num = (v: any) => Number(v || 0);
  const resumo = {
    dias: rows.length,
    ok: rows.filter((r) => r.status === 'ok').length,
    verificar: rows.filter((r) => r.status === 'verificar').length,
    stone_bruto_total: rows.reduce((s, r) => s + num(r.stone_bruto), 0),
    taxa_total: rows.reduce((s, r) => s + num(r.stone_taxa), 0),
    diferenca_abs_total: rows.reduce((s, r) => s + Math.abs(num(r.diferenca)), 0),
  };

  return NextResponse.json({ success: true, conciliacao: rows, resumo });
}
