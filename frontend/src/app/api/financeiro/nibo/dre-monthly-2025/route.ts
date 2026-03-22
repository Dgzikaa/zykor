import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');

    // Buscar dados mensais de 2025 da view_dre
    const { data: dreData, error: dreError } = await supabase
      .from('view_dre')
      .select('*')
      .eq('ano', 2025)
      .order('mes');

    if (dreError) {
      console.error('Erro ao buscar view_dre:', dreError);
      return NextResponse.json(
        { error: 'Erro ao buscar dados da DRE' },
        { status: 500 }
      );
    }

    // Buscar lançamentos manuais de 2025
    const { data: lancamentosManuais, error: manuaisError } = await supabase
      .from('dre_manual')
      .select('*')
      .gte('data_competencia', '2025-01-01')
      .lt('data_competencia', '2026-01-01');

    if (manuaisError) {
      console.error('Erro ao buscar lançamentos manuais:', manuaisError);
    }

    // Agrupar por mês
    const dadosPorMes: Record<number, { receitas: number; custos: number; ebitda: number }> = {};

    // Inicializar todos os meses
    for (let i = 1; i <= 12; i++) {
      dadosPorMes[i] = { receitas: 0, custos: 0, ebitda: 0 };
    }

    // Processar dados da view_dre
    dreData?.forEach(item => {
      const mes = item.mes;
      const valor = parseFloat(item.total_valor) || 0;
      const macro = item.categoria_macro;

      if (dadosPorMes[mes]) {
        if (macro === 'Receita' || macro === 'Não Operacionais') {
          dadosPorMes[mes].receitas += valor;
        } else if (macro !== 'Investimentos' && macro !== 'Sócios') {
          dadosPorMes[mes].custos += valor;
        }
      }
    });

    // Processar lançamentos manuais
    lancamentosManuais?.forEach(item => {
      const data = new Date(item.data_competencia);
      const mes = data.getMonth() + 1;
      const valor = parseFloat(item.valor) || 0;
      const macro = item.categoria_macro;

      if (dadosPorMes[mes]) {
        if (macro === 'Receita' || macro === 'Não Operacionais' || valor > 0) {
          dadosPorMes[mes].receitas += Math.abs(valor);
        } else if (macro !== 'Investimentos' && macro !== 'Sócios') {
          dadosPorMes[mes].custos += Math.abs(valor);
        }
      }
    });

    // Calcular EBITDA para cada mês
    Object.keys(dadosPorMes).forEach(mes => {
      const mesNum = parseInt(mes);
      dadosPorMes[mesNum].ebitda = dadosPorMes[mesNum].receitas - dadosPorMes[mesNum].custos;
    });

    // Converter para array no formato esperado
    const monthlyData = Object.entries(dadosPorMes)
      .filter(([_, dados]) => dados.receitas > 0 || dados.custos > 0)
      .map(([mes, dados]) => ({
        month: parseInt(mes),
        year: 2025,
        monthName: MESES[parseInt(mes) - 1],
        receitas: dados.receitas,
        custos: dados.custos,
        ebitda: dados.ebitda,
      }))
      .sort((a, b) => a.month - b.month);

    return NextResponse.json({
      success: true,
      monthlyData,
      year: 2025,
      totalMeses: monthlyData.length,
    });
  } catch (error) {
    console.error('Erro ao buscar DRE mensal 2025:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
