import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// =====================================================
// 📊 INTERFACES TYPESCRIPT
// =====================================================

interface ChecklistExecucao {
  id?: string;
  funcionario_id: string;
  checklist_id?: string;
  status: string;
  score_final?: number;
  tempo_total_minutos?: number;
  iniciado_em: string;
  finalizado_em?: string;
  checklist?: {
    nome: string;
    setor: string;
    tipo: string;
  };
  funcionario?: {
    nome: string;
    email: string;
    cargo: string;
    setor: string;
  };
}

interface MetricasGerais {
  total_execucoes: number;
  execucoes_concluidas: number;
  execucoes_pendentes: number;
  taxa_conclusao: number;
  score_medio: number;
  tempo_medio: number;
  funcionarios_ativos: number;
}

interface FuncionarioRanking {
  funcionario_id: string;
  funcionario?: {
    nome: string;
    email: string;
    cargo: string;
    setor: string;
  };
  total_execucoes: number;
  execucoes_concluidas: number;
  score_total: number;
  tempo_total: number;
  execucoes_com_score: number;
  execucoes_com_tempo: number;
  dias_ativos: number;
  taxa_conclusao: number;
  score_medio: number;
  tempo_medio: number;
  score_produtividade: number;
  classificacao: {
    nivel: string;
    cor: string;
    emoji: string;
  };
  posicao: number;
}

interface EvolucaoTemporal {
  data: string;
  total_execucoes: number;
  execucoes_concluidas: number;
  score_total: number;
  execucoes_com_score: number;
  taxa_conclusao: number;
  score_medio: number;
}

interface Alerta {
  tipo: string;
  severidade: string;
  titulo: string;
  descricao: string;
  itens: Array<{
    checklist?: string;
    funcionario?: string;
    data_agendada?: string;
    atraso_horas?: number;
    score_medio?: number;
    total_execucoes?: number;
  }>;
}

interface EstatisticaSetor {
  setor: string;
  total_execucoes: number;
  execucoes_concluidas: number;
  score_total: number;
  execucoes_com_score: number;
  taxa_conclusao: number;
  score_medio: number;
}

interface EstatisticaCargo {
  cargo: string;
  total_execucoes: number;
  execucoes_concluidas: number;
  score_total: number;
  execucoes_com_score: number;
  taxa_conclusao: number;
  score_medio: number;
}

interface TopChecklist {
  checklist_id: string;
  checklist?: {
    nome: string;
    setor: string;
    tipo: string;
  };
  total_execucoes: number;
  execucoes_concluidas: number;
  score_total: number;
  tempo_total: number;
  execucoes_com_score: number;
  execucoes_com_tempo: number;
  taxa_conclusao: number;
  score_medio: number;
  tempo_medio: number;
}

interface ChecklistAgendamento {
  id: string;
  checklist_id: string;
  funcionario_id: string;
  data_agendada: string;
  status: string;
  checklist?: {
    nome: string;
  };
  funcionario?: {
    nome: string;
  };
}

