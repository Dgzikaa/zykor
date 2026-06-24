import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** GET -> indicadores de gente dos últimos 12 meses (turnover, absenteísmo, headcount). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const [{ data: funcs, error: e1 }, { data: ocorr, error: e2 }] = await Promise.all([
    (supabase as any).schema('hr').from('funcionarios').select('id, data_admissao, data_demissao').eq('bar_id', user.bar_id),
    (supabase as any).schema('hr').from('funcionario_ocorrencias').select('funcionario_id, tipo, data_inicio')
      .in('tipo', ['falta', 'atestado']),
  ]);
  if (e1 || e2) return NextResponse.json({ success: false, error: (e1 || e2)?.message }, { status: 500 });

  const idsBar = new Set((funcs || []).map((f: any) => f.id));
  const hoje = new Date();
  const meses: any[] = [];

  for (let i = 11; i >= 0; i--) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ano = ref.getFullYear(); const mes = ref.getMonth(); // 0-based
    const ini = new Date(ano, mes, 1); const fim = new Date(ano, mes + 1, 0, 23, 59, 59);

    let admissoes = 0, demissoes = 0, hcIni = 0, hcFim = 0;
    for (const f of funcs || []) {
      const adm = f.data_admissao ? new Date(f.data_admissao) : null;
      const dem = f.data_demissao ? new Date(f.data_demissao) : null;
      if (adm && adm >= ini && adm <= fim) admissoes++;
      if (dem && dem >= ini && dem <= fim) demissoes++;
      if (adm && adm < ini && (!dem || dem >= ini)) hcIni++;
      if (adm && adm <= fim && (!dem || dem > fim)) hcFim++;
    }
    const hcMedio = (hcIni + hcFim) / 2;
    const turnover = hcMedio > 0 ? Math.round((demissoes / hcMedio) * 1000) / 10 : 0;

    let faltas = 0, atestados = 0;
    for (const o of ocorr || []) {
      if (!idsBar.has(o.funcionario_id)) continue;
      const d = o.data_inicio ? new Date(o.data_inicio) : null;
      if (!d || d < ini || d > fim) continue;
      if (o.tipo === 'falta') faltas++; else if (o.tipo === 'atestado') atestados++;
    }

    meses.push({ label: `${MES_ABBR[mes]}/${String(ano).slice(2)}`, admissoes, demissoes, headcount: hcFim, turnover, faltas, atestados });
  }

  const headcountAtual = meses[meses.length - 1]?.headcount || 0;
  const demissoes12 = meses.reduce((s, m) => s + m.demissoes, 0);
  const admissoes12 = meses.reduce((s, m) => s + m.admissoes, 0);
  const faltas12 = meses.reduce((s, m) => s + m.faltas, 0);
  const hcMedio12 = meses.reduce((s, m) => s + m.headcount, 0) / (meses.length || 1);
  const turnover12 = hcMedio12 > 0 ? Math.round((demissoes12 / hcMedio12) * 1000) / 10 : 0;

  return NextResponse.json({
    success: true, meses,
    resumo: { headcount_atual: headcountAtual, turnover_12m: turnover12, demissoes_12m: demissoes12, admissoes_12m: admissoes12, faltas_12m: faltas12 },
  });
}
