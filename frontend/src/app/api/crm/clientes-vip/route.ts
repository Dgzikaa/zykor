import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser, authErrorResponse } from '@/middleware/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Autenticar usuário
    const user = await authenticateUser(request)
    if (!user) {
      return authErrorResponse('Usuário não autenticado')
    }

    const supabase = await getAdminClient()

    // Obter bar_id do header x-selected-bar-id
    const barIdHeader = request.headers.get('x-selected-bar-id')
    let barId: number | null = null
    if (barIdHeader) {
      barId = parseInt(barIdHeader, 10) || null
    }

    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      )
    }

    // 1. Buscar clientes com perfil de consumo ordenados por visitas
    const { data: clientesPerfil, error: perfilError } = await supabase
      .from('cliente_perfil_consumo')
      .select('*')
      .eq('bar_id', barId)
      .order('total_visitas', { ascending: false })
      .limit(100)

    if (perfilError) {
      console.error('❌ Erro ao buscar perfis:', perfilError)
    }

    // 2. Buscar estatísticas agregadas da tabela cliente_estatisticas
    const { data: clientesEstatisticas, error: statsError } = await supabase
      .from('cliente_estatisticas')
      .select('*')
      .eq('bar_id', barId)
      .order('total_visitas', { ascending: false })
      .limit(100)

    if (statsError) {
      console.error('❌ Erro ao buscar estatísticas:', statsError)
    }

    // 3. Mesclar dados de perfil com estatísticas
    const clientesMap = new Map<string, any>()

    // Primeiro, adicionar estatísticas base
    for (const cliente of clientesEstatisticas || []) {
      clientesMap.set(cliente.telefone, {
        telefone: cliente.telefone,
        nome: cliente.nome,
        total_visitas: cliente.total_visitas,
        total_gasto: parseFloat(cliente.total_gasto) || 0,
        ticket_medio: parseFloat(cliente.ticket_medio) || 0,
        ultima_visita: cliente.ultima_visita,
        produtos_favoritos: [],
        categorias_favoritas: [],
        tags: [],
        is_vip: cliente.total_visitas >= 20,
        is_frequente: cliente.total_visitas >= 10 && cliente.total_visitas < 20,
        is_regular: cliente.total_visitas >= 5 && cliente.total_visitas < 10
      })
    }

    // Depois, enriquecer com perfil de consumo
    for (const perfil of clientesPerfil || []) {
      const cliente = clientesMap.get(perfil.telefone)
      if (cliente) {
        cliente.produtos_favoritos = perfil.produtos_favoritos || []
        cliente.categorias_favoritas = perfil.categorias_favoritas || []
        cliente.tags = perfil.tags || []
        cliente.dias_preferidos = perfil.dias_preferidos || []
      } else {
        clientesMap.set(perfil.telefone, {
          telefone: perfil.telefone,
          nome: perfil.nome,
          total_visitas: perfil.total_visitas,
          total_gasto: parseFloat(perfil.valor_total_consumo) || 0,
          ticket_medio: parseFloat(perfil.ticket_medio_consumo) || 0,
          ultima_visita: perfil.ultima_visita,
          produtos_favoritos: perfil.produtos_favoritos || [],
          categorias_favoritas: perfil.categorias_favoritas || [],
          tags: perfil.tags || [],
          dias_preferidos: perfil.dias_preferidos || [],
          is_vip: perfil.total_visitas >= 20,
          is_frequente: perfil.total_visitas >= 10 && perfil.total_visitas < 20,
          is_regular: perfil.total_visitas >= 5 && perfil.total_visitas < 10
        })
      }
    }

    // Converter para array e ordenar
    const clientes = Array.from(clientesMap.values())
      .sort((a, b) => b.total_visitas - a.total_visitas)

    // 4. Calcular estatísticas gerais
    const totalClientes = clientes.length
    const clientesVip = clientes.filter(c => c.is_vip).length
    const clientesFrequentes = clientes.filter(c => c.is_frequente).length
    const clientesRegulares = clientes.filter(c => c.is_regular).length

    // Produtos mais populares (agregando todos os clientes)
    const produtosPopulares = new Map<string, { quantidade: number; clientes: number }>()
    for (const cliente of clientes) {
      for (const produto of cliente.produtos_favoritos || []) {
        const key = produto.produto
        if (!produtosPopulares.has(key)) {
          produtosPopulares.set(key, { quantidade: 0, clientes: 0 })
        }
        const p = produtosPopulares.get(key)!
        p.quantidade += produto.quantidade
        p.clientes += 1
      }
    }

    const topProdutos = Array.from(produtosPopulares.entries())
      .sort((a, b) => b[1].clientes - a[1].clientes)
      .slice(0, 10)
      .map(([produto, data]) => ({
        produto,
        clientes: data.clientes,
        quantidade_total: Math.round(data.quantidade)
      }))

    // Tags mais comuns
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
      clientes: clientes.slice(0, 50), // Retornar top 50
      estatisticas: {
        total_clientes: totalClientes,
        clientes_vip: clientesVip,
        clientes_frequentes: clientesFrequentes,
        clientes_regulares: clientesRegulares,
        top_produtos: topProdutos,
        top_tags: topTags
      }
    })

  } catch (error) {
    console.error('❌ Erro na API de clientes VIP:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

