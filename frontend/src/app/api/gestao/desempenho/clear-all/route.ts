import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar não selecionado' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Deletar todos os registros do bar
    const { error } = await supabase
      .from('desempenho_semanal')
      .delete()
      .eq('bar_id', barId);

    if (error) {
      console.error('Erro ao limpar dados:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao limpar dados de desempenho' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Todos os dados de desempenho foram excluídos com sucesso' 
    });

  } catch (error) {
    console.error('Erro ao limpar dados:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
