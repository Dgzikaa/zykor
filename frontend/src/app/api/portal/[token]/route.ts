import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toMin = (t: string | null) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

async function funcByToken(supabase: any, token: string) {
  const { data } = await supabase.schema('hr').from('funcionarios')
    .select('id, bar_id, nome, cargo_id, area_id, tipo_contratacao, salario_base, valor_diaria, chave_pix, tipo_chave_pix, data_admissao, ativo')
    .eq('portal_token', token).maybeSingle();
  return data;
}

/** GET /api/portal/<token> -> dados do funcionário (acesso próprio por link). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ success: false, error: 'token inválido' }, { status: 400 });
  const supabase = await getAdminClient();
  const f = await funcByToken(supabase, token);
  if (!f) return NextResponse.json({ success: false, error: 'Link inválido' }, { status: 404 });

  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const fim7 = new Date(hoje); fim7.setDate(fim7.getDate() + 7);
  const mesIni = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const mesFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const [{ data: cargo }, { data: area }, { data: escala }, { data: ponto }, { data: solics }] = await Promise.all([
    f.cargo_id ? supabase.schema('hr').from('cargos').select('nome').eq('id', f.cargo_id).maybeSingle() : Promise.resolve({ data: null }),
    f.area_id ? supabase.schema('hr').from('areas').select('nome').eq('id', f.area_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.schema('hr').from('escalas').select('data, turno, status, hora_inicio, hora_fim').eq('funcionario_id', f.id).gte('data', ymd(hoje)).lte('data', ymd(fim7)).order('data'),
    supabase.schema('hr').from('ponto_registro').select('data, entrada, saida, intervalo_min, horas_previstas').eq('funcionario_id', f.id).gte('data', ymd(mesIni)).lte('data', ymd(mesFim)),
    supabase.schema('hr').from('solicitacoes').select('id, tipo, data_inicio, data_fim, status, criado_em').eq('funcionario_id', f.id).order('criado_em', { ascending: false }).limit(10),
  ]);

  let saldoMin = 0;
  for (const r of ponto || []) {
    const e = toMin(r.entrada), s = toMin(r.saida);
    if (e == null || s == null) continue;
    let dur = s - e; if (dur < 0) dur += 1440; dur -= (r.intervalo_min || 0);
    saldoMin += Math.max(0, dur) - Math.round((r.horas_previstas || 0) * 60);
  }

  return NextResponse.json({
    success: true,
    funcionario: { nome: f.nome, cargo_nome: cargo?.nome || null, area_nome: area?.nome || null, tipo_contratacao: f.tipo_contratacao, chave_pix: f.chave_pix, tipo_chave_pix: f.tipo_chave_pix, ativo: f.ativo },
    escala: escala || [], banco_horas_min: saldoMin, solicitacoes: solics || [],
  });
}

/** POST /api/portal/<token> -> pedir folga/férias. Body: { tipo, data_inicio, data_fim?, motivo? } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const tipo = ['ferias', 'folga', 'outro'].includes(body.tipo) ? body.tipo : null;
  if (!tipo || !body.data_inicio) return NextResponse.json({ success: false, error: 'tipo e data início obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  const f = await funcByToken(supabase, token);
  if (!f) return NextResponse.json({ success: false, error: 'Link inválido' }, { status: 404 });

  const { error } = await supabase.schema('hr').from('solicitacoes').insert({
    bar_id: f.bar_id, funcionario_id: f.id, tipo, data_inicio: body.data_inicio,
    data_fim: body.data_fim || null, motivo: (body.motivo || '').toString().slice(0, 300) || null,
  });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
