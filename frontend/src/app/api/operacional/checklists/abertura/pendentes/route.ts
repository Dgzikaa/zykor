import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse , permissionErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }
    if ((user.role as string) !== 'admin') return permissionErrorResponse('Somente admin');

    const body = await request.json();
    const { bar_id, user_id } = body;

    if (!bar_id || !user_id) {
      return NextResponse.json(
        { error: 'bar_id e user_id são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Buscar checklists de abertura pendentes
    const { data: checklistsAbertura, error: aberturaError } = await supabase
      .from('checklist_abertura')
      .select('id, status')
      .eq('bar_id', bar_id)
      .in('status', ['pendente', 'em_andamento']);

    if (aberturaError) {
      console.error('Erro ao buscar checklists abertura:', aberturaError);
      return NextResponse.json({
        success: true,
        pendentes: 0,
      });
    }

    const totalPendentes = checklistsAbertura?.length || 0;

    return NextResponse.json({
      success: true,
      pendentes: totalPendentes,
      detalhes: {
        total: totalPendentes,
      },
    });
  } catch (error) {
    console.error('Erro na API checklists/abertura/pendentes:', error);
    return NextResponse.json({
      success: true,
      pendentes: 0,
    });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
