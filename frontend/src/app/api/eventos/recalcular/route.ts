import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Autenticação
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { data_inicio, data_fim, force_all } = await request.json();

    let totalRecalculados = 0;

    if (force_all) {
      // Recalcular todos os eventos pendentes
      const { data: eventosPendentes, error: selectError } = await supabase
        .from('eventos_base')
        .select('id')
        .eq('precisa_recalculo', true)
        .limit(50);

      if (selectError) {
        console.error('❌ Erro ao buscar eventos pendentes:', selectError);
        throw selectError;
      }

      // Recalcular cada evento individualmente
      for (const evento of eventosPendentes || []) {
        try {
          const { error: calcError } = await supabase
            .rpc('calculate_evento_metrics', { evento_id: evento.id });

          if (calcError) {
            console.error(`❌ Erro ao recalcular evento ${evento.id}:`, calcError);
          } else {
            totalRecalculados++;
          }
        } catch (error) {
          console.error(`❌ Erro ao recalcular evento ${evento.id}:`, error);
        }
      }

    } else {
      // Recalcular eventos de um período específico
      const startDate = data_inicio || '2025-08-01';
      const endDate = data_fim || '2025-08-31';

      // Primeiro, marcar eventos do período para recálculo
      const { error: updateError } = await supabase
        .from('eventos_base')
        .update({ 
          precisa_recalculo: true,
          atualizado_em: new Date().toISOString()
        })
        .gte('data_evento', startDate)
        .lte('data_evento', endDate);

      if (updateError) {
        console.error('❌ Erro ao marcar eventos para recálculo:', updateError);
        throw updateError;
      }

      // Buscar eventos do período
      const { data: eventosPeríodo, error: selectError } = await supabase
        .from('eventos_base')
        .select('id, data_evento, nome')
        .gte('data_evento', startDate)
        .lte('data_evento', endDate)
        .order('data_evento')
        .limit(50);

      if (selectError) {
        console.error('❌ Erro ao buscar eventos do período:', selectError);
        throw selectError;
      }

      // Recalcular cada evento individualmente
      for (const evento of eventosPeríodo || []) {
        try {
          const { error: calcError } = await supabase
            .rpc('calculate_evento_metrics', { evento_id: evento.id });

          if (calcError) {
            console.error(`❌ Erro ao recalcular evento ${evento.id} (${evento.data_evento}):`, calcError);
          } else {
            totalRecalculados++;
          }
        } catch (error) {
          console.error(`❌ Erro ao recalcular evento ${evento.id}:`, error);
        }
      }
    }

    // Verificar alguns resultados
    const { data: eventosVerificacao, error: verifyError } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome, te_real, tb_real, real_r, cl_real, calculado_em')
      .gte('data_evento', data_inicio || '2025-08-01')
      .lte('data_evento', data_fim || '2025-08-31')
      .not('te_real', 'is', null)
      .not('tb_real', 'is', null)
      .order('data_evento')
      .limit(10);

    if (verifyError) {
      console.error('❌ Erro ao verificar resultados:', verifyError);
    }

    return NextResponse.json({
      success: true,
      message: `Recálculo concluído! ${totalRecalculados} eventos processados`,
      total_recalculados: totalRecalculados,
      eventos_com_dados: eventosVerificacao?.length || 0,
      sample_eventos: eventosVerificacao?.slice(0, 5) || [],
      periodo: {
        inicio: data_inicio || '2025-08-01',
        fim: data_fim || '2025-08-31'
      }
    });

  } catch (error) {
    console.error('❌ Erro na API de recálculo:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
