import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  authenticateUser,
  authErrorResponse,
  permissionErrorResponse,
} from '@/middleware/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic'

// =====================================================
// SCHEMAS DE VALIDAÇÃO
// =====================================================

const AgendamentoSchema = z.object({
  checklist_id: z.string().uuid('ID do checklist inválido'),
  titulo: z.string().min(1).max(255),
  frequencia: z.enum([
    'diaria',
    'semanal',
    'quinzenal',
    'mensal',
    'conforme_necessario',
  ]),
  horario: z
    .string()
    .regex(
      /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      'Horário deve estar no formato HH:MM'
    ),
  dias_semana: z.array(z.number().min(0).max(6)).optional(), // 0 = domingo, 6 = sábado
  dia_mes: z.number().min(1).max(31).optional(),
  ativo: z.boolean().default(true),
  notificacoes_ativas: z.boolean().default(true),
  tempo_limite_horas: z.number().int().min(1).max(168).default(24), // Máx 1 semana
  tempo_alerta_horas: z.number().int().min(1).max(48).default(2), // Alerta 2h antes do prazo
  prioridade: z.enum(['baixa', 'normal', 'alta', 'critica']).default('normal'),
  observacoes: z.string().optional(),
  responsaveis_whatsapp: z
    .array(
      z.object({
        nome: z.string(),
        numero: z
          .string()
          .regex(/^\+?[1-9]\d{1,14}$/, 'Número WhatsApp inválido'),
        cargo: z.string().optional(),
      })
    )
    .default([]),
});

// const UpdateAgendamentoSchema = AgendamentoSchema.partial().omit({
//   checklist_id: true
// })

