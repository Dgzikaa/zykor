import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Verifica eventos sem m1_r preenchido
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    const { searchParams } = new URL(request.url);
    const semana = parseInt(searchParams.get('semana') || '14');
    const ano = parseInt(searchParams.get('ano') || '2026');
    
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;
    
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    // Buscar dados da semana
    const { data: semanaData } = await supabase
      .from('desempenho_semanal')
      .select('data_inicio, data_fim, meta_semanal')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('numero_semana', semana)
      .single();

    if (!semanaData) {
      return NextResponse.json({ error: 'Semana não encontrada' }, { status: 404 });
    }

    // Buscar eventos da semana
    const { data: eventos } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome, dia_semana, m1_r, real_r, cl_plan, te_plan, tb_plan')
      .eq('bar_id', barId)
      .gte('data_evento', semanaData.data_inicio)
      .lte('data_evento', semanaData.data_fim)
      .eq('ativo', true)
      .order('data_evento', { ascending: true });

    const eventosData = (eventos || []) as any[];
    
    // Separar eventos com e sem m1_r
    const eventosSemM1 = eventosData.filter(e => !e.m1_r || e.m1_r === 0);
    const eventosComM1 = eventosData.filter(e => e.m1_r && e.m1_r > 0);

    // Calcular soma atual de m1_r
    const somaM1Atual = eventosData.reduce((acc, e) => acc + (e.m1_r || 0), 0);

    // Buscar metas diárias padrão por dia da semana
    const metasPorDiaSemana = {
      'Segunda': 5066.67,
      'Terça': 11000.00, // estimativa
      'Quarta': 38506.67,
      'Quinta': 18240.00,
      'Sexta': 62826.67,
      'Sábado': 52693.33,
      'Domingo': 55733.33,
    };

    // Sugerir m1_r para eventos sem meta
    const sugestoes = eventosSemM1.map(e => {
      const metaSugerida = metasPorDiaSemana[e.dia_semana as keyof typeof metasPorDiaSemana] || 0;
      return {
        ...e,
        m1_sugerido: metaSugerida,
        fonte_sugestao: 'metas_diarias_padrao'
      };
    });

    const somaM1Sugerida = sugestoes.reduce((acc, e) => acc + e.m1_sugerido, 0);
    const metaTotalCalculada = somaM1Atual + somaM1Sugerida;

    return NextResponse.json({
      success: true,
      semana: {
        numero: semana,
        ano: ano,
        periodo: `${semanaData.data_inicio} até ${semanaData.data_fim}`,
        meta_no_banco: semanaData.meta_semanal,
      },
      analise: {
        total_eventos: eventosData.length,
        eventos_com_m1: eventosComM1.length,
        eventos_sem_m1: eventosSemM1.length,
        soma_m1_atual: somaM1Atual,
        soma_m1_sugerida: somaM1Sugerida,
        meta_total_calculada: metaTotalCalculada,
        diferenca_vs_banco: Math.abs(metaTotalCalculada - (semanaData.meta_semanal || 0)),
      },
      eventos_com_m1: eventosComM1.map(e => ({
        data: e.data_evento,
        nome: e.nome,
        dia_semana: e.dia_semana,
        m1_r: e.m1_r,
      })),
      eventos_sem_m1: sugestoes.map(e => ({
        id: e.id,
        data: e.data_evento,
        nome: e.nome,
        dia_semana: e.dia_semana,
        m1_atual: e.m1_r || 0,
        m1_sugerido: e.m1_sugerido,
        cl_plan: e.cl_plan,
        te_plan: e.te_plan,
        tb_plan: e.tb_plan,
      })),
      recomendacao: eventosSemM1.length > 0 
        ? 'Preencher m1_r dos eventos sem meta e depois recalcular a semana'
        : 'Todos os eventos têm m1_r preenchido. Recalcular a semana para atualizar meta_semanal.',
    });

  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: String(error) },
      { status: 500 }
    );
  }
}
