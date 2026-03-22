import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DiscordChecklistService } from '@/lib/discord-checklist-service';

export const dynamic = 'force-dynamic'

// ========================================
// 🚨 API PARA ALERTAS DE CHECKLISTS
// ========================================

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
  checklist: {
    id: string;
    titulo: string;
    categoria: string;
  };
}

interface ChecklistExecution {
  id: string;
  checklist_id: string;
  executed_at: string;
  status: string;
}

interface Alert {
  id: string;
  checklistId: string;
  scheduleId: string;
  titulo: string;
  categoria: string;
  tipo: 'atraso' | 'perdido' | 'urgente' | 'lembrete';
  nivel: 'baixo' | 'medio' | 'alto' | 'critico';
  tempoAtraso: number;
  horaEsperada: string;
  dataEsperada: string;
  mensagem: string;
  ativo: boolean;
  resolvido: boolean;
  criadoEm: string;
}

interface ApiError {
  message: string;
}

// ========================================
// 🚨 GET /api/checklists/alerts
// ========================================

export async function GET() {
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

    // Buscar agendamentos ativos
    const { data: schedules, error: schedulesError } = await supabase
      .from('checklist_schedules')
      .select(
        `
        *,
        checklist:checklists(id, titulo, categoria)
      `
      )
      .eq('user_id', user.id)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (schedulesError) {
      console.error('Erro ao buscar agendamentos:', schedulesError);
      return NextResponse.json(
        {
          error: 'Erro ao buscar agendamentos',
        },
        { status: 500 }
      );
    }

    // Buscar execuções recentes
    const { data: executions, error: executionsError } = await supabase
      .from('checklist_executions')
      .select('id, checklist_id, executed_at, status')
      .eq('user_id', user.id)
      .gte(
        'executed_at',
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      ) // Últimos 7 dias
      .order('executed_at', { ascending: false });

    if (executionsError) {
      console.error('Erro ao buscar execuções:', executionsError);
    }

    const alerts = await generateAlerts(schedules || [], executions || []);

    // 🔥 ENVIAR ALERTAS CRÍTICOS PARA DISCORD
    const criticalAlerts = alerts.filter(a => a.nivel === 'critico');
    const urgentAlerts = alerts.filter(a => a.nivel === 'alto');

    // Enviar alertas críticos imediatamente para Discord
    for (const criticalAlert of criticalAlerts) {
      try {
        await DiscordChecklistService.sendCriticalAlert(criticalAlert);
      } catch (error) {
        console.error('❌ Erro ao enviar alerta crítico para Discord:', error);
      }
    }

    // Enviar alertas urgentes também para Discord
    for (const urgentAlert of urgentAlerts) {
      try {
        await DiscordChecklistService.sendAlert(urgentAlert);
      } catch (error) {
        console.error('❌ Erro ao enviar alerta urgente para Discord:', error);
      }
    }

    return NextResponse.json({
      success: true,
      alerts,
      totalAlerts: alerts.length,
      criticalAlerts: criticalAlerts.length,
      urgentAlerts: urgentAlerts.length,
      discord_notifications: {
        critical_sent: criticalAlerts.length,
        urgent_sent: urgentAlerts.length,
      },
    });
  } catch (error: unknown) {
    const apiError = error as ApiError;
    console.error('Erro ao buscar alertas:', apiError);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}

// =====================================================
// 🎯 FUNÇÃO PARA GERAR ALERTAS AUTOMATICAMENTE
// =====================================================

