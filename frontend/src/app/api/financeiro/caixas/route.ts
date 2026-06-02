import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

// Formatar valor em BRL
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // 'investimentos' | 'impostos' | 'terceiros' | 'futuros' | 'resumo'
    const barId = searchParams.get('bar_id') || '3';
    const ano = searchParams.get('ano') || new Date().getFullYear().toString();

    // RESUMO GERAL - Dashboard
    if (!tipo || tipo === 'resumo') {
      // Caixa Investimentos
      const { data: invEntradas } = await supabase
        .from('caixa_investimentos_movimentos')
        .select('valor')
        .eq('bar_id', parseInt(barId))
        .eq('tipo', 'entrada');

      const { data: invSaidas } = await supabase
        .from('caixa_investimentos_movimentos')
        .select('valor')
        .eq('bar_id', parseInt(barId))
        .eq('tipo', 'saida');

      const totalInvEntradas = invEntradas?.reduce((sum, item) => sum + parseFloat(item.valor), 0) || 0;
      const totalInvSaidas = invSaidas?.reduce((sum, item) => sum + parseFloat(item.valor), 0) || 0;

      // Caixa Impostos
      const { data: impEntradas } = await supabase
        .from('caixa_impostos_movimentos')
        .select('valor')
        .eq('bar_id', parseInt(barId))
        .eq('tipo', 'entrada');

      const { data: impSaidas } = await supabase
        .from('caixa_impostos_movimentos')
        .select('valor')
        .eq('bar_id', parseInt(barId))
        .eq('tipo', 'saida');

      const totalImpEntradas = impEntradas?.reduce((sum, item) => sum + parseFloat(item.valor), 0) || 0;
      const totalImpSaidas = impSaidas?.reduce((sum, item) => sum + parseFloat(item.valor), 0) || 0;

      // Valores com Terceiros
      const { data: terceiros } = await supabase
        .from('caixa_valores_terceiros')
        .select('*')
        .eq('bar_id', parseInt(barId));

      const totalTerceiros = terceiros?.reduce((sum, item) => sum + parseFloat(item.valor), 0) || 0;

      // Recebimentos Futuros
      const { data: futuros } = await supabase
        .from('caixa_recebimentos_futuros')
        .select('*')
        .eq('bar_id', parseInt(barId))
        .eq('status', 'pendente');

      const totalFuturos = futuros?.reduce((sum, item) => sum + parseFloat(item.valor), 0) || 0;

      // Cálculos
      const saldoInvestimentos = totalInvEntradas - totalInvSaidas;
      const saldoImpostos = totalImpEntradas - totalImpSaidas;
      const saldoTotal = saldoInvestimentos + saldoImpostos;
      const saldoDisponivel = saldoTotal - totalTerceiros;
      const saldoProjetado = saldoDisponivel + totalFuturos;

      return NextResponse.json({
        success: true,
        resumo: {
          caixa_investimentos: {
            entradas: totalInvEntradas,
            saidas: totalInvSaidas,
            saldo: saldoInvestimentos,
            percentual_saida: totalInvEntradas > 0 ? (totalInvSaidas / totalInvEntradas * 100) : 0,
          },
          caixa_impostos: {
            entradas: totalImpEntradas,
            saidas: totalImpSaidas,
            saldo: saldoImpostos,
            percentual_saida: totalImpEntradas > 0 ? (totalImpSaidas / totalImpEntradas * 100) : 0,
          },
          valores_terceiros: {
            total: totalTerceiros,
            quantidade: terceiros?.length || 0,
            items: terceiros || [],
          },
          recebimentos_futuros: {
            total: totalFuturos,
            quantidade: futuros?.length || 0,
            items: futuros || [],
          },
          consolidado: {
            saldo_total: saldoTotal,
            saldo_disponivel: saldoDisponivel,
            saldo_projetado: saldoProjetado,
          },
        },
      });
    }

    // MOVIMENTOS DE INVESTIMENTOS
    if (tipo === 'investimentos') {
      const { data, error } = await supabase
        .from('caixa_investimentos_movimentos')
        .select('*')
        .eq('bar_id', parseInt(barId))
        .order('data', { ascending: false, nullsFirst: false });

      if (error) throw error;

      const entradas = data?.filter(m => m.tipo === 'entrada') || [];
      const saidas = data?.filter(m => m.tipo === 'saida') || [];
      const totalEntradas = entradas.reduce((sum, item) => sum + parseFloat(item.valor), 0);
      const totalSaidas = saidas.reduce((sum, item) => sum + parseFloat(item.valor), 0);

      return NextResponse.json({
        success: true,
        movimentos: data,
        resumo: {
          total_entradas: totalEntradas,
          total_saidas: totalSaidas,
          saldo: totalEntradas - totalSaidas,
          percentual_saida: totalEntradas > 0 ? (totalSaidas / totalEntradas * 100) : 0,
        },
      });
    }

    // MOVIMENTOS DE IMPOSTOS
    if (tipo === 'impostos') {
      const { data, error } = await supabase
        .from('caixa_impostos_movimentos')
        .select('*')
        .eq('bar_id', parseInt(barId))
        .order('data', { ascending: false, nullsFirst: false });

      if (error) throw error;

      const entradas = data?.filter(m => m.tipo === 'entrada') || [];
      const saidas = data?.filter(m => m.tipo === 'saida') || [];
      const totalEntradas = entradas.reduce((sum, item) => sum + parseFloat(item.valor), 0);
      const totalSaidas = saidas.reduce((sum, item) => sum + parseFloat(item.valor), 0);

      return NextResponse.json({
        success: true,
        movimentos: data,
        resumo: {
          total_entradas: totalEntradas,
          total_saidas: totalSaidas,
          saldo: totalEntradas - totalSaidas,
          percentual_saida: totalEntradas > 0 ? (totalSaidas / totalEntradas * 100) : 0,
        },
      });
    }

    // VALORES COM TERCEIROS
    if (tipo === 'terceiros') {
      const { data, error } = await supabase
        .from('caixa_valores_terceiros')
        .select('*')
        .eq('bar_id', parseInt(barId))
        .order('data_atualizacao', { ascending: false });

      if (error) throw error;

      const total = data?.reduce((sum, item) => sum + parseFloat(item.valor), 0) || 0;

      // Agrupar por tipo
      const porTipo = data?.reduce((acc, item) => {
        const tipo = item.tipo || 'outros';
        if (!acc[tipo]) {
          acc[tipo] = { total: 0, items: [] };
        }
        acc[tipo].total += parseFloat(item.valor);
        acc[tipo].items.push(item);
        return acc;
      }, {} as Record<string, { total: number; items: any[] }>) || {};

      return NextResponse.json({
        success: true,
        valores_terceiros: data,
        total,
        por_tipo: porTipo,
      });
    }

    // RECEBIMENTOS FUTUROS
    if (tipo === 'futuros') {
      const { data, error } = await supabase
        .from('caixa_recebimentos_futuros')
        .select('*')
        .eq('bar_id', parseInt(barId))
        .order('data_prevista', { ascending: true });

      if (error) throw error;

      const pendentes = data?.filter(r => r.status === 'pendente') || [];
      const recebidos = data?.filter(r => r.status === 'recebido') || [];
      const totalPendente = pendentes.reduce((sum, item) => sum + parseFloat(item.valor), 0);
      const totalRecebido = recebidos.reduce((sum, item) => sum + parseFloat(item.valor), 0);

      return NextResponse.json({
        success: true,
        recebimentos: data,
        resumo: {
          total_pendente: totalPendente,
          total_recebido: totalRecebido,
          quantidade_pendente: pendentes.length,
        },
      });
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao buscar dados de caixa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar novo movimento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tabela, ...dados } = body;

    if (!tabela || !dados.tipo || !dados.valor) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando (tabela, tipo, valor)' },
        { status: 400 }
      );
    }

    const tabelasValidas = [
      'caixa_investimentos_movimentos',
      'caixa_impostos_movimentos',
      'caixa_valores_terceiros',
      'caixa_recebimentos_futuros',
    ];

    if (!tabelasValidas.includes(tabela)) {
      return NextResponse.json(
        { error: 'Tabela inválida' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from(tabela)
      .insert(dados)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      movimento: data,
    });
  } catch (error) {
    console.error('Erro ao criar movimento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar movimento
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tabela, id, ...dados } = body;

    if (!tabela || !id) {
      return NextResponse.json(
        { error: 'Tabela e ID são obrigatórios' },
        { status: 400 }
      );
    }

    const tabelasValidas = [
      'caixa_investimentos_movimentos',
      'caixa_impostos_movimentos',
      'caixa_valores_terceiros',
      'caixa_recebimentos_futuros',
    ];

    if (!tabelasValidas.includes(tabela)) {
      return NextResponse.json(
        { error: 'Tabela inválida' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from(tabela)
      .update({ ...dados, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      movimento: data,
    });
  } catch (error) {
    console.error('Erro ao atualizar movimento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Remover movimento
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tabela = searchParams.get('tabela');
    const id = searchParams.get('id');

    if (!tabela || !id) {
      return NextResponse.json(
        { error: 'Tabela e ID são obrigatórios' },
        { status: 400 }
      );
    }

    const tabelasValidas = [
      'caixa_investimentos_movimentos',
      'caixa_impostos_movimentos',
      'caixa_valores_terceiros',
      'caixa_recebimentos_futuros',
    ];

    if (!tabelasValidas.includes(tabela)) {
      return NextResponse.json(
        { error: 'Tabela inválida' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from(tabela)
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Registro removido com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar movimento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
