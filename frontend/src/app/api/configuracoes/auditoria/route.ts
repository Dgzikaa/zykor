/**
 * API para buscar logs de auditoria
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/server';
import { getAuditLogs } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';

export const GET = requireAdmin(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      user_id: searchParams.get('user_id') ? parseInt(searchParams.get('user_id')!) : undefined,
      action: searchParams.get('action') || undefined,
      resource: searchParams.get('resource') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    const logs = await getAuditLogs(filters);

    return NextResponse.json({
      success: true,
      logs,
      filters,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar logs de auditoria:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});
