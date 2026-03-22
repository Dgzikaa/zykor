import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET - Lista analises diarias do agente
 * Query params: bar_id (obrigatorio), limite (default 7)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const limite = parseInt(searchParams.get('limite') || '7');

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'bar_id e obrigatorio' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('agente_insights')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .eq('tipo', 'analise_diaria')
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('Erro ao buscar analises:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const analises = (data || []) as any[];

    return NextResponse.json({
      success: true,
      analises,
      total: analises.length
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar analises' },
      { status: 500 }
    );
  }
}

/**
 * POST - Dispara analise diaria manualmente
 * Body: { bar_id: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id } = body;

    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id e obrigatorio' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agente-dispatcher`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ 
          action: 'analise-diaria-v2', 
          bar_id 
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na Edge Function:', errorText);
      return NextResponse.json(
        { success: false, error: 'Erro ao executar analise' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Erro ao disparar analise:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao disparar analise' },
      { status: 500 }
    );
  }
}
