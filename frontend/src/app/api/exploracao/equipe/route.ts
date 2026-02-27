import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');

    // 1. TAXA DE CONCLUSÃO DE CHECKLISTS POR FUNCIONÁRIO
    const { data: execucoes } = await supabase
      .from('checklist_execucoes')
      .select('funcionario_id, status, tempo_execucao, funcionarios(nome)')
      .eq('bar_id', barId)
      .gte('data_execucao', new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]);

    const performanceFuncionarios: any = {};
    (execucoes || []).forEach((exec: any) => {
      const funcId = exec.funcionario_id;
      if (!performanceFuncionarios[funcId]) {
        performanceFuncionarios[funcId] = {
          funcionario_id: funcId,
          nome: exec.funcionarios?.nome || 'Desconhecido',
          total_checklists: 0,
          concluidos: 0,
          atrasados: 0,
          tempo_total: 0
        };
      }
      
      performanceFuncionarios[funcId].total_checklists += 1;
      if (exec.status === 'concluido') {
        performanceFuncionarios[funcId].concluidos += 1;
      }
      if (exec.status === 'atrasado') {
        performanceFuncionarios[funcId].atrasados += 1;
      }
      performanceFuncionarios[funcId].tempo_total += exec.tempo_execucao || 0;
    });

    const rankingFuncionarios = Object.values(performanceFuncionarios)
      .map((f: any) => ({
        ...f,
        taxa_conclusao: (f.concluidos / f.total_checklists) * 100,
        tempo_medio: f.tempo_total / f.total_checklists
      }))
      .sort((a: any, b: any) => b.taxa_conclusao - a.taxa_conclusao);

    // 2. HORÁRIOS DE MAIOR ATRASO
    const { data: execucoesPorHora } = await supabase
      .from('checklist_execucoes')
      .select('hora_inicio, hora_fim, status, tempo_execucao')
      .eq('bar_id', barId)
      .gte('data_execucao', new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]);

    const atrasosPorHora: any = {};
    (execucoesPorHora || []).forEach((exec: any) => {
      if (exec.hora_inicio) {
        const hora = exec.hora_inicio.substring(0, 2);
        if (!atrasosPorHora[hora]) {
          atrasosPorHora[hora] = {
            hora: `${hora}:00`,
            total: 0,
            atrasados: 0,
            concluidos: 0
          };
        }
        atrasosPorHora[hora].total += 1;
        if (exec.status === 'atrasado') {
          atrasosPorHora[hora].atrasados += 1;
        } else if (exec.status === 'concluido') {
          atrasosPorHora[hora].concluidos += 1;
        }
      }
    });

    const horariosProblematicos = Object.values(atrasosPorHora)
      .map((h: any) => ({
        ...h,
        taxa_atraso: (h.atrasados / h.total) * 100
      }))
      .sort((a: any, b: any) => b.taxa_atraso - a.taxa_atraso);

    // 3. CORRELAÇÃO CHECKLIST × FATURAMENTO
    const { data: eventosPorData } = await supabase
      .from('eventos_base')
      .select('data_evento, real_r')
      .eq('bar_id', barId)
      .gte('data_evento', new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]);

    const { data: checklistsPorData } = await supabase
      .from('checklist_execucoes')
      .select('data_execucao, status')
      .eq('bar_id', barId)
      .gte('data_execucao', new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]);

    const correlacaoChecklistFat: any[] = [];
    const mapaChecklists = new Map<string, any>();
    
    (checklistsPorData || []).forEach((c: any) => {
      const data = c.data_execucao;
      if (!mapaChecklists.has(data)) {
        mapaChecklists.set(data, { total: 0, concluidos: 0 });
      }
      mapaChecklists.get(data)!.total += 1;
      if (c.status === 'concluido') {
        mapaChecklists.get(data)!.concluidos += 1;
      }
    });

    (eventosPorData || []).forEach((e: any) => {
      const checklists = mapaChecklists.get(e.data_evento);
      if (checklists) {
        correlacaoChecklistFat.push({
          data: e.data_evento,
          faturamento: e.real_r,
          checklists_concluidos: checklists.concluidos,
          checklists_total: checklists.total,
          taxa_conclusao: (checklists.concluidos / checklists.total) * 100
        });
      }
    });

    return NextResponse.json({
      success: true,
      exploracao: {
        ranking_funcionarios: rankingFuncionarios,
        horarios_problematicos: horariosProblematicos,
        correlacao_checklist_faturamento: correlacaoChecklistFat.slice(0, 30)
      }
    });

  } catch (error: any) {
    console.error('Erro na exploração de equipe:', error);
    return NextResponse.json(
      { error: 'Erro ao explorar equipe', details: error.message },
      { status: 500 }
    );
  }
}
