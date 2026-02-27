import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'analisar', barId = 3, enviarDiscord = false } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Alertas] Variáveis de ambiente não encontradas');
      return NextResponse.json(
        { success: false, error: 'Configuração do Supabase não encontrada' },
        { status: 500 }
      );
    }

    console.log('[Alertas] Chamando Edge Function:', `${supabaseUrl}/functions/v1/alertas-dispatcher`);

    // Chamar alertas-dispatcher (nome correto da Edge Function)
    const response = await fetch(`${supabaseUrl}/functions/v1/alertas-dispatcher`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ 
        action, 
        bar_id: barId,
        params: { enviarDiscord }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Alertas] Erro da Edge Function:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Erro ao processar alertas: ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('[Alertas] Sucesso:', result);
    
    // Adaptar resposta para formato esperado pelo frontend
    return NextResponse.json({
      success: result.success,
      resultado: {
        alertas: result.data?.alertas || [],
        insights: [],
        metricas: result.data?.periodo || {}
      }
    });

  } catch (error) {
    console.error('[Alertas] Erro interno:', error);
    return NextResponse.json(
      { success: false, error: `Erro interno: ${error instanceof Error ? error.message : 'Desconhecido'}` },
      { status: 500 }
    );
  }
}
