import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/middleware/auth';

export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const { data_inicial, data_final, bar_id } = await request.json();

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!data_inicial || !data_final) {
      return NextResponse.json(
        { error: 'data_inicial e data_final são obrigatórias' },
        { status: 400 }
      );
    }

    // Chamar a Edge Function
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/contahub-sync-prodporhora`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        data_inicial,
        data_final,
        bar_id
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na sincronização: ${response.statusText}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Sincronização iniciada com sucesso',
      data: result
    });

  } catch (error) {
    console.error('Erro na API de sincronização:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
