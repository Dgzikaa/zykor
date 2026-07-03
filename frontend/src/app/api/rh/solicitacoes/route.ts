import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/** GET -> solicitações de folga/férias do bar (pendentes primeiro). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data: sols, error } = await (supabase as any).schema('hr').from('solicitacoes')
    .select('*').eq('bar_id', user.bar_id).order('status').order('criado_em', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const ids = [...new Set((sols || []).map((s: any) => s.funcionario_id))];
  const nomes: Record<number, string> = {};
  if (ids.length) {
    const { data: fs } = await (supabase as any).schema('hr').from('funcionarios').select('id, nome').in('id', ids);
    for (const f of fs || []) nomes[f.id] = f.nome;
  }
  return NextResponse.json({ success: true, solicitacoes: (sols || []).map((s: any) => ({ ...s, funcionario_nome: nomes[s.funcionario_id] || `#${s.funcionario_id}` })) });
}

/** POST -> aprova/recusa. Body: { id, status: 'aprovado'|'recusado' }. Aprovar cria a ocorrência. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const status = ['aprovado', 'recusado'].includes(body.status) ? body.status : null;
  if (!body.id || !status) return NextResponse.json({ success: false, error: 'id e status válidos obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data: sol, error } = await (supabase as any).schema('hr').from('solicitacoes')
    .update({ status, resolvido_em: new Date().toISOString() }).eq('id', body.id).eq('bar_id', user.bar_id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Aprovado: registra a ocorrência (férias = 'ferias'; folga/outro = 'observacao').
  if (status === 'aprovado' && sol) {
    const tipoOc = sol.tipo === 'ferias' ? 'ferias' : 'observacao';
    const desc = sol.tipo === 'ferias' ? (sol.motivo || 'Férias aprovadas via portal') : `${sol.tipo === 'folga' ? 'Folga' : 'Solicitação'} aprovada via portal${sol.motivo ? ` — ${sol.motivo}` : ''}`;
    await (supabase as any).schema('hr').from('funcionario_ocorrencias').insert({
      funcionario_id: sol.funcionario_id, tipo: tipoOc, data_inicio: sol.data_inicio, data_fim: sol.data_fim || null, descricao: desc,
    });
  }
  return NextResponse.json({ success: true, solicitacao: sol });
}
