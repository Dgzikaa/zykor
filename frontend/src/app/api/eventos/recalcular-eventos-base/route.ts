import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 API Recalcular Eventos Base - Iniciado');

    // Autenticação
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      data_inicio, 
      data_fim, 
      evento_ids, 
      forcar_todos = false 
    } = body;

    console.log(`📅 Parâmetros recebidos:`, {
      data_inicio,
      data_fim,
      evento_ids,
      forcar_todos,
      bar_id: user.bar_id
    });

    let totalRecalculados = 0;
    let eventosProcessados: any[] = [];

    if (evento_ids && Array.isArray(evento_ids)) {
      // Recalcular eventos específicos
      console.log(`🎯 Recalculando ${evento_ids.length} eventos específicos`);
      
      for (const eventoId of evento_ids) {
        try {
          const { error } = await supabase.rpc('calculate_evento_metrics', { 
            evento_id: eventoId 
          });
          
          if (!error) {
            totalRecalculados++;
            
            // Buscar dados atualizados do evento
            const { data: eventoAtualizado } = await supabase
              .from('eventos_base')
              .select('id, nome, data_evento, real_r, cl_real, calculado_em')
              .eq('id', eventoId)
              .single();
              
            if (eventoAtualizado) {
              eventosProcessados.push(eventoAtualizado);
            }
            
            console.log(`✅ Evento ${eventoId} recalculado com sucesso`);
          } else {
            console.error(`❌ Erro ao recalcular evento ${eventoId}:`, error);
          }
        } catch (err) {
          console.error(`❌ Erro ao processar evento ${eventoId}:`, err);
        }
      }
      
    } else if (data_inicio) {
      // Recalcular período específico
      const dataFim = data_fim || data_inicio;
      console.log(`📅 Recalculando período: ${data_inicio} a ${dataFim}`);
      
      const { data, error } = await supabase.rpc('recalcular_eventos_periodo', {
        data_inicio,
        data_fim: dataFim
      });
      
      if (!error) {
        totalRecalculados = data || 0;
        console.log(`✅ ${totalRecalculados} eventos recalculados no período`);
        
        // Buscar eventos recalculados
        const { data: eventosRecalculados } = await supabase
          .from('eventos_base')
          .select('id, nome, data_evento, real_r, cl_real, calculado_em')
          .eq('bar_id', user.bar_id)
          .gte('data_evento', data_inicio)
          .lte('data_evento', dataFim)
          .order('data_evento');
          
        eventosProcessados = eventosRecalculados || [];
      } else {
        console.error('❌ Erro ao recalcular período:', error);
        throw new Error(`Erro ao recalcular período: ${error.message}`);
      }
      
    } else if (forcar_todos) {
      // Recalcular todos os eventos pendentes
      console.log('🔄 Recalculando todos os eventos pendentes');
      
      const { data, error } = await supabase.rpc('recalcular_eventos_pendentes', { 
        limite: 100 
      });
      
      if (!error) {
        totalRecalculados = data || 0;
        console.log(`✅ ${totalRecalculados} eventos pendentes recalculados`);
        
        // Buscar eventos recalculados recentemente
        const { data: eventosRecalculados } = await supabase
          .from('eventos_base')
          .select('id, nome, data_evento, real_r, cl_real, calculado_em')
          .eq('bar_id', user.bar_id)
          .gte('calculado_em', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Últimos 5 minutos
          .order('calculado_em', { ascending: false });
          
        eventosProcessados = eventosRecalculados || [];
      } else {
        console.error('❌ Erro ao recalcular eventos pendentes:', error);
        throw new Error(`Erro ao recalcular eventos pendentes: ${error.message}`);
      }
      
    } else {
      // Recalcular apenas eventos que precisam de recálculo
      console.log('🔄 Recalculando eventos marcados como pendentes');
      
      // Buscar eventos que precisam de recálculo
      const { data: eventosPendentes, error: errorPendentes } = await supabase
        .from('eventos_base')
        .select('id, nome, data_evento')
        .eq('bar_id', user.bar_id)
        .eq('precisa_recalculo', true)
        .order('data_evento', { ascending: false })
        .limit(50);
        
      if (errorPendentes) {
        throw new Error(`Erro ao buscar eventos pendentes: ${errorPendentes.message}`);
      }
      
      console.log(`📊 Encontrados ${eventosPendentes?.length || 0} eventos pendentes`);
      
      if (eventosPendentes && eventosPendentes.length > 0) {
        for (const evento of eventosPendentes) {
          try {
            const { error } = await supabase.rpc('calculate_evento_metrics', { 
              evento_id: evento.id 
            });
            
            if (!error) {
              totalRecalculados++;
              
              // Buscar dados atualizados do evento
              const { data: eventoAtualizado } = await supabase
                .from('eventos_base')
                .select('id, nome, data_evento, real_r, cl_real, calculado_em')
                .eq('id', evento.id)
                .single();
                
              if (eventoAtualizado) {
                eventosProcessados.push(eventoAtualizado);
              }
              
              console.log(`✅ Evento ${evento.id} (${evento.nome}) recalculado`);
            } else {
              console.error(`❌ Erro ao recalcular evento ${evento.id}:`, error);
            }
          } catch (err) {
            console.error(`❌ Erro ao processar evento ${evento.id}:`, err);
          }
        }
      }
    }

    console.log(`🎉 Recálculo concluído: ${totalRecalculados} eventos processados`);

    return NextResponse.json({
      success: true,
      message: `${totalRecalculados} eventos recalculados com sucesso`,
      total_recalculados: totalRecalculados,
      eventos_processados: eventosProcessados,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao recalcular eventos:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Erro ao recalcular eventos',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET para verificar status dos eventos que precisam de recálculo
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar eventos que precisam de recálculo
    const { data: eventosPendentes, error } = await supabase
      .from('eventos_base')
      .select('id, nome, data_evento, calculado_em, precisa_recalculo')
      .eq('bar_id', user.bar_id)
      .eq('precisa_recalculo', true)
      .order('data_evento', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      eventos_pendentes: eventosPendentes || [],
      total_pendentes: eventosPendentes?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao buscar status:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Erro ao buscar status dos eventos',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
