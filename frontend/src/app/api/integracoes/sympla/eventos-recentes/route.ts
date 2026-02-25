import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com Supabase' },
        { status: 500 }
      );
    }

    // Buscar eventos do Carnaval 2026 (13-17 fev) e últimos 60 dias
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 60);

    const { data: eventos, error } = await supabase
      .from('sympla_eventos')
      .select(`
        evento_sympla_id,
        nome_evento,
        data_inicio,
        bar_id
      `)
      .eq('bar_id', 3)
      .gte('data_inicio', dataInicio.toISOString())
      .order('data_inicio', { ascending: false });

    if (error) {
      throw error;
    }

    // Buscar contagem de participantes para cada evento
    const eventosComContagem = await Promise.all(
      (eventos || []).map(async (evento) => {
        const { count } = await supabase
          .from('sympla_participantes')
          .select('*', { count: 'exact', head: true })
          .eq('evento_sympla_id', evento.evento_sympla_id)
          .eq('bar_id', evento.bar_id);

        return {
          ...evento,
          total_participantes: count || 0
        };
      })
    );

    return NextResponse.json({
      success: true,
      eventos: eventosComContagem
    });

  } catch (error: any) {
    console.error('Erro ao buscar eventos:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar eventos' },
      { status: 500 }
    );
  }
}
