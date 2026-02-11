import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('🔄 Iniciando sincronização NPS Reservas...');

    // Usar nova função consolidada google-sheets-sync com action=nps-reservas
    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-sheets-sync`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'nps-reservas' }),
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

