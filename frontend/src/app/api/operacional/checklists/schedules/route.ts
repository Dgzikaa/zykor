import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

// ========================================
// 📅 API PARA AGENDAMENTOS DE CHECKLISTS
// ========================================

interface ScheduleData {
  checklistId: string;
  titulo: string;
  frequencia: string;
  horario: string;
  diasSemana?: number[];
  diaMes?: number;
  ativo?: boolean;
  notificacoes?: boolean;
  responsaveis?: string[];
  observacoes?: string;
}

interface ScheduleUpdateData {
  id: string;
  titulo?: string;
  frequencia?: string;
  horario?: string;
  diasSemana?: number[];
  diaMes?: number;
  ativo?: boolean;
  notificacoes?: boolean;
  responsaveis?: string[];
  observacoes?: string;
}

interface Schedule {
  id: string;
  checklist_id: string;
  titulo: string;
  frequencia: string;
  horario: string;
  dias_semana?: number[];
  dia_mes?: number;
  ativo: boolean;
  notificacoes: boolean;
  responsaveis: string[];
  observacoes?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  checklist?: {
    id: string;
    titulo: string;
    categoria: string;
  };
}

// interface Checklist {
//   id: string;
//   titulo: string;
//   user_id: string;
// }

interface ScheduleToInsert {
  checklist_id: string;
  titulo: string;
  frequencia: string;
  horario: string;
  dias_semana?: number[] | null;
  dia_mes?: number | null;
  ativo: boolean;
  notificacoes: boolean;
  responsaveis: string[];
  observacoes?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// ========================================
// 📅 POST /api/checklists/schedules
// ========================================

export async function POST(req: NextRequest) {
  const authUser = await authenticateUser(req);
  if (!authUser) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const scheduleData: ScheduleData = await req.json();

    if (
      !scheduleData.checklistId ||
      !scheduleData.frequencia ||
      !scheduleData.horario
    ) {
      return NextResponse.json(
        {
          error: 'Dados obrigatórios não fornecidos',
        },
        { status: 400 }
      );
    }

    // Verificar se o checklist existe e pertence ao usuário
    const { data: checklist, error: checklistError } = await supabase
      .from('checklists')
      .select('id, titulo, user_id')
      .eq('id', scheduleData.checklistId)
      .eq('user_id', user.id)
      .single();

    if (checklistError || !checklist) {
      return NextResponse.json(
        {
          error: 'Checklist não encontrado',
        },
        { status: 404 }
      );
    }

    // Preparar dados para inserção
    const scheduleToInsert: ScheduleToInsert = {
      checklist_id: scheduleData.checklistId,
      titulo: scheduleData.titulo,
      frequencia: scheduleData.frequencia,
      horario: scheduleData.horario,
      dias_semana: scheduleData.diasSemana || null,
      dia_mes: scheduleData.diaMes || null,
      ativo: scheduleData.ativo ?? true,
      notificacoes: scheduleData.notificacoes ?? true,
      responsaveis: scheduleData.responsaveis || [],
      observacoes: scheduleData.observacoes || null,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Inserir agendamento
    const { data: insertedSchedule, error: insertError } = await supabase
      .from('checklist_schedules')
      .insert(scheduleToInsert)
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir agendamento:', insertError);
      return NextResponse.json(
        {
          error: 'Erro ao criar agendamento',
        },
        { status: 500 }
      );
    }

    const insertedScheduleData = insertedSchedule as Schedule;

    return NextResponse.json({
      success: true,
      message: 'Agendamento criado com sucesso',
      schedule: insertedScheduleData,
    });
  } catch (error: unknown) {
    console.error('Erro ao criar agendamento:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const checklistId = searchParams.get('checklistId');

    let query = supabase
      .from('checklist_schedules')
      .select(
        `
        *,
        checklist:checklists(id, titulo, categoria)
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (checklistId) {
      query = query.eq('checklist_id', checklistId);
    }

    const { data: schedules, error: schedulesError } = await query;

    if (schedulesError) {
      console.error('Erro ao buscar agendamentos:', schedulesError);
      return NextResponse.json(
        {
          error: 'Erro ao buscar agendamentos',
        },
        { status: 500 }
      );
    }

    const schedulesData = (schedules as Schedule[]) || [];

    return NextResponse.json({
      success: true,
      schedules: schedulesData,
    });
  } catch (error: unknown) {
    console.error('Erro ao buscar agendamentos:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const authUser = await authenticateUser(req);
  if (!authUser) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const scheduleData: ScheduleUpdateData = await req.json();

    if (!scheduleData.id) {
      return NextResponse.json(
        {
          error: 'ID do agendamento não fornecido',
        },
        { status: 400 }
      );
    }

    // Verificar se o agendamento existe e pertence ao usuário
    const { data: existingSchedule, error: scheduleError } = await supabase
      .from('checklist_schedules')
      .select('id, user_id')
      .eq('id', scheduleData.id)
      .eq('user_id', user.id)
      .single();

    if (scheduleError || !existingSchedule) {
      return NextResponse.json(
        {
          error: 'Agendamento não encontrado',
        },
        { status: 404 }
      );
    }

    // Preparar dados para atualização
    const updateData: Partial<ScheduleToInsert> = {
      updated_at: new Date().toISOString(),
    };

    if (scheduleData.titulo !== undefined)
      updateData.titulo = scheduleData.titulo;
    if (scheduleData.frequencia !== undefined)
      updateData.frequencia = scheduleData.frequencia;
    if (scheduleData.horario !== undefined)
      updateData.horario = scheduleData.horario;
    if (scheduleData.diasSemana !== undefined)
      updateData.dias_semana = scheduleData.diasSemana;
    if (scheduleData.diaMes !== undefined)
      updateData.dia_mes = scheduleData.diaMes;
    if (scheduleData.ativo !== undefined) updateData.ativo = scheduleData.ativo;
    if (scheduleData.notificacoes !== undefined)
      updateData.notificacoes = scheduleData.notificacoes;
    if (scheduleData.responsaveis !== undefined)
      updateData.responsaveis = scheduleData.responsaveis;
    if (scheduleData.observacoes !== undefined)
      updateData.observacoes = scheduleData.observacoes;

    // Atualizar agendamento
    const { data: updatedSchedule, error: updateError } = await supabase
      .from('checklist_schedules')
      .update(updateData)
      .eq('id', scheduleData.id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar agendamento:', updateError);
      return NextResponse.json(
        {
          error: 'Erro ao atualizar agendamento',
        },
        { status: 500 }
      );
    }

    const updatedScheduleData = updatedSchedule as Schedule;

    return NextResponse.json({
      success: true,
      message: 'Agendamento atualizado com sucesso',
      schedule: updatedScheduleData,
    });
  } catch (error: unknown) {
    console.error('Erro ao atualizar agendamento:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authUser = await authenticateUser(req);
  if (!authUser) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get('id');

    if (!scheduleId) {
      return NextResponse.json(
        {
          error: 'ID do agendamento não fornecido',
        },
        { status: 400 }
      );
    }

    // Verificar se o agendamento existe e pertence ao usuário
    const { data: existingSchedule, error: scheduleError } = await supabase
      .from('checklist_schedules')
      .select('id, user_id')
      .eq('id', scheduleId)
      .eq('user_id', user.id)
      .single();

    if (scheduleError || !existingSchedule) {
      return NextResponse.json(
        {
          error: 'Agendamento não encontrado',
        },
        { status: 404 }
      );
    }

    // Deletar agendamento
    const { error: deleteError } = await supabase
      .from('checklist_schedules')
      .delete()
      .eq('id', scheduleId);

    if (deleteError) {
      console.error('Erro ao deletar agendamento:', deleteError);
      return NextResponse.json(
        {
          error: 'Erro ao deletar agendamento',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agendamento deletado com sucesso',
    });
  } catch (error: unknown) {
    console.error('Erro ao deletar agendamento:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
