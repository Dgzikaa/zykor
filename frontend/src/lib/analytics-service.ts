import { createClient } from '@supabase/supabase-js';

// Interfaces para tipagem adequada
interface FuncionarioStats {
  id: string;
  nome: string;
  total_execucoes: number;
  score_total: number;
  tempo_total: number;
  scores: number[];
  score_medio?: number;
  tempo_medio?: number;
  consistencia?: number;
}

interface FuncionarioRanking {
  posicao: number;
  id: string;
  nome: string;
  total_execucoes: number;
  score_total: number;
  tempo_total: number;
  scores: number[];
  score_medio: number;
  tempo_medio: number;
  consistencia: number;
}

interface PerformanceResult {
  ranking_funcionarios: FuncionarioRanking[];
  estatisticas: {
    total_funcionarios: number;
    melhor_score: number;
    melhor_funcionario: string;
  };
  mensagem: string;
}

interface ChecklistExecucao {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  pontuacao_final: number;
  tempo_execucao_minutos: number;
  created_at: string;
}

interface WhatsAppMensagem {
  id: string;
  status: string;
  tipo: string;
  created_at: string;
}

// ========================================
// ✅ ANÁLISES DE CHECKLISTS
// ========================================

export async function getStatusChecklists(
  bar_id: number,
  inicio?: string,
  fim?: string
) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const dataInicio =
    inicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dataFim = fim || new Date().toISOString().split('T')[0];

  try {
    const { data: execucoes } = await supabase
      .from('checklist_execucoes')
      .select('status, created_at')
      .eq('bar_id', bar_id)
      .gte('created_at', `${dataInicio}T00:00:00Z`)
      .lte('created_at', `${dataFim}T23:59:59Z`);

    const arr = (execucoes || []) as any[];
    const total = arr.length;
    const completadas = arr.filter(e => e.status === 'completo').length;
    const pendentes = arr.filter(e => e.status === 'pendente').length;
    const atrasadas = arr.filter(e => e.status === 'atrasada').length;

    return {
      periodo: { inicio: dataInicio, fim: dataFim },
      estatisticas: {
        total_checklists: total,
        taxa_completude: total > 0 ? (completadas / total) * 100 : 0,
        pendentes,
        atrasadas,
      },
      mensagem: `${completadas}/${total} checklists completados (${total > 0 ? ((completadas / total) * 100).toFixed(1) : 0}%)`,
    };
  } catch (_e) {
    return {
      periodo: { inicio: dataInicio, fim: dataFim },
      estatisticas: { total_checklists: 0, taxa_completude: 0, pendentes: 0, atrasadas: 0 },
      mensagem: 'Checklists não disponíveis (sistema migrado)',
    };
  }
}

// ========================================
// 👥 ANÁLISES DE PERFORMANCE
// ========================================

