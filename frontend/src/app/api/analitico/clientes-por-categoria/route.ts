import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser, authErrorResponse } from '@/middleware/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    if (!user) return authErrorResponse('Usuário não autenticado')

    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

    const barIdHeader = request.headers.get('x-selected-bar-id')
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : NaN
    if (!Number.isFinite(barId)) {
      return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 })
    }

    const supabase = await getAdminClient()

    // Lista de categorias disponiveis
    if (!categoria || categoria === '__listar__') {
      const { data: catData, error: catErr } = await supabase.rpc('listar_categorias_clientes_estatisticas', {
        p_bar_id: barId,
      })
      if (catErr) {
        // Fallback: query direta
        const { data: fallback } = await (supabase as any)
          .from('cliente_estatisticas')
          .select('produtos_favoritos')
          .eq('bar_id', barId)
          .limit(5000)
        const cats = new Map<string, number>()
        for (const r of (fallback || [])) {
          const list = Array.isArray(r.produtos_favoritos) ? r.produtos_favoritos : []
          for (const p of list) {
            if (p?.categoria) cats.set(p.categoria, (cats.get(p.categoria) || 0) + 1)
          }
        }
        return NextResponse.json({
          categorias: Array.from(cats.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([nome, count]) => ({ nome, count })),
        })
      }
      return NextResponse.json({ categorias: catData || [] })
    }

    // Top clientes pra categoria especifica via RPC SQL (jsonb unnest)
    const { data, error } = await supabase.rpc('top_clientes_por_categoria', {
      p_bar_id: barId,
      p_categoria: categoria,
      p_limit: limit,
    })

    if (error) {
      console.error('Erro top_clientes_por_categoria:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      categoria,
      total: (data || []).length,
      clientes: data || [],
    })
  } catch (e: any) {
    console.error('Erro clientes-por-categoria:', e)
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 })
  }
}
