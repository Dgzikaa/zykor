import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    // Obter parâmetros
    const body = await request.json().catch(() => ({}));
    const barId = body.bar_id || 3;
    const daysBack = body.days_back || 7;

    // Chamar Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/falae-nps-sync?bar_id=${barId}&days_back=${daysBack}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Erro ao chamar Edge Function:', error);
      return NextResponse.json(
        { error: 'Erro ao sincronizar com Falaê', details: error },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Erro na API de sync Falaê:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const periodo = searchParams.get('periodo') || 'semana'; // semana, mes, trimestre
    
    // Calcular datas
    const hoje = new Date();
    let dataInicio: Date;
    
    switch (periodo) {
      case 'mes':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        break;
      case 'trimestre':
        const mesAtual = hoje.getMonth();
        const trimestreInicio = Math.floor(mesAtual / 3) * 3;
        dataInicio = new Date(hoje.getFullYear(), trimestreInicio, 1);
        break;
      case 'semana':
      default:
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 7);
        break;
    }

    const dataInicioStr = dataInicio.toISOString().split('T')[0];
    const dataFimStr = hoje.toISOString().split('T')[0];

    // Buscar respostas do período
    const { data: respostas, error } = await supabase
      .from('falae_respostas')
      .select('nps, created_at, criterios, discursive_question')
      .eq('bar_id', barId)
      .gte('created_at', dataInicioStr)
      .lte('created_at', dataFimStr + 'T23:59:59')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar respostas:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    // Calcular métricas NPS
    const total = respostas?.length || 0;
    const promotores = respostas?.filter(r => r.nps >= 9).length || 0;
    const neutros = respostas?.filter(r => r.nps >= 7 && r.nps <= 8).length || 0;
    const detratores = respostas?.filter(r => r.nps <= 6).length || 0;
    const npsScore = total > 0 ? Math.round(((promotores - detratores) / total) * 100) : null;
    const mediaNps = total > 0 ? Math.round((respostas.reduce((acc, r) => acc + r.nps, 0) / total) * 10) / 10 : null;

    // Calcular médias por critério
    const criteriosTotais: Record<string, { soma: number; count: number }> = {};
    
    respostas?.forEach(r => {
      if (r.criterios && Array.isArray(r.criterios)) {
        r.criterios.forEach((c: any) => {
          if (c.type === 'Rating' && c.name) {
            const nota = parseFloat(c.name);
            if (!isNaN(nota)) {
              const nick = c.nick || 'Geral';
              if (!criteriosTotais[nick]) {
                criteriosTotais[nick] = { soma: 0, count: 0 };
              }
              criteriosTotais[nick].soma += nota;
              criteriosTotais[nick].count++;
            }
          }
        });
      }
    });

    const criteriosMedias = Object.entries(criteriosTotais).map(([nome, dados]) => ({
      nome,
      media: Math.round((dados.soma / dados.count) * 10) / 10,
      total: dados.count,
    }));

    // Últimos comentários (detratores primeiro)
    const comentarios = respostas
      ?.filter(r => r.discursive_question && r.discursive_question.trim().length > 0)
      .slice(0, 10)
      .map(r => ({
        nps: r.nps,
        comentario: r.discursive_question,
        data: r.created_at,
        tipo: r.nps >= 9 ? 'promotor' : r.nps <= 6 ? 'detrator' : 'neutro',
      })) || [];

    return NextResponse.json({
      periodo: { inicio: dataInicioStr, fim: dataFimStr },
      metricas: {
        total_respostas: total,
        nps_score: npsScore,
        media_nps: mediaNps,
        promotores,
        neutros,
        detratores,
        perc_promotores: total > 0 ? Math.round((promotores / total) * 100) : 0,
        perc_detratores: total > 0 ? Math.round((detratores / total) * 100) : 0,
      },
      criterios: criteriosMedias,
      ultimos_comentarios: comentarios,
    });

  } catch (error) {
    console.error('Erro na API de NPS Falaê:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
