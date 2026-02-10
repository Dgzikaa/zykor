import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { produto_codigo, peso_limpo_g, bar_id } = body;

    if (!produto_codigo || !peso_limpo_g || !bar_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'produto_codigo, peso_limpo_g e bar_id são obrigatórios',
        },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao conectar com banco',
        },
        { status: 500 }
      );
    }

    // 1. Buscar produto com suas receitas
    const { data: produto, error: produtoError } = await supabase
      .from('produtos')
      .select(
        `
        id,
        codigo,
        nome,
        categoria,
        receitas (
          id,
          quantidade_necessaria,
          custo_unitario,
          insumos (
            id,
            codigo,
            nome,
            categoria,
            unidade_medida,
            custo_por_unidade
          )
        )
      `
      )
      .eq('bar_id', bar_id)
      .eq('codigo', produto_codigo)
      .single();

    if (produtoError || !produto) {
      console.error('❌ Erro ao buscar produto:', produtoError);
      return NextResponse.json(
        {
          success: false,
          error: 'Produto não encontrado: ' + produto_codigo,
        },
        { status: 404 }
      );
    }

    const produtoData = produto as any;
    if (!produtoData.receitas || produtoData.receitas.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Produto não possui receitas cadastradas',
        },
        { status: 404 }
      );
    }

    // 2. Calcular insumos proporcionalmente
    const pesoLimpo = parseFloat(peso_limpo_g);
    const pesoReferencia = 1000; // Base padrão 1kg
    const fatorProporcional = pesoLimpo / pesoReferencia;

    const insumosCalculados = (produtoData.receitas || []).map((receita: any) => {
      const quantidadePlanejada =
        receita.quantidade_necessaria * fatorProporcional;

      return {
        insumo_id: receita.insumos.id,
        codigo: receita.insumos.codigo,
        nome: receita.insumos.nome,
        categoria: receita.insumos.categoria,
        unidade_medida: receita.insumos.unidade_medida,
        quantidade_padrao: receita.quantidade_necessaria,
        quantidade_planejada: quantidadePlanejada,
        quantidade_real: quantidadePlanejada, // Iniciar igual ao planejado
        custo_unitario: receita.custo_unitario,
        custo_total: quantidadePlanejada * receita.custo_unitario,
        editado: false,
      };
    });

    console.log(
      `🧮 Calculados ${insumosCalculados.length} insumos para ${pesoLimpo}g`
    );

    return NextResponse.json({
      success: true,
      produto: {
        id: produtoData.id,
        codigo: produtoData.codigo,
        nome: produtoData.nome,
        categoria: produtoData.categoria,
        quantidade_base: pesoReferencia,
      },
      calculo: {
        peso_limpo_g: pesoLimpo,
        peso_referencia_g: pesoReferencia,
        fator_proporcional: fatorProporcional,
        calculo_detalhado: `Base ${pesoReferencia}g → Produzindo ${pesoLimpo}g (${(fatorProporcional * 100).toFixed(1)}%)`,
      },
      insumos: insumosCalculados,
      estatisticas: {
        total_insumos: insumosCalculados.length,
        custo_total_planejado: insumosCalculados.reduce(
          (total: number, insumo: any) => total + insumo.custo_total,
          0
        ),
      },
    });
  } catch (error) {
    console.error('❌ Erro ao calcular insumos:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno: ' + (error as Error).message,
      },
      { status: 500 }
    );
  }
}
