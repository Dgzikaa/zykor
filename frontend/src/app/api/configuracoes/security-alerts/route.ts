/**
 * API para buscar alertas de segurança
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/server';
import { getSecurityAlertsSummary } from '@/lib/auth/monitoring';

export const dynamic = 'force-dynamic';

export const GET = requireAdmin(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');

    const summary = await getSecurityAlertsSummary(hours);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar alertas de segurança:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});
