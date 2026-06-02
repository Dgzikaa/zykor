import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId') || '3';
    const periodo = searchParams.get('periodo') || '7'; // dias

    const supabase = createServiceRoleClient();
    
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - parseInt(periodo));

    // Métricas gerais
    const { data: metricas, error: errMetricas } = await supabase
      .from('agente_uso')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .gte('created_at', dataInicio.toISOString());

    if (errMetricas) throw errMetricas;

    // Calcular estatísticas
    const totalQueries = metricas?.length || 0;
    const queriesComSucesso = metricas?.filter(m => m.success).length || 0;
    const cacheHits = metricas?.filter(m => m.cache_hit).length || 0;
    const tempoMedio = metricas?.reduce((acc, m) => acc + (m.response_time_ms || 0), 0) / Math.max(totalQueries, 1);
    const feedbacks = metricas?.filter(m => m.feedback_rating !== null) || [];
    const ratingMedio = feedbacks.reduce((acc, m) => acc + (m.feedback_rating || 0), 0) / Math.max(feedbacks.length, 1);

    // Agrupar por agente
    const porAgente: Record<string, { queries: number; tempo_medio: number; rating_medio: number }> = {};
    metricas?.forEach(m => {
      if (!porAgente[m.agent_name]) {
        porAgente[m.agent_name] = { queries: 0, tempo_medio: 0, rating_medio: 0 };
      }
      porAgente[m.agent_name].queries++;
    });

    // Calcular médias por agente
    Object.keys(porAgente).forEach(agente => {
      const agentMetrics = metricas?.filter(m => m.agent_name === agente);
      const total = agentMetrics?.length || 1;
      porAgente[agente].tempo_medio = agentMetrics?.reduce((acc, m) => acc + (m.response_time_ms || 0), 0) / total;
      const agentFeedbacks = agentMetrics?.filter(m => m.feedback_rating !== null);
      if (agentFeedbacks?.length) {
        porAgente[agente].rating_medio = agentFeedbacks.reduce((acc, m) => acc + (m.feedback_rating || 0), 0) / agentFeedbacks.length;
      }
    });

    // Agrupar por intent
    const porIntent: Record<string, number> = {};
    metricas?.forEach(m => {
      porIntent[m.intent] = (porIntent[m.intent] || 0) + 1;
    });

    // Ordenar intents por frequência
    const topIntents = Object.entries(porIntent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Agrupar por hora (últimas 24h)
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    
    const metricasRecentes = metricas?.filter(m => new Date(m.created_at) >= ontem) || [];
    const porHora: Record<string, number> = {};
    
    metricasRecentes.forEach(m => {
      const hora = new Date(m.created_at).getHours();
      porHora[hora] = (porHora[hora] || 0) + 1;
    });

    // Transformar em array para gráfico
    const horasArray = Array.from({ length: 24 }, (_, i) => ({
      hora: i,
      queries: porHora[i] || 0
    }));

    // Agrupar por dia
    const porDia: Record<string, number> = {};
    metricas?.forEach(m => {
      const dia = new Date(m.created_at).toISOString().split('T')[0];
      porDia[dia] = (porDia[dia] || 0) + 1;
    });

    const diasArray = Object.entries(porDia)
      .map(([dia, queries]) => ({ dia, queries }))
      .sort((a, b) => a.dia.localeCompare(b.dia));

    return NextResponse.json({
      success: true,
      resumo: {
        totalQueries,
        queriesComSucesso,
        taxaSucesso: totalQueries > 0 ? (queriesComSucesso / totalQueries * 100).toFixed(1) : '0',
        cacheHits,
        taxaCache: totalQueries > 0 ? (cacheHits / totalQueries * 100).toFixed(1) : '0',
        tempoMedio: Math.round(tempoMedio),
        ratingMedio: ratingMedio.toFixed(2),
        totalFeedbacks: feedbacks.length
      },
      porAgente,
      topIntents,
      porHora: horasArray,
      porDia: diasArray
    });

  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
