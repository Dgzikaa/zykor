import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET /api/rh/funcionarios/opcoes -> cargos + áreas do bar (dropdowns). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const [c, a] = await Promise.all([
    (supabase as any).schema('hr').from('cargos').select('id, nome').eq('bar_id', user.bar_id).eq('ativo', true).order('nome'),
    (supabase as any).schema('hr').from('areas').select('id, nome').eq('bar_id', user.bar_id).eq('ativo', true).order('nome'),
  ]);
  return NextResponse.json({
    success: true,
    cargos: c.data || [],
    areas: a.data || [],
    tipos_contratacao: ['CLT', 'PJ', 'Freela'],
    tipos_documento: ['carteira_trabalho', 'exame_admissional', 'contrato', 'rg_cpf', 'outro'],
  });
}
