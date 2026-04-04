import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id = 3, dias_anteriores = 7 } = body;

    console.log(`🔄 Iniciando re-sync semanal manual para bar_id=${bar_id}, dias=${dias_anteriores}`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    // Chamar a Edge Function de re-sync semanal
    const response = await fetch(`${supabaseUrl}/functions/v1/contahub-resync-semanal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        bar_id,
        dias_anteriores
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function retornou erro: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Re-sincronização semanal iniciada',
      result
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Erro ao executar re-sync manual:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
