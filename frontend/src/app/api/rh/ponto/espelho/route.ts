import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/rh/ponto/espelho?funcionario_id=&mes=YYYY-MM
 * Espelho de ponto de UM funcionário no mês + resumo. Serve a aba "Ponto" do dossiê.
 *
 * Fonte: hr.v_espelho_dia — livro-razão diário do Tangerino (folga/falta/ausência
 * justificada/trabalhou por dia, espelhando o próprio Tangerino) + detalhe de batida
 * (entrada/saída/foto/geo). Fallback p/ hr.v_espelho_ponto (ponto×escala) nos meses sem
 * daily-summary puxado (histórico antigo), normalizando o vocabulário de situação.
 */
export const dynamic = 'force-dynamic';

// Normaliza a situação da view antiga (v_espelho_ponto) p/ o vocabulário novo.
const normSitAntiga = (s: string): string =>
  s === 'ok' ? 'trabalhou' : s === 'sem_marcacao' ? 'folga' : s;

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
  const cols = 'data, entrada, saida, intervalo_min, prev_inicio, prev_fim, turno, origem, status, foto_in_url, foto_out_url, geo_ok, horas_trab, horas_prev, horas_extra, atraso_min, situacao, observacao';

  // 1) Fonte principal: livro-razão do Tangerino (por dia, inclui folga + justificada).
  const { data: dia } = await (supabase as any).schema('hr')
    .from('v_espelho_dia')
    .select(cols + ', tem_justificativa')
    .eq('bar_id', user.bar_id).eq('funcionario_id', funcionarioId)
    .gte('data', de).lte('data', ate)
    .order('data', { ascending: false });

  let linhas = dia ?? [];
  // 2) Fallback (mês sem daily-summary): view antiga ponto×escala.
  if (!linhas.length) {
    const { data: antigo, error } = await (supabase as any).schema('hr')
      .from('v_espelho_ponto').select(cols)
      .eq('bar_id', user.bar_id).eq('funcionario_id', funcionarioId)
      .gte('data', de).lte('data', ate)
      .order('data', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    linhas = (antigo ?? []).map((r: any) => ({ ...r, situacao: normSitAntiga(r.situacao) }));
  }

  const resumo = {
    horas_trab: linhas.reduce((a: number, r: any) => a + Number(r.horas_trab || 0), 0),
    horas_extra: linhas.reduce((a: number, r: any) => a + Number(r.horas_extra || 0), 0),
    faltas: linhas.filter((r: any) => r.situacao === 'falta').length,
    justificadas: linhas.filter((r: any) => r.situacao === 'ausencia_justificada').length,
    folgas: linhas.filter((r: any) => r.situacao === 'folga').length,
    atrasos: linhas.filter((r: any) => r.situacao === 'atraso').length,
    dias_trabalhados: linhas.filter((r: any) => r.situacao === 'trabalhou' || r.situacao === 'atraso').length,
  };
  return NextResponse.json({ success: true, mes, funcionario_id: funcionarioId, resumo, linhas });
}
