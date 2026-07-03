import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Listar eventos de concorrência
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'ativo'
    const tipo = searchParams.get('tipo')
    const dataInicio = searchParams.get('data_inicio')
    const dataFim = searchParams.get('data_fim')
    const limite = parseInt(searchParams.get('limite') || '50')

    let query = supabase
      .from('eventos_concorrencia')
      .select('*')
      .eq('status', status)
      .order('data_evento', { ascending: true })
      .limit(limite)

    // Filtrar por tipo se especificado
    if (tipo) {
      query = query.eq('tipo', tipo)
    }

    // Filtrar por período
    if (dataInicio) {
      query = query.gte('data_evento', dataInicio)
    }
    if (dataFim) {
      query = query.lte('data_evento', dataFim)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar eventos:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      eventos: data || [],
      total: data?.length || 0
    })

  } catch (error) {
    console.error('Erro na API de concorrência:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST - Adicionar evento manualmente
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  try {
    const body = await request.json()
    
    const {
      nome,
      local_nome,
      local_endereco,
      data_evento,
      horario_inicio,
      tipo,
      impacto,
      url_fonte,
      notas
    } = body

    if (!nome || !local_nome || !data_evento || !tipo) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios: nome, local_nome, data_evento, tipo' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('eventos_concorrencia')
      .insert({
        nome,
        local_nome,
        local_endereco,
        cidade: 'Brasília',
        data_evento,
        horario_inicio,
        tipo,
        impacto: impacto || 'medio',
        fonte: 'manual',
        url_fonte,
        notas,
        verificado: true,
        status: 'ativo'
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao inserir evento:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      evento: data,
      message: 'Evento adicionado com sucesso'
    })

  } catch (error) {
    console.error('Erro na API de concorrência:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar evento (marcar como verificado, alterar impacto, etc)
export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID do evento é obrigatório' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('eventos_concorrencia')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar evento:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      evento: data,
      message: 'Evento atualizado com sucesso'
    })

  } catch (error) {
    console.error('Erro na API de concorrência:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Remover evento (ou marcar como ignorado)
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID do evento é obrigatório' },
        { status: 400 }
      )
    }

    // Marca como ignorado em vez de deletar fisicamente
    const { error } = await supabase
      .from('eventos_concorrencia')
      .update({ status: 'ignorado' })
      .eq('id', id)

    if (error) {
      console.error('Erro ao remover evento:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Evento removido com sucesso'
    })

  } catch (error) {
    console.error('Erro na API de concorrência:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
