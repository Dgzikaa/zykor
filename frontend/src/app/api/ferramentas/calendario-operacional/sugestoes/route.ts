import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * API de Sugestões Inteligentes para Calendário
 * Detecta feriados, padrões e sugere ajustes
 */

// Feriados nacionais 2025-2026
const FERIADOS_NACIONAIS = [
  { data: '2025-01-01', nome: 'Ano Novo', tipo: 'nacional' },
  { data: '2025-03-04', nome: 'Carnaval (terça)', tipo: 'facultativo' },
  { data: '2025-04-18', nome: 'Sexta-feira Santa', tipo: 'nacional' },
  { data: '2025-04-21', nome: 'Tiradentes', tipo: 'nacional' },
  { data: '2025-05-01', nome: 'Dia do Trabalho', tipo: 'nacional' },
  { data: '2025-06-19', nome: 'Corpus Christi', tipo: 'facultativo' },
  { data: '2025-09-07', nome: 'Independência', tipo: 'nacional' },
  { data: '2025-10-12', nome: 'Nossa Senhora Aparecida', tipo: 'nacional' },
  { data: '2025-11-02', nome: 'Finados', tipo: 'nacional' },
  { data: '2025-11-15', nome: 'Proclamação da República', tipo: 'nacional' },
  { data: '2025-11-20', nome: 'Consciência Negra', tipo: 'facultativo' },
  { data: '2025-12-25', nome: 'Natal', tipo: 'nacional' },
  { data: '2026-01-01', nome: 'Ano Novo', tipo: 'nacional' },
  { data: '2026-02-17', nome: 'Carnaval (terça)', tipo: 'facultativo' },
  { data: '2026-04-03', nome: 'Sexta-feira Santa', tipo: 'nacional' },
  { data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' },
  { data: '2026-05-01', nome: 'Dia do Trabalho', tipo: 'nacional' },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes') ? parseInt(searchParams.get('mes')!) : null;
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    // 1. FERIADOS NÃO CADASTRADOS
    const dataInicio = mes ? `${ano}-${mes.toString().padStart(2, '0')}-01` : `${ano}-01-01`;
    const dataFim = mes 
      ? new Date(ano, mes, 0).toISOString().split('T')[0] 
      : `${ano}-12-31`;

    const feriadosNoPeriodo = FERIADOS_NACIONAIS.filter(f => 
      f.data >= dataInicio && f.data <= dataFim
    );

    // Buscar quais já estão cadastrados
    const { data: registrosCadastrados } = await supabase
      .from('calendario_operacional')
      .select('data')
      .eq('bar_id', barId)
      .in('data', feriadosNoPeriodo.map(f => f.data));

    const datasJaCadastradas = new Set(registrosCadastrados?.map(r => r.data) || []);
    
    const feriadosNaoCadastrados = feriadosNoPeriodo.filter(f => 
      !datasJaCadastradas.has(f.data)
    );

    // 2. PADRÕES DETECTADOS
    // Buscar registros existentes para detectar padrões
    const { data: todosRegistros } = await supabase
      .from('calendario_operacional')
      .select('data, status, motivo')
      .eq('bar_id', barId)
      .gte('data', `${ano}-01-01`)
      .lt('data', `${ano + 1}-01-01`);

    // Detectar dias da semana frequentemente fechados
    const diasSemanaConta = new Map<number, { abertos: number; fechados: number }>();
    
    todosRegistros?.forEach(reg => {
      const diaSemana = new Date(reg.data + 'T12:00:00Z').getUTCDay();
      if (!diasSemanaConta.has(diaSemana)) {
        diasSemanaConta.set(diaSemana, { abertos: 0, fechados: 0 });
      }
      const stats = diasSemanaConta.get(diaSemana)!;
      if (reg.status === 'aberto') {
        stats.abertos++;
      } else {
        stats.fechados++;
      }
    });

    const padroesDiasSemana = Array.from(diasSemanaConta.entries()).map(([dia, stats]) => ({
      dia,
      diaLabel: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dia],
      abertos: stats.abertos,
      fechados: stats.fechados,
      percentualFechado: stats.abertos + stats.fechados > 0 
        ? (stats.fechados / (stats.abertos + stats.fechados) * 100).toFixed(1)
        : '0'
    })).filter(p => parseFloat(p.percentualFechado) > 80); // Dias que fecham mais de 80% das vezes

    // 3. INCONSISTÊNCIAS DETECTADAS (usando eventos_base)
    const { data: movimentacoes } = await supabase
      .from('eventos_base')
      .select('data_evento, real_r')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lte('data_evento', dataFim);

    const movimentacoesMap = new Map(
      movimentacoes?.map(m => [m.data_evento, parseFloat(m.real_r || '0')]) || []
    );

    // Dias marcados como fechados mas com movimento
    const inconsistencias = todosRegistros?.filter(reg => {
      if (reg.status !== 'fechado') return false;
      const movimento = movimentacoesMap.get(reg.data);
      return movimento && movimento > 100; // Movimento significativo
    }) || [];

    // 4. GERAR SUGESTÕES
    const sugestoes: any[] = [];

    // Sugestão de feriados
    if (feriadosNaoCadastrados.length > 0) {
      sugestoes.push({
        tipo: 'feriado',
        prioridade: 'alta',
        titulo: `${feriadosNaoCadastrados.length} feriado${feriadosNaoCadastrados.length > 1 ? 's' : ''} não cadastrado${feriadosNaoCadastrados.length > 1 ? 's' : ''}`,
        descricao: `Marcar como fechado: ${feriadosNaoCadastrados.map(f => f.nome).join(', ')}`,
        acoes: feriadosNaoCadastrados.map(f => ({
          data: f.data,
          status: 'fechado',
          motivo: `Feriado: ${f.nome}`,
          tipo_feriado: f.tipo
        }))
      });
    }

    // Sugestão de padrões
    if (padroesDiasSemana.length > 0) {
      sugestoes.push({
        tipo: 'padrao',
        prioridade: 'media',
        titulo: 'Padrão de fechamento detectado',
        descricao: `${padroesDiasSemana.map(p => p.diaLabel).join(' e ')} geralmente ${padroesDiasSemana.length > 1 ? 'ficam' : 'fica'} fechado${padroesDiasSemana.length > 1 ? 's' : ''}`,
        padroes: padroesDiasSemana
      });
    }

    // Sugestão de correção de inconsistências
    if (inconsistencias.length > 0) {
      sugestoes.push({
        tipo: 'inconsistencia',
        prioridade: 'alta',
        titulo: `${inconsistencias.length} dia${inconsistencias.length > 1 ? 's' : ''} com inconsistência`,
        descricao: 'Dias marcados como fechados mas com movimento financeiro registrado',
        acoes: inconsistencias.map(inc => ({
          data: inc.data,
          status_atual: 'fechado',
          sugestao: 'aberto',
          motivo_atual: inc.motivo,
          movimento: movimentacoesMap.get(inc.data)
        }))
      });
    }

    // Sugestão baseada em histórico do ano anterior (se disponível)
    const anoAnterior = ano - 1;
    const { data: registrosAnoAnterior } = await supabase
      .from('calendario_operacional')
      .select('data, status, motivo')
      .eq('bar_id', barId)
      .gte('data', `${anoAnterior}-01-01`)
      .lt('data', `${anoAnterior + 1}-01-01`)
      .eq('status', 'fechado');

    const fechamentosAnoAnterior = registrosAnoAnterior?.map(r => {
      const [ano, mes, dia] = r.data.split('-');
      return { mes, dia, motivo: r.motivo };
    }) || [];

    const sugestoesMesmoPeriodo = fechamentosAnoAnterior
      .filter(f => {
        const dataAtual = `${ano}-${f.mes}-${f.dia}`;
        return dataAtual >= dataInicio && dataAtual <= dataFim;
      })
      .filter(f => {
        const dataAtual = `${ano}-${f.mes}-${f.dia}`;
        return !datasJaCadastradas.has(dataAtual);
      });

    if (sugestoesMesmoPeriodo.length > 0) {
      sugestoes.push({
        tipo: 'historico',
        prioridade: 'baixa',
        titulo: 'Baseado em anos anteriores',
        descricao: `${sugestoesMesmoPeriodo.length} dia${sugestoesMesmoPeriodo.length > 1 ? 's' : ''} estava${sugestoesMesmoPeriodo.length > 1 ? 'm' : ''} fechado${sugestoesMesmoPeriodo.length > 1 ? 's' : ''} em ${anoAnterior}`,
        acoes: sugestoesMesmoPeriodo.map(s => ({
          data: `${ano}-${s.mes}-${s.dia}`,
          status: 'fechado',
          motivo: s.motivo || 'Mesmo período ano anterior'
        }))
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        periodo: { ano, mes, dataInicio, dataFim },
        sugestoes,
        resumo: {
          total_sugestoes: sugestoes.length,
          feriados_nao_cadastrados: feriadosNaoCadastrados.length,
          inconsistencias: inconsistencias.length,
          padroes_detectados: padroesDiasSemana.length
        }
      }
    });

  } catch (error) {
    console.error('Erro na API de sugestões:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

