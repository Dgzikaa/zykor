import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');

    // 1. CMV POR DIA DA SEMANA
    const { data: cmvSemanal } = await supabase
      .from('cmv_semanal')
      .select('data_inicio, data_fim, cmv_percentual, faturamento_liquido, consumo_total')
      .eq('bar_id', barId)
      .gte('cmv_percentual', 0)
      .lte('cmv_percentual', 100);

    const cmvPorDiaSemana: any = {};
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    (cmvSemanal || []).forEach((cmv: any) => {
      const data = new Date(cmv.data_inicio);
      const dia = diasSemana[data.getDay()];
      
      if (!cmvPorDiaSemana[dia]) {
        cmvPorDiaSemana[dia] = {
          dia_semana: dia,
          cmv_medio: 0,
          quantidade_semanas: 0,
          soma_cmv: 0
        };
      }
      
      cmvPorDiaSemana[dia].soma_cmv += cmv.cmv_percentual;
      cmvPorDiaSemana[dia].quantidade_semanas += 1;
    });

    Object.values(cmvPorDiaSemana).forEach((dia: any) => {
      dia.cmv_medio = dia.soma_cmv / dia.quantidade_semanas;
    });

    // 2. CORRELAÇÃO CMV × VOLUME
    const correlacao = (cmvSemanal || []).map((cmv: any) => ({
      data_inicio: cmv.data_inicio,
      cmv_percentual: cmv.cmv_percentual,
      faturamento_liquido: cmv.faturamento_liquido,
      consumo_total: cmv.consumo_total
    })).sort((a: any, b: any) => b.faturamento_liquido - a.faturamento_liquido);

    // 3. CMV ALTO (> 40%)
    const { data: cmvAlto } = await supabase
      .from('cmv_semanal')
      .select('*')
      .eq('bar_id', barId)
      .gt('cmv_percentual', 40)
      .lte('cmv_percentual', 100)
      .order('cmv_percentual', { ascending: false });

    // 4. PERÍODOS DE CMV ANORMAL
    const cmvMedio = (cmvSemanal || []).reduce((acc: number, c: any) => acc + c.cmv_percentual, 0) / (cmvSemanal || []).length;
    const desvioPadrao = Math.sqrt(
      (cmvSemanal || []).reduce((acc: number, c: any) => acc + Math.pow(c.cmv_percentual - cmvMedio, 2), 0) / (cmvSemanal || []).length
    );

    const cmvAnormal = (cmvSemanal || [])
      .filter((c: any) => Math.abs(c.cmv_percentual - cmvMedio) > desvioPadrao * 2)
      .sort((a: any, b: any) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime());

    return NextResponse.json({
      success: true,
      exploracao: {
        cmv_por_dia_semana: Object.values(cmvPorDiaSemana).sort((a: any, b: any) => 
          diasSemana.indexOf(a.dia_semana) - diasSemana.indexOf(b.dia_semana)
        ),
        correlacao_cmv_volume: correlacao.slice(0, 20),
        cmv_alto: (cmvAlto || []) as any[],
        cmv_anormal: cmvAnormal,
        estatisticas: {
          cmv_medio: Math.round(cmvMedio * 100) / 100,
          desvio_padrao: Math.round(desvioPadrao * 100) / 100,
          cmv_minimo: Math.min(...(cmvSemanal || []).map((c: any) => c.cmv_percentual)),
          cmv_maximo: Math.max(...(cmvSemanal || []).map((c: any) => c.cmv_percentual))
        }
      }
    });

  } catch (error: any) {
    console.error('Erro na exploração de CMV:', error);
    return NextResponse.json(
      { error: 'Erro ao explorar CMV', details: error.message },
      { status: 500 }
    );
  }
}
