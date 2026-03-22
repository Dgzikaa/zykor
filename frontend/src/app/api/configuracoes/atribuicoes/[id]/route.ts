import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// SCHEMAS DE VALIDAÇÃO
// =====================================================

const AtualizarAtribuicaoSchema = z.object({
  tipo_atribuicao: z
    .enum(['funcionario_especifico', 'cargo', 'setor', 'todos'])
    .optional(),
  funcionario_id: z.string().uuid().optional(),
  cargo: z.string().optional(),
  setor: z.string().optional(),
  frequencia: z
    .enum(['diaria', 'semanal', 'mensal', 'personalizada'])
    .optional(),
  configuracao_frequencia: z
    .object({
      horarios: z.array(z.string()).optional(),
      dias_semana: z.array(z.number()).optional(),
      recorrencia_personalizada: z.string().optional(),
      tolerancia_minutos: z.number().min(0).max(1440).optional(),
      lembrete_antecipado_minutos: z.number().min(0).max(1440).optional(),
      auto_cancelar_apos_horas: z.number().min(1).max(168).optional(),
    })
    .optional(),
  ativo: z.boolean().optional(),
  observacoes: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
});

// =====================================================
// GET - BUSCAR ATRIBUIÇÃO ESPECÍFICA
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    if (!user.bar_id) {
      return NextResponse.json(
        { error: 'Bar ID não encontrado' },
        { status: 400 }
      );
    }
    const barIdStr = user.bar_id.toString();

    const { id: atribuicaoId } = await params;
    const supabase = await getAdminClient();

    // Buscar atribuição completa
    const { data: atribuicao, error } = await supabase
      .from('checklist_atribuicoes')
      .select(
        `
        *,
        checklist:checklists!checklist_id (
          id, nome, setor, tipo, tempo_estimado, estrutura
        ),
        funcionario:usuarios_bar!funcionario_id (id, nome, email, cargo),
        criado_por_usuario:usuarios_bar!criado_por (nome, email)
      `
      )
      .eq('id', atribuicaoId)
      .eq('bar_id', barIdStr)
      .single();

    if (error) {
      console.error('Erro ao buscar atribuição:', error);
      return NextResponse.json(
        {
          error: 'Atribuição não encontrada',
        },
        { status: 404 }
      );
    }

    // Buscar agendamentos relacionados
    const { data: agendamentos } = await supabase
      .from('checklist_agendamentos')
      .select(
        `
        *,
        execucao:checklist_execucoes!execucao_id (
          id, status, score_final, finalizado_em
        )
      `
      )
      .eq('atribuicao_id', atribuicaoId)
      .order('data_agendada', { ascending: false })
      .limit(20);

    // Calcular estatísticas detalhadas
    const estatisticas = await calcularEstatisticasDetalhadas(
      supabase as SupabaseClient,
      atribuicaoId
    );

    // Buscar funcionários elegíveis (se necessário)
    const funcionariosElegiveis = await buscarFuncionariosElegiveis(
      supabase as SupabaseClient,
      barIdStr,
      atribuicao.tipo_atribuicao,
      atribuicao.cargo || undefined,
      atribuicao.setor || undefined
    );

    const atribuicaoCompleta = {
      ...atribuicao,
      agendamentos: agendamentos || [],
      estatisticas,
      funcionarios_elegiveis: funcionariosElegiveis,
    };

    return NextResponse.json({
      success: true,
      data: atribuicaoCompleta,
    });
  } catch (error: unknown) {
    console.error('Erro na API de buscar atribuição:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT - ATUALIZAR ATRIBUIÇÃO
// =====================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    if (!user.bar_id) {
      return NextResponse.json(
        { error: 'Bar ID não encontrado' },
        { status: 400 }
      );
    }
    const barIdStr = user.bar_id.toString();

    // Verificar permissões
    if (!['admin', 'financeiro'].includes(user.role)) {
      return NextResponse.json(
        {
          error: 'Sem permissão para editar atribuições',
        },
        { status: 403 }
      );
    }

    const { id: atribuicaoId } = await params;
    const body = await request.json();
    const data = AtualizarAtribuicaoSchema.parse(body);

    const supabase = await getAdminClient();

    // Buscar atribuição atual
    const { data: atribuicaoAtual, error: fetchError } = await supabase
      .from('checklist_atribuicoes')
      .select('*')
      .eq('id', atribuicaoId)
      .eq('bar_id', barIdStr)
      .single();

    if (fetchError || !atribuicaoAtual) {
      return NextResponse.json(
        {
          error: 'Atribuição não encontrada',
        },
        { status: 404 }
      );
    }

    // Validar mudanças
    const mudancasSignificativas = verificarMudancasSignificativas(
      atribuicaoAtual,
      data
    );

    // Atualizar atribuição
    const dadosAtualizacao = {
      ...data,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user.auth_id,
    };

    const { data: atribuicaoAtualizada, error: updateError } = await supabase
      .from('checklist_atribuicoes')
      .update(dadosAtualizacao)
      .eq('id', atribuicaoId)
      .select(
        `
        *,
        checklist:checklists!checklist_id (nome, setor, tipo),
        funcionario:usuarios_bar!funcionario_id (nome, email, cargo),
        atualizado_por_usuario:usuarios_bar!atualizado_por (nome)
      `
      )
      .single();

    if (updateError) {
      console.error('Erro ao atualizar atribuição:', updateError);
      return NextResponse.json(
        {
          error: 'Erro ao atualizar atribuição',
        },
        { status: 500 }
      );
    }

    // Se houve mudanças significativas, recriar agendamentos
    if (mudancasSignificativas) {
      await recriarAgendamentos(
        supabase as SupabaseClient,
        atribuicaoAtualizada as Record<string, unknown>
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Atribuição atualizada com sucesso',
      data: atribuicaoAtualizada,
      agendamentos_recriados: mudancasSignificativas,
    });
  } catch (error: unknown) {
    console.error('Erro na API de atualizar atribuição:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE - EXCLUIR ATRIBUIÇÃO
// =====================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    if (!user.bar_id) {
      return NextResponse.json(
        { error: 'Bar ID não encontrado' },
        { status: 400 }
      );
    }
    const barIdStr = user.bar_id.toString();

    // Verificar permissões
    if (!['admin', 'financeiro'].includes(user.role)) {
      return NextResponse.json(
        {
          error: 'Sem permissão para excluir atribuições',
        },
        { status: 403 }
      );
    }

    const { id: atribuicaoId } = await params;
    const { searchParams } = new URL(request.url);
    const forceDelete = searchParams.get('force') === 'true';

    const supabase = await getAdminClient();

    // Buscar atribuição
    const { data: atribuicao, error: fetchError } = await supabase
      .from('checklist_atribuicoes')
      .select('*')
      .eq('id', atribuicaoId)
      .eq('bar_id', barIdStr)
      .single();

    if (fetchError || !atribuicao) {
      return NextResponse.json(
        {
          error: 'Atribuição não encontrada',
        },
        { status: 404 }
      );
    }

    // Verificar se há agendamentos pendentes
    const { data: agendamentosPendentes } = await supabase
      .from('checklist_agendamentos')
      .select('id, status, data_agendada')
      .eq('atribuicao_id', atribuicaoId)
      .in('status', ['agendado', 'em_andamento']);

    if (
      agendamentosPendentes &&
      agendamentosPendentes.length > 0 &&
      !forceDelete
    ) {
      return NextResponse.json(
        {
          error: 'Existem agendamentos pendentes para esta atribuição',
          agendamentos_pendentes: agendamentosPendentes.length,
          sugestao:
            'Use force=true para forçar a exclusão ou desative a atribuição',
        },
        { status: 409 }
      );
    }

    // Cancelar agendamentos pendentes
    if (agendamentosPendentes && agendamentosPendentes.length > 0) {
      await supabase
        .from('checklist_agendamentos')
        .update({
          status: 'cancelado',
          cancelado_em: new Date().toISOString(),
          cancelado_por: user.auth_id,
          motivo_cancelamento: 'Atribuição excluída',
        })
        .eq('atribuicao_id', atribuicaoId)
        .in('status', ['agendado', 'em_andamento']);
    }

    // Excluir atribuição (soft delete)
    const { error: deleteError } = await supabase
      .from('checklist_atribuicoes')
      .update({
        ativo: false,
        excluido: true,
        excluido_em: new Date().toISOString(),
        excluido_por: user.auth_id,
      })
      .eq('id', atribuicaoId);

    if (deleteError) {
      console.error('Erro ao excluir atribuição:', deleteError);
      return NextResponse.json(
        {
          error: 'Erro ao excluir atribuição',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Atribuição excluída com sucesso',
      agendamentos_cancelados: agendamentosPendentes?.length || 0,
    });
  } catch (error: unknown) {
    console.error('Erro na API de excluir atribuição:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

async function calcularEstatisticasDetalhadas(
  supabase: SupabaseClient,
  atribuicaoId: string
) {
  // Buscar todos os agendamentos
  const { data: agendamentos } = await supabase
    .from('checklist_agendamentos')
    .select(
      `
      *,
      execucao:checklist_execucoes!execucao_id (
        id, status, score_final, tempo_total_minutos
      )
    `
    )
    .eq('atribuicao_id', atribuicaoId);

  if (!agendamentos) {
    return {
      total_agendados: 0,
      concluidos: 0,
      pendentes: 0,
      atrasados: 0,
      cancelados: 0,
      taxa_conclusao: 0,
      score_medio: 0,
      tempo_medio_execucao: 0,
      evolucao_mensal: [],
    };
  }

  const agora = new Date();
  const concluidos = agendamentos.filter(
    (a: Record<string, unknown>) => a.status === 'concluido'
  );
  const pendentes = agendamentos.filter(
    (a: Record<string, unknown>) =>
      a.status === 'agendado' && new Date(a.data_agendada as string) > agora
  );
  const atrasados = agendamentos.filter(
    (a: Record<string, unknown>) =>
      a.status === 'agendado' && new Date(a.data_agendada as string) <= agora
  );
  const cancelados = agendamentos.filter(
    (a: Record<string, unknown>) => a.status === 'cancelado'
  );

  // Calcular scores e tempos
  const execucoesCompletas = concluidos.filter(
    (a: Record<string, unknown>) =>
      (a.execucao as Record<string, unknown>)?.score_final != null
  );
  const scoreMedio =
    execucoesCompletas.length > 0
      ? execucoesCompletas.reduce(
          (acc: number, a: Record<string, unknown>) =>
            acc +
            ((a.execucao as Record<string, unknown>).score_final as number),
          0
        ) / execucoesCompletas.length
      : 0;

  const execucoesComTempo = concluidos.filter(
    (a: Record<string, unknown>) =>
      (a.execucao as Record<string, unknown>)?.tempo_total_minutos != null
  );
  const tempoMedio =
    execucoesComTempo.length > 0
      ? execucoesComTempo.reduce(
          (acc: number, a: Record<string, unknown>) =>
            acc +
            ((a.execucao as Record<string, unknown>)
              .tempo_total_minutos as number),
          0
        ) / execucoesComTempo.length
      : 0;

  // Evolução mensal (últimos 6 meses)
  const evolucaoMensal = calcularEvolucaoMensal(agendamentos);

  return {
    total_agendados: agendamentos.length,
    concluidos: concluidos.length,
    pendentes: pendentes.length,
    atrasados: atrasados.length,
    cancelados: cancelados.length,
    taxa_conclusao:
      agendamentos.length > 0
        ? Math.round((concluidos.length / agendamentos.length) * 100)
        : 0,
    score_medio: Math.round(scoreMedio * 10) / 10,
    tempo_medio_execucao: Math.round(tempoMedio),
    evolucao_mensal: evolucaoMensal,
  };
}

interface EvolucaoMensal {
  mes: string;
  total: number;
  concluidos: number;
  taxa_conclusao: number;
}

function calcularEvolucaoMensal(
  agendamentos: Array<Record<string, unknown>>
): EvolucaoMensal[] {
  const agora = new Date();
  const evolucao: EvolucaoMensal[] = [];

  for (let i = 5; i >= 0; i--) {
    const mes = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const proximoMes = new Date(
      agora.getFullYear(),
      agora.getMonth() - i + 1,
      1
    );

    const agendamentosMes = agendamentos.filter(
      (a: Record<string, unknown>) => {
        const dataAgendamento = new Date(a.data_agendada as string);
        return dataAgendamento >= mes && dataAgendamento < proximoMes;
      }
    );

    const concluidos = agendamentosMes.filter(
      (a: Record<string, unknown>) => a.status === 'concluido'
    );

    evolucao.push({
      mes: mes.toISOString().slice(0, 7), // YYYY-MM
      total: agendamentosMes.length,
      concluidos: concluidos.length,
      taxa_conclusao:
        agendamentosMes.length > 0
          ? Math.round((concluidos.length / agendamentosMes.length) * 100)
          : 0,
    });
  }

  return evolucao;
}

async function buscarFuncionariosElegiveis(
  supabase: SupabaseClient,
  barId: string,
  tipoAtribuicao: string,
  cargo?: string,
  setor?: string
) {
  let query = supabase
    .from('usuarios_bar')
    .select('id, nome, email, cargo')
    .eq('bar_id', barId)
    .eq('ativo', true);

  switch (tipoAtribuicao) {
    case 'cargo':
      if (cargo) {
        query = query.eq('cargo', cargo);
      }
      break;

    case 'setor':
      if (setor) {
        query = query.eq('setor', setor);
      }
      break;

    case 'funcionario_especifico':
      // Retornar todos para seleção
      break;

    default:
      // Para 'todos', retornar todos os funcionários
      break;
  }

  const { data } = await query.order('nome');
  return data || [];
}

function verificarMudancasSignificativas(
  atribuicaoAtual: Record<string, unknown>,
  novosDados: Record<string, unknown>
): boolean {
  // Verificar se mudaram configurações que afetam agendamentos
  const camposSignificativos = [
    'frequencia',
    'configuracao_frequencia',
    'data_inicio',
    'data_fim',
    'ativo',
  ];

  return camposSignificativos.some(campo => {
    if (novosDados[campo] !== undefined) {
      if (campo === 'configuracao_frequencia') {
        return (
          JSON.stringify(atribuicaoAtual[campo]) !==
          JSON.stringify(novosDados[campo])
        );
      }
      return atribuicaoAtual[campo] !== novosDados[campo];
    }
    return false;
  });
}

async function recriarAgendamentos(
  supabase: SupabaseClient,
  atribuicao: Record<string, unknown>
) {
  try {
    // Cancelar agendamentos futuros
    await supabase
      .from('checklist_agendamentos')
      .update({
        status: 'cancelado',
        cancelado_em: new Date().toISOString(),
        motivo_cancelamento: 'Atribuição atualizada - agendamentos recriados',
      })
      .eq('atribuicao_id', atribuicao.id)
      .eq('status', 'agendado')
      .gte('data_agendada', new Date().toISOString());

    // Criar novos agendamentos
    const novosAgendamentos = gerarAgendamentos(atribuicao, 30);

    if (novosAgendamentos.length > 0) {
      await supabase.from('checklist_agendamentos').insert(novosAgendamentos);
    }
  } catch (error) {
    console.error('Erro ao recriar agendamentos:', error);
    throw error;
  }
}

// Função auxiliar reutilizada do outro arquivo
function gerarAgendamentos(atribuicao: Record<string, unknown>, dias: number) {
  const agendamentos: Array<Record<string, unknown>> = [];
  const config = atribuicao.configuracao_frequencia as Record<string, unknown>;
  const dataInicio = new Date(atribuicao.data_inicio as string);
  const dataFim = atribuicao.data_fim
    ? new Date(atribuicao.data_fim as string)
    : new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

  switch (atribuicao.frequencia) {
    case 'diaria':
      for (
        let data = new Date(dataInicio);
        data <= dataFim;
        data.setDate(data.getDate() + 1)
      ) {
        if (
          config.dias_semana &&
          !(config.dias_semana as number[]).includes(data.getDay())
        ) {
          continue;
        }

        (config.horarios as string[])?.forEach((horario: string) => {
          const [hora, minuto] = horario.split(':').map(Number);
          const dataAgendamento = new Date(data);
          dataAgendamento.setHours(hora, minuto, 0, 0);

          if (dataAgendamento > new Date()) {
            agendamentos.push({
              atribuicao_id: atribuicao.id,
              checklist_id: atribuicao.checklist_id,
              bar_id: atribuicao.bar_id,
              data_agendada: dataAgendamento.toISOString(),
              status: 'agendado',
              tipo_atribuicao: atribuicao.tipo_atribuicao,
              funcionario_id: atribuicao.funcionario_id,
              cargo: atribuicao.cargo,
              setor: atribuicao.setor,
              configuracao: {
                tolerancia_minutos: config.tolerancia_minutos,
                lembrete_antecipado_minutos: config.lembrete_antecipado_minutos,
                auto_cancelar_apos_horas: config.auto_cancelar_apos_horas,
              },
              criado_em: new Date().toISOString(),
            });
          }
        });
      }
      break;

    // Implementações similares para semanal e mensal...
  }

  return agendamentos;
}
