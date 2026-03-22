import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    // Obter parâmetros
    const { searchParams } = new URL(request.url);
    const semana = parseInt(searchParams.get('semana') || '1');
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    
    // Obter bar_id do header x-selected-bar-id
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;
    
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    // Buscar dados da semana atual (desempenho + marketing em paralelo)
    const [desempenhoResult, marketingResult] = await Promise.all([
      supabase
        .from('desempenho_semanal')
        .select('*')
        .eq('bar_id', barId)
        .eq('numero_semana', semana)
        .eq('ano', ano)
        .single(),
      supabase
        .from('marketing_semanal')
        .select('*')
        .eq('bar_id', barId)
        .eq('semana', semana)
        .eq('ano', ano)
        .single()
    ]);

    if (desempenhoResult.error && desempenhoResult.error.code !== 'PGRST116') {
      console.error('Erro ao buscar semana:', desempenhoResult.error);
    }

    // Mesclar dados de desempenho com marketing
    const dadosSemana = desempenhoResult.data ? {
      ...desempenhoResult.data,
      // Sobrescrever com dados de marketing se existirem
      ...(marketingResult.data ? {
        o_num_posts: marketingResult.data.o_num_posts,
        o_alcance: marketingResult.data.o_alcance,
        o_interacao: marketingResult.data.o_interacao,
        o_compartilhamento: marketingResult.data.o_compartilhamento,
        o_engajamento: marketingResult.data.o_engajamento,
        o_num_stories: marketingResult.data.o_num_stories,
        o_visu_stories: marketingResult.data.o_visu_stories,
        m_valor_investido: marketingResult.data.m_valor_investido,
        m_alcance: marketingResult.data.m_alcance,
        m_frequencia: marketingResult.data.m_frequencia,
        m_cpm: marketingResult.data.m_cpm,
        m_cliques: marketingResult.data.m_cliques,
        m_ctr: marketingResult.data.m_ctr,
        m_custo_por_clique: marketingResult.data.m_cpc,
        m_conversas_iniciadas: marketingResult.data.m_conversas_iniciadas,
        // Google Ads
        g_valor_investido: marketingResult.data.g_valor_investido,
        g_impressoes: marketingResult.data.g_impressoes,
        g_cliques: marketingResult.data.g_cliques,
        g_ctr: marketingResult.data.g_ctr,
        g_solicitacoes_rotas: marketingResult.data.g_solicitacoes_rotas,
        // GMN
        gmn_total_acoes: marketingResult.data.gmn_total_acoes,
        gmn_total_visualizacoes: marketingResult.data.gmn_total_visualizacoes,
        gmn_solicitacoes_rotas: marketingResult.data.gmn_solicitacoes_rotas,
      } : {})
    } : null;

    // Calcular semana anterior
    let semanaAnterior = semana - 1;
    let anoAnterior = ano;
    if (semanaAnterior < 1) {
      semanaAnterior = 53;
      anoAnterior = ano - 1;
    }

    // Buscar dados da semana anterior (desempenho + marketing em paralelo)
    const [desempenhoAnteriorResult, marketingAnteriorResult] = await Promise.all([
      supabase
        .from('desempenho_semanal')
        .select('*')
        .eq('bar_id', barId)
        .eq('numero_semana', semanaAnterior)
        .eq('ano', anoAnterior)
        .single(),
      supabase
        .from('marketing_semanal')
        .select('*')
        .eq('bar_id', barId)
        .eq('semana', semanaAnterior)
        .eq('ano', anoAnterior)
        .single()
    ]);

    if (desempenhoAnteriorResult.error && desempenhoAnteriorResult.error.code !== 'PGRST116') {
      console.error('Erro ao buscar semana anterior:', desempenhoAnteriorResult.error);
    }

    // Mesclar dados anteriores
    const dadosSemanaAnterior = desempenhoAnteriorResult.data ? {
      ...desempenhoAnteriorResult.data,
      ...(marketingAnteriorResult.data ? {
        o_num_posts: marketingAnteriorResult.data.o_num_posts,
        o_alcance: marketingAnteriorResult.data.o_alcance,
        o_interacao: marketingAnteriorResult.data.o_interacao,
        o_compartilhamento: marketingAnteriorResult.data.o_compartilhamento,
        o_engajamento: marketingAnteriorResult.data.o_engajamento,
        o_num_stories: marketingAnteriorResult.data.o_num_stories,
        o_visu_stories: marketingAnteriorResult.data.o_visu_stories,
        m_valor_investido: marketingAnteriorResult.data.m_valor_investido,
        m_alcance: marketingAnteriorResult.data.m_alcance,
        m_frequencia: marketingAnteriorResult.data.m_frequencia,
        m_cpm: marketingAnteriorResult.data.m_cpm,
        m_cliques: marketingAnteriorResult.data.m_cliques,
        m_ctr: marketingAnteriorResult.data.m_ctr,
        m_custo_por_clique: marketingAnteriorResult.data.m_cpc,
        m_conversas_iniciadas: marketingAnteriorResult.data.m_conversas_iniciadas,
        g_valor_investido: marketingAnteriorResult.data.g_valor_investido,
        g_impressoes: marketingAnteriorResult.data.g_impressoes,
        g_cliques: marketingAnteriorResult.data.g_cliques,
        g_ctr: marketingAnteriorResult.data.g_ctr,
        g_solicitacoes_rotas: marketingAnteriorResult.data.g_solicitacoes_rotas,
        gmn_total_acoes: marketingAnteriorResult.data.gmn_total_acoes,
        gmn_total_visualizacoes: marketingAnteriorResult.data.gmn_total_visualizacoes,
        gmn_solicitacoes_rotas: marketingAnteriorResult.data.gmn_solicitacoes_rotas,
      } : {})
    } : null;

    // Contar total de semanas com dados
    const { count } = await supabase
      .from('desempenho_semanal')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', barId)
      .eq('ano', ano);

    return NextResponse.json({
      success: true,
      semana: dadosSemana || null,
      semanaAnterior: dadosSemanaAnterior || null,
      totalSemanas: count || 53,
      parametros: {
        semana,
        ano,
        barId
      }
    });

  } catch (error) {
    console.error('Erro na API de desempenho semanal:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
