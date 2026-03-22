import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bar_id = searchParams.get('bar_id');
    
    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar a data mais recente com dados em vendas_item
    const { data: ultimaData, error } = await supabase
      .from('vendas_item')
      .select('data_venda')
      .eq('bar_id', parseInt(bar_id))
      .order('data_venda', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Erro ao buscar última data:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar dados' },
        { status: 500 }
      );
    }

    const dataEncontrada = ultimaData?.[0]?.data_venda;
    
    if (!dataEncontrada) {
      return NextResponse.json(
        { error: 'Nenhuma data encontrada' },
        { status: 404 }
      );
    }

    // Verificar se há dados suficientes para essa data (pelo menos 100 registros)
    const { data: contagem, error: errorContagem } = await supabase
      .from('vendas_item')
      .select('data_venda', { count: 'exact' })
      .eq('bar_id', parseInt(bar_id))
      .eq('data_venda', dataEncontrada);

    const totalRegistros = contagem?.length || 0;

    return NextResponse.json({
      success: true,
      data: {
        ultima_data: dataEncontrada,
        total_registros: totalRegistros,
        bar_id: parseInt(bar_id)
      }
    });

  } catch (error) {
    console.error('Erro na API ultima-data-com-dados:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}


