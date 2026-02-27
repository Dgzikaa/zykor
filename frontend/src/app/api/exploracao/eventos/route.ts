import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');

    // 1. ROI DE EVENTOS (faturamento vs custo artístico)
    const { data: eventos } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome, artista, real_r, cl_real, ca_plan, ca_real, dia_semana')
      .eq('bar_id', barId)
      .not('real_r', 'is', null)
      .not('ca_real', 'is', null)
      .gt('real_r', 0)
      .gt('ca_real', 0);

    const eventosComROI = (eventos || [])
      .map((e: any) => ({
        ...e,
        roi: ((e.real_r - e.ca_real) / e.ca_real) * 100,
        lucro_bruto: e.real_r - e.ca_real,
        custo_pct: (e.ca_real / e.real_r) * 100
      }))
      .sort((a: any, b: any) => b.roi - a.roi);

    // 2. EVENTOS MAIS LUCRATIVOS
    const eventosMaisLucrativos = eventosComROI
      .sort((a: any, b: any) => b.lucro_bruto - a.lucro_bruto)
      .slice(0, 20);

    // 3. PADRÕES PRÉ/PÓS EVENTO
    const { data: todosEventos } = await supabase
      .from('eventos_base')
      .select('data_evento, real_r, nome')
      .eq('bar_id', barId)
      .order('data_evento', { ascending: true });

    const padroesPrePos: any[] = [];
    for (let i = 1; i < (todosEventos || []).length - 1; i++) {
      const eventoAtual: any = todosEventos![i];
      const eventoAnterior: any = todosEventos![i - 1];
      const eventoPosterior: any = todosEventos![i + 1];
      
      padroesPrePos.push({
        evento: eventoAtual.nome,
        data: eventoAtual.data_evento,
        faturamento: eventoAtual.real_r,
        faturamento_anterior: eventoAnterior.real_r,
        faturamento_posterior: eventoPosterior.real_r,
        variacao_pre: eventoAnterior.real_r ? ((eventoAtual.real_r - eventoAnterior.real_r) / eventoAnterior.real_r) * 100 : 0,
        variacao_pos: eventoPosterior.real_r ? ((eventoPosterior.real_r - eventoAtual.real_r) / eventoPosterior.real_r) * 100 : 0
      });
    }

    // 4. COMPARAR EVENTOS SIMILARES (mesmo artista/gênero)
    const eventosPorArtista: any = {};
    (eventos || []).forEach((e: any) => {
      if (e.artista) {
        if (!eventosPorArtista[e.artista]) {
          eventosPorArtista[e.artista] = [];
        }
        eventosPorArtista[e.artista].push(e);
      }
    });

    const comparativoArtistas = Object.entries(eventosPorArtista)
      .filter(([_, eventos]: any) => eventos.length >= 3)
      .map(([artista, eventos]: any) => {
        const somaFat = eventos.reduce((acc: number, e: any) => acc + e.real_r, 0);
        const somaPublico = eventos.reduce((acc: number, e: any) => acc + (e.cl_real || 0), 0);
        const somaCusto = eventos.reduce((acc: number, e: any) => acc + (e.ca_real || 0), 0);
        
        return {
          artista,
          quantidade_eventos: eventos.length,
          faturamento_medio: somaFat / eventos.length,
          publico_medio: somaPublico / eventos.length,
          custo_medio: somaCusto / eventos.length,
          roi_medio: somaCusto > 0 ? ((somaFat - somaCusto) / somaCusto) * 100 : 0
        };
      })
      .sort((a: any, b: any) => b.roi_medio - a.roi_medio);

    return NextResponse.json({
      success: true,
      exploracao: {
        eventos_com_roi: eventosComROI.slice(0, 20),
        eventos_mais_lucrativos: eventosMaisLucrativos,
        padroes_pre_pos: padroesPrePos.slice(0, 30),
        comparativo_artistas: comparativoArtistas
      }
    });

  } catch (error: any) {
    console.error('Erro na exploração de eventos:', error);
    return NextResponse.json(
      { error: 'Erro ao explorar eventos', details: error.message },
      { status: 500 }
    );
  }
}