// =====================================================
// GET - LISTAR AGENDAMENTOS
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { searchParams } = new URL(request.url);
    const checklistId = searchParams.get('checklist_id');
    const ativo = searchParams.get('ativo');
    const frequencia = searchParams.get('frequencia');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    const supabase = await getAdminClient();


    if (!user.bar_id) {
      return NextResponse.json({ error: 'Bar ID não encontrado' }, { status: 400 });
    }
    const barIdStr = user.bar_id.toString();

    let query = supabase
      .from('checklist_schedules')
      .select(
        `
        *,
        checklist:checklists (
          id, nome, setor, tipo, tempo_estimado
        ),
        _count_execucoes:checklist_execucoes (count)
      `
      )
      .eq('bar_id', user.bar_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Aplicar filtros
    if (checklistId) {
      query = query.eq('checklist_id', checklistId);
    }
    if (ativo !== null) {
      query = query.eq('ativo', ativo === 'true');
    }
    if (frequencia) {
      query = query.eq('frequencia', frequencia);
    }

    const { data: agendamentos, error } = await query;

    if (error) {
      console.error('Erro ao buscar agendamentos:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar agendamentos' },
        { status: 500 }
      );
    }

    // Buscar próximas execuções para cada agendamento
    const agendamentosComProximaExecucao = await Promise.all(
      (agendamentos || []).map(async (agendamento: any) => {
        const proximaExecucao = calcularProximaExecucao(agendamento);
        const ultimaExecucao = await buscarUltimaExecucao(
          supabase,
          agendamento.id
        );

        return {
          ...agendamento,
          proxima_execucao: proximaExecucao,
          ultima_execucao: ultimaExecucao,
          status_atual: determinarStatusAtual(
            agendamento,
            proximaExecucao,
            ultimaExecucao
          ),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: agendamentosComProximaExecucao,
      pagination: {
        page,
        limit,
        total: agendamentos?.length || 0,
      },
    });
  } catch (error: unknown) {
    console.error('Erro na API de agendamentos GET:', error);
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
// POST - CRIAR AGENDAMENTO
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    // Verificar permissões - apenas admin pode criar agendamentos
    if (user.role !== 'admin') {
      return permissionErrorResponse(
        'Apenas administradores podem criar agendamentos'
      );
    }

    const body = await request.json();
    const data = AgendamentoSchema.parse(body);

    const supabase = await getAdminClient();

    // Verificar se checklist existe
    const { data: checklist, error: checklistError } = await supabase
      .from('checklists')
      .select('id, nome, setor')
      .eq('id', data.checklist_id)
      .eq('bar_id', user.bar_id)
      .single();

    if (checklistError || !checklist) {
      return NextResponse.json(
        { error: 'Checklist não encontrado' },
        { status: 404 }
      );
    }

    // Verificar conflitos de agendamento
    const conflito = verificarConflitoAgendamento(supabase, data, user.bar_id!);
    if (conflito) {
      return NextResponse.json(
        {
          error: 'Já existe um agendamento similar para este horário',
          conflito,
        },
        { status: 409 }
      );
    }

    // Criar agendamento
    const agendamentoData = {
      ...data,
      bar_id: user.bar_id,
      criado_por: user.auth_id,
      created_at: new Date().toISOString(),
    };

    const { data: novoAgendamento, error: createError } = await supabase
      .from('checklist_schedules')
      .insert(agendamentoData)
      .select(
        `
        *,
        checklist:checklists (nome, setor),
        criado_por_usuario:usuarios_bar!criado_por (nome, email)
      `
      )
      .single();

    if (createError) {
      console.error('Erro ao criar agendamento:', createError);
      return NextResponse.json(
        { error: 'Erro ao criar agendamento' },
        { status: 500 }
      );
    }

    // Log da criação
    console.log(
      `✅ Agendamento criado: ${novoAgendamento.titulo} para checklist ${checklist.nome}`
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Agendamento criado com sucesso',
        data: novoAgendamento,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Erro na API de agendamentos POST:', error);

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
// FUNÇÕES AUXILIARES
// =====================================================

function calcularProximaExecucao(agendamento: any): string | null {
  if (!agendamento.ativo) return null;

  const agora = new Date();
  const [hora, minuto] = (agendamento.horario || '00:00')
    .split(':')
    .map(Number);

  const proximaData = new Date();
  proximaData.setHours(hora, minuto, 0, 0);

  // Se já passou da hora hoje, começar de amanhã
  if (proximaData <= agora) {
    proximaData.setDate(proximaData.getDate() + 1);
  }

  switch (agendamento.frequencia) {
    case 'diaria':
      return proximaData.toISOString();

    case 'semanal': {
      const diasSemana = Array.isArray(agendamento.dias_semana)
        ? agendamento.dias_semana
        : [];
      while (!diasSemana.includes(proximaData.getDay())) {
        proximaData.setDate(proximaData.getDate() + 1);
      }
      return proximaData.toISOString();
    }

    case 'quinzenal': {
      const diasQuinzenal = Array.isArray(agendamento.dias_semana)
        ? agendamento.dias_semana
        : [];
      let encontrou = false;
      let tentativas = 0;

      while (!encontrou && tentativas < 14) {
        if (diasQuinzenal.includes(proximaData.getDay())) {
          encontrou = true;
        } else {
          proximaData.setDate(proximaData.getDate() + 1);
          tentativas++;
        }
      }
      return encontrou ? proximaData.toISOString() : null;
    }

    case 'mensal': {
      const diaMes = agendamento.dia_mes || 1;
      proximaData.setDate(diaMes);

      // Se já passou este mês, próximo mês
      if (proximaData <= agora) {
        proximaData.setMonth(proximaData.getMonth() + 1);
        proximaData.setDate(diaMes);
      }
      return proximaData.toISOString();
    }

    case 'conforme_necessario':
      return null; // Apenas manual

    default:
      return null;
  }
}

// Função para buscar a última execução de um agendamento
async function buscarUltimaExecucao(supabase: any, agendamentoId: string) {
  const { data, error } = await supabase
    .from('checklist_execucoes')
    .select('id, status, iniciado_em, concluido_em')
    .eq('agendamento_id', agendamentoId)
    .order('iniciado_em', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Erro ao buscar última execução:', error);
    return null;
  }
  return data?.[0] || null;
}

function determinarStatusAtual(
  agendamento: any,
  proximaExecucao: string | null,
  ultimaExecucao: any
) {
  if (!agendamento.ativo) return 'inativo';
  if (!ultimaExecucao) return 'pendente';
  if ((ultimaExecucao as any).status === 'concluido') return 'concluido';
  return 'em_andamento';
}

function verificarConflitoAgendamento(supabase: any, data: any, barId: number) {
  // Implementação fictícia para exemplo
  return false;
}
