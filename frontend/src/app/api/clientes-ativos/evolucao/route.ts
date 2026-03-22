import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EvolucaoMensal {
  mes: string; // YYYY-MM
  mesLabel: string; // "Jan/25"
  totalClientes: number;
  novosClientes: number;
  clientesRetornantes: number;
  percentualNovos: number;
  percentualRetornantes: number;
  baseAtiva: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);
    const meses = parseInt(searchParams.get('meses') || '12'); // Últimos 12 meses por padrão

    // Calcular evolução usando SQL direto para performance
    const evolucaoMensal: EvolucaoMensal[] = [];

    // Processar cada mês
    const hoje = new Date();
    
    for (let i = 0; i < meses; i++) {
      const mesData = new Date();
      mesData.setMonth(hoje.getMonth() - (meses - i - 1));
      const ano = mesData.getFullYear();
      const mesNum = mesData.getMonth() + 1;
      const mesStr = `${ano}-${mesNum.toString().padStart(2, '0')}`;

      // Calcular início e fim do mês
      const inicioMes = `${mesStr}-01`;
      const fimMes = new Date(ano, mesNum, 0).toISOString().split('T')[0];
      
      // Calcular mês anterior para comparação de novos vs retornantes
      const mesAnteriorData = new Date(ano, mesNum - 2, 1);
      const inicioMesAnterior = mesAnteriorData.toISOString().split('T')[0];
      const fimMesAnterior = new Date(mesAnteriorData.getFullYear(), mesAnteriorData.getMonth() + 1, 0).toISOString().split('T')[0];

      // Usar a função SQL para calcular métricas
      const { data: metricas, error: errorMetricas } = await supabase.rpc('calcular_metricas_clientes', {
        p_bar_id: barId,
        p_data_inicio_atual: inicioMes,
        p_data_fim_atual: fimMes,
        p_data_inicio_anterior: inicioMesAnterior,
        p_data_fim_anterior: fimMesAnterior
      });

      if (errorMetricas) {
        console.error(`❌ Erro ao calcular métricas para ${mesStr}:`, errorMetricas);
        // Continuar mesmo com erro
        evolucaoMensal.push({
          mes: mesStr,
          mesLabel: mesData.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
          totalClientes: 0,
          novosClientes: 0,
          clientesRetornantes: 0,
          percentualNovos: 0,
          percentualRetornantes: 0,
          baseAtiva: 0,
        });
        continue;
      }

      const resultado = metricas?.[0] || { total_atual: 0, novos_atual: 0, retornantes_atual: 0 };
      const totalClientes = Number(resultado.total_atual) || 0;
      const novosClientes = Number(resultado.novos_atual) || 0;
      const clientesRetornantes = Number(resultado.retornantes_atual) || 0;

      // Calcular percentuais
      const percentualNovos = totalClientes > 0 ? (novosClientes / totalClientes) * 100 : 0;
      const percentualRetornantes = totalClientes > 0 ? (clientesRetornantes / totalClientes) * 100 : 0;

      // Calcular base ativa (clientes com 2+ visitas nos últimos 90 dias)
      const data90diasAtras = new Date(fimMes);
      data90diasAtras.setDate(data90diasAtras.getDate() - 90);
      const data90Str = data90diasAtras.toISOString().split('T')[0];

      const { data: baseAtivaResult, error: errorBaseAtiva } = await supabase.rpc('get_count_base_ativa', {
        p_bar_id: barId,
        p_data_inicio: data90Str,
        p_data_fim: fimMes
      });

      const baseAtiva = Number(baseAtivaResult) || 0;

      // Formatar label do mês
      const mesLabel = mesData.toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      }).replace('.', '');

      evolucaoMensal.push({
        mes: mesStr,
        mesLabel,
        totalClientes,
        novosClientes,
        clientesRetornantes,
        percentualNovos: Math.round(percentualNovos * 100) / 100,
        percentualRetornantes: Math.round(percentualRetornantes * 100) / 100,
        baseAtiva,
      });
    }

    return NextResponse.json({
      success: true,
      data: evolucaoMensal,
      meta: {
        meses: meses,
        barId: barId,
      },
    });
  } catch (error) {
    console.error('❌ Erro na API de evolução de clientes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
