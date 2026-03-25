import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface RespostaDetalhada {
  id: string;
  nps: number;
  data: string;
  dataVisita: string | null;
  comentario: string | null;
  clientName: string | null;
  clientEmail: string | null;
  tipo: 'promotor' | 'neutro' | 'detrator';
  criterios: { nome: string; nota: number }[];
}

interface NpsDetailedSummary {
  searchName: string;
  total: number;
  npsScore: number | null;
  promotores: number;
  neutros: number;
  detratores: number;
  mediaNotas: number | null;
  respostas: RespostaDetalhada[];
  criteriosMedia: { nome: string; media: number; total: number }[];
}

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
    const searchName = searchParams.get('search_name') || null;

    if (!barId || Number.isNaN(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    if (!dataInicio || !dataFim) {
      return NextResponse.json({ error: 'data_inicio e data_fim são obrigatórios' }, { status: 400 });
    }

    let query = supabase
      .from('falae_respostas')
      .select('id, falae_id, nps, created_at, data_visita, discursive_question, client_name, client_email, search_name, criterios')
      .eq('bar_id', barId)
      .or(`data_visita.gte.${dataInicio},and(data_visita.is.null,created_at.gte.${dataInicio})`)
      .or(`data_visita.lte.${dataFim},and(data_visita.is.null,created_at.lte.${dataFim}T23:59:59)`)
      .order('created_at', { ascending: false });

    if (searchName) {
      query = query.eq('search_name', searchName);
    }

    const { data: respostas, error } = await query;

    if (error) {
      console.error('Erro ao buscar respostas Falaê:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    const filtradas = (respostas || []).filter((r: any) => {
      const dataRef = r.data_visita || r.created_at?.split('T')[0];
      return dataRef >= dataInicio && dataRef <= dataFim;
    }) as any[];

    const total = filtradas.length;
    const promotores = filtradas.filter(r => r.nps >= 9).length;
    const neutros = filtradas.filter(r => r.nps >= 7 && r.nps <= 8).length;
    const detratores = filtradas.filter(r => r.nps <= 6).length;
    const npsScore = total > 0 ? Math.round(((promotores - detratores) / total) * 100) : null;
    const mediaNotas = total > 0 ? Math.round((filtradas.reduce((acc, r) => acc + (r.nps || 0), 0) / total) * 10) / 10 : null;

    const criteriosTotais: Record<string, { soma: number; count: number }> = {};

    const respostasDetalhadas: RespostaDetalhada[] = filtradas.map((r: any) => {
      const criteriosArray: { nome: string; nota: number }[] = [];
      
      if (r.criterios && Array.isArray(r.criterios)) {
        r.criterios.forEach((c: any) => {
          if (c.type === 'Rating' && c.name) {
            const nota = parseFloat(c.name);
            if (!isNaN(nota)) {
              const nick = c.nick || 'Geral';
              criteriosArray.push({ nome: nick, nota });
              
              if (!criteriosTotais[nick]) {
                criteriosTotais[nick] = { soma: 0, count: 0 };
              }
              criteriosTotais[nick].soma += nota;
              criteriosTotais[nick].count++;
            }
          }
        });
      }

      return {
        id: r.falae_id || r.id,
        nps: r.nps,
        data: new Date(r.created_at).toLocaleDateString('pt-BR'),
        dataVisita: r.data_visita ? new Date(r.data_visita + 'T12:00:00').toLocaleDateString('pt-BR') : null,
        comentario: r.discursive_question || null,
        clientName: r.client_name || null,
        clientEmail: r.client_email || null,
        tipo: r.nps >= 9 ? 'promotor' : r.nps <= 6 ? 'detrator' : 'neutro',
        criterios: criteriosArray,
      };
    });

    const criteriosMedia = Object.entries(criteriosTotais)
      .map(([nome, { soma, count }]) => ({
        nome,
        media: Math.round((soma / count) * 10) / 10,
        total: count,
      }))
      .sort((a, b) => b.total - a.total);

    const summary: NpsDetailedSummary = {
      searchName: searchName || 'Todas',
      total,
      npsScore,
      promotores,
      neutros,
      detratores,
      mediaNotas,
      respostas: respostasDetalhadas,
      criteriosMedia,
    };

    return NextResponse.json({
      success: true,
      summary,
      periodo: { dataInicio, dataFim },
    });

  } catch (error) {
    console.error('Erro na API detailed-summary Falaê:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
