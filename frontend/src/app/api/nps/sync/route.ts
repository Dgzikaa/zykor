import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { data_inicio, data_fim, bar_id } = body;
    console.log('🔄 Iniciando sincronização NPS...', data_inicio || data_fim ? `(retroativo: ${data_inicio || '-'} a ${data_fim || '-'})` : '');
    
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-sheets-sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ action: 'nps', bar_id, data_inicio, data_fim })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na sincronização:', errorText);
      return NextResponse.json({
        success: false,
        error: `Erro na Edge Function: ${response.status} - ${errorText}`
      }, { status: 500 });
    }

    const result = await response.json();
    console.log('✅ Sincronização concluída:', result);

    return NextResponse.json({
      success: true,
      message: 'Sincronização NPS concluída com sucesso',
      data: result
    });

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