export async function getPerformanceFuncionarios(
  bar_id: number,
  inicio?: string,
  fim?: string,
  limite = 10
): Promise<PerformanceResult> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  const dataInicio =
    inicio ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dataFim = fim || new Date().toISOString().split('T')[0];

  let execucoes: any[] = [];
  try {
    const res = await supabase
      .from('checklist_execucoes')
      .select('funcionario_id, funcionario_nome, pontuacao_final, tempo_execucao_minutos')
      .eq('bar_id', bar_id)
      .gte('created_at', `${dataInicio}T00:00:00Z`)
      .lte('created_at', `${dataFim}T23:59:59Z`);
    execucoes = (res.data || []) as any[];
  } catch (_e) {
    /* checklist_execucoes removida - sistema migrado */
  }

  if (execucoes.length === 0) {
    return {
      ranking_funcionarios: [],
      estatisticas: { total_funcionarios: 0, melhor_score: 0, melhor_funcionario: 'N/A' },
      mensagem: 'Nenhum dado de checklists encontrado',
    };
  }

  const funcionarios: Record<string, FuncionarioStats> = {};

  execucoes.forEach((exec: any) => {
    const id = exec.funcionario_id;
    if (!funcionarios[id]) {
      funcionarios[id] = {
        id,
        nome: exec.funcionario_nome,
        total_execucoes: 0,
        score_total: 0,
        tempo_total: 0,
        scores: [],
      };
    }
    funcionarios[id].total_execucoes++;
    funcionarios[id].score_total += exec.pontuacao_final || 0;
    funcionarios[id].tempo_total += exec.tempo_execucao_minutos || 0;
    funcionarios[id].scores.push(exec.pontuacao_final || 0);
  });

  const ranking: FuncionarioRanking[] = Object.values(funcionarios)
    .map((func: FuncionarioStats) => ({
      posicao: 0, // Será definido depois
      ...func,
      score_medio:
        func.total_execucoes > 0 ? func.score_total / func.total_execucoes : 0,
      tempo_medio:
        func.total_execucoes > 0 ? func.tempo_total / func.total_execucoes : 0,
      consistencia:
        func.scores.length > 1
          ? func.scores.reduce(
              (sum: number, score: number) =>
                sum + Math.abs(score - func.score_total / func.total_execucoes),
              0
            ) / func.scores.length
          : 0,
    }))
    .sort((a, b) => b.score_medio - a.score_medio)
    .slice(0, limite)
    .map((f, index) => ({ ...f, posicao: index + 1 }));

  return {
    ranking_funcionarios: ranking,
    estatisticas: {
      total_funcionarios: Object.keys(funcionarios).length,
      melhor_score: ranking[0]?.score_medio || 0,
      melhor_funcionario: ranking[0]?.nome || 'N/A',
    },
    mensagem: `Ranking de ${ranking.length} funcionários por performance`,
  };
}

// ========================================
// 📱 ANÁLISES DE WHATSAPP
// ========================================

export async function getWhatsAppStats(
  bar_id: number,
  inicio?: string,
  fim?: string
) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  const dataInicio =
    inicio ||
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dataFim = fim || new Date().toISOString().split('T')[0];

  const { data: mensagens } = await supabase
    .from('whatsapp_mensagens')
    .select('status, tipo, created_at')
    .eq('bar_id', bar_id)
    .gte('created_at', `${dataInicio}T00:00:00Z`)
    .lte('created_at', `${dataFim}T23:59:59Z`);

  if (!mensagens) return { erro: 'Erro ao buscar dados' };

  const total = mensagens.length;
  const enviadas = mensagens.filter(m =>
    ['sent', 'delivered', 'read'].includes(m.status)
  ).length;
  const lidas = mensagens.filter(m => m.status === 'read').length;
  const falhas = mensagens.filter(m => m.status === 'failed').length;

  // Estatísticas por tipo
  const tipoStats: Record<string, number> = {};
  mensagens.forEach(m => {
    tipoStats[m.tipo] = (tipoStats[m.tipo] || 0) + 1;
  });

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    estatisticas: {
      total_mensagens: total,
      taxa_entrega: total > 0 ? (enviadas / total) * 100 : 0,
      taxa_leitura: total > 0 ? (lidas / total) * 100 : 0,
      taxa_falha: total > 0 ? (falhas / total) * 100 : 0,
      engagement: total > 0 ? ((lidas + enviadas * 0.5) / total) * 100 : 0,
    },
    por_tipo: tipoStats,
    mensagem: `${total} mensagens enviadas com ${((lidas / total) * 100).toFixed(1)}% de taxa de leitura`,
  };
}

// ========================================
// 🍕 ANÁLISES DE PRODUÇÃO & TEMPO
// ========================================

