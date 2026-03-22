import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

// =====================================================
// SCHEMAS DE VALIDAÇÃO
// =====================================================

const CriarAtribuicaoSchema = z.object({
  checklist_id: z.string().uuid(),
  tipo_atribuicao: z.enum([
    'funcionario_especifico',
    'cargo',
    'setor',
    'todos',
  ]),
  funcionario_id: z.string().uuid().optional(),
  cargo: z.string().optional(),
  setor: z.string().optional(),
  frequencia: z.enum(['diaria', 'semanal', 'mensal', 'personalizada']),
  configuracao_frequencia: z.object({
    // Para frequência diária
    horarios: z.array(z.string()).optional(), // ['09:00', '15:00', '21:00']
    dias_semana: z.array(z.number()).optional(), // [1,2,3,4,5] (segunda-sexta)

    // Para frequência personalizada
    recorrencia_personalizada: z.string().optional(), // Cron expression

    // Configurações gerais
    tolerancia_minutos: z.number().min(0).max(1440).default(30),
    lembrete_antecipado_minutos: z.number().min(0).max(1440).default(15),
    auto_cancelar_apos_horas: z.number().min(1).max(168).default(24),
  }),
  ativo: z.boolean().default(true),
  observacoes: z.string().optional(),
  data_inicio: z.string(),
  data_fim: z.string().optional(),
});

