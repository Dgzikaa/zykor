import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface AtracaoDia {
  data: string;
  dataFormatada: string;
  diaSemana: string;
  evento: string;
  artista: string | null;
  custoArtistico: number;
  custoProducao: number;
  custoTotal: number;
  faturamento: number;
  couvert: number;
  percentualFat: number;
}

interface AtracaoSummary {
  total: number;
  custoArtisticoTotal: number;
  custoProducaoTotal: number;
  custoTotal: number;
  faturamentoTotal: number;
  couvertTotal: number;
  percentualMedio: number;
  dias: AtracaoDia[];
}

const DIAS_SEMANA_ORDEM: Record<string, number> = {
  'SEGUNDA': 1, 'Segunda': 1,
  'TERCA': 2, 'Terça': 2, 'TERÇA': 2,
  'QUARTA': 3, 'Quarta': 3,
  'QUINTA': 4, 'Quinta': 4,
  'SEXTA': 5, 'Sexta': 5,
  'SABADO': 6, 'Sábado': 6, 'SÁBADO': 6,
  'DOMINGO': 7, 'Domingo': 7,
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Erro ao conectar ao banco' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '', 10);
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');

    if (!barId || Number.isNaN(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    if (!dataInicio || !dataFim) {
      return NextResponse.json({ error: 'data_inicio e data_fim são obrigatórios' }, { status: 400 });
    }

    const { data: eventos, error } = await supabase
      .from('eventos_base')
      .select('data_evento, dia_semana, nome, artista, c_art, c_prod, real_r, faturamento_couvert')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lte('data_evento', dataFim)
      .order('data_evento', { ascending: true });

    if (error) {
      console.error('Erro ao buscar eventos:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    const eventosData = (eventos || []) as any[];

    let custoArtisticoTotal = 0;
    let custoProducaoTotal = 0;
    let faturamentoTotal = 0;
    let couvertTotal = 0;

    const dias: AtracaoDia[] = eventosData.map((e: any) => {
      const custoArt = parseFloat(e.c_art) || 0;
      const custoProd = parseFloat(e.c_prod) || 0;
      const custoTotal = custoArt + custoProd;
      const faturamento = parseFloat(e.real_r) || 0;
      const couvert = parseFloat(e.faturamento_couvert) || 0;
      const percentualFat = faturamento > 0 ? (custoTotal / faturamento) * 100 : 0;

      custoArtisticoTotal += custoArt;
      custoProducaoTotal += custoProd;
      faturamentoTotal += faturamento;
      couvertTotal += couvert;

      const dataObj = new Date(e.data_evento + 'T12:00:00');

      return {
        data: e.data_evento,
        dataFormatada: dataObj.toLocaleDateString('pt-BR'),
        diaSemana: e.dia_semana,
        evento: e.nome || '-',
        artista: e.artista || null,
        custoArtistico: custoArt,
        custoProducao: custoProd,
        custoTotal,
        faturamento,
        couvert,
        percentualFat: Math.round(percentualFat * 100) / 100,
      };
    });

    // Ordenar por dia da semana (Segunda a Domingo)
    dias.sort((a, b) => {
      const ordemA = DIAS_SEMANA_ORDEM[a.diaSemana] || 99;
      const ordemB = DIAS_SEMANA_ORDEM[b.diaSemana] || 99;
      return ordemA - ordemB;
    });

    const custoTotal = custoArtisticoTotal + custoProducaoTotal;
    const percentualMedio = faturamentoTotal > 0 ? (custoTotal / faturamentoTotal) * 100 : 0;

    const summary: AtracaoSummary = {
      total: eventosData.length,
      custoArtisticoTotal,
      custoProducaoTotal,
      custoTotal,
      faturamentoTotal,
      couvertTotal,
      percentualMedio: Math.round(percentualMedio * 100) / 100,
      dias,
    };

    return NextResponse.json({
      success: true,
      summary,
      periodo: { dataInicio, dataFim },
    });

  } catch (error) {
    console.error('Erro na API atracao-detalhes:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
