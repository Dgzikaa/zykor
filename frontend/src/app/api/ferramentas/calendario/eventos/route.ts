import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Função para obter bar_id do header
function getBarIdFromRequest(request: NextRequest): number | null {
  const barIdHeader = request.headers.get('x-selected-bar-id');
  if (!barIdHeader) {
    return null;
  }
  return parseInt(barIdHeader, 10) || null;
}

// GET - Buscar evento específico por data
export async function GET(request: NextRequest) {
  try {
    const barId = getBarIdFromRequest(request);
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const data = searchParams.get('data');
    const id = searchParams.get('id');

    if (id) {
      // Buscar por ID
      const { data: evento, error } = await supabase
        .from('eventos_base')
        .select('*')
        .eq('id', id)
        .eq('bar_id', barId)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar evento:', error);
        return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: evento });
    }

    if (data) {
      // Buscar por data
      const { data: evento, error } = await supabase
        .from('eventos_base')
        .select('*')
        .eq('data_evento', data)
        .eq('bar_id', barId)
        .eq('ativo', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = não encontrado
        console.error('❌ Erro ao buscar evento:', error);
        return NextResponse.json({ error: 'Erro ao buscar evento' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        data: evento || null 
      });
    }

    return NextResponse.json({ error: 'Parâmetro data ou id é obrigatório' }, { status: 400 });

  } catch (error) {
    console.error('❌ Erro na API GET eventos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar novo evento
export async function POST(request: NextRequest) {
  try {
    const barId = getBarIdFromRequest(request);
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const body = await request.json();
    const {
      data_evento,
      nome,
      artista,
      genero,
      observacoes
    } = body;

    if (!data_evento || !nome) {
      return NextResponse.json({ 
        error: 'Data do evento e nome são obrigatórios' 
      }, { status: 400 });
    }

    // Calcular dia da semana
    const dataEvento = new Date(data_evento);
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const diaSemana = diasSemana[dataEvento.getDay()];

    const { data: evento, error } = await supabase
      .from('eventos_base')
      .insert({
        data_evento,
        nome,
        artista: artista || null,
        genero: genero || null,
        observacoes: observacoes || null,
        dia_semana: diaSemana,
        bar_id: barId,
        ativo: true,
        precisa_recalculo: true,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar evento:', error);
      return NextResponse.json({ 
        error: 'Erro ao criar evento',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: evento,
      message: 'Evento criado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na API POST eventos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Atualizar evento existente
export async function PUT(request: NextRequest) {
  try {
    const barId = getBarIdFromRequest(request);
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const body = await request.json();
    const {
      id,
      nome,
      artista,
      genero,
      observacoes
    } = body;

    if (!id || !nome) {
      return NextResponse.json({ 
        error: 'ID e nome são obrigatórios' 
      }, { status: 400 });
    }

    const { data: evento, error } = await supabase
      .from('eventos_base')
      .update({
        nome,
        artista: artista || null,
        genero: genero || null,
        observacoes: observacoes || null,
        atualizado_em: new Date().toISOString(),
        precisa_recalculo: true
      })
      .eq('id', id)
      .eq('bar_id', barId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar evento:', error);
      return NextResponse.json({ 
        error: 'Erro ao atualizar evento',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: evento,
      message: 'Evento atualizado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na API PUT eventos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Excluir evento (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const barId = getBarIdFromRequest(request);
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    // Soft delete - marcar como inativo
    const { data: evento, error } = await supabase
      .from('eventos_base')
      .update({
        ativo: false,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .eq('bar_id', barId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao excluir evento:', error);
      return NextResponse.json({ 
        error: 'Erro ao excluir evento',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: evento,
      message: 'Evento excluído com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na API DELETE eventos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