export async function getTempoProducao(
  bar_id: number,
  inicio?: string,
  fim?: string
) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  const dataInicio =
    inicio ||
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dataFim = fim || new Date().toISOString().split('T')[0];

  const { data: tempos } = await supabase
    .from('contahub_tempo')
    .select(
      `
      tempo_t0_t1,
      tempo_t1_t2,
      tempo_t2_t3,
      tempo_t0_t3,
      prd_desc,
      dia
    `
    )
    .eq('bar_id', bar_id)
    .gte('dia', `${dataInicio}T00:00:00`)
    .lte('dia', `${dataFim}T23:59:59`);

  if (!tempos) return { erro: 'Erro ao buscar dados' };

  const tempoMedioTotal =
    tempos.reduce((acc, t) => acc + (t.tempo_t0_t3 || 0), 0) / tempos.length;
  const tempoMedioPrep =
    tempos.reduce((acc, t) => acc + (t.tempo_t0_t1 || 0), 0) / tempos.length;
  const tempoMedioCozinha =
    tempos.reduce((acc, t) => acc + (t.tempo_t1_t2 || 0), 0) / tempos.length;
  const tempoMedioEntrega =
    tempos.reduce((acc, t) => acc + (t.tempo_t2_t3 || 0), 0) / tempos.length;

  // Produtos mais demorados
  const produtosTempo: Record<string, number[]> = {};
  tempos.forEach(t => {
    if (!produtosTempo[t.prd_desc]) produtosTempo[t.prd_desc] = [];
    produtosTempo[t.prd_desc].push(t.tempo_t0_t3 || 0);
  });

  const produtosMaisDemorados = Object.entries(produtosTempo)
    .map(([produto, tempos]) => ({
      produto,
      tempo_medio: tempos.reduce((a, b) => a + b, 0) / tempos.length,
      total_pedidos: tempos.length,
    }))
    .sort((a, b) => b.tempo_medio - a.tempo_medio)
    .slice(0, 5);

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    tempos_medios: {
      total_segundos: tempoMedioTotal,
      total_minutos: tempoMedioTotal / 60,
      preparacao: tempoMedioPrep,
      cozinha: tempoMedioCozinha,
      entrega: tempoMedioEntrega,
    },
    produtos_mais_demorados: produtosMaisDemorados,
    total_producoes: tempos.length,
    mensagem: `Tempo médio de produção: ${(tempoMedioTotal / 60).toFixed(1)} minutos`,
  };
}

// ========================================
// 🤖 ANÁLISES DE IA & ANALYTICS
// ========================================

export async function getScoreSaudeGeral(bar_id: number) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  // Score simplificado baseado em dados disponíveis
  const hoje = new Date().toISOString().split('T')[0];
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [vendasRes, checklistsRes] = await Promise.all([
    supabase
      .from('contahub_pagamentos')
      .select('valor_liquido')
      .eq('bar_id', bar_id)
      .gte('dt_gerencial', ontem)
      .lte('dt_gerencial', hoje),
    supabase
      .from('checklist_execucoes')
      .select('status, pontuacao_final')
      .eq('bar_id', bar_id)
      .gte('created_at', `${ontem}T00:00:00Z`),
  ]);

  const vendas = vendasRes;
  const checklists = { data: checklistsRes.error ? [] : checklistsRes.data };

  let score = 85; // Score base

  // Ajustar baseado em vendas
  const vendaTotal = vendas.data?.reduce((acc, v) => acc + (v.valor_liquido || 0), 0) || 0;
  if (vendaTotal > 1000) score += 10;
  else if (vendaTotal < 100) score -= 15;

  // Ajustar baseado em checklists
  const checklistsConcluidos = checklists.data?.filter(c => c.status === 'concluido').length || 0;
  const checklistsTotal = checklists.data?.length || 1;
  const percentualConcluido = (checklistsConcluidos / checklistsTotal) * 100;
  
  if (percentualConcluido > 80) score += 5;
  else if (percentualConcluido < 50) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let status = 'excelente';
  if (score < 40) status = 'critico';
  else if (score < 60) status = 'ruim';
  else if (score < 75) status = 'regular';
  else if (score < 90) status = 'bom';

  return {
    score_saude: score,
    status,
    fatores: {
      vendas_24h: vendaTotal,
      checklists_concluidos: checklistsConcluidos,
      checklists_total: checklistsTotal,
      percentual_checklists: Math.round(percentualConcluido),
    },
    mensagem: `Score de saúde: ${score}% - Status: ${status.toUpperCase()}`,
  };
}

