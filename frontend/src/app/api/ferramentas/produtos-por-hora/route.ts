import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ProdutoPorHora {
  hora: number;
  produto_id: string;
  produto_descricao: string;
  grupo_descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  is_banda: boolean;
}

interface VendaPorHorario {
  hora: number;
  total_quantidade: number;
  total_valor: number;
  produtos_diferentes: Set<string>;
}

export async function POST(request: NextRequest) {
  try {
    const { data_selecionada, bar_id } = await request.json();

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!data_selecionada) {
      return NextResponse.json(
        { error: 'data_selecionada é obrigatória' },
        { status: 400 }
      );
    }

    // 🎯 Usando vendas_item como fonte principal para contagem de produtos
    // Excluir categorias que são compras/estoque, não vendas
    const { data: dadosAnaliticos, error: errorAnalitico } = await supabase
      .schema('silver' as never)
      .from('vendas_item')
      .select(`
        produto_desc,
        grupo_desc,
        quantidade,
        valor
      `)
      .eq('data_venda', data_selecionada)
      .eq('bar_id', bar_id)
      .not('grupo_desc', 'in', '(Mercadorias- Compras,Insumos,Uso Interno)')
      .order('quantidade', { ascending: false });

    if (errorAnalitico) {
      console.error('Erro ao buscar dados analíticos:', errorAnalitico);
      return NextResponse.json(
        { error: 'Erro ao buscar dados do banco' },
        { status: 500 }
      );
    }

    // 🔄 Usar vendas_item como fonte principal de produtos
    let produtosPorHoraEnriquecidos: ProdutoPorHora[] = [];
    const produtosAgregados = new Map<string, ProdutoPorHora>();
    
    dadosAnaliticos?.forEach(item => {
      const prodDesc = item.produto_desc?.toLowerCase() || '';
      const isBanda = prodDesc.includes('[banda]') || prodDesc.includes('banda');
      const key = item.produto_desc;
      
      if (produtosAgregados.has(key)) {
        const existing = produtosAgregados.get(key);
        if (existing) {
          existing.quantidade += parseFloat(item.quantidade) || 0;
          existing.valor_total += parseFloat(item.valor) || 0;
        }
      } else {
        produtosAgregados.set(key, {
          hora: 0,
          produto_id: item.produto_desc || '',
          produto_descricao: item.produto_desc || '',
          grupo_descricao: item.grupo_desc || '',
          quantidade: parseFloat(item.quantidade) || 0,
          valor_unitario: parseFloat(item.valor) || 0,
          valor_total: parseFloat(item.valor) || 0,
          is_banda: isBanda
        });
      }
    });

    produtosPorHoraEnriquecidos = Array.from(produtosAgregados.values());

    // Calcular estatísticas
    const totalProdutos = produtosPorHoraEnriquecidos?.reduce((sum, item) => sum + item.quantidade, 0) || 0;
    const totalValor = produtosPorHoraEnriquecidos?.reduce((sum, item) => sum + item.valor_total, 0) || 0;
    const produtosUnicos = new Set(produtosPorHoraEnriquecidos?.map(item => item.produto_id) || []).size;
    const gruposUnicos = new Set(produtosPorHoraEnriquecidos?.map(item => item.grupo_descricao).filter(Boolean) || []).size;

    // Encontrar horário e produto de pico
    const produtosPorQuantidade = [...(produtosPorHoraEnriquecidos || [])].sort((a, b) => b.quantidade - a.quantidade);
    const produtoPico = produtosPorQuantidade[0];

    // 🎯 Calcular horário de pico (usando vendas_item, sem informação de hora específica)
    let horarioPico: VendaPorHorario | null = null;
    const produtosNaoBanda = produtosPorHoraEnriquecidos?.filter(item => !item.is_banda) || [];
    
    const vendasPorHorario = produtosNaoBanda.reduce((acc, item) => {
      if (!acc[item.hora]) {
        acc[item.hora] = {
          hora: item.hora,
          total_quantidade: 0,
          total_valor: 0,
          produtos_diferentes: new Set<string>()
        };
      }
      acc[item.hora].total_quantidade += item.quantidade;
      acc[item.hora].total_valor += item.valor_total;
      acc[item.hora].produtos_diferentes.add(item.produto_id);
      return acc;
    }, {} as Record<number, VendaPorHorario>);

    const horariosSorted = Object.values(vendasPorHorario)
      .sort((a, b) => b.total_quantidade - a.total_quantidade);
    horarioPico = horariosSorted.length > 0 ? horariosSorted[0] : null;

    // Top 5 produtos
    const topProdutos = produtosPorHoraEnriquecidos?.reduce((acc, item) => {
      const key = item.produto_descricao;
      if (!acc[key]) {
        acc[key] = {
          produto_descricao: item.produto_descricao,
          grupo_descricao: item.grupo_descricao,
          total_quantidade: 0,
          total_valor: 0
        };
      }
      acc[key].total_quantidade += item.quantidade;
      acc[key].total_valor += item.valor_total;
      return acc;
    }, {} as Record<string, any>) || {};

    const top5Produtos = Object.values(topProdutos)
      .sort((a: any, b: any) => b.total_quantidade - a.total_quantidade)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data_selecionada,
      dados: produtosPorHoraEnriquecidos || [],
      estatisticas: {
        total_produtos_vendidos: totalProdutos,
        total_valor_vendas: totalValor,
        produtos_unicos: produtosUnicos,
        grupos_unicos: gruposUnicos,
        produto_pico: produtoPico ? {
          produto: produtoPico.produto_descricao,
          grupo: produtoPico.grupo_descricao,
          quantidade: produtoPico.quantidade,
          hora: produtoPico.hora,
          valor: produtoPico.valor_total
        } : null,
        horario_pico: horarioPico ? {
          hora: horarioPico.hora,
          total_quantidade: horarioPico.total_quantidade,
          total_valor: horarioPico.total_valor,
          produtos_diferentes: horarioPico.produtos_diferentes.size
        } : null,
        top_5_produtos: top5Produtos
      }
    });

  } catch (error) {
    console.error('Erro na API produtos-por-hora:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