// =====================================================
// GET - DASHBOARD DE PRODUTIVIDADE
// =====================================================
export async function GET(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { searchParams } = new URL(request.url);

    const periodo = searchParams.get('periodo') || '30'; // dias
    const funcionarioId = searchParams.get('funcionario_id');
    const setor = searchParams.get('setor');
    const cargo = searchParams.get('cargo');

    const supabase = await getAdminClient();

    if (!user.bar_id) {
      return NextResponse.json(
        { error: 'Bar ID não encontrado' },
        { status: 400 }
      );
    }

    const barIdStr = user.bar_id.toString();

    // Calcular data de início baseada no período
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataFim.getDate() - parseInt(periodo));

    // Buscar métricas gerais
    const metricas = await calcularMetricasGerais(
      supabase,
      barIdStr,
      dataInicio,
      dataFim
    );

    // Buscar ranking de funcionários
    const ranking = await calcularRankingFuncionarios(
      supabase,
      barIdStr,
      dataInicio,
      dataFim,
      funcionarioId || undefined,
      setor || undefined,
      cargo || undefined
    );

    // Buscar evolução temporal
    const evolucao = await calcularEvolucaoTemporal(
      supabase,
      barIdStr,
      dataInicio,
      dataFim
    );

    // Buscar alertas e pendências
    const alertas = await buscarAlertas(supabase, barIdStr);

    // Buscar estatísticas por setor/cargo
    const estatisticasPorSetor = await calcularEstatisticasPorSetor(
      supabase,
      barIdStr,
      dataInicio,
      dataFim
    );
    const estatisticasPorCargo = await calcularEstatisticasPorCargo(
      supabase,
      barIdStr,
      dataInicio,
      dataFim
    );

    // Buscar top checklists
    const topChecklists = await buscarTopChecklists(
      supabase,
      barIdStr,
      dataInicio,
      dataFim
    );

    const dashboard = {
      periodo: {
        inicio: dataInicio.toISOString(),
        fim: dataFim.toISOString(),
        dias: parseInt(periodo),
      },
      metricas_gerais: metricas,
      ranking_funcionarios: ranking,
      evolucao_temporal: evolucao,
      alertas,
      estatisticas: {
        por_setor: estatisticasPorSetor,
        por_cargo: estatisticasPorCargo,
      },
      top_checklists: topChecklists,
    };

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error: unknown) {
    console.error('Erro na API de dashboard de produtividade:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// FUNÇÕES DE CÁLCULO
// =====================================================

async function calcularMetricasGerais(
  supabase: SupabaseClient,
  barId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<MetricasGerais> {
  // Buscar execuções do período
  const { data: execucoes } = await supabase
    .from('checklist_execucoes')
    .select(
      `
      *,
      checklist:checklists!checklist_id (nome, setor, tipo),
      funcionario:usuarios_bar!funcionario_id (nome, cargo)
    `
    )
    .gte('iniciado_em', dataInicio.toISOString())
    .lte('iniciado_em', dataFim.toISOString());

  if (!execucoes) {
    return {
      total_execucoes: 0,
      execucoes_concluidas: 0,
      execucoes_pendentes: 0,
      taxa_conclusao: 0,
      score_medio: 0,
      tempo_medio: 0,
      funcionarios_ativos: 0,
    };
  }

  const execucoesTyped = execucoes as ChecklistExecucao[];
  const concluidas = execucoesTyped.filter(e => e.status === 'completado');
  const pendentes = execucoesTyped.filter(e =>
    ['em_andamento', 'pausado'].includes(e.status)
  );

  const scoreTotal = concluidas
    .filter(e => e.score_final != null)
    .reduce((acc: number, e) => acc + (e.score_final || 0), 0);

  const tempoTotal = concluidas
    .filter(e => e.tempo_total_minutos != null)
    .reduce((acc: number, e) => acc + (e.tempo_total_minutos || 0), 0);

  const funcionariosUnicos = new Set(execucoesTyped.map(e => e.funcionario_id))
    .size;

  return {
    total_execucoes: execucoesTyped.length,
    execucoes_concluidas: concluidas.length,
    execucoes_pendentes: pendentes.length,
    taxa_conclusao:
      execucoesTyped.length > 0
        ? Math.round((concluidas.length / execucoesTyped.length) * 100)
        : 0,
    score_medio:
      concluidas.length > 0
        ? Math.round((scoreTotal / concluidas.length) * 10) / 10
        : 0,
    tempo_medio:
      concluidas.length > 0 ? Math.round(tempoTotal / concluidas.length) : 0,
    funcionarios_ativos: funcionariosUnicos,
  };
}

async function calcularRankingFuncionarios(
  supabase: SupabaseClient,
  barId: string,
  dataInicio: Date,
  dataFim: Date,
  funcionarioIdFiltro?: string,
  setorFiltro?: string,
  cargoFiltro?: string
): Promise<FuncionarioRanking[]> {
  // Buscar execuções por funcionário
  const query = supabase
    .from('checklist_execucoes')
    .select(
      `
      funcionario_id,
      status,
      score_final,
      tempo_total_minutos,
      iniciado_em,
      finalizado_em,
      funcionario:usuarios_bar!funcionario_id (nome, email, cargo, setor)
    `
    )
    .gte('iniciado_em', dataInicio.toISOString())
    .lte('iniciado_em', dataFim.toISOString());

  const { data: execucoes } = await query;

  if (!execucoes) return [];

  const execucoesTyped = execucoes as unknown as ChecklistExecucao[];

  // Filtrar funcionários
  let execucoesFiltradas = execucoesTyped;

  if (funcionarioIdFiltro) {
    execucoesFiltradas = execucoesTyped.filter(
      e => e.funcionario_id === funcionarioIdFiltro
    );
  }

  if (setorFiltro) {
    execucoesFiltradas = execucoesFiltradas.filter(
      e => e.funcionario?.setor === setorFiltro
    );
  }

  if (cargoFiltro) {
    execucoesFiltradas = execucoesFiltradas.filter(
      e => e.funcionario?.cargo === cargoFiltro
    );
  }

  // Agrupar por funcionário
  const funcionarios = new Map<
    string,
    {
      funcionario_id: string;
      funcionario?: {
        nome: string;
        email: string;
        cargo: string;
        setor: string;
      };
      total_execucoes: number;
      execucoes_concluidas: number;
      score_total: number;
      tempo_total: number;
      execucoes_com_score: number;
      execucoes_com_tempo: number;
      dias_ativos: Set<string>;
    }
  >();

  execucoesFiltradas.forEach(execucao => {
    const funcionarioId = execucao.funcionario_id;

    if (!funcionarios.has(funcionarioId)) {
      funcionarios.set(funcionarioId, {
        funcionario_id: funcionarioId,
        funcionario: execucao.funcionario,
        total_execucoes: 0,
        execucoes_concluidas: 0,
        score_total: 0,
        tempo_total: 0,
        execucoes_com_score: 0,
        execucoes_com_tempo: 0,
        dias_ativos: new Set(),
      });
    }

    const funcionario = funcionarios.get(funcionarioId)!;
    funcionario.total_execucoes++;

    // Adicionar dia ativo
    const diaExecucao = execucao.iniciado_em.split('T')[0];
    funcionario.dias_ativos.add(diaExecucao);

    if (execucao.status === 'completado') {
      funcionario.execucoes_concluidas++;

      if (execucao.score_final != null) {
        funcionario.score_total += execucao.score_final;
        funcionario.execucoes_com_score++;
      }

      if (execucao.tempo_total_minutos != null) {
        funcionario.tempo_total += execucao.tempo_total_minutos;
        funcionario.execucoes_com_tempo++;
      }
    }
  });

  // Calcular métricas finais e ordenar
  const ranking = Array.from(funcionarios.values())
    .map(funcionario => {
      const taxa_conclusao =
        funcionario.total_execucoes > 0
          ? Math.round(
              (funcionario.execucoes_concluidas / funcionario.total_execucoes) *
                100
            )
          : 0;

      const score_medio =
        funcionario.execucoes_com_score > 0
          ? Math.round(
              (funcionario.score_total / funcionario.execucoes_com_score) * 10
            ) / 10
          : 0;

      const tempo_medio =
        funcionario.execucoes_com_tempo > 0
          ? Math.round(
              funcionario.tempo_total / funcionario.execucoes_com_tempo
            )
          : 0;

      // Calcular score de produtividade (média ponderada)
      const score_produtividade = Math.round(
        taxa_conclusao * 0.4 +
          score_medio * 2 + // Score 0-100 -> peso 0.2
          Math.max(0, 100 - (tempo_medio / 60) * 10) * 0.4 // Tempo menor = melhor
      );

      return {
        ...funcionario,
        taxa_conclusao,
        score_medio,
        tempo_medio,
        dias_ativos: funcionario.dias_ativos.size,
        score_produtividade,
        // Classificação qualitativa
        classificacao: getClassificacaoDesempenho(
          score_produtividade,
          taxa_conclusao
        ),
        posicao: 0, // Será definido depois
      };
    })
    .sort((a, b) => b.score_produtividade - a.score_produtividade);

  // Adicionar posição no ranking
  return ranking.map((funcionario, index) => ({
    ...funcionario,
    posicao: index + 1,
    dias_ativos: funcionario.dias_ativos, // Manter apenas o número
  }));
}

async function calcularEvolucaoTemporal(
  supabase: SupabaseClient,
  barId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<EvolucaoTemporal[]> {
  const { data: execucoes } = await supabase
    .from('checklist_execucoes')
    .select('iniciado_em, status, score_final')
    .gte('iniciado_em', dataInicio.toISOString())
    .lte('iniciado_em', dataFim.toISOString());

  if (!execucoes) return [];

  const execucoesTyped = execucoes as unknown as ChecklistExecucao[];

  // Agrupar por dia
  const evolucaoPorDia = new Map<
    string,
    {
      data: string;
      total_execucoes: number;
      execucoes_concluidas: number;
      score_total: number;
      execucoes_com_score: number;
    }
  >();

  execucoesTyped.forEach(execucao => {
    const dia = execucao.iniciado_em.split('T')[0];

    if (!evolucaoPorDia.has(dia)) {
      evolucaoPorDia.set(dia, {
        data: dia,
        total_execucoes: 0,
        execucoes_concluidas: 0,
        score_total: 0,
        execucoes_com_score: 0,
      });
    }

    const dadosDia = evolucaoPorDia.get(dia)!;
    dadosDia.total_execucoes++;

    if (execucao.status === 'completado') {
      dadosDia.execucoes_concluidas++;

      if (execucao.score_final != null) {
        dadosDia.score_total += execucao.score_final;
        dadosDia.execucoes_com_score++;
      }
    }
  });

  // Converter para array e calcular métricas
  return Array.from(evolucaoPorDia.values())
    .map(dia => ({
      ...dia,
      taxa_conclusao:
        dia.total_execucoes > 0
          ? Math.round((dia.execucoes_concluidas / dia.total_execucoes) * 100)
          : 0,
      score_medio:
        dia.execucoes_com_score > 0
          ? Math.round((dia.score_total / dia.execucoes_com_score) * 10) / 10
          : 0,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

async function buscarAlertas(
  supabase: SupabaseClient,
  barId: string
): Promise<Alerta[]> {
  const agora = new Date();
  const alertas: Alerta[] = [];

  // Agendamentos atrasados
  const { data: agendamentosAtrasados } = await supabase
    .from('checklist_agendamentos')
    .select(
      `
      *,
      checklist:checklists!checklist_id (nome),
      funcionario:usuarios_bar!funcionario_id (nome)
    `
    )
    .eq('bar_id', barId)
    .eq('status', 'agendado')
    .lt('data_agendada', agora.toISOString())
    .limit(10);

  if (agendamentosAtrasados && agendamentosAtrasados.length > 0) {
    const agendamentosTyped =
      agendamentosAtrasados as unknown as ChecklistAgendamento[];
    alertas.push({
      tipo: 'agendamentos_atrasados',
      severidade: 'alta',
      titulo: `${agendamentosTyped.length} agendamento(s) atrasado(s)`,
      descricao: 'Existem checklists que deveriam ter sido executados',
      itens: agendamentosTyped.map(a => ({
        checklist: a.checklist?.nome,
        funcionario: a.funcionario?.nome,
        data_agendada: a.data_agendada,
        atraso_horas: Math.round(
          (agora.getTime() - new Date(a.data_agendada).getTime()) /
            (1000 * 60 * 60)
        ),
      })),
    });
  }

  // Funcionários com baixa performance
  const { data: execucoesRecentes } = await supabase
    .from('checklist_execucoes')
    .select(
      `
      funcionario_id,
      status,
      score_final,
      funcionario:usuarios_bar!funcionario_id (nome)
    `
    )
    .eq('bar_id', barId)
    .gte(
      'iniciado_em',
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    );

  if (execucoesRecentes) {
    const execucoesTyped = execucoesRecentes as unknown as ChecklistExecucao[];
    const funcionariosBaixaPerformance: Array<{
      funcionario?: string;
      score_medio: number;
      total_execucoes: number;
    }> = [];
    const funcionarios = new Map<
      string,
      {
        funcionario?: {
          nome: string;
        };
        total: number;
        scores: number[];
      }
    >();

    execucoesTyped.forEach(exec => {
      if (!funcionarios.has(exec.funcionario_id)) {
        funcionarios.set(exec.funcionario_id, {
          funcionario: exec.funcionario,
          total: 0,
          scores: [],
        });
      }

      const func = funcionarios.get(exec.funcionario_id)!;
      func.total++;

      if (exec.status === 'completado' && exec.score_final != null) {
        func.scores.push(exec.score_final);
      }
    });

    funcionarios.forEach(dados => {
      if (dados.scores.length >= 3) {
        const scoreMedio =
          dados.scores.reduce((a: number, b: number) => a + b, 0) /
          dados.scores.length;

        if (scoreMedio < 70) {
          // Threshold configurável
          funcionariosBaixaPerformance.push({
            funcionario: dados.funcionario?.nome,
            score_medio: Math.round(scoreMedio * 10) / 10,
            total_execucoes: dados.scores.length,
          });
        }
      }
    });

    if (funcionariosBaixaPerformance.length > 0) {
      alertas.push({
        tipo: 'baixa_performance',
        severidade: 'media',
        titulo: `${funcionariosBaixaPerformance.length} funcionário(s) com baixa performance`,
        descricao:
          'Funcionários com score médio abaixo de 70% nos últimos 7 dias',
        itens: funcionariosBaixaPerformance,
      });
    }
  }

  return alertas;
}

async function calcularEstatisticasPorSetor(
  supabase: SupabaseClient,
  barId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<EstatisticaSetor[]> {
  const { data: execucoes } = await supabase
    .from('checklist_execucoes')
    .select(
      `
      status,
      score_final,
      checklist:checklists!checklist_id (setor)
    `
    )
    .gte('iniciado_em', dataInicio.toISOString())
    .lte('iniciado_em', dataFim.toISOString());

  if (!execucoes) return [];

  const execucoesTyped = execucoes as unknown as ChecklistExecucao[];
  const setores = new Map<
    string,
    {
      setor: string;
      total_execucoes: number;
      execucoes_concluidas: number;
      score_total: number;
      execucoes_com_score: number;
    }
  >();

  execucoesTyped.forEach(exec => {
    const setor = exec.checklist?.setor || 'Sem setor';

    if (!setores.has(setor)) {
      setores.set(setor, {
        setor,
        total_execucoes: 0,
        execucoes_concluidas: 0,
        score_total: 0,
        execucoes_com_score: 0,
      });
    }

    const dadosSetor = setores.get(setor)!;
    dadosSetor.total_execucoes++;

    if (exec.status === 'completado') {
      dadosSetor.execucoes_concluidas++;

      if (exec.score_final != null) {
        dadosSetor.score_total += exec.score_final;
        dadosSetor.execucoes_com_score++;
      }
    }
  });

  return Array.from(setores.values())
    .map(setor => ({
      ...setor,
      taxa_conclusao:
        setor.total_execucoes > 0
          ? Math.round(
              (setor.execucoes_concluidas / setor.total_execucoes) * 100
            )
          : 0,
      score_medio:
        setor.execucoes_com_score > 0
          ? Math.round((setor.score_total / setor.execucoes_com_score) * 10) /
            10
          : 0,
    }))
    .sort((a, b) => b.total_execucoes - a.total_execucoes);
}

async function calcularEstatisticasPorCargo(
  supabase: SupabaseClient,
  barId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<EstatisticaCargo[]> {
  const { data: execucoes } = await supabase
    .from('checklist_execucoes')
    .select(
      `
      status,
      score_final,
      funcionario:usuarios_bar!funcionario_id (cargo)
    `
    )
    .gte('iniciado_em', dataInicio.toISOString())
    .lte('iniciado_em', dataFim.toISOString());

  if (!execucoes) return [];

  const execucoesTyped = execucoes as unknown as ChecklistExecucao[];
  const cargos = new Map<
    string,
    {
      cargo: string;
      total_execucoes: number;
      execucoes_concluidas: number;
      score_total: number;
      execucoes_com_score: number;
    }
  >();

  execucoesTyped.forEach(exec => {
    const cargo = exec.funcionario?.cargo || 'Sem cargo';

    if (!cargos.has(cargo)) {
      cargos.set(cargo, {
        cargo,
        total_execucoes: 0,
        execucoes_concluidas: 0,
        score_total: 0,
        execucoes_com_score: 0,
      });
    }

    const dadosCargo = cargos.get(cargo)!;
    dadosCargo.total_execucoes++;

    if (exec.status === 'completado') {
      dadosCargo.execucoes_concluidas++;

      if (exec.score_final != null) {
        dadosCargo.score_total += exec.score_final;
        dadosCargo.execucoes_com_score++;
      }
    }
  });

  return Array.from(cargos.values())
    .map(cargo => ({
      ...cargo,
      taxa_conclusao:
        cargo.total_execucoes > 0
          ? Math.round(
              (cargo.execucoes_concluidas / cargo.total_execucoes) * 100
            )
          : 0,
      score_medio:
        cargo.execucoes_com_score > 0
          ? Math.round((cargo.score_total / cargo.execucoes_com_score) * 10) /
            10
          : 0,
    }))
    .sort((a, b) => b.total_execucoes - a.total_execucoes);
}

async function buscarTopChecklists(
  supabase: SupabaseClient,
  barId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<TopChecklist[]> {
  const { data: execucoes } = await supabase
    .from('checklist_execucoes')
    .select(
      `
      checklist_id,
      status,
      score_final,
      tempo_total_minutos,
      checklist:checklists!checklist_id (nome, setor, tipo)
    `
    )
    .gte('iniciado_em', dataInicio.toISOString())
    .lte('iniciado_em', dataFim.toISOString());

  if (!execucoes) return [];

  const execucoesTyped = execucoes as unknown as ChecklistExecucao[];
  const checklists = new Map<
    string,
    {
      checklist_id: string;
      checklist?: {
        nome: string;
        setor: string;
        tipo: string;
      };
      total_execucoes: number;
      execucoes_concluidas: number;
      score_total: number;
      tempo_total: number;
      execucoes_com_score: number;
      execucoes_com_tempo: number;
    }
  >();

  execucoesTyped.forEach(exec => {
    const checklistId = exec.checklist_id || '';

    if (!checklists.has(checklistId)) {
      checklists.set(checklistId, {
        checklist_id: checklistId,
        checklist: exec.checklist,
        total_execucoes: 0,
        execucoes_concluidas: 0,
        score_total: 0,
        tempo_total: 0,
        execucoes_com_score: 0,
        execucoes_com_tempo: 0,
      });
    }

    const dadosChecklist = checklists.get(checklistId)!;
    dadosChecklist.total_execucoes++;

    if (exec.status === 'completado') {
      dadosChecklist.execucoes_concluidas++;

      if (exec.score_final != null) {
        dadosChecklist.score_total += exec.score_final;
        dadosChecklist.execucoes_com_score++;
      }

      if (exec.tempo_total_minutos != null) {
        dadosChecklist.tempo_total += exec.tempo_total_minutos;
        dadosChecklist.execucoes_com_tempo++;
      }
    }
  });

  return Array.from(checklists.values())
    .map(checklist => ({
      ...checklist,
      taxa_conclusao:
        checklist.total_execucoes > 0
          ? Math.round(
              (checklist.execucoes_concluidas / checklist.total_execucoes) * 100
            )
          : 0,
      score_medio:
        checklist.execucoes_com_score > 0
          ? Math.round(
              (checklist.score_total / checklist.execucoes_com_score) * 10
            ) / 10
          : 0,
      tempo_medio:
        checklist.execucoes_com_tempo > 0
          ? Math.round(checklist.tempo_total / checklist.execucoes_com_tempo)
          : 0,
    }))
    .sort((a, b) => b.total_execucoes - a.total_execucoes)
    .slice(0, 10); // Top 10
}

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

function getClassificacaoDesempenho(
  scoreProdutividade: number,
  taxaConclusao: number
) {
  if (scoreProdutividade >= 80 && taxaConclusao >= 90) {
    return { nivel: 'excelente', cor: 'green', emoji: '🏆' };
  } else if (scoreProdutividade >= 60 && taxaConclusao >= 70) {
    return { nivel: 'bom', cor: 'blue', emoji: '👍' };
  } else if (scoreProdutividade >= 40 && taxaConclusao >= 50) {
    return { nivel: 'regular', cor: 'yellow', emoji: '⚠️' };
  } else {
    return { nivel: 'precisa_melhorar', cor: 'red', emoji: '🔴' };
  }
}
