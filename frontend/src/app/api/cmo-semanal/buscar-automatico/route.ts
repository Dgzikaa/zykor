import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST - Buscar dados automáticos para CMO (Freelas + CMA)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, data_inicio, data_fim } = body;

    if (!bar_id || !data_inicio || !data_fim) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    const resultado = {
      freelas: 0,
      cma_alimentacao: 0,
    };

    // 1. BUSCAR FREELAS DO NIBO
    try {
      const { data: agendamentos, error } = await supabase
        .from('nibo_agendamentos')
        .select('categoria_nome, valor')
        .eq('bar_id', bar_id)
        .eq('tipo', 'Debit')
        .gte('data_competencia', data_inicio)
        .lte('data_competencia', data_fim);

      if (!error && agendamentos) {
        // Filtrar categorias que contenham "FREELA" (case-insensitive)
        resultado.freelas = agendamentos
          .filter(item => {
            const cat = (item.categoria_nome || '').toUpperCase();
            return cat.includes('FREELA');
          })
          .reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0);

        console.log(`✅ Freelas: R$ ${resultado.freelas.toFixed(2)}`);
      }
    } catch (err) {
      console.error('Erro ao buscar freelas:', err);
    }

    // 2. BUSCAR CMA (da tabela cmv_semanal)
    try {
      // Calcular semana ISO
      const dataInicioDate = new Date(data_inicio + 'T12:00:00Z');
      const d = new Date(Date.UTC(dataInicioDate.getFullYear(), dataInicioDate.getMonth(), dataInicioDate.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      const ano = d.getUTCFullYear();

      const { data: cmvData, error: cmvError } = await supabase
        .from('cmv_semanal')
        .select('cma_total')
        .eq('bar_id', bar_id)
        .eq('ano', ano)
        .eq('semana', semana)
        .single();

      if (!cmvError && cmvData) {
        resultado.cma_alimentacao = cmvData.cma_total || 0;
        console.log(`✅ CMA Alimentação: R$ ${resultado.cma_alimentacao.toFixed(2)}`);
      } else {
        console.log('⚠️ CMA não encontrado na tabela cmv_semanal');
      }
    } catch (err) {
      console.error('Erro ao buscar CMA:', err);
    }

    console.log(`📊 Total Automático: Freelas R$ ${resultado.freelas.toFixed(2)} + CMA R$ ${resultado.cma_alimentacao.toFixed(2)}`);

    return NextResponse.json({
      success: true,
      data: resultado,
      message: 'Dados automáticos carregados',
    });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
