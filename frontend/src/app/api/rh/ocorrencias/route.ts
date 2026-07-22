import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rh/ocorrencias?tipo=advertencia|atestado&q= — histórico geral do bar (advertências/
 * atestados), INCLUINDO os "nome-só" (sem vínculo de funcionário = ex-funcionário/histórico).
 * O nome exibido vem do funcionário vinculado; se não houver, do colaborador_nome.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const tipo = sp.get('tipo');
  const q = (sp.get('q') || '').trim().toLowerCase();
  const supabase = await getAdminClient();

  let query = (supabase as any).schema('hr').from('funcionario_ocorrencias')
    .select('id, funcionario_id, colaborador_nome, tipo, data_inicio, data_fim, descricao, cartao, aplicado_por')
    .eq('bar_id', user.bar_id)
    .order('data_inicio', { ascending: false })
    .limit(2000);
  if (tipo) query = query.eq('tipo', tipo);
  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Nome do funcionário vinculado (quando houver) — pra mostrar o cadastro oficial.
  const ids = Array.from(new Set((rows || []).map((r: any) => r.funcionario_id).filter(Boolean)));
  const nomeById = new Map<number, { nome: string; ativo: boolean }>();
  if (ids.length) {
    const { data: funcs } = await (supabase as any).schema('hr').from('funcionarios')
      .select('id, nome, ativo').in('id', ids);
    for (const f of funcs || []) nomeById.set(f.id, { nome: f.nome, ativo: f.ativo });
  }

  let ocorrencias = (rows || []).map((r: any) => {
    const vinc = r.funcionario_id ? nomeById.get(r.funcionario_id) : null;
    return {
      ...r,
      nome: vinc?.nome || r.colaborador_nome || '—',
      vinculado: !!r.funcionario_id,
      funcionario_ativo: vinc?.ativo ?? null,
    };
  });
  if (q) ocorrencias = ocorrencias.filter((o: any) =>
    o.nome.toLowerCase().includes(q) || (o.aplicado_por || '').toLowerCase().includes(q) || (o.descricao || '').toLowerCase().includes(q));

  return NextResponse.json({
    success: true,
    ocorrencias,
    resumo: {
      total: ocorrencias.length,
      vinculadas: ocorrencias.filter((o: any) => o.vinculado).length,
      nome_so: ocorrencias.filter((o: any) => !o.vinculado).length,
    },
  });
}
