'use server'

import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CMVManual {
  id?: number
  bar_id: number
  periodo_tipo: 'semanal' | 'mensal' | 'trimestral'
  periodo_inicio: string
  periodo_fim: string
  cmv_percentual: number
  cmv_valor?: number
  faturamento_periodo?: number
  estoque_inicial?: number
  estoque_final?: number
  compras_periodo?: number
  observacoes?: string
  fonte?: string
}

// GET - Buscar CMV por período
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barId = searchParams.get('bar_id')
    const periodoTipo = searchParams.get('periodo_tipo') || 'trimestral'
    const dataInicio = searchParams.get('data_inicio')
    const dataFim = searchParams.get('data_fim')

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })
    }

    let query = supabase
      .from('cmv_manual')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .order('periodo_inicio', { ascending: false })

    if (periodoTipo) {
      query = query.eq('periodo_tipo', periodoTipo)
    }

    if (dataInicio) {
      query = query.gte('periodo_inicio', dataInicio)
    }

    if (dataFim) {
      query = query.lte('periodo_fim', dataFim)
    }

    const { data, error } = await query.limit(10)

    if (error) throw error

    return NextResponse.json({ cmv: data })
  } catch (error) {
    console.error('Erro ao buscar CMV:', error)
    return NextResponse.json({ error: 'Erro ao buscar CMV' }, { status: 500 })
  }
}

// POST - Inserir novo CMV
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  try {
    const body: CMVManual = await request.json()

    if (!body.bar_id || !body.periodo_tipo || !body.periodo_inicio || !body.periodo_fim || body.cmv_percentual === undefined) {
      return NextResponse.json({ 
        error: 'Campos obrigatórios: bar_id, periodo_tipo, periodo_inicio, periodo_fim, cmv_percentual' 
      }, { status: 400 })
    }

    // Verificar se já existe registro para este período
    const { data: existing } = await supabase
      .from('cmv_manual')
      .select('id')
      .eq('bar_id', body.bar_id)
      .eq('periodo_tipo', body.periodo_tipo)
      .eq('periodo_inicio', body.periodo_inicio)
      .single()

    if (existing) {
      // Atualizar registro existente
      const { data, error } = await supabase
        .from('cmv_manual')
        .update({
          cmv_percentual: body.cmv_percentual,
          cmv_valor: body.cmv_valor,
          faturamento_periodo: body.faturamento_periodo,
          estoque_inicial: body.estoque_inicial,
          estoque_final: body.estoque_final,
          compras_periodo: body.compras_periodo,
          observacoes: body.observacoes,
          fonte: body.fonte || 'manual'
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ cmv: data, message: 'CMV atualizado com sucesso' })
    }

    // Inserir novo registro
    const { data, error } = await supabase
      .from('cmv_manual')
      .insert({
        bar_id: body.bar_id,
        periodo_tipo: body.periodo_tipo,
        periodo_inicio: body.periodo_inicio,
        periodo_fim: body.periodo_fim,
        cmv_percentual: body.cmv_percentual,
        cmv_valor: body.cmv_valor,
        faturamento_periodo: body.faturamento_periodo,
        estoque_inicial: body.estoque_inicial,
        estoque_final: body.estoque_final,
        compras_periodo: body.compras_periodo,
        observacoes: body.observacoes,
        fonte: body.fonte || 'manual'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ cmv: data, message: 'CMV inserido com sucesso' }, { status: 201 })
  } catch (error) {
    console.error('Erro ao inserir CMV:', error)
    return NextResponse.json({ error: 'Erro ao inserir CMV' }, { status: 500 })
  }
}

// DELETE - Remover CMV
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const { error } = await supabase
      .from('cmv_manual')
      .delete()
      .eq('id', parseInt(id))

    if (error) throw error

    return NextResponse.json({ message: 'CMV removido com sucesso' })
  } catch (error) {
    console.error('Erro ao remover CMV:', error)
    return NextResponse.json({ error: 'Erro ao remover CMV' }, { status: 500 })
  }
}

