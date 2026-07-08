import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { getOrcamentacaoCompleta } from '@/app/estrategico/orcamentacao/services/orcamentacao-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * API fina p/ o hub de Gráficos: expõe a Orçamentação (plan×proj×real por mês) via GET,
 * já que a tela de Orçamentação consome o service no servidor (não tinha GET pro cliente).
 * GET /api/graficos/orcamentacao?ano=2026 → { success, meses: MesOrcamento[] } (Jan→Dez).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const ano = Number(new URL(request.url).searchParams.get('ano')) || new Date().getFullYear();
  const supabase = await getAdminClient();
  try {
    const meses = await getOrcamentacaoCompleta(supabase as any, user.bar_id, ano, 1, 12);
    return NextResponse.json({ success: true, meses });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Falha ao montar orçamentação' }, { status: 500 });
  }
}
