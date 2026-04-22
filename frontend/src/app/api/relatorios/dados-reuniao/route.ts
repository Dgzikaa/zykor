import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    
    const barId = searchParams.get('bar_id') || '3';
    const semanas = parseInt(searchParams.get('semanas') || '12');

    // Buscar dados das últimas N semanas de gold.desempenho
    const { data: dadosSemanais, error } = await (supabase as any)
      .schema('gold')
      .from('desempenho')
      .select(`
        numero_semana,
        data_inicio,
        data_fim,
        perc_clientes_novos,
        clientes_ativos,
        clientes_atendidos,
        faturamento_total,
        ticket_medio,
        cmv_global_real,
        cmo,
        nps_reservas,
        nota_felicidade_equipe
      `)
      .eq('bar_id', barId)
      .eq('granularidade', 'semanal')
      .order('data_inicio', { ascending: false })
      .limit(semanas);

    if (error) {
      console.error('Erro ao buscar dados:', error);
      throw error;
    }

    // Formatar dados para exibição
    const dadosFormatados = (dadosSemanais || []).reverse().map(semana => {
      const dataInicio = new Date(semana.data_inicio + 'T00:00:00');
      const dataFim = new Date(semana.data_fim + 'T00:00:00');
      
      return {
        semana: semana.numero_semana,
        periodo: `${dataInicio.toLocaleDateString('pt-BR')} - ${dataFim.toLocaleDateString('pt-BR')}`,
        dataInicio: semana.data_inicio,
        dataFim: semana.data_fim,
        percNovos: semana.perc_clientes_novos != null ? Number(semana.perc_clientes_novos).toFixed(1) + '%' : '-',
        clientesAtivos: semana.clientes_ativos != null ? semana.clientes_ativos.toLocaleString('pt-BR') : '-',
        clientesAtendidos: semana.clientes_atendidos != null ? semana.clientes_atendidos.toLocaleString('pt-BR') : '-',
        faturamento: semana.faturamento_total != null ? 'R$ ' + Number(semana.faturamento_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-',
        ticketMedio: semana.ticket_medio != null ? 'R$ ' + Number(semana.ticket_medio).toFixed(2) : '-',
        cmv: semana.cmv_global_real != null ? Number(semana.cmv_global_real).toFixed(1) + '%' : '-',
        cmo: semana.cmo != null ? Number(semana.cmo).toFixed(1) + '%' : '-',
        nps: semana.nps_reservas != null ? Number(semana.nps_reservas).toFixed(0) : '-',
        felicidade: semana.nota_felicidade_equipe != null ? Number(semana.nota_felicidade_equipe).toFixed(1) : '-',
      };
    });

    // Criar texto formatado para copiar
    let textoParaCopiar = 'SEMANA\tPERÍODO\t% NOVOS\tCLIENTES ATIVOS\tCLIENTES ATENDIDOS\tFATURAMENTO\tTICKET MÉDIO\tCMV\tCMO\tNPS\tFELICIDADE\n';
    
    dadosFormatados.forEach(d => {
      textoParaCopiar += `${d.semana}\t${d.periodo}\t${d.percNovos}\t${d.clientesAtivos}\t${d.clientesAtendidos}\t${d.faturamento}\t${d.ticketMedio}\t${d.cmv}\t${d.cmo}\t${d.nps}\t${d.felicidade}\n`;
    });

    return NextResponse.json({
      success: true,
      data: dadosFormatados,
      textoParaCopiar,
      totalSemanas: dadosFormatados.length
    });

  } catch (error: any) {
    console.error('❌ Erro na API de dados reunião:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao buscar dados' },
      { status: 500 }
    );
  }
}

