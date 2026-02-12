import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { data_inicio, data_fim, bar_id } = body;
    console.log('🔄 Iniciando sincronização NPS Reservas...', data_inicio || data_fim ? `(retroativo: ${data_inicio || '-'} a ${data_fim || '-'})` : '');

    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-sheets-sync`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'nps-reservas', bar_id, data_inicio, data_fim }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na Edge Function:', errorText);
      throw new Error(`Edge Function error: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Sincronização de Reservas concluída:', result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ Erro na sincronização de Reservas:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        details: error 
      },
      { status: 500 }
    );
  }
}

