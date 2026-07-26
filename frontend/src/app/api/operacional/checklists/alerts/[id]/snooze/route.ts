import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse , permissionErrorResponse } from '@/middleware/auth';

// =====================================================
// ✅ API PARA ADIAR ALERTAS
// =====================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }
    if ((user.role as string) !== 'admin') return permissionErrorResponse('Somente admin');

    const { id: alertId } = await params;

    if (!alertId) {
      return NextResponse.json(
        {
          error: 'ID do alerta não fornecido',
        },
        { status: 400 }
      );
    }

    // Log do adiamento do alerta
    const snoozeLog = {
      alert_id: alertId,
      user_id: user.id,
      action: 'snoozed',
      snoozed_at: new Date().toISOString(),
      notes: 'Alerta adiado pelo usuário',
    };

    return NextResponse.json({
      success: true,
      message: 'Alerta adiado com sucesso',
      alertId,
      snoozedAt: snoozeLog.snoozed_at,
    });
  } catch (error) {
    console.error('Erro ao adiar alerta:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
