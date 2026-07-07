import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { authenticateUser } from '@/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const bar_id = searchParams.get('bar_id')

    if (!bar_id) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })
    }

    const { data: configs, error } = await supabase
      .from('agente_configuracoes')
      .select('*')
      .eq('bar_id', parseInt(bar_id))

    if (error) throw error

    return NextResponse.json({ configuracoes: configs || [] })

  } catch (error: any) {
    console.error('Erro ao buscar configurações:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar configurações' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const supabase = createServerClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { bar_id, tipo_agente, ativo, frequencia_scan, metricas_monitoradas, thresholds, notificacoes_ativas } = body

    if (!bar_id || !tipo_agente) {
      return NextResponse.json({ error: 'bar_id e tipo_agente são obrigatórios' }, { status: 400 })
    }

    // Verificar se usuário tem acesso ao bar
    const { data: userBar } = await supabase
      .from('usuarios_bar')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('bar_id', bar_id)
      .single()

    if (!userBar) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('agente_configuracoes')
      .insert({
        bar_id,
        tipo_agente,
        ativo: ativo ?? true,
        frequencia_scan: frequencia_scan ?? 300,
        metricas_monitoradas: metricas_monitoradas ?? [],
        thresholds: thresholds ?? {},
        notificacoes_ativas: notificacoes_ativas ?? true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ configuracao: data })

  } catch (error: any) {
    console.error('Erro ao criar configuração:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao criar configuração' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  await authenticateUser(request);
  try {
    const supabase = createServerClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('agente_configuracoes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ configuracao: data })

  } catch (error: any) {
    console.error('Erro ao atualizar configuração:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar configuração' },
      { status: 500 }
    )
  }
}
