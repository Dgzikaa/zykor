import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

const supabase = createServiceRoleClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bar_id,
      receita_codigo,
      receita_nome,
      receita_categoria,
      criado_por_nome,
      inicio_producao,
      fim_producao,
      peso_bruto_proteina,
      peso_limpo_proteina,
      rendimento_real,
      rendimento_esperado,
      observacoes,
      insumo_chefe_id,
      insumo_chefe_nome,
      peso_insumo_chefe,
      status,
      insumos,
    } = body;

    // Validações
    if (!bar_id || !receita_codigo || !receita_nome) {
      return NextResponse.json(
        { success: false, error: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    // 1. Salvar produção principal
    const { data: producao, error: errorProducao } = await supabase
      .from('producoes')
      .insert({
        bar_id,
        receita_codigo,
        receita_nome,
        receita_categoria,
        criado_por_nome,
        inicio_producao,
        fim_producao,
        peso_bruto_proteina,
        peso_limpo_proteina,
        rendimento_real,
        rendimento_esperado,
        observacoes,
        insumo_chefe_id,
        insumo_chefe_nome,
        peso_insumo_chefe,
        status,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (errorProducao) {
      console.error('❌ Erro ao salvar produção:', errorProducao);
      return NextResponse.json(
        { success: false, error: errorProducao.message },
        { status: 500 }
      );
    }

    // 2. Calcular aderência à receita
    let percentualAderencia = 100;
    let insumosSalvos = 0;

    if (insumos && insumos.length > 0) {
      // Salvar insumos utilizados
      const insumosParaSalvar = insumos.map((insumo: any) => ({
        producao_id: producao.id,
        insumo_id: insumo.id,
        insumo_codigo: insumo.codigo,
        insumo_nome: insumo.nome,
        quantidade_necessaria: insumo.quantidade_necessaria || 0,
        quantidade_calculada: insumo.quantidade_calculada || insumo.quantidade_necessaria || 0,
        quantidade_real: insumo.quantidade_real || 0,
        unidade_medida: insumo.unidade_medida,
        is_chefe: insumo.is_chefe || false,
      }));

      const { data: insumosData, error: errorInsumos } = await supabase
        .from('producoes_insumos')
        .insert(insumosParaSalvar)
        .select();

      if (errorInsumos) {
        console.error('⚠️ Erro ao salvar insumos:', errorInsumos);
      } else {
        insumosSalvos = insumosData?.length || 0;
      }

      // Calcular aderência baseado nos insumos
      const totalDesvios = insumos.reduce((acc: number, insumo: any) => {
        const necessaria = insumo.quantidade_calculada || insumo.quantidade_necessaria || 0;
        const real = insumo.quantidade_real || 0;
        
        if (necessaria === 0) return acc;
        
        const desvio = Math.abs(real - necessaria) / necessaria;
        return acc + desvio;
      }, 0);

      const desvioMedio = totalDesvios / insumos.length;
      percentualAderencia = Math.max(0, Math.min(100, (1 - desvioMedio) * 100));
    }

    // 3. Atualizar produção com aderência
    await supabase
      .from('producoes')
      .update({ percentual_aderencia_receita: percentualAderencia })
      .eq('id', producao.id);

    return NextResponse.json({
      success: true,
      data: {
        ...producao,
        percentual_aderencia_receita: percentualAderencia,
        insumos_salvos: insumosSalvos,
      },
    });
  } catch (error) {
    console.error('❌ Erro no POST producoes:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bar_id = searchParams.get('bar_id');

    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('producoes')
      .select('*')
      .eq('bar_id', bar_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar produções:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro no GET producoes:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

