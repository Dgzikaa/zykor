import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');

    // 1. TOP 10 DIAS DE MAIOR FATURAMENTO
    const { data: topDias } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome, real_r, cl_real, dia_semana')
      .eq('bar_id', barId)
      .not('real_r', 'is', null)
      .order('real_r', { ascending: false })
      .limit(10);

    // 2. MÉDIA DE FATURAMENTO POR DIA DA SEMANA
    const { data: eventosPorDia } = await supabase
      .from('eventos_base')
      .select('dia_semana, real_r, cl_real')
      .eq('bar_id', barId)
      .not('real_r', 'is', null)
      .gt('real_r', 0);

    const mediaPorDia: any = {};
    const diasSemana = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
    
    diasSemana.forEach(dia => {
      const eventosDia = (eventosPorDia || []).filter((e: any) => e.dia_semana === dia);
      if (eventosDia.length > 0) {
        const somaFat = eventosDia.reduce((acc: number, e: any) => acc + (e.real_r || 0), 0);
        const somaPublico = eventosDia.reduce((acc: number, e: any) => acc + (e.cl_real || 0), 0);
        mediaPorDia[dia] = {
          dia_semana: dia,
          quantidade_eventos: eventosDia.length,
          faturamento_medio: somaFat / eventosDia.length,
          faturamento_total: somaFat,
          publico_medio: somaPublico / eventosDia.length,
          ticket_medio: somaPublico > 0 ? somaFat / somaPublico : 0
        };
      }
    });

    // 3. FATURAMENTO POR HORA (usando contahub_fatporhora)
    const { data: faturamentoPorHora } = await supabase
      .from('contahub_fatporhora')
      .select('hora, valor')
      .eq('bar_id', barId)
      .gte('vd_dtgerencial', new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]);

    const mediaPorHora: any = {};
    for (let h = 0; h < 24; h++) {
      const horaStr = h.toString().padStart(2, '0');
      const vendasHora = (faturamentoPorHora || []).filter((v: any) => {
        const hora = v.hora?.toString() || '';
        return hora.startsWith(horaStr);
      });
      if (vendasHora.length > 0) {
        const soma = vendasHora.reduce((acc: number, v: any) => acc + (v.valor || 0), 0);
        mediaPorHora[horaStr] = {
          hora: `${horaStr}:00`,
          faturamento_medio: soma / vendasHora.length,
          quantidade_registros: vendasHora.length
        };
      }
    }

    // 4. COMPARAÇÃO MENSAL (último ano)
    const { data: eventosMensais } = await supabase
      .from('eventos_base')
      .select('data_evento, real_r, cl_real')
      .eq('bar_id', barId)
      .gte('data_evento', new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0])
      .not('real_r', 'is', null);

    const faturamentoPorMes: any = {};
    (eventosMensais || []).forEach((evento: any) => {
      const mes = evento.data_evento.substring(0, 7); // YYYY-MM
      if (!faturamentoPorMes[mes]) {
        faturamentoPorMes[mes] = {
          mes,
          faturamento_total: 0,
          publico_total: 0,
          quantidade_eventos: 0
        };
      }
      faturamentoPorMes[mes].faturamento_total += evento.real_r || 0;
      faturamentoPorMes[mes].publico_total += evento.cl_real || 0;
      faturamentoPorMes[mes].quantidade_eventos += 1;
    });

    const comparativoMensal = Object.values(faturamentoPorMes)
      .sort((a: any, b: any) => b.faturamento_total - a.faturamento_total);

    // 5. PADRÕES SAZONAIS (por trimestre)
    const padroesSazonais: any = {
      'Q1 (Jan-Mar)': { meses: ['01', '02', '03'], faturamento: 0, eventos: 0 },
      'Q2 (Abr-Jun)': { meses: ['04', '05', '06'], faturamento: 0, eventos: 0 },
      'Q3 (Jul-Set)': { meses: ['07', '08', '09'], faturamento: 0, eventos: 0 },
      'Q4 (Out-Dez)': { meses: ['10', '11', '12'], faturamento: 0, eventos: 0 },
    };

    (eventosMensais || []).forEach((evento: any) => {
      const mes = evento.data_evento.substring(5, 7);
      for (const [trimestre, dados] of Object.entries(padroesSazonais)) {
        const dadosTrimestre = dados as any;
        if (dadosTrimestre.meses.includes(mes)) {
          dadosTrimestre.faturamento += evento.real_r || 0;
          dadosTrimestre.eventos += 1;
        }
      }
    });

    // Calcular médias
    Object.values(padroesSazonais).forEach((trimestre: any) => {
      trimestre.faturamento_medio = trimestre.eventos > 0 
        ? trimestre.faturamento / trimestre.eventos 
        : 0;
    });

    // 6. TENDÊNCIA (crescimento/queda)
    const mesesOrdenados = Object.values(faturamentoPorMes)
      .sort((a: any, b: any) => a.mes.localeCompare(b.mes));

    const tendencias: any[] = [];
    for (let i = 1; i < mesesOrdenados.length; i++) {
      const mesAtual: any = mesesOrdenados[i];
      const mesAnterior: any = mesesOrdenados[i - 1];
      const variacao = ((mesAtual.faturamento_total - mesAnterior.faturamento_total) / mesAnterior.faturamento_total) * 100;
      
      tendencias.push({
        mes: mesAtual.mes,
        faturamento: mesAtual.faturamento_total,
        variacao_pct: Math.round(variacao * 100) / 100,
        tendencia: variacao > 5 ? 'CRESCIMENTO' : variacao < -5 ? 'QUEDA' : 'ESTÁVEL'
      });
    }

    return NextResponse.json({
      success: true,
      exploracao: {
        top_10_dias: (topDias || []) as any[],
        media_por_dia_semana: Object.values(mediaPorDia).sort((a: any, b: any) => 
          diasSemana.indexOf(a.dia_semana) - diasSemana.indexOf(b.dia_semana)
        ),
        faturamento_por_hora: Object.values(mediaPorHora).sort((a: any, b: any) => 
          a.hora.localeCompare(b.hora)
        ),
        comparativo_mensal: comparativoMensal,
        padroes_sazonais: padroesSazonais,
        tendencias: tendencias.slice(-12) // Últimos 12 meses
      }
    });

  } catch (error: any) {
    console.error('Erro na exploração de faturamento:', error);
    return NextResponse.json(
      { error: 'Erro ao explorar faturamento', details: error.message },
      { status: 500 }
    );
  }
}
