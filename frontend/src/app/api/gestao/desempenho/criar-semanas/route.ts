import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * DEPRECATED - Criação de semanas via UI
 * 
 * Gold ETL (cron gold-desempenho às 09:00 BRT) cria semanas automaticamente
 * ao processar dados. Não é necessário criar semanas manualmente.
 * 
 * Rota mantida apenas por compatibilidade com UI existente.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Criação automática via Gold ETL (cron 09:00 BRT)',
    created: 0,
    note: 'Semanas são criadas automaticamente pelo ETL gold.desempenho'
  });
}
