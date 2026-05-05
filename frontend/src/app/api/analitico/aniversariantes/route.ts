import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser, authErrorResponse } from '@/middleware/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10min — base muda lentamente

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    if (!user) return authErrorResponse('Usuário não autenticado')

    const { searchParams } = new URL(request.url)
    const mesParam = searchParams.get('mes')
    const mes = mesParam ? parseInt(mesParam) : (new Date().getMonth() + 1)
    if (mes < 1 || mes > 12) {
      return NextResponse.json({ error: 'Mês inválido (1-12)' }, { status: 400 })
    }

    const barIdHeader = request.headers.get('x-selected-bar-id')
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : NaN
    if (!Number.isFinite(barId)) {
      return NextResponse.json({ error: 'bar_id obrigatorio (header x-selected-bar-id)' }, { status: 400 })
    }

    const supabase = await getAdminClient()
    const { data, error } = await (supabase as unknown as { schema: (s: string) => any })
      .schema('silver')
      .from('cliente_estatisticas')
      .select('cliente_nome, cliente_fone_norm, cliente_dtnasc, total_visitas, ultima_visita, dias_desde_ultima_visita, status, eh_vip, ticket_medio_consumo, valor_total_consumo')
      .eq('bar_id', barId)
      .not('cliente_dtnasc', 'is', null)
      .filter('cliente_dtnasc', 'gte', '1900-01-01') // sanity
      .order('cliente_dtnasc', { ascending: true })

    if (error) {
      console.error('Erro aniversariantes:', error)
      return NextResponse.json({ error: 'Erro ao carregar aniversariantes', details: error.message }, { status: 500 })
    }

    // Filtrar por mes em JS (PostgREST nao tem EXTRACT direto via .filter)
    const aniversariantes = (data || [])
      .filter((c: any) => {
        if (!c.cliente_dtnasc) return false
        // dtnasc em formato YYYY-MM-DD; pega o mes (posicao 5-6) sem timezone shift
        const mesAniv = parseInt(String(c.cliente_dtnasc).substring(5, 7))
        return mesAniv === mes
      })
      .map((c: any) => {
        const dtNascStr = String(c.cliente_dtnasc)
        const dia = parseInt(dtNascStr.substring(8, 10))
        return {
          nome: c.cliente_nome || 'Sem nome',
          telefone: c.cliente_fone_norm,
          dtnasc: dtNascStr,
          dia,
          mes,
          total_visitas: c.total_visitas || 0,
          ultima_visita: c.ultima_visita,
          dias_desde_ultima_visita: c.dias_desde_ultima_visita,
          status: c.status,
          eh_vip: c.eh_vip,
          ticket_medio: Number(c.ticket_medio_consumo) || 0,
          gasto_total: Number(c.valor_total_consumo) || 0,
        }
      })
      .sort((a: any, b: any) => {
        // Ordenar por dia do mes asc, depois total_visitas desc
        if (a.dia !== b.dia) return a.dia - b.dia
        return b.total_visitas - a.total_visitas
      })

    const totalAtivos = aniversariantes.filter(a => a.status === 'ativo').length
    const totalVip = aniversariantes.filter(a => a.eh_vip).length

    return NextResponse.json({
      mes,
      total: aniversariantes.length,
      total_ativos: totalAtivos,
      total_vip: totalVip,
      aniversariantes,
    })
  } catch (e: any) {
    console.error('Erro aniversariantes:', e)
    return NextResponse.json({ error: e?.message || 'Erro desconhecido' }, { status: 500 })
  }
}
