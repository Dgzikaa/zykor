import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { filtrarDiasAbertos } from '@/lib/helpers/calendario-helper';

export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId');
    const periodo = searchParams.get('periodo') || '7d'; // 7d, 30d, 90d

    if (!barId) {
      return NextResponse.json(
        { error: 'Bar ID é obrigatório' },
        { status: 400 }
      );
    }

    // Calcular datas baseado no período
    const agora = new Date();
    const dias = periodo === '30d' ? 30 : periodo === '90d' ? 90 : 7;
    const dataInicio = new Date(
      agora.getTime() - dias * 24 * 60 * 60 * 1000
    ).toISOString();

    // Buscar eventos do período
    const { data: eventosBruto, error } = await supabase
      .from('eventos_base')
      .select('*')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .order('data_evento', { ascending: false });

    if (error) {
      console.error('Erro ao buscar eventos:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar dados' },
        { status: 500 }
      );
    }

    // ⚡ FILTRAR DIAS FECHADOS
    const eventos = await filtrarDiasAbertos(eventosBruto || [], 'data_evento', parseInt(barId));

    // Calcular estatísticas
    const estatisticas = {
      total_eventos: eventos?.length || 0,
      eventos_confirmados:
        eventos?.filter(e => e.status === 'confirmado').length || 0,
      eventos_pendentes:
        eventos?.filter(e => e.status === 'pendente').length || 0,
      eventos_cancelados:
        eventos?.filter(e => e.status === 'cancelado').length || 0,
      valor_total: eventos?.reduce((acc, e) => acc + (e.valor || 0), 0) || 0,
      media_por_evento: eventos?.length
        ? eventos.reduce((acc, e) => acc + (e.valor || 0), 0) / eventos.length
        : 0,
    };

    // Agrupamento por status
    const porStatus =
      eventos?.reduce((acc: Record<string, number>, evento: any) => {
        acc[evento.status] = (acc[evento.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

    // Agrupamento por mês
    const porMes =
      eventos?.reduce((acc: Record<string, { mes: string; eventos: number; valor: number }>, evento: any) => {
        const mes = new Date(evento.data_evento).toLocaleDateString('pt-BR', {
          month: 'short',
        });
        if (!acc[mes]) {
          acc[mes] = {
            mes,
            eventos: 0,
            valor: 0,
          };
        }
        acc[mes].eventos++;
        acc[mes].valor += evento.valor || 0;
        return acc;
      }, {} as Record<string, { mes: string; eventos: number; valor: number }>) || {};

    return NextResponse.json({
      success: true,
      data: {
        eventos: eventos || [],
        estatisticas,
        porStatus,
        porMes,
      },
    });
  } catch (error) {
    console.error('Erro na API de analytics de eventos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
