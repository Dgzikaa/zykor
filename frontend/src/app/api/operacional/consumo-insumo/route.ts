import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, selectAll } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Consumo teórico de insumo por período (saída de produto explodida na ficha técnica).
 * GET ?bar_id&ini&fim            → lista de insumos com qtd_base consumida no período
 * GET ?bar_id&ini&fim&codigo=i0X → série diária de um insumo
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const ini = sp.get('ini');
  const fim = sp.get('fim');
  const codigo = sp.get('codigo');
  if (!barId || !ini || !fim) return NextResponse.json({ success: false, error: 'bar_id, ini e fim obrigatórios' }, { status: 400 });

  const admin = await getAdminClient();
  try {
    if (codigo) {
      const serie = await selectAll((from, to) => (admin as any).schema('silver').from('v_consumo_insumo_dia')
        .select('data, qtd_base').eq('bar_id', barId).eq('insumo_codigo', codigo).gte('data', ini).lte('data', fim)
        .order('data', { ascending: true }).range(from, to));
      return NextResponse.json({ success: true, serie });
    }
    const { data, error } = await (admin as any).schema('silver').rpc('fn_consumo_insumo_periodo', { p_bar_id: barId, p_ini: ini, p_fim: fim });
    if (error) throw error;
    return NextResponse.json({ success: true, insumos: data || [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}