async function generateAlerts(
  schedules: Schedule[],
  executions: ChecklistExecution[]
) {
  const alerts: Alert[] = [];
  const now = new Date();
  const today = now.getDay(); // 0=domingo, 1=segunda, etc.
  const todayDate = now.getDate();

  for (const schedule of schedules) {
    if (!schedule.checklist) continue;

    // Verificar se deve executar hoje
    const shouldExecuteToday = shouldScheduleExecuteToday(
      schedule,
      today,
      todayDate
    );
    if (!shouldExecuteToday) continue;

    // Verificar última execução
    const lastExecution = executions
      .filter(exec => exec.checklist_id === schedule.checklist_id)
      .sort(
        (a, b) =>
          new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
      )[0];

    // Calcular horário esperado de hoje
    const expectedTime = new Date();
    const [hours, minutes] = schedule.horario.split(':').map(Number);
    expectedTime.setHours(hours, minutes, 0, 0);

    // Se já passou do horário e não foi executado hoje
    if (now > expectedTime) {
      const isExecutedToday =
        lastExecution &&
        new Date(lastExecution.executed_at).toDateString() ===
          now.toDateString();

      if (!isExecutedToday) {
        const delayMinutes = Math.floor(
          (now.getTime() - expectedTime.getTime()) / (1000 * 60)
        );

        const alert: Alert = {
          id: `alert-${schedule.id}-${now.toDateString()}`,
          checklistId: schedule.checklist_id,
          scheduleId: schedule.id,
          titulo: schedule.checklist.titulo,
          categoria: schedule.checklist.categoria,
          tipo: getAlertType(delayMinutes),
          nivel: getAlertLevel(delayMinutes),
          tempoAtraso: delayMinutes,
          horaEsperada: schedule.horario,
          dataEsperada: now.toDateString(),
          mensagem: generateAlertMessage(
            schedule.checklist.titulo,
            delayMinutes
          ),
          ativo: true,
          resolvido: false,
          criadoEm: now.toISOString(),
        };

        alerts.push(alert);
      }
    }
  }

  return alerts;
}

// =====================================================
// 🎯 FUNÇÕES AUXILIARES
// =====================================================

function shouldScheduleExecuteToday(
  schedule: Schedule,
  today: number,
  todayDate: number
): boolean {
  switch (schedule.frequencia) {
    case 'diaria':
      return true;

    case 'semanal':
      return schedule.dias_semana?.includes(today) || false;

    case 'mensal':
      return schedule.dia_mes === todayDate;

    default:
      return false;
  }
}

function getAlertType(
  delayMinutes: number
): 'atraso' | 'perdido' | 'urgente' | 'lembrete' {
  if (delayMinutes > 360) return 'perdido'; // > 6 horas
  if (delayMinutes > 120) return 'urgente'; // > 2 horas
  if (delayMinutes > 30) return 'atraso'; // > 30 min
  return 'lembrete';
}

function getAlertLevel(
  delayMinutes: number
): 'baixo' | 'medio' | 'alto' | 'critico' {
  if (delayMinutes > 480) return 'critico'; // > 8 horas
  if (delayMinutes > 240) return 'alto'; // > 4 horas
  if (delayMinutes > 60) return 'medio'; // > 1 hora
  return 'baixo';
}

function generateAlertMessage(
  checklistTitulo: string,
  delayMinutes: number
): string {
  const delayText =
    delayMinutes < 60
      ? `${delayMinutes} minutos`
      : `${Math.floor(delayMinutes / 60)} horas`;

  if (delayMinutes > 480) {
    return `⚠️ CRÍTICO: "${checklistTitulo}" está atrasado há ${delayText}! Verificação urgente necessária.`;
  }

  if (delayMinutes > 240) {
    return `🚨 URGENTE: "${checklistTitulo}" não foi executado há ${delayText}. Ação imediata requerida.`;
  }

  if (delayMinutes > 60) {
    return `⏰ ATENÇÃO: "${checklistTitulo}" está ${delayText} atrasado. Execute assim que possível.`;
  }

  return `🔔 LEMBRETE: "${checklistTitulo}" deveria ter sido executado há ${delayText}.`;
}

// =====================================================
// 🔧 CRIAR ALERTAS MANUALMENTE (POST)
// =====================================================

export async function POST(req: NextRequest) {
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

    const alertData: Alert = await req.json();

    if (!alertData.checklistId || !alertData.scheduleId) {
      return NextResponse.json(
        {
          error: 'Dados obrigatórios não fornecidos',
        },
        { status: 400 }
      );
    }

    // eslint-disable-next-line no-unused-vars
    const { id: _id, ...alertDataWithoutId } = alertData;

    return NextResponse.json({
      success: true,
      message: 'Alerta criado com sucesso',
      alert: {
        ...alertDataWithoutId,
        id: `custom-alert-${Date.now()}`,
        criadoEm: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Erro ao criar alerta:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
