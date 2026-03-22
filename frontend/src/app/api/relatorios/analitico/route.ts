import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bar_id = searchParams.get('bar_id') || '3';
    const data_inicio = searchParams.get('data_inicio');
    const data_fim = searchParams.get('data_fim');
    const produto = searchParams.get('produto');
    const grupo = searchParams.get('grupo');
    const usuario = searchParams.get('usuario');
    const limit = parseInt(searchParams.get('limit') || '1000');

    // Excluir categorias de compras/estoque por padrão - migrado para vendas_item
    let query = (supabase as any)
      .from('vendas_item')
      .select('*')
      .eq('bar_id', parseInt(bar_id))
      .not('grupo_desc', 'in', '("Mercadorias- Compras","Insumos","Uso Interno")')
      .limit(limit);

    // Aplicar filtros
    if (data_inicio) {
      query = query.gte('data_venda', data_inicio);
    }
    if (data_fim) {
      query = query.lte('data_venda', data_fim);
    }
    if (produto) {
      query = query.ilike('produto_desc', `%${produto}%`);
    }
    if (grupo) {
      query = query.ilike('grupo_desc', `%${grupo}%`);
    }
    // usuario (usr_lancou) não existe em vendas_item - ignorar filtro

    const { data, error } = await query as { data: any[] | null; error: any };

    if (error) {
      console.error('❌ Erro ao buscar dados analíticos:', error);
      return NextResponse.json(
        { error: `Erro ao buscar dados: ${error.message}` },
        { status: 500 }
      );
    }

    // Calcular estatísticas
    const estatisticas = {
      total_registros: data?.length || 0,
      total_vendas: data?.reduce((sum, item) => sum + (item.valor || 0), 0) || 0,
      total_itens: data?.reduce((sum, item) => sum + (item.quantidade || 0), 0) || 0,
      produtos_unicos: [...new Set(data?.map(item => item.produto_desc).filter(Boolean))].length,
      grupos_unicos: [...new Set(data?.map(item => item.grupo_desc).filter(Boolean))].length,
      usuarios_unicos: 0 // usr_lancou não existe em vendas_item
    };

    // Top produtos por valor
    const produtosPorValor = data?.reduce((acc, item) => {
      const produto = item.produto_desc || 'Sem descrição';
      if (!acc[produto]) {
        acc[produto] = { valor: 0, quantidade: 0, vendas: 0 };
      }
      acc[produto].valor += item.valor || 0;
      acc[produto].quantidade += item.quantidade || 0;
      acc[produto].vendas += 1;
      return acc;
    }, {} as Record<string, { valor: number; quantidade: number; vendas: number }>);

    const topProdutos = Object.entries(produtosPorValor || {})
      .map(([produto, stats]) => ({
        produto,
        valor_total: (stats as { valor: number; quantidade: number; vendas: number }).valor,
        quantidade_total: (stats as { valor: number; quantidade: number; vendas: number }).quantidade,
        total_vendas: (stats as { valor: number; quantidade: number; vendas: number }).vendas
      }))
      .sort((a, b) => b.valor_total - a.valor_total)
      .slice(0, 10);

    // Top grupos por valor
    const gruposPorValor = data?.reduce((acc, item) => {
      const grupo = item.grupo_desc || 'Sem grupo';
      if (!acc[grupo]) {
        acc[grupo] = { valor: 0, quantidade: 0, vendas: 0 };
      }
      acc[grupo].valor += item.valor || 0;
      acc[grupo].quantidade += item.quantidade || 0;
      acc[grupo].vendas += 1;
      return acc;
    }, {} as Record<string, { valor: number; quantidade: number; vendas: number }>);

    const topGrupos = Object.entries(gruposPorValor || {})
      .map(([grupo, stats]) => ({
        grupo,
        valor_total: (stats as { valor: number; quantidade: number; vendas: number }).valor,
        quantidade_total: (stats as { valor: number; quantidade: number; vendas: number }).quantidade,
        total_vendas: (stats as { valor: number; quantidade: number; vendas: number }).vendas
      }))
      .sort((a, b) => b.valor_total - a.valor_total)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      tipo: 'analitico',
      bar_id: parseInt(bar_id),
      estatisticas,
      top_produtos: topProdutos,
      top_grupos: topGrupos,
      dados: data,
      filtros: {
        data_inicio,
        data_fim,
        produto,
        grupo,
        usuario,
        limit
      }
    });

  } catch (error) {
    console.error('❌ Erro na API de relatórios analíticos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 
