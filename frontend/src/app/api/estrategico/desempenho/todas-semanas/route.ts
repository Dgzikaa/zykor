import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    // Obter parâmetros
    const { searchParams } = new URL(request.url);
    const ano = searchParams.get('ano'); // opcional - se não passar, busca todos
    
    // Obter bar_id do header
    const userDataHeader = request.headers.get('x-user-data');
    let barId = 3; // Default
    
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader));
        if (userData.bar_id) barId = userData.bar_id;
      } catch (e) {
        console.warn('Erro ao parsear user data:', e);
      }
    }

    // Buscar todas as semanas do bar, ordenadas por ano e semana
    let query = supabase
      .from('desempenho_semanal')
      .select('*')
      .eq('bar_id', barId)
      .order('ano', { ascending: true })
      .order('numero_semana', { ascending: true });
    
    if (ano) {
      query = query.eq('ano', parseInt(ano));
    }

    const { data: semanas, error } = await query;

    if (error) {
      console.error('Erro ao buscar semanas:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    // Buscar dados de marketing para mesclar
    let marketingQuery = supabase
      .from('marketing_semanal')
      .select('*')
      .eq('bar_id', barId);
    
    if (ano) {
      marketingQuery = marketingQuery.eq('ano', parseInt(ano));
    }

    const { data: marketingData } = await marketingQuery;

    // Criar mapa de marketing por semana/ano
    const marketingMap = new Map<string, any>();
    marketingData?.forEach(m => {
      marketingMap.set(`${m.ano}-${m.semana}`, m);
    });

    // Mesclar dados
    const semanasCompletas = semanas?.map(s => {
      const marketing = marketingMap.get(`${s.ano}-${s.numero_semana}`);
      return {
        ...s,
        ...(marketing ? {
          o_num_posts: marketing.o_num_posts,
          o_alcance: marketing.o_alcance,
          o_interacao: marketing.o_interacao,
          o_compartilhamento: marketing.o_compartilhamento,
          o_engajamento: marketing.o_engajamento,
          o_num_stories: marketing.o_num_stories,
          o_visu_stories: marketing.o_visu_stories,
          m_valor_investido: marketing.m_valor_investido,
          m_alcance: marketing.m_alcance,
          m_frequencia: marketing.m_frequencia,
          m_cpm: marketing.m_cpm,
          m_cliques: marketing.m_cliques,
          m_ctr: marketing.m_ctr,
          m_custo_por_clique: marketing.m_cpc,
          m_conversas_iniciadas: marketing.m_conversas_iniciadas,
        } : {})
      };
    }) || [];

    // Calcular semana atual ISO
    const hoje = new Date();
    const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const semanaAtual = Math.ceil((((d.getTime() - inicioAno.getTime()) / 86400000) + 1) / 7);
    const anoAtual = d.getUTCFullYear();

    return NextResponse.json({
      success: true,
      semanas: semanasCompletas,
      semanaAtual,
      anoAtual,
      totalSemanas: semanasCompletas.length,
      barId
    });

  } catch (error) {
    console.error('Erro na API de todas semanas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