// ========================================
// 📊 DASHBOARD EXECUTIVO COMPLETO
// ========================================

export async function getDashboardExecutivo(
  bar_id: number,
  inicio?: string,
  fim?: string
) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  const dataInicio =
    inicio ||
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dataFim = fim || new Date().toISOString().split('T')[0];

  const [faturamento, checklists, whatsapp, tempos, scoreSaude] =
    await Promise.all([
      supabase
        .from('contahub_pagamentos')
        .select('valor_liquido')
        .eq('bar_id', bar_id)
        .gte('dt_gerencial', dataInicio)
        .lte('dt_gerencial', dataFim),

      getStatusChecklists(bar_id, inicio, fim),
      getWhatsAppStats(bar_id, inicio, fim),
      getTempoProducao(bar_id, inicio, fim),
      getScoreSaudeGeral(bar_id),
    ]);

  const faturamentoTotal =
    faturamento.data?.reduce((acc, f) => acc + (f.valor_liquido || 0), 0) || 0;
  const transacoes = faturamento.data?.length || 0;

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    kpis_principais: {
      faturamento_total: faturamentoTotal,
      total_transacoes: transacoes,
      ticket_medio: transacoes > 0 ? faturamentoTotal / transacoes : 0,
      taxa_conclusao_checklists: checklists.estatisticas?.taxa_completude || 0,
      engagement_whatsapp: whatsapp.estatisticas?.engagement || 0,
      tempo_medio_producao: tempos.tempos_medios?.total_minutos || 0,
    },
    score_saude: scoreSaude,
    resumo_operacional: {
      checklists: checklists.estatisticas,
      whatsapp: whatsapp.estatisticas,
      producao: tempos.tempos_medios,
    },
    mensagem: `Dashboard executivo: R$ ${faturamentoTotal.toFixed(2)} em ${transacoes} transações - Score saúde: ${scoreSaude.score_saude}%`,
  };
}

// ========================================
// 🎯 ANÁLISE 360° COMPLETA
// ========================================

export async function getVisao360(
  bar_id: number,
  inicio?: string,
  fim?: string
) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  const dashboard = await getDashboardExecutivo(bar_id, inicio, fim);
  const performance = await getPerformanceFuncionarios(bar_id, inicio, fim, 5);

  const [anomalias, insights, recomendacoes] = await Promise.all([
    supabase
      .from('ai_anomalies')
      .select('titulo, severidade, ainda_ativa')
      .eq('bar_id', bar_id)
      .eq('ainda_ativa', true)
      .limit(5),

    supabase
      .from('ai_insights')
      .select('titulo, impacto, urgencia')
      .eq('bar_id', bar_id)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('ai_recommendations')
      .select('titulo, roi_estimado, prioridade')
      .eq('bar_id', bar_id)
      .order('prioridade', { ascending: false })
      .limit(5),
  ]);

  return {
    visao_geral: dashboard,
    equipe: performance,
    alertas: {
      anomalias_ativas: anomalias.data || [],
      insights_recentes: insights.data || [],
      recomendacoes_prioritarias: recomendacoes.data || [],
    },
    resumo_inteligencia: {
      total_anomalias_ativas: anomalias.data?.length || 0,
      insights_criticos:
        insights.data?.filter(i => i.impacto === 'critico').length || 0,
      recomendacoes_altas:
        recomendacoes.data?.filter(r => r.prioridade >= 8).length || 0,
    },
    mensagem: 'Análise 360° completa do estabelecimento',
  };
}
