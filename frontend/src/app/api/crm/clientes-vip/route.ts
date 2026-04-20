import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser, authErrorResponse } from '@/middleware/auth'

export const dynamic = 'force-dynamic'

interface ProdutoFavorito { produto: string; quantidade: number }
interface CategoriaFavorita { categoria: string; quantidade: number }

interface SilverClienteEstatistica {
  cliente_fone_norm: string | null
  cliente_nome: string | null
  total_visitas: number | null
  valor_total_consumo: number | string | null
  ticket_medio_consumo: number | string | null
  ultima_visita: string | null
  produtos_favoritos: ProdutoFavorito[] | null
  categorias_favoritas: CategoriaFavorita[] | null
  tags: string[] | null
  dias_preferidos: string[] | null
  eh_vip: boolean | null
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    if (!user) return authErrorResponse('Usuário não autenticado')

    const supabase = await getAdminClient()

    const barIdHeader = request.headers.get('x-selected-bar-id')
    const barId = barIdHeader ? parseInt(barIdHeader, 10) || null : null

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })
    }

    // Single query consolidando o que antes era 2 reads (crm.cliente_perfil_consumo + public.cliente_estatisticas)
    const { data, error } = await supabase
      .schema('silver' as never)
      .from('cliente_estatisticas')
      .select(`
        cliente_fone_norm,
        cliente_nome,
        total_visitas,
        valor_total_consumo,
        ticket_medio_consumo,
        ultima_visita,
        produtos_favoritos,
        categorias_favoritas,
        tags,
        dias_preferidos,
        eh_vip
      `)
      .eq('bar_id', barId)
      .order('total_visitas', { ascending: false })
      .limit(100) as unknown as { data: SilverClienteEstatistica[] | null; error: { message?: string } | null }

    if (error) {
      console.error('❌ Erro ao buscar clientes silver:', error)
      return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 })
    }

    const clientesRaw = data || []

    // Mapper compat: preserva shape esperado pelo UI (telefone/nome/total_gasto/ticket_medio + flags is_vip/is_frequente/is_regular)
    const clientes = clientesRaw.map((c) => {
      const totalVisitas = Number(c.total_visitas) || 0
      return {
        telefone: c.cliente_fone_norm,
        nome: c.cliente_nome,
        total_visitas: totalVisitas,
        total_gasto: parseFloat(String(c.valor_total_consumo || 0)) || 0,
        ticket_medio: parseFloat(String(c.ticket_medio_consumo || 0)) || 0,
        ultima_visita: c.ultima_visita,
        produtos_favoritos: c.produtos_favoritos || [],
        categorias_favoritas: c.categorias_favoritas || [],
        tags: c.tags || [],
        dias_preferidos: c.dias_preferidos || [],
        is_vip: c.eh_vip === true || totalVisitas >= 20,
        is_frequente: totalVisitas >= 10 && totalVisitas < 20,
        is_regular: totalVisitas >= 5 && totalVisitas < 10,
      }
    })

    const totalClientes = clientes.length
    const clientesVip = clientes.filter((c) => c.is_vip).length
    const clientesFrequentes = clientes.filter((c) => c.is_frequente).length
    const clientesRegulares = clientes.filter((c) => c.is_regular).length

    // Produtos mais populares (agregando todos os clientes)
    const produtosPopulares = new Map<string, { quantidade: number; clientes: number }>()
    for (const cliente of clientes) {
      for (const produto of cliente.produtos_favoritos || []) {
        const key = produto.produto
        if (!produtosPopulares.has(key)) {
          produtosPopulares.set(key, { quantidade: 0, clientes: 0 })
        }
        const p = produtosPopulares.get(key)!
        p.quantidade += produto.quantidade || 0
        p.clientes += 1
      }
    }

    const topProdutos = Array.from(produtosPopulares.entries())
      .sort((a, b) => b[1].clientes - a[1].clientes)
      .slice(0, 10)
      .map(([produto, data]) => ({
        produto,
        clientes: data.clientes,
        quantidade_total: Math.round(data.quantidade),
      }))

    const tagsCount = new Map<string, number>()
    for (const cliente of clientes) {
      for (const tag of cliente.tags || []) {
        tagsCount.set(tag, (tagsCount.get(tag) || 0) + 1)
      }
    }

    const topTags = Array.from(tagsCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))

    return NextResponse.json({
      clientes: clientes.slice(0, 50),
      estatisticas: {
        total_clientes: totalClientes,
        clientes_vip: clientesVip,
        clientes_frequentes: clientesFrequentes,
        clientes_regulares: clientesRegulares,
        top_produtos: topProdutos,
        top_tags: topTags,
      },
    })
  } catch (error) {
    console.error('❌ Erro na API de clientes VIP:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
