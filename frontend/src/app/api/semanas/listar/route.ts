import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Busca as últimas 20 semanas ordenadas por data_inicio DESC
    const { data: semanas, error } = await supabase
      .from('semanas_referencia')
      .select('semana, data_inicio, data_fim, periodo_formatado')
      .order('data_inicio', { ascending: false })
      .limit(20);

    if (error) {
      console.error('❌ Erro ao buscar semanas:', error);
      console.error('❌ Detalhes do erro:', JSON.stringify(error, null, 2));
      throw error;
    }

    return NextResponse.json({
      success: true,
      semanas: semanas || [],
      total: semanas?.length || 0
    });

  } catch (error) {
    console.error('❌ Erro na API de semanas:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
