import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface ReviewPorDia {
  data: string;
  diaSemana: string;
  total: number;
  media: number;
  distribuicao: Record<number, number>;
}

interface ReviewDetalhada {
  nome: string;
  stars: number;
  texto: string;
  data: string;
  dataCompleta: string;
  tipo: 'positivo' | 'neutro' | 'negativo';
}

interface DetailedSummary {
  total: number;
  media: number;
  distribuicao: Record<number, number>;
  porDia: ReviewPorDia[];
  elogios: string[];
  criticas: string[];
  reviewsPositivas: ReviewDetalhada[];
  reviewsNegativas: ReviewDetalhada[];
  reviewsNeutras: ReviewDetalhada[];
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');
    const filtroEstrelas = searchParams.get('stars') ? parseInt(searchParams.get('stars')!) : null;

    if (!dataInicio || !dataFim) {
      return NextResponse.json({ 
        error: 'Parâmetros data_inicio e data_fim são obrigatórios' 
      }, { status: 400 });
    }

    // Usar query raw para garantir filtro por data local (não UTC)
    const { data: reviews, error } = await supabase
      .rpc('get_google_reviews_by_date', {
        p_bar_id: barId,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim
      });

    if (error) {
      console.error('Erro ao buscar reviews:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    // Filtrar por estrelas se especificado
    let reviewsData = (reviews || []) as any[];
    if (filtroEstrelas !== null && filtroEstrelas >= 1 && filtroEstrelas <= 5) {
      reviewsData = reviewsData.filter((r: any) => r.stars === filtroEstrelas);
    }
    const total = reviewsData.length;
    
    const reviewsComStars = reviewsData.filter(r => r.stars !== null);
    const somaEstrelas = reviewsComStars.reduce((acc: number, r: any) => acc + (r.stars || 0), 0);
    const media = reviewsComStars.length > 0 
      ? Math.round((somaEstrelas / reviewsComStars.length) * 1000) / 1000
      : 0;

    const distribuicao: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviewsComStars.forEach((r: any) => {
      if (r.stars >= 1 && r.stars <= 5) {
        distribuicao[r.stars]++;
      }
    });

    // Agrupar por dia (usando timezone de São Paulo)
    const porDiaMap = new Map<string, { total: number; soma: number; distribuicao: Record<number, number> }>();
    
    reviewsData.forEach((r: any) => {
      const data = new Date(r.published_at_date);
      // Converter para timezone de São Paulo (UTC-3)
      const dataLocal = new Date(data.getTime() - (3 * 60 * 60 * 1000) + (data.getTimezoneOffset() * 60 * 1000));
      const dataStr = `${dataLocal.getFullYear()}-${String(dataLocal.getMonth() + 1).padStart(2, '0')}-${String(dataLocal.getDate()).padStart(2, '0')}`;
      
      if (!porDiaMap.has(dataStr)) {
        porDiaMap.set(dataStr, { total: 0, soma: 0, distribuicao: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
      }
      
      const dia = porDiaMap.get(dataStr)!;
      dia.total++;
      if (r.stars) {
        dia.soma += r.stars;
        if (r.stars >= 1 && r.stars <= 5) {
          dia.distribuicao[r.stars]++;
        }
      }
    });

    const porDia: ReviewPorDia[] = Array.from(porDiaMap.entries())
      .map(([dataStr, dados]) => {
        const data = new Date(dataStr + 'T12:00:00');
        return {
          data: data.toLocaleDateString('pt-BR'),
          dataStr,
          diaSemana: DIAS_SEMANA[data.getDay()],
          total: dados.total,
          media: dados.total > 0 ? Math.round((dados.soma / dados.total) * 100) / 100 : 0,
          distribuicao: dados.distribuicao
        };
      })
      .sort((a, b) => {
        // Ordenar por data crescente (segunda a domingo)
        return a.dataStr.localeCompare(b.dataStr);
      })
      .map(({ dataStr: _dataStr, ...rest }) => rest);

    // Extrair elogios e críticas
    const reviewsComTexto = reviewsData.filter(r => r.text && r.text.trim().length > 10);
    
    const palavrasElogio = [
      'excelente', 'ótimo', 'maravilhoso', 'incrível', 'perfeito', 'delicioso',
      'melhor', 'adorei', 'amei', 'recomendo', 'atendimento', 'música', 
      'comida', 'bebida', 'gelada', 'ambiente', 'aconchegante', 'top'
    ];
    
    const palavrasCritica = [
      'ruim', 'péssimo', 'demora', 'demorado', 'lento', 'caro', 'lotado',
      'espera', 'barulho', 'desorganizado', 'problema', 'não recomendo'
    ];
    
    const mapElogios = new Map<string, number>();
    const mapCriticas = new Map<string, number>();
    
    reviewsComTexto.forEach((review: any) => {
      const texto = review.text.toLowerCase();
      const isPositivo = review.stars >= 4;
      const isNegativo = review.stars <= 2;
      
      if (isPositivo) {
        palavrasElogio.forEach(palavra => {
          if (texto.includes(palavra.toLowerCase())) {
            mapElogios.set(palavra, (mapElogios.get(palavra) || 0) + 1);
          }
        });
      }
      
      if (isNegativo || review.stars === 3) {
        palavrasCritica.forEach(palavra => {
          if (texto.includes(palavra.toLowerCase())) {
            mapCriticas.set(palavra, (mapCriticas.get(palavra) || 0) + 1);
          }
        });
      }
    });
    
    const topElogios = Array.from(mapElogios.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([palavra]) => palavra);
    
    const topCriticas = Array.from(mapCriticas.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([palavra]) => palavra);

    // Separar reviews por tipo
    const formatReview = (r: any): ReviewDetalhada => ({
      nome: r.reviewer_name || 'Anônimo',
      stars: r.stars,
      texto: r.text || '',
      data: new Date(r.published_at_date).toLocaleDateString('pt-BR'),
      dataCompleta: r.published_at_date,
      tipo: r.stars >= 4 ? 'positivo' : r.stars <= 2 ? 'negativo' : 'neutro'
    });

    const reviewsPositivas = reviewsComTexto
      .filter((r: any) => r.stars >= 4)
      .slice(0, 10)
      .map(formatReview);

    const reviewsNegativas = reviewsComTexto
      .filter((r: any) => r.stars <= 2)
      .slice(0, 10)
      .map(formatReview);

    const reviewsNeutras = reviewsComTexto
      .filter((r: any) => r.stars === 3)
      .slice(0, 5)
      .map(formatReview);

    const summary: DetailedSummary = {
      total,
      media,
      distribuicao,
      porDia,
      elogios: topElogios,
      criticas: topCriticas,
      reviewsPositivas,
      reviewsNegativas,
      reviewsNeutras
    };

    return NextResponse.json({
      success: true,
      summary,
      periodo: { dataInicio, dataFim }
    });

  } catch (error) {
    console.error('Erro na API detailed-summary Google Reviews:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
