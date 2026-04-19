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

    // Obter parâmetros
    const { searchParams } = new URL(request.url)
    const telefone = searchParams.get('telefone')

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

    if (!telefone) {
      return NextResponse.json(
        { error: 'telefone é obrigatório' },
        { status: 400 }
      )
    }

    // Normalizar telefone para busca
    let telefoneNormalizado = telefone.replace(/\D/g, '')
    
    // Gerar variações do telefone
    const variacoes = new Set<string>()
    variacoes.add(telefone)
    variacoes.add(telefoneNormalizado)
    
    // Com/sem 9
    if (telefoneNormalizado.length === 11 && telefoneNormalizado.charAt(2) === '9') {
      variacoes.add(telefoneNormalizado.substring(0, 2) + telefoneNormalizado.substring(3))
    }
    if (telefoneNormalizado.length === 10) {
      variacoes.add(telefoneNormalizado.substring(0, 2) + '9' + telefoneNormalizado.substring(2))
    }

    // Buscar perfil do cliente
    const { data: perfil, error } = await supabase
      .from('cliente_perfil_consumo')
      .select('*')
      .eq('bar_id', barId)
      .in('telefone', Array.from(variacoes))
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Erro ao buscar perfil:', error)
      return NextResponse.json({ error: 'Erro ao buscar perfil' }, { status: 500 })
    }

    // Se não encontrou no cache, tentar buscar em tempo real
    if (!perfil) {
      // Buscar comandas do cliente (migrado para visitas)
      const { data: vendas } = await supabase
        .schema('silver')
        .from('cliente_visitas')
        .select('id, data_visita, cliente_nome')
        .eq('bar_id', barId)
        .in('cliente_fone', Array.from(variacoes))

      if (!vendas || vendas.length === 0) {
        return NextResponse.json({
          perfil: null,
          message: 'Cliente sem perfil de consumo identificado'
        })
      }

      // Extrair IDs e datas das visitas
      const visitaIds = [...new Set(vendas.map(v => v.id).filter(Boolean))]
      const datas = [...new Set(vendas.map(v => v.data_visita).filter(Boolean))]

      // Buscar itens consumidos (migrado para vendas_item)
      const { data: itensConsumo } = await supabase
        .from('vendas_item')
        .select('produto_desc, grupo_desc, quantidade, valor, data_venda')
        .eq('bar_id', barId)
        .in('data_venda', datas)

      if (!itensConsumo || itensConsumo.length === 0) {
        return NextResponse.json({
          perfil: null,
          message: 'Cliente sem consumo identificado'
        })
      }

      // Processar itens
      const produtosMap = new Map<string, { categoria: string; quantidade: number; vezes: number }>()
      const categoriasMap = new Map<string, { quantidade: number; valor: number }>()
      
      let totalItens = 0
      let totalValor = 0

      for (const item of itensConsumo) {
        const produto = item.produto_desc || 'Produto'
        const categoria = item.grupo_desc || 'Outros'
        const qtd = parseFloat(item.quantidade) || 0
        const valor = parseFloat(item.valor) || 0

        // Ignorar insumos
        if (produto.startsWith('[IN]') || produto.startsWith('[PD]') || produto.startsWith('[DD]')) continue

        totalItens += qtd
        totalValor += valor

        if (!produtosMap.has(produto)) {
          produtosMap.set(produto, { categoria, quantidade: 0, vezes: 0 })
        }
        const p = produtosMap.get(produto)!
        p.quantidade += qtd
        p.vezes += 1

        if (!categoriasMap.has(categoria)) {
          categoriasMap.set(categoria, { quantidade: 0, valor: 0 })
        }
        const c = categoriasMap.get(categoria)!
        c.quantidade += qtd
        c.valor += valor
      }

      // Montar perfil em tempo real
      const perfilTempoReal = {
        telefone: telefoneNormalizado,
        nome: vendas[0]?.cliente_nome || 'Cliente',
        total_visitas: datas.length,
        total_itens_consumidos: Math.round(totalItens),
        valor_total_consumo: Math.round(totalValor * 100) / 100,
        produtos_favoritos: Array.from(produtosMap.entries())
          .sort((a, b) => b[1].quantidade - a[1].quantidade)
          .slice(0, 10)
          .map(([produto, data]) => ({
            produto,
            categoria: data.categoria,
            quantidade: Math.round(data.quantidade * 100) / 100,
            vezes_pediu: data.vezes
          })),
        categorias_favoritas: Array.from(categoriasMap.entries())
          .sort((a, b) => b[1].quantidade - a[1].quantidade)
          .slice(0, 5)
          .map(([categoria, data]) => ({
            categoria,
            quantidade: Math.round(data.quantidade * 100) / 100,
            valor_total: Math.round(data.valor * 100) / 100
          })),
        tags: [],
        fonte: 'tempo_real'
      }

      return NextResponse.json({
        perfil: perfilTempoReal,
        fonte: 'tempo_real'
      })
    }

    return NextResponse.json({
      perfil,
      fonte: 'cache'
    })

  } catch (error) {
    console.error('❌ Erro na API de perfil de consumo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

