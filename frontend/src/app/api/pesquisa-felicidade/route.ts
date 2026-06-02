import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

// GET - Buscar dados Pesquisa da Felicidade
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');
    const setor = searchParams.get('setor');
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    let query = supabase
      .from('pesquisa_felicidade')
      .select('*')
      .eq('bar_id', barId)
      .order('data_pesquisa', { ascending: false });

    if (dataInicio) {
      query = query.gte('data_pesquisa', dataInicio);
    }
    if (dataFim) {
      query = query.lte('data_pesquisa', dataFim);
    }
    if (setor && setor !== 'TODOS') {
      query = query.eq('setor', setor);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar Pesquisa Felicidade:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar dados da Pesquisa da Felicidade' },
        { status: 500 }
      );
    }

    // Calcular estatísticas
    const totalRespostas = data?.length || 0;
    const mediaGeral = totalRespostas > 0
      ? data!.reduce((sum, item) => sum + (item.media_geral || 0), 0) / totalRespostas
      : 0;

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        total_respostas: totalRespostas,
        media_geral: parseFloat(mediaGeral.toFixed(2)),
        periodo: { data_inicio: dataInicio, data_fim: dataFim }
      }
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Importar dados Pesquisa da Felicidade (da planilha)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, registros } = body;

    if (!bar_id || !registros || !Array.isArray(registros)) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Inserir registros
    const { data, error } = await supabase
      .from('pesquisa_felicidade')
      .upsert(registros, {
        onConflict: 'bar_id,data_pesquisa,funcionario_nome,setor'
      })
      .select();

    if (error) {
      console.error('Erro ao importar Pesquisa Felicidade:', error);
      return NextResponse.json(
        { error: 'Erro ao importar dados', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: `${data?.length || 0} registros importados com sucesso`
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}


