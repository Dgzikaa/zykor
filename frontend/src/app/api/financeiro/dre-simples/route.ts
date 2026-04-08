import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ano = searchParams.get('ano') || new Date().getFullYear().toString();
    const mes = searchParams.get('mes') || (new Date().getMonth() + 1).toString();
    const barId = searchParams.get('bar_id');

    // Buscar dados da view_dre (filtrado por bar_id quando disponível)
    let dreQuery = supabase
      .from('view_dre')
      .select('*')
      .eq('ano', parseInt(ano))
      .eq('mes', parseInt(mes));

    if (barId) {
      dreQuery = dreQuery.eq('bar_id', parseInt(barId));
    }

    const { data: dreData, error: dreError } = await dreQuery;

    if (dreError) {
      console.error('Erro ao buscar view_dre:', dreError);
      return NextResponse.json(
        { error: 'Erro ao buscar dados da DRE' },
        { status: 500 }
      );
    }

    // Buscar lançamentos manuais do mês
    const { data: lancamentosManuais, error: manuaisError } = await supabase
      .from('dre_manual')
      .select('*')
      .gte('data_competencia', `${ano}-${mes.padStart(2, '0')}-01`)
      .lt('data_competencia', mes === '12' 
        ? `${parseInt(ano) + 1}-01-01` 
        : `${ano}-${(parseInt(mes) + 1).toString().padStart(2, '0')}-01`)
      .order('data_competencia', { ascending: false });

    if (manuaisError) {
      console.error('Erro ao buscar lançamentos manuais:', manuaisError);
    }

    // Processar dados para formato esperado pela página
    const categorias = dreData?.map(item => ({
      categoria_dre: item.categoria_macro,
      valor_total: parseFloat(item.total_valor) || 0,
      registros: item.total_registros,
      origem: item.origem,
    })) || [];

    // Calcular resumo
    const receitas = categorias
      .filter(c => c.categoria_dre === 'Receita' || c.categoria_dre === 'Não Operacionais')
      .reduce((sum, c) => sum + c.valor_total, 0);

    const custos = categorias
      .filter(c => ['Custos Variáveis', 'Custo insumos (CMV)'].includes(c.categoria_dre))
      .reduce((sum, c) => sum + c.valor_total, 0);

    const despesas = categorias
      .filter(c => !['Receita', 'Não Operacionais', 'Custos Variáveis', 'Custo insumos (CMV)', 'Investimentos', 'Sócios'].includes(c.categoria_dre))
      .reduce((sum, c) => sum + c.valor_total, 0);

    const lucroOperacional = receitas - custos - despesas;

    return NextResponse.json({
      success: true,
      categorias,
      resumo: {
        total_receitas: receitas,
        total_custos: custos,
        total_despesas: despesas,
        lucro_operacional: lucroOperacional,
      },
      lancamentos_manuais: lancamentosManuais || [],
      periodo: { ano: parseInt(ano), mes: parseInt(mes) },
    });
  } catch (error) {
    console.error('Erro ao buscar DRE:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST para criar lançamento manual
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      data_competencia,
      descricao,
      valor,
      categoria,
      categoria_macro,
      observacoes,
      usuario_criacao,
    } = body;

    if (!data_competencia || !descricao || valor === undefined || !categoria || !categoria_macro) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('dre_manual')
      .insert({
        data_competencia,
        descricao,
        valor: parseFloat(valor),
        categoria,
        categoria_macro,
        observacoes,
        usuario_criacao: usuario_criacao || 'Sistema',
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar lançamento manual:', error);
      return NextResponse.json(
        { error: 'Erro ao criar lançamento' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lancamento: data,
    });
  } catch (error) {
    console.error('Erro ao criar lançamento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE para remover lançamento manual
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID do lançamento é obrigatório' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('dre_manual')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      console.error('Erro ao deletar lançamento:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar lançamento' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lançamento removido com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar lançamento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
