import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Erro ao conectar com banco' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');

    // Buscar estatísticas gerais
    const { data: reviews, error } = await supabase
      .from('google_reviews')
      .select('stars, published_at_date, rating_food, rating_service, rating_atmosphere, text, response_from_owner_text')
      .eq('bar_id', barId);

    if (error) {
      console.error('Erro ao buscar reviews:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    const reviewsData = (reviews || []) as any[];
    const total = reviewsData.length;
    
    // Calcular média de estrelas
    const somaEstrelas = reviewsData.reduce((acc: number, r: any) => acc + (r.stars || 0), 0);
    const mediaEstrelas = total > 0 ? Math.round((somaEstrelas / total) * 100) / 100 : 0;

    // Distribuição por estrelas
    const distribuicao: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviewsData.forEach((r: any) => {
      if (r.stars && r.stars >= 1 && r.stars <= 5) {
        distribuicao[r.stars]++;
      }
    });

    // Médias por categoria (quando disponível)
    const comFood = reviewsData.filter((r: any) => r.rating_food !== null);
    const comService = reviewsData.filter((r: any) => r.rating_service !== null);
    const comAtmosphere = reviewsData.filter((r: any) => r.rating_atmosphere !== null);

    const mediaFood = comFood.length > 0 
      ? Math.round((comFood.reduce((acc: number, r: any) => acc + (r.rating_food || 0), 0) / comFood.length) * 100) / 100 
      : null;
    const mediaService = comService.length > 0 
      ? Math.round((comService.reduce((acc: number, r: any) => acc + (r.rating_service || 0), 0) / comService.length) * 100) / 100 
      : null;
    const mediaAtmosphere = comAtmosphere.length > 0 
      ? Math.round((comAtmosphere.reduce((acc: number, r: any) => acc + (r.rating_atmosphere || 0), 0) / comAtmosphere.length) * 100) / 100 
      : null;

    // Reviews com texto vs sem texto
    const comTexto = reviewsData.filter((r: any) => r.text && r.text.trim().length > 0).length;
    const semTexto = total - comTexto;

    // Reviews respondidas pelo proprietário
    const respondidas = reviewsData.filter((r: any) => r.response_from_owner_text && r.response_from_owner_text.trim().length > 0).length;
    const percentualRespondidas = total > 0 ? Math.round((respondidas / total) * 100) : 0;

    // Reviews por mês (últimos 12 meses)
    const reviewsPorMes: Record<string, { total: number; media: number }> = {};
    const hoje = new Date();
    
    for (let i = 0; i < 12; i++) {
      const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`;
      reviewsPorMes[chave] = { total: 0, media: 0 };
    }

    reviewsData.forEach((r: any) => {
      if (r.published_at_date) {
        const data = new Date(r.published_at_date);
        const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        if (reviewsPorMes[chave]) {
          reviewsPorMes[chave].total++;
        }
      }
    });

    // Calcular média por mês
    Object.keys(reviewsPorMes).forEach(chave => {
      const reviewsDoMes = reviewsData.filter((r: any) => {
        if (!r.published_at_date) return false;
        const data = new Date(r.published_at_date);
        const chaveMes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        return chaveMes === chave;
      });
      
      if (reviewsDoMes.length > 0) {
        const soma = reviewsDoMes.reduce((acc: number, r: any) => acc + (r.stars || 0), 0);
        reviewsPorMes[chave].media = Math.round((soma / reviewsDoMes.length) * 100) / 100;
      }
    });

    // Ordenar meses cronologicamente
    const mesesOrdenados = Object.entries(reviewsPorMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, dados]) => ({
        mes,
        mesFormatado: new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        ...dados,
      }));

    return NextResponse.json({
      success: true,
      stats: {
        total,
        mediaEstrelas,
        distribuicao,
        categorias: {
          comida: mediaFood,
          servico: mediaService,
          ambiente: mediaAtmosphere,
        },
        textos: {
          comTexto,
          semTexto,
          percentualComTexto: total > 0 ? Math.round((comTexto / total) * 100) : 0,
        },
        respostas: {
          respondidas,
          naoRespondidas: total - respondidas,
          percentualRespondidas,
        },
        evolucaoMensal: mesesOrdenados,
      },
    });

  } catch (error) {
    console.error('Erro na API de stats Google Reviews:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
