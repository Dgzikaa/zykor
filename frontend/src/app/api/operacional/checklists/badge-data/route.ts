import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

// =====================================================
// GET - BUSCAR DADOS DO BADGE DE CHECKLISTS
// =====================================================
export async function GET(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    if (!user.bar_id) {
      return NextResponse.json({ error: 'Bar ID não encontrado' }, { status: 400 });
    }
    const barIdStr = user.bar_id.toString();

    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id') || barIdStr;

    const supabase = await getAdminClient();

    // Buscar checklists pendentes e atrasados
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];

    // Buscar execuções pendentes
    const { data: execucoesPendentes, error: execucoesError } = await supabase
      .from('checklist_execucoes')
      .select(
        `
        id,
        checklist_id,
        status,
        prazo_execucao,
        funcionario_id,
        checklist:checklists!checklist_id (nome, setor, tipo)
      `
      )
      .eq('bar_id', barId)
      .in('status', ['em_andamento', 'pausado', 'agendado']);

    if (execucoesError) {
      console.error('Erro ao buscar execuções pendentes:', execucoesError);
    }

    // Buscar agendamentos ativos que deveriam ter execuções hoje
    const { data: agendamentos, error: agendamentosError } = await supabase
      .from('checklist_schedules')
      .select(
        `
        id,
        checklist_id,
        frequencia,
        horario,
        dias_semana,
        ultimo_agendamento,
        proximo_agendamento,
        checklist:checklists!checklist_id (nome, setor, tipo)
      `
      )
      .eq('bar_id', barId)
      .eq('ativo', true);

    if (agendamentosError) {
      console.error('Erro ao buscar agendamentos:', agendamentosError);
    }

    // Calcular pendentes e atrasados
    let pendentes = 0;
    let atrasados = 0;

    // Contar execuções em andamento como pendentes
    const execucoesPendentesCount =
      execucoesPendentes?.filter(
        (exec: any) =>
          exec.status === 'em_andamento' || exec.status === 'pausado'
      ).length || 0;

    // Contar execuções atrasadas (com prazo vencido)
    const execucoesAtrasadas =
      execucoesPendentes?.filter((exec: any) => {
        if (!exec.prazo_execucao) return false;
        const prazo = new Date(exec.prazo_execucao);
        return prazo < hoje;
      }).length || 0;

    // Contar agendamentos que deveriam ter execuções hoje mas não têm
    const agendamentosHoje =
      agendamentos?.filter((agendamento: any) => {
        if (!agendamento.proximo_agendamento) return false;
        const proximoAgendamento = new Date(agendamento.proximo_agendamento);
        return proximoAgendamento.toISOString().split('T')[0] <= hojeStr;
      }).length || 0;

    pendentes = execucoesPendentesCount + agendamentosHoje;
    atrasados = execucoesAtrasadas;

    const total = pendentes + atrasados;

    const badgeData = {
      pendentes,
      atrasados,
      total,
      detalhes: {
        execucoes_em_andamento: execucoesPendentesCount,
        execucoes_atrasadas: execucoesAtrasadas,
        agendamentos_hoje: agendamentosHoje,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json({
      success: true,
      data: badgeData,
    });
  } catch (error: unknown) {
    console.error('Erro na API de badge-data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
