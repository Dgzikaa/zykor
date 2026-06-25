import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/rh/ponto/espelho?funcionario_id=&mes=YYYY-MM
 * Espelho de ponto de UM funcionário no mês (hr.v_espelho_ponto: ponto × escala) + resumo.
 * Serve a aba "Ponto" do dossiê. Funciona com ponto manual; a Tangerino alimenta o mesmo registro.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(req.url).searchParams;
  const funcionarioId = Number(sp.get('funcionario_id'));
  const mes = sp.get('mes') || new Date().toISOString().slice(0, 7);
  if (!funcionarioId) return NextResponse.json({ error: 'funcionario_id obrigatório' }, { status: 400 });
  const de = `${mes}-01`;
  const [y, m] = mes.split('-').map(Number);
  const ate = `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('hr')
    .from('v_espelho_ponto')
    .select('data, entrada, saida, intervalo_min, prev_inicio, prev_fim, turno, origem, status, foto_in_url, foto_out_url, geo_ok, horas_trab, horas_prev, horas_extra, atraso_min, situacao, observacao')
    .eq('bar_id', user.bar_id).eq('funcionario_id', funcionarioId)
    .gte('data', de).lte('data', ate)
    .order('data', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const linhas = data ?? [];
  const resumo = {
    horas_trab: linhas.reduce((a: number, r: any) => a + Number(r.horas_trab || 0), 0),
    horas_extra: linhas.reduce((a: number, r: any) => a + Number(r.horas_extra || 0), 0),
    faltas: linhas.filter((r: any) => r.situacao === 'falta').length,
    atrasos: linhas.filter((r: any) => r.situacao === 'atraso').length,
    dias_com_ponto: linhas.filter((r: any) => r.entrada).length,
  };
  return NextResponse.json({ success: true, mes, funcionario_id: funcionarioId, resumo, linhas });
}
