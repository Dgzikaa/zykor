import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * DEPRECATED - Limpeza de dados de desempenho
 * 
 * Gold.desempenho não deve ser limpa via UI pois:
 * 1. ETL só reprocessa últimos 14 dias por padrão
 * 2. Histórico seria perdido sem backup
 * 3. Não há necessidade de limpar (dados são recalculados)
 * 
 * Rota desabilitada por segurança.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'Operação desabilitada. Gold.desempenho não deve ser limpa via UI (ETL reprocessaria apenas 14 dias).',
    deleted: 0,
    note: 'Se necessário, limpar via Supabase Studio SQL Editor com backup prévio'
  }, { status: 403 });
}
