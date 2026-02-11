import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface ReviewSummary {
  total: number;
  media: number;
  distribuicao: Record<number, number>;
  elogios: string[];
  criticas: string[];
  reviewsComTexto: {
    nome: string;
    stars: number;
    texto: string;
    data: string;
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Erro ao conectar com banco' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');

    if (!dataInicio || !dataFim) {
      return NextResponse.json({ 
        error: 'Parâmetros data_inicio e data_fim são obrigatórios' 
      }, { status: 400 });
    }

    // Buscar reviews do período (usando timezone de Brasília -03:00)
    const { data: reviews, error } = await supabase
      .from('google_reviews')
      .select('reviewer_name, stars, text, published_at_date')
      .eq('bar_id', barId)
      .gte('published_at_date', dataInicio + 'T00:00:00-03:00')
      .lte('published_at_date', dataFim + 'T23:59:59-03:00')
      .order('published_at_date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar reviews:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    const reviewsData = (reviews || []) as any[];
    const total = reviewsData.length;
    
    // Calcular média de estrelas
    const reviewsComStars = reviewsData.filter(r => r.stars !== null);
    const somaEstrelas = reviewsComStars.reduce((acc: number, r: any) => acc + (r.stars || 0), 0);
    const media = reviewsComStars.length > 0 
      ? Math.round((somaEstrelas / reviewsComStars.length) * 100) / 100 
      : 0;

    // Distribuição por estrelas
    const distribuicao: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviewsComStars.forEach((r: any) => {
      if (r.stars >= 1 && r.stars <= 5) {
        distribuicao[r.stars]++;
      }
    });

    // Filtrar reviews com texto
    const reviewsComTexto = reviewsData.filter(r => r.text && r.text.trim().length > 10);
    
    // Extrair palavras-chave de elogios e críticas
    const elogios: string[] = [];
    const criticas: string[] = [];
    
    // Palavras-chave comuns em elogios
    const palavrasElogio = [
      'excelente', 'ótimo', 'maravilhoso', 'incrível', 'perfeito', 'delicioso', 'deliciosa',
      'melhor', 'adorei', 'amei', 'recomendo', 'ambiente', 'atendimento', 'música', 
      'comida', 'bebida', 'cerveja', 'gelada', 'geladíssima', 'rápido', 'eficiente',
      'aconchegante', 'agradável', 'fantástico', 'sensacional', 'top', 'impecável',
      'diversificado', 'variado', 'bom preço', 'preço justo', 'custo-benefício',
      'pagode', 'samba', 'banda', 'show', 'petiscos', 'drinks', 'coquetéis'
    ];
    
    // Palavras-chave comuns em críticas
    const palavrasCritica = [
      'ruim', 'péssimo', 'horrível', 'demora', 'demorado', 'lento', 'caro',
      'barulho', 'barulhento', 'lotado', 'cheio', 'fila', 'espera', 'alto',
      'desorganizado', 'desorganização', 'sujo', 'suja', 'frio', 'quente',
      'errado', 'confuso', 'problema', 'reclamação', 'decepção', 'frustração',
      'estacionamento', 'difícil', 'não recomendo', 'nunca mais'
    ];
    
    // Analisar textos para extrair padrões (versão simplificada sem IA)
    const mapElogios = new Map<string, number>();
    const mapCriticas = new Map<string, number>();
    
    reviewsComTexto.forEach((review: any) => {
      const texto = review.text.toLowerCase();
      const isPositivo = review.stars >= 4;
      const isNegativo = review.stars <= 2;
      
      // Procurar padrões de elogios em reviews positivas
      if (isPositivo) {
        palavrasElogio.forEach(palavra => {
          if (texto.includes(palavra.toLowerCase())) {
            mapElogios.set(palavra, (mapElogios.get(palavra) || 0) + 1);
          }
        });
      }
      
      // Procurar padrões de críticas em reviews negativas ou neutras
      if (isNegativo || review.stars === 3) {
        palavrasCritica.forEach(palavra => {
          if (texto.includes(palavra.toLowerCase())) {
            mapCriticas.set(palavra, (mapCriticas.get(palavra) || 0) + 1);
          }
        });
      }
    });
    
    // Ordenar por frequência e pegar top 10
    const topElogios = Array.from(mapElogios.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([palavra]) => palavra);
    
    const topCriticas = Array.from(mapCriticas.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([palavra]) => palavra);

    // Preparar lista de reviews com texto para exibição
    const reviewsParaExibir = reviewsComTexto.slice(0, 5).map((r: any) => ({
      nome: r.reviewer_name || 'Anônimo',
      stars: r.stars,
      texto: r.text.substring(0, 150) + (r.text.length > 150 ? '...' : ''),
      data: new Date(r.published_at_date).toLocaleDateString('pt-BR')
    }));

    const summary: ReviewSummary = {
      total,
      media,
      distribuicao,
      elogios: topElogios,
      criticas: topCriticas,
      reviewsComTexto: reviewsParaExibir
    };

    return NextResponse.json({
      success: true,
      summary,
      periodo: { dataInicio, dataFim }
    });

  } catch (error) {
    console.error('Erro na API de period-summary Google Reviews:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
