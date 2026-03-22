import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * API de Analytics do Calendário Operacional
 * Retorna estatísticas e insights sobre dias abertos/fechados
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    const mes = searchParams.get('mes') ? parseInt(searchParams.get('mes')!) : null;
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    // Definir período de análise
    const dataInicio = mes ? `${ano}-${mes.toString().padStart(2, '0')}-01` : `${ano}-01-01`;
    const dataFim = mes 
      ? new Date(ano, mes, 0).toISOString().split('T')[0] 
      : `${ano}-12-31`;

    // 1. BUSCAR REGISTROS MANUAIS DO CALENDÁRIO
    const { data: registrosCalendario, error: errorCalendario } = await supabase
      .from('calendario_operacional')
      .select('*')
      .eq('bar_id', barId)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: true });

    if (errorCalendario) {
      console.error('Erro ao buscar calendário:', errorCalendario);
      throw errorCalendario;
    }

    // 2. BUSCAR MOVIMENTAÇÃO DE eventos_base PARA VALIDAÇÃO
    const { data: movimentacoes, error: errorMovimentacoes } = await supabase
      .from('eventos_base')
      .select('data_evento, real_r, cl_real')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lte('data_evento', dataFim);

    if (errorMovimentacoes) {
      console.warn('Erro ao buscar movimentações:', errorMovimentacoes);
    }

    // Criar map de movimentações
    const movimentacoesMap = new Map(
      (movimentacoes || []).map(m => [
        m.data_evento, 
        { 
          vendas: parseFloat(m.real_r || '0'),
          clientes: parseInt(m.cl_real || '0')
        }
      ])
    );

    // 3. GERAR TODOS OS DIAS DO PERÍODO
    const inicioPeriodo = new Date(dataInicio);
    const fimPeriodo = new Date(dataFim);
    const todosDias: Array<{
      data: string;
      diaSemana: number;
      status: 'aberto' | 'fechado';
      fonte: 'manual' | 'movimento' | 'padrao';
      motivo: string;
      temRegistroManual: boolean;
      temMovimento: boolean;
      valorMovimento: number;
      qtdClientes: number;
    }> = [];

    const ultimaTercaOperacional = new Date('2025-04-15T12:00:00Z');

    for (let d = new Date(inicioPeriodo); d <= fimPeriodo; d.setDate(d.getDate() + 1)) {
      const dataStr = d.toISOString().split('T')[0];
      const diaSemana = d.getDay();
      
      // Verificar registro manual
      const registro = registrosCalendario?.find(r => r.data === dataStr);
      const temRegistroManual = !!registro;
      
      // Verificar movimento
      const movimento = movimentacoesMap.get(dataStr);
      const temMovimento = movimento && movimento.vendas > 0;
      
      // Determinar status
      let status: 'aberto' | 'fechado' = 'fechado';
      let fonte: 'manual' | 'movimento' | 'padrao' = 'padrao';
      let motivo = '';

      if (registro) {
        status = registro.status as 'aberto' | 'fechado';
        fonte = 'manual';
        motivo = registro.motivo || '';
      } else if (d < new Date()) {
        // Passado: usar movimento
        status = temMovimento ? 'aberto' : 'fechado';
        fonte = 'movimento';
        motivo = temMovimento ? 'Movimento detectado' : 'Sem movimento';
      } else {
        // Futuro: padrão semanal
        if ((diaSemana === 2 && d > ultimaTercaOperacional) || diaSemana === 1) {
          status = 'fechado';
          motivo = diaSemana === 1 ? 'Segunda-feira (padrão)' : 'Terça-feira (padrão)';
        } else {
          status = 'aberto';
          motivo = 'Dia normal';
        }
      }

      todosDias.push({
        data: dataStr,
        diaSemana,
        status,
        fonte,
        motivo,
        temRegistroManual,
        temMovimento: !!temMovimento,
        valorMovimento: movimento?.vendas || 0,
        qtdClientes: movimento?.clientes || 0
      });
    }

    // 4. CALCULAR ESTATÍSTICAS
    const diasAbertos = todosDias.filter(d => d.status === 'aberto');
    const diasFechados = todosDias.filter(d => d.status === 'fechado');
    const diasComRegistroManual = todosDias.filter(d => d.temRegistroManual);
    const diasComMovimento = todosDias.filter(d => d.temMovimento);

    // Por dia da semana
    const porDiaSemana = [0, 1, 2, 3, 4, 5, 6].map(dia => {
      const dias = todosDias.filter(d => d.diaSemana === dia);
      const abertos = dias.filter(d => d.status === 'aberto');
      const fechados = dias.filter(d => d.status === 'fechado');
      
      return {
        dia,
        diaLabel: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dia],
        total: dias.length,
        abertos: abertos.length,
        fechados: fechados.length,
        percentualAberto: dias.length > 0 ? (abertos.length / dias.length * 100).toFixed(1) : '0'
      };
    });

    // Por mês (se ano inteiro)
    const porMes = !mes ? Array.from({ length: 12 }, (_, i) => {
      const mesNum = i + 1;
      const dias = todosDias.filter(d => {
        const [, m] = d.data.split('-');
        return parseInt(m) === mesNum;
      });
      const abertos = dias.filter(d => d.status === 'aberto');
      const fechados = dias.filter(d => d.status === 'fechado');

      return {
        mes: mesNum,
        mesLabel: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i],
        total: dias.length,
        abertos: abertos.length,
        fechados: fechados.length,
        percentualAberto: dias.length > 0 ? (abertos.length / dias.length * 100).toFixed(1) : '0'
      };
    }) : null;

    // Sequências (maior sequência de dias abertos/fechados consecutivos)
    let maiorSequenciaAbertos = 0;
    let sequenciaAtualAbertos = 0;
    let maiorSequenciaFechados = 0;
    let sequenciaAtualFechados = 0;

    todosDias.forEach(dia => {
      if (dia.status === 'aberto') {
        sequenciaAtualAbertos++;
        sequenciaAtualFechados = 0;
        maiorSequenciaAbertos = Math.max(maiorSequenciaAbertos, sequenciaAtualAbertos);
      } else {
        sequenciaAtualFechados++;
        sequenciaAtualAbertos = 0;
        maiorSequenciaFechados = Math.max(maiorSequenciaFechados, sequenciaAtualFechados);
      }
    });

    // Faturamento total em dias abertos vs fechados (apenas com movimento)
    const faturamentoDiasAbertos = diasAbertos
      .filter(d => d.temMovimento)
      .reduce((sum, d) => sum + d.valorMovimento, 0);
    
    const faturamentoDiasFechados = diasFechados
      .filter(d => d.temMovimento)
      .reduce((sum, d) => sum + d.valorMovimento, 0);

    // Motivos mais comuns
    const motivosMap = new Map<string, number>();
    diasFechados.forEach(dia => {
      if (dia.motivo) {
        motivosMap.set(dia.motivo, (motivosMap.get(dia.motivo) || 0) + 1);
      }
    });

    const motivosMaisComuns = Array.from(motivosMap.entries())
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 5. RETORNAR ANALYTICS
    return NextResponse.json({
      success: true,
      data: {
        periodo: {
          ano,
          mes,
          dataInicio,
          dataFim,
          totalDias: todosDias.length
        },
        resumo: {
          diasAbertos: diasAbertos.length,
          diasFechados: diasFechados.length,
          percentualAberto: ((diasAbertos.length / todosDias.length) * 100).toFixed(1),
          diasComRegistroManual: diasComRegistroManual.length,
          diasComMovimento: diasComMovimento.length,
          maiorSequenciaAbertos,
          maiorSequenciaFechados
        },
        faturamento: {
          totalDiasAbertos: faturamentoDiasAbertos,
          totalDiasFechados: faturamentoDiasFechados,
          mediaDiaAberto: diasAbertos.filter(d => d.temMovimento).length > 0 
            ? faturamentoDiasAbertos / diasAbertos.filter(d => d.temMovimento).length 
            : 0
        },
        porDiaSemana,
        porMes,
        motivosMaisComuns,
        detalhes: {
          diasComInconsistencia: diasFechados.filter(d => d.temMovimento).length, // Dias marcados como fechados mas com movimento
          diasSemMovimento: diasAbertos.filter(d => !d.temMovimento && new Date(d.data) < new Date()).length // Dias abertos sem movimento
        }
      }
    });

  } catch (error) {
    console.error('Erro na API de analytics do calendário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

