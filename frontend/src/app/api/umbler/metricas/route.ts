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
    // MÉTRICAS DE CAMPANHAS
    // ========================================

    // Total de campanhas
    const { count: totalCampanhas } = await supabase
      .from('umbler_campanhas')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', parseInt(barId))
      .gte('created_at', dataInicioStr);

    // Campanhas concluídas
    const { data: campanhasConcluidas } = await supabase
      .from('umbler_campanhas')
      .select('enviados, erros, total_destinatarios, respostas')
      .eq('bar_id', parseInt(barId))
      .eq('status', 'concluida')
      .gte('created_at', dataInicioStr);

    const totalEnviados = campanhasConcluidas?.reduce((sum, c) => sum + (c.enviados || 0), 0) || 0;
    const totalErros = campanhasConcluidas?.reduce((sum, c) => sum + (c.erros || 0), 0) || 0;
    const totalDestinatarios = campanhasConcluidas?.reduce((sum, c) => sum + (c.total_destinatarios || 0), 0) || 0;
    const totalRespostas = campanhasConcluidas?.reduce((sum, c) => sum + (c.respostas || 0), 0) || 0;

    // Taxa de entrega e resposta
    const taxaEntrega = totalDestinatarios > 0 ? (totalEnviados / totalDestinatarios) * 100 : 0;
    const taxaResposta = totalEnviados > 0 ? (totalRespostas / totalEnviados) * 100 : 0;

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
      },
      campanhas: {
        total: totalCampanhas || 0,
        concluidas: campanhasConcluidas?.length || 0,
        total_enviados: totalEnviados,
        total_erros: totalErros,
        total_respostas: totalRespostas,
        taxa_entrega: Math.round(taxaEntrega * 100) / 100,
        taxa_resposta: Math.round(taxaResposta * 100) / 100
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
