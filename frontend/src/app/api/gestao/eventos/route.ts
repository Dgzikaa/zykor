import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Criar cliente Supabase dentro da função para evitar erro no build
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { searchParams } = new URL(request.url)
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    const status = searchParams.get('status')
    const genero = searchParams.get('genero')

    // Primeiro, vamos testar uma query simples sem filtros
    await supabase
      .from('eventos_base')
      .select('count')
      .limit(1)

    // Agora a query principal com paginação para retornar todos os eventos
    let query = supabase
      .from('eventos_base')
      .select('*')
      .order('data_evento', { ascending: true })

    // Filtros opcionais
    if (dataInicio) {
      query = query.gte('data_evento', dataInicio)
    }

    if (dataFim) {
      query = query.lte('data_evento', dataFim)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (genero) {
      query = query.eq('genero', genero)
    }

    // Implementar paginação completa para retornar todos os eventos
    let todosEventos: any[] = []
    let from = 0
    const pageSize = 100 // Supabase padrão
    let hasMore = true
    
    while (hasMore) {
      const { data: eventos, error } = await query.range(from, from + pageSize - 1)
      
      if (error) {
        console.error('❌ [API] Erro ao buscar eventos:', error)
        return NextResponse.json({ error: 'Erro ao buscar eventos', details: error }, { status: 500 })
      }
      
      if (!eventos || eventos.length === 0) {
        hasMore = false // Não há mais eventos
        break
      }
      
      todosEventos = todosEventos.concat(eventos)
      from += pageSize

      // Se retornou menos que pageSize, chegamos ao fim
      if (eventos.length < pageSize) {
        hasMore = false
      }
    }

    return NextResponse.json({ eventos: todosEventos })

  } catch (error) {
    console.error('💥 [API] Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error }, { status: 500 })
  }
} 
