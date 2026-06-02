import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ferramentas/cancelamentos?dias=60
 * Perda por cancelamento: série diária (gold.cancelamentos_diario) + top motivos
 * dos últimos 30 dias (bronze). bar_id do usuário autenticado.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) {
    return NextResponse.json({ success: false, error: 'Usuário sem bar associado' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const dias = Math.min(Math.max(Number(searchParams.get('dias')) || 60, 7), 180);
  const hoje = new Date();
  const desde = new Date(hoje);
  desde.setDate(desde.getDate() - dias);
  const desdeIso = desde.toISOString().slice(0, 10);
  const desde30 = new Date(hoje);
  desde30.setDate(desde30.getDate() - 30);
  const desde30Iso = desde30.toISOString().slice(0, 10);

  const supabase = createServiceRoleClient();

  const [diarioRes, motivosRaw] = await Promise.all([
    supabase
      .schema('gold' as never)
      .from('cancelamentos_diario')
      .select('dt_gerencial, qtd_itens, valor_cancelado, custo_perdido, faturamento_liquido, pct_sobre_faturamento')
      .eq('bar_id', user.bar_id)
      .gte('dt_gerencial', desdeIso)
      .order('dt_gerencial', { ascending: false }),
    supabase
      .schema('bronze' as never)
      .from('bronze_contahub_avendas_cancelamentos')
      .select('motivocancdesconto, itm_vrcheio')
      .eq('bar_id', user.bar_id)
      .gte('dt_gerencial', desde30Iso)
      .limit(20000),
  ]);

  if (diarioRes.error) {
    return NextResponse.json({ success: false, error: diarioRes.error.message }, { status: 500 });
  }

  // Agrega top motivos em memória (poucos milhares de linhas no período).
  const mapaMotivos = new Map<string, { valor: number; qtd: number }>();
  for (const r of (motivosRaw.data || []) as Array<{ motivocancdesconto: string | null; itm_vrcheio: number | null }>) {
    const motivo = (r.motivocancdesconto || 'Sem motivo').trim() || 'Sem motivo';
    const cur = mapaMotivos.get(motivo) || { valor: 0, qtd: 0 };
    cur.valor += Number(r.itm_vrcheio || 0);
    cur.qtd += 1;
    mapaMotivos.set(motivo, cur);
  }
  const motivos = Array.from(mapaMotivos.entries())
    .map(([motivo, v]) => ({ motivo, valor: Math.round(v.valor * 100) / 100, qtd: v.qtd }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);

  return NextResponse.json({ success: true, diario: diarioRes.data || [], motivos });
}