// =====================================================
// POST - CRIAR NOVA ATRIBUIÇÃO
// =====================================================
export async function POST(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    // Apenas admin e financeiro podem criar atribuições
    if (!['admin', 'financeiro'].includes(user.role)) {
      return NextResponse.json(
        {
          error: 'Sem permissão para criar atribuições',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = CriarAtribuicaoSchema.parse(body);

    const supabase = await getAdminClient();


    if (!user.bar_id) {
      return NextResponse.json({ error: 'Bar ID não encontrado' }, { status: 400 });
    }
    const barIdStr = user.bar_id.toString();

    // Verificar se checklist existe
    const { data: checklist, error: checklistError } = await supabase
      .from('checklists')
      .select('id, nome, setor, tempo_estimado')
      .eq('id', data.checklist_id)
      .eq('bar_id', user.bar_id)
      .eq('ativo', true)
      .single();

    if (checklistError || !checklist) {
      return NextResponse.json(
        {
          error: 'Checklist não encontrado ou inativo',
        },
        { status: 404 }
      );
    }

    // Validar dados específicos por tipo de atribuição
    const validacao = validarDadosAtribuicao(data);
    if (!validacao.valido) {
      return NextResponse.json(
        {
          error: 'Dados de atribuição inválidos',
          detalhes: validacao.erros,
        },
        { status: 400 }
      );
    }

    // Verificar conflitos de atribuição
    const conflitos = await verificarConflitosAtribuicao(
      supabase as SupabaseClient,
      data as Record<string, unknown>,
      barIdStr
    );
    if (conflitos.length > 0) {
      return NextResponse.json(
        {
          error: 'Conflito com atribuições existentes',
          conflitos,
        },
        { status: 409 }
      );
    }

    // Criar nova atribuição
    const novaAtribuicao = {
      checklist_id: data.checklist_id,
      bar_id: user.bar_id,
      tipo_atribuicao: data.tipo_atribuicao,
      funcionario_id: data.funcionario_id,
      cargo: data.cargo,
      setor: data.setor,
      frequencia: data.frequencia,
      configuracao_frequencia: data.configuracao_frequencia,
      ativo: data.ativo,
      observacoes: data.observacoes,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      criado_por: user.auth_id,
      criado_em: new Date().toISOString(),
    };

    const { data: atribuicao, error: createError } = await supabase
      .from('checklist_atribuicoes')
      .insert(novaAtribuicao)
      .select(
        `
        *,
        checklist:checklists!checklist_id (nome, setor, tipo),
        funcionario:usuarios_bar!funcionario_id (nome, email, cargo),
        criado_por_usuario:usuarios_bar!criado_por (nome)
      `
      )
      .single();

    if (createError) {
      console.error('Erro ao criar atribuição:', createError);
      return NextResponse.json(
        {
          error: 'Erro ao criar atribuição',
        },
        { status: 500 }
      );
    }

    // Criar agendamentos automáticos para esta atribuição
    await criarAgendamentosAutomaticos(
      supabase as SupabaseClient,
      atribuicao as Record<string, unknown>
    );

    return NextResponse.json({
      success: true,
      message: 'Atribuição criada com sucesso',
      data: atribuicao,
    });
  } catch (error: unknown) {
    console.error('Erro na API de criar atribuição:', error);

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
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

// =====================================================
// GET - LISTAR ATRIBUIÇÕES
// =====================================================
export async function GET(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { searchParams } = new URL(request.url);

    const checklistId = searchParams.get('checklist_id');
    const funcionarioId = searchParams.get('funcionario_id');
    const tipo = searchParams.get('tipo');
    const ativo = searchParams.get('ativo');
    const setor = searchParams.get('setor');
    const cargo = searchParams.get('cargo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    const supabase = await getAdminClient();

    // Construir query base
    let query = supabase
      .from('checklist_atribuicoes')
      .select(
        `
        *,
        checklist:checklists!checklist_id (nome, setor, tipo, tempo_estimado),
        funcionario:usuarios_bar!funcionario_id (nome, email, cargo),
        criado_por_usuario:usuarios_bar!criado_por (nome)
      `
      )
      .eq('bar_id', user.bar_id);

    // Aplicar filtros
    if (checklistId) {
      query = query.eq('checklist_id', checklistId);
    }

    if (funcionarioId) {
      query = query.eq('funcionario_id', funcionarioId);
    }

    if (tipo) {
      query = query.eq('tipo_atribuicao', tipo);
    }

    if (ativo !== null && ativo !== undefined) {
      query = query.eq('ativo', ativo === 'true');
    }

    if (setor) {
      query = query.eq('setor', setor);
    }

    if (cargo) {
      query = query.eq('cargo', cargo);
    }

    // Buscar total para paginação
    const { count } = await query;

    // Buscar atribuições com paginação
    const { data: atribuicoes, error } = await query
      .order('criado_em', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Erro ao buscar atribuições:', error);
      return NextResponse.json(
        {
          error: 'Erro ao buscar atribuições',
        },
        { status: 500 }
      );
    }

    // Enriquecer atribuições com estatísticas
    const atribuicoesEnriquecidas = await Promise.all(
      (atribuicoes || []).map(async (atribuicao: any) => {
        const stats = await calcularEstatisticasAtribuicao(
          supabase as SupabaseClient,
          atribuicao.id as string
        );
        return {
          ...atribuicao,
          estatisticas: stats,
        };
      })
    );

    // Calcular estatísticas gerais
    const estatisticasGerais = calcularEstatisticasGerais(
      atribuicoesEnriquecidas
    );

    return NextResponse.json({
      success: true,
      data: {
        atribuicoes: atribuicoesEnriquecidas,
        estatisticas: estatisticasGerais,
        paginacao: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
      },
    });
  } catch (error: unknown) {
    console.error('Erro na API de listar atribuições:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

function validarDadosAtribuicao(data: Record<string, unknown>) {
  const erros: string[] = [];

  // Validar tipo específico
  switch (data.tipo_atribuicao) {
    case 'funcionario_especifico':
      if (!data.funcionario_id) {
        erros.push(
          'ID do funcionário é obrigatório para atribuição específica'
        );
      }
      break;

    case 'cargo':
      if (!data.cargo) {
        erros.push('Cargo é obrigatório para atribuição por cargo');
      }
      break;

    case 'setor':
      if (!data.setor) {
        erros.push('Setor é obrigatório para atribuição por setor');
      }
      break;
  }

  // Validar frequência
  const config = data.configuracao_frequencia as any;
  switch (data.frequencia) {
    case 'diaria':
      if (!config?.horarios || config.horarios.length === 0) {
        erros.push('Horários são obrigatórios para frequência diária');
      }
      break;

    case 'semanal':
      if (!config?.dias_semana || config.dias_semana.length === 0) {
        erros.push('Dias da semana são obrigatórios para frequência semanal');
      }
      if (!config?.horarios || config.horarios.length === 0) {
        erros.push('Horários são obrigatórios para frequência semanal');
      }
      break;

    case 'personalizada':
      if (!config?.recorrencia_personalizada) {
        erros.push(
          'Expressão de recorrência é obrigatória para frequência personalizada'
        );
      }
      break;
  }

  // Validar datas
  if (
    data.data_fim &&
    new Date(data.data_fim as string) <= new Date(data.data_inicio as string)
  ) {
    erros.push('Data de fim deve ser posterior à data de início');
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}

async function verificarConflitosAtribuicao(
  supabase: SupabaseClient,
  data: Record<string, unknown>,
  barId: string
) {
  const conflitos: Array<Record<string, unknown>> = [];

  // Buscar atribuições existentes que possam conflitar
  const { data: atribuicoesExistentes } = await supabase
    .from('checklist_atribuicoes')
    .select('*')
    .eq('bar_id', barId)
    .eq('checklist_id', data.checklist_id)
    .eq('ativo', true);

  if (!atribuicoesExistentes) return conflitos;

  atribuicoesExistentes.forEach((existente: Record<string, unknown>) => {
    // Verificar conflitos por tipo
    let temConflito = false;
    let motivo = '';

    if (existente.tipo_atribuicao === data.tipo_atribuicao) {
      switch (data.tipo_atribuicao) {
        case 'funcionario_especifico':
          if (existente.funcionario_id === data.funcionario_id) {
            temConflito = true;
            motivo = 'Funcionário já possui atribuição para este checklist';
          }
          break;

        case 'cargo':
          if (existente.cargo === data.cargo) {
            temConflito = true;
            motivo = 'Cargo já possui atribuição para este checklist';
          }
          break;

        case 'setor':
          if (existente.setor === data.setor) {
            temConflito = true;
            motivo = 'Setor já possui atribuição para este checklist';
          }
          break;

        case 'todos':
          temConflito = true;
          motivo = 'Já existe atribuição geral para este checklist';
          break;
      }
    }

    if (temConflito) {
      conflitos.push({
        atribuicao_id: existente.id,
        motivo,
        data_criacao: existente.criado_em,
      });
    }
  });

  return conflitos;
}

async function criarAgendamentosAutomaticos(
  supabase: SupabaseClient,
  atribuicao: Record<string, unknown>
) {
  try {
    const agendamentos = gerarAgendamentos(atribuicao, 30); // Próximos 30 dias

    if (agendamentos.length > 0) {
      const { error } = await supabase
        .from('checklist_agendamentos')
        .insert(agendamentos);

      if (error) {
        console.error('Erro ao criar agendamentos automáticos:', error);
      }
    }
  } catch (error) {
    console.error('Erro na criação de agendamentos automáticos:', error);
  }
}

function gerarAgendamentos(atribuicao: Record<string, unknown>, dias: number) {
  const agendamentos: Array<Record<string, unknown>> = [];
  const config = atribuicao.configuracao_frequencia as any;
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
        if (config.dias_semana && !config.dias_semana.includes(data.getDay())) {
          continue; // Pular dias não configurados
        }

        config.horarios?.forEach((horario: string) => {
          const [hora, minuto] = horario.split(':').map(Number);
          const dataAgendamento = new Date(data);
          dataAgendamento.setHours(hora, minuto, 0, 0);

          if (dataAgendamento > new Date()) {
            // Só agendar para o futuro
            agendamentos.push(criarAgendamento(atribuicao, dataAgendamento));
          }
        });
      }
      break;

    case 'semanal':
      for (
        let data = new Date(dataInicio);
        data <= dataFim;
        data.setDate(data.getDate() + 7)
      ) {
        config.dias_semana?.forEach((diaSemana: number) => {
          const dataAgendamento = new Date(data);
          const diasParaAjustar = (diaSemana - data.getDay() + 7) % 7;
          dataAgendamento.setDate(data.getDate() + diasParaAjustar);

          if (dataAgendamento <= dataFim) {
            config.horarios?.forEach((horario: string) => {
              const [hora, minuto] = horario.split(':').map(Number);
              const dataHorario = new Date(dataAgendamento);
              dataHorario.setHours(hora, minuto, 0, 0);

              if (dataHorario > new Date()) {
                agendamentos.push(criarAgendamento(atribuicao, dataHorario));
              }
            });
          }
        });
      }
      break;

    case 'mensal':
      // Implementação mensal (primeiro dia útil do mês, etc.)
      for (
        let data = new Date(dataInicio);
        data <= dataFim;
        data.setMonth(data.getMonth() + 1)
      ) {
        config.horarios?.forEach((horario: string) => {
          const [hora, minuto] = horario.split(':').map(Number);
          const dataAgendamento = new Date(
            data.getFullYear(),
            data.getMonth(),
            1,
            hora,
            minuto
          );

          if (dataAgendamento > new Date() && dataAgendamento <= dataFim) {
            agendamentos.push(criarAgendamento(atribuicao, dataAgendamento));
          }
        });
      }
      break;
  }

  return agendamentos;
}

function criarAgendamento(
  atribuicao: Record<string, unknown>,
  dataAgendamento: Date
) {
  return {
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
      tolerancia_minutos: (atribuicao.configuracao_frequencia as any)
        .tolerancia_minutos,
      lembrete_antecipado_minutos: (atribuicao.configuracao_frequencia as any)
        .lembrete_antecipado_minutos,
      auto_cancelar_apos_horas: (atribuicao.configuracao_frequencia as any)
        .auto_cancelar_apos_horas,
    },
    criado_em: new Date().toISOString(),
  };
}

async function calcularEstatisticasAtribuicao(
  supabase: SupabaseClient,
  atribuicaoId: string
) {
  // Buscar agendamentos desta atribuição
  const { data: agendamentos } = await supabase
    .from('checklist_agendamentos')
    .select('status, data_agendada, execucao_id')
    .eq('atribuicao_id', atribuicaoId);

  if (!agendamentos) {
    return {
      total_agendados: 0,
      concluidos: 0,
      pendentes: 0,
      atrasados: 0,
      taxa_conclusao: 0,
    };
  }

  const agora = new Date();
  const concluidos = agendamentos.filter(
    (a: Record<string, unknown>) => a.status === 'concluido'
  ).length;
  const pendentes = agendamentos.filter(
    (a: Record<string, unknown>) =>
      a.status === 'agendado' && new Date(a.data_agendada as string) > agora
  ).length;
  const atrasados = agendamentos.filter(
    (a: Record<string, unknown>) =>
      a.status === 'agendado' && new Date(a.data_agendada as string) <= agora
  ).length;

  return {
    total_agendados: agendamentos.length,
    concluidos,
    pendentes,
    atrasados,
    taxa_conclusao:
      agendamentos.length > 0
        ? Math.round((concluidos / agendamentos.length) * 100)
        : 0,
  };
}

function calcularEstatisticasGerais(
  atribuicoes: Array<Record<string, unknown>>
) {
  const total = atribuicoes.length;
  const ativas = atribuicoes.filter(
    (a: Record<string, unknown>) => a.ativo as boolean
  ).length;
  const inativas = total - ativas;

  const totalAgendados = atribuicoes.reduce(
    (acc: number, a: Record<string, unknown>) =>
      acc +
      (((a.estatisticas as Record<string, unknown>)
        ?.total_agendados as number) || 0),
    0
  );
  const totalConcluidos = atribuicoes.reduce(
    (acc: number, a: Record<string, unknown>) =>
      acc +
      (((a.estatisticas as Record<string, unknown>)?.concluidos as number) ||
        0),
    0
  );
  const totalAtrasados = atribuicoes.reduce(
    (acc: number, a: Record<string, unknown>) =>
      acc +
      (((a.estatisticas as Record<string, unknown>)?.atrasados as number) || 0),
    0
  );

  return {
    total_atribuicoes: total,
    atribuicoes_ativas: ativas,
    atribuicoes_inativas: inativas,
    total_agendamentos: totalAgendados,
    execucoes_concluidas: totalConcluidos,
    execucoes_atrasadas: totalAtrasados,
    taxa_conclusao_geral:
      totalAgendados > 0
        ? Math.round((totalConcluidos / totalAgendados) * 100)
        : 0,
  };
}
