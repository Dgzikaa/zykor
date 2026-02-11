import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const body = await request.json();
    const { bar_id, user_id } = body;

    if (!bar_id || !user_id) {
      return NextResponse.json(
        { error: 'bar_id e user_id são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    let pendenciasGerais = 0;

    // Somar várias pendências para um resumo geral
    // 1. Checklists - checklist_agendamentos (checklist_execucoes removida)
    let checklistsCount = 0;
    try {
      const { data } = await supabase
        .from('checklist_agendamentos')
        .select('id')
        .eq('bar_id', bar_id);
      checklistsCount = (data || []).length;
    } catch (_e) {
      /* tabela pode não existir */
    }
    pendenciasGerais += checklistsCount;

    // 2. Alertas ativos
    const { data: alertas } = await supabase
      .from('sistema_alertas')
      .select('id')
      .eq('bar_id', bar_id)
      .is('resolvido_em', null);

    pendenciasGerais += alertas?.length || 0;

    // 3. Notificações não lidas
    const { data: notificacoes } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('bar_id', bar_id)
      .eq('lida', false);

    pendenciasGerais += notificacoes?.length || 0;

    return NextResponse.json({
      success: true,
      pendencias_gerais: pendenciasGerais,
      detalhes: {
        checklists: checklistsCount,
        alertas: alertas?.length || 0,
        notificacoes: notificacoes?.length || 0,
        total: pendenciasGerais,
      },
    });
  } catch (error) {
    console.error('Erro na API dashboard/resumo:', error);
    return NextResponse.json({
      success: true,
      pendencias_gerais: 0,
    });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
