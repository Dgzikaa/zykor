import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Estatísticas de chamados
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const periodo = searchParams.get('periodo') || '30'; // dias

    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - parseInt(periodo));

    // Buscar todos os chamados do período
    const { data: chamados, error } = await supabase
      .from('chamados')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .gte('criado_em', dataInicio.toISOString());

    if (error) {
      console.error('Erro ao buscar chamados:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar estatísticas', details: error.message },
        { status: 500 }
      );
    }

    const todosChamados = (chamados || []) as any[];

    // Calcular estatísticas
    const stats = {
      // Totais
      total: todosChamados.length,
      abertos: todosChamados.filter(c => c.status === 'aberto').length,
      em_andamento: todosChamados.filter(c => c.status === 'em_andamento').length,
      aguardando_cliente: todosChamados.filter(c => c.status === 'aguardando_cliente').length,
      resolvidos: todosChamados.filter(c => c.status === 'resolvido').length,
      fechados: todosChamados.filter(c => c.status === 'fechado').length,
      cancelados: todosChamados.filter(c => c.status === 'cancelado').length,

      // Por prioridade
      por_prioridade: {
        critica: todosChamados.filter(c => c.prioridade === 'critica').length,
        alta: todosChamados.filter(c => c.prioridade === 'alta').length,
        media: todosChamados.filter(c => c.prioridade === 'media').length,
        baixa: todosChamados.filter(c => c.prioridade === 'baixa').length
      },

      // Por categoria
      por_categoria: {
        bug: todosChamados.filter(c => c.categoria === 'bug').length,
        melhoria: todosChamados.filter(c => c.categoria === 'melhoria').length,
        duvida: todosChamados.filter(c => c.categoria === 'duvida').length,
        sugestao: todosChamados.filter(c => c.categoria === 'sugestao').length,
        urgente: todosChamados.filter(c => c.categoria === 'urgente').length
      },

      // Por módulo
      por_modulo: {} as Record<string, number>,

      // SLA
      sla_violados: todosChamados.filter(c => c.sla_violado).length,
      sla_em_risco: todosChamados.filter(c => {
        if (c.status === 'resolvido' || c.status === 'fechado' || c.status === 'cancelado') return false;
        const criado = new Date(c.criado_em);
        const slaHoras = c.sla_resolucao_horas || 72;
        const prazo = new Date(criado.getTime() + slaHoras * 60 * 60 * 1000);
        const agora = new Date();
        const horasRestantes = (prazo.getTime() - agora.getTime()) / (1000 * 60 * 60);
        return horasRestantes > 0 && horasRestantes < 12; // Menos de 12 horas para SLA
      }).length,

      // Tempos médios (em horas)
      tempo_medio_primeira_resposta: 0,
      tempo_medio_resolucao: 0,

      // Avaliação
      avaliacao_media: 0,
      total_avaliacoes: 0
    };

    // Calcular por módulo
    todosChamados.forEach(c => {
      const modulo = c.modulo || 'outro';
      stats.por_modulo[modulo] = (stats.por_modulo[modulo] || 0) + 1;
    });

    // Calcular tempos médios
    const chamadosComPrimeiraResposta = todosChamados.filter(c => c.primeira_resposta_em);
    if (chamadosComPrimeiraResposta.length > 0) {
      const tempoTotal = chamadosComPrimeiraResposta.reduce((acc, c) => {
        const criado = new Date(c.criado_em);
        const resposta = new Date(c.primeira_resposta_em);
        return acc + (resposta.getTime() - criado.getTime()) / (1000 * 60 * 60);
      }, 0);
      stats.tempo_medio_primeira_resposta = parseFloat((tempoTotal / chamadosComPrimeiraResposta.length).toFixed(2));
    }

    const chamadosResolvidos = todosChamados.filter(c => c.resolvido_em);
    if (chamadosResolvidos.length > 0) {
      const tempoTotal = chamadosResolvidos.reduce((acc, c) => {
        const criado = new Date(c.criado_em);
        const resolvido = new Date(c.resolvido_em);
        return acc + (resolvido.getTime() - criado.getTime()) / (1000 * 60 * 60);
      }, 0);
      stats.tempo_medio_resolucao = parseFloat((tempoTotal / chamadosResolvidos.length).toFixed(2));
    }

    // Calcular avaliação média
    const chamadosAvaliados = todosChamados.filter(c => c.avaliacao_nota);
    if (chamadosAvaliados.length > 0) {
      const notaTotal = chamadosAvaliados.reduce((acc, c) => acc + c.avaliacao_nota, 0);
      stats.avaliacao_media = parseFloat((notaTotal / chamadosAvaliados.length).toFixed(2));
      stats.total_avaliacoes = chamadosAvaliados.length;
    }

    // Chamados por dia (últimos 7 dias)
    const chamadosPorDia: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const dia = new Date();
      dia.setDate(dia.getDate() - i);
      const diaStr = dia.toISOString().split('T')[0];
      chamadosPorDia[diaStr] = 0;
    }
    todosChamados.forEach(c => {
      const diaStr = c.criado_em.split('T')[0];
      if (chamadosPorDia[diaStr] !== undefined) {
        chamadosPorDia[diaStr]++;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        chamados_por_dia: chamadosPorDia,
        periodo_dias: parseInt(periodo)
      }
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
