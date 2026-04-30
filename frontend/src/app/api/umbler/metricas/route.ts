import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/umbler/metricas
 * Retorna métricas de uso do chatbot e campanhas
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id') || '3';
    const periodo = searchParams.get('periodo') || '7'; // dias

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - parseInt(periodo));
    const dataInicioStr = dataInicio.toISOString();

    // ========================================
    // MÉTRICAS DE CONVERSAS
    // ========================================
    
    // Total de conversas no período
    const { count: totalConversas } = await supabase
      .from('umbler_conversas')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', parseInt(barId))
      .gte('created_at', dataInicioStr);

    // Conversas por status
    const { data: conversasPorStatus } = await supabase
      .from('umbler_conversas')
      .select('status')
      .eq('bar_id', parseInt(barId))
      .gte('created_at', dataInicioStr);

    const statusCount = (conversasPorStatus || []).reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Tempo médio de resposta
    const { data: temposResposta } = await supabase
      .from('umbler_conversas')
      .select('tempo_primeira_resposta_segundos')
      .eq('bar_id', parseInt(barId))
      .gte('created_at', dataInicioStr)
      .not('tempo_primeira_resposta_segundos', 'is', null);

    const tempoMedioResposta = temposResposta && temposResposta.length > 0
      ? temposResposta.reduce((sum, c) => sum + (c.tempo_primeira_resposta_segundos || 0), 0) / temposResposta.length
      : 0;

    // Tempo médio de atendimento
    const { data: temposAtendimento } = await supabase
      .from('umbler_conversas')
      .select('tempo_total_segundos')
      .eq('bar_id', parseInt(barId))
      .gte('created_at', dataInicioStr)
      .not('tempo_total_segundos', 'is', null);

    const tempoMedioAtendimento = temposAtendimento && temposAtendimento.length > 0
      ? temposAtendimento.reduce((sum, c) => sum + (c.tempo_total_segundos || 0), 0) / temposAtendimento.length
      : 0;

    // ========================================
    // MÉTRICAS DE MENSAGENS
    // ========================================

    // Total de mensagens
    const { count: totalMensagens } = await supabase
      .from('umbler_mensagens')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', parseInt(barId))
      .gte('created_at', dataInicioStr);

    // Mensagens por direção
    const { data: mensagensPorDirecao } = await supabase
      .from('umbler_mensagens')
      .select('direcao')
      .eq('bar_id', parseInt(barId))
      .gte('created_at', dataInicioStr);

    const direcaoCount = (mensagensPorDirecao || []).reduce((acc, m) => {
      acc[m.direcao] = (acc[m.direcao] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Mensagens por tipo de remetente
    const { data: mensagensPorRemetente } = await supabase
      .from('umbler_mensagens')
      .select('tipo_remetente')
      .eq('bar_id', parseInt(barId))
      .gte('created_at', dataInicioStr);

    const remetenteCount = (mensagensPorRemetente || []).reduce((acc, m) => {
      acc[m.tipo_remetente || 'desconhecido'] = (acc[m.tipo_remetente || 'desconhecido'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // ========================================
    // MÉTRICAS DE CAMPANHAS — REMOVIDO 2026-04-27
    // CUT Feature B: time usa portal Umbler direto. Métricas de envio em massa
    // estão em /api/umbler/bulksend (lê da API Umbler) e /crm/campanhas/analise.
    // ========================================

    // ========================================
    // CONVERSAS POR DIA (para gráfico)
    // ========================================

    const { data: conversasPorDia } = await supabase
      .from('umbler_conversas')
      .select('created_at')
      .eq('bar_id', parseInt(barId))
      .gte('created_at', dataInicioStr);

    const porDia = (conversasPorDia || []).reduce((acc, c) => {
      const dia = c.created_at.split('T')[0];
      acc[dia] = (acc[dia] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // ========================================
    // CORRELAÇÃO COM CLIENTES
    // ========================================

    const { count: conversasCorrelacionadas } = await supabase
      .from('umbler_conversas')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', parseInt(barId))
      .not('cliente_id', 'is', null)
      .gte('created_at', dataInicioStr);

    const taxaCorrelacao = totalConversas && totalConversas > 0
      ? ((conversasCorrelacionadas || 0) / totalConversas) * 100
      : 0;

    return NextResponse.json({
      periodo: parseInt(periodo),
      conversas: {
        total: totalConversas || 0,
        por_status: statusCount,
        tempo_medio_resposta_segundos: Math.round(tempoMedioResposta),
        tempo_medio_atendimento_segundos: Math.round(tempoMedioAtendimento),
        por_dia: porDia,
        correlacionadas_contahub: conversasCorrelacionadas || 0,
        taxa_correlacao: Math.round(taxaCorrelacao * 100) / 100
      },
      mensagens: {
        total: totalMensagens || 0,
        por_direcao: direcaoCount,
        por_remetente: remetenteCount
      }
    });

  } catch (error) {
    console.error('Erro na API Umbler Métricas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
