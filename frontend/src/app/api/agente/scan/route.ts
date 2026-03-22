import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const bar_id = searchParams.get('bar_id')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!bar_id) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })
    }

    // Buscar histórico de scans
    const { data: scans, error } = await supabase
      .from('agente_scans')
      .select('*')
      .eq('bar_id', parseInt(bar_id))
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ scans })

  } catch (error: any) {
    console.error('Erro ao buscar scans:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar scans' },
      { status: 500 }
    )
  }
}
