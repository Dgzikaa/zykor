import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

// Função para calcular número da semana ISO
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// GET - Buscar dados de desempenho
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = request.headers.get('x-user-data')
      ? JSON.parse(request.headers.get('x-user-data') || '{}').bar_id
      : null;

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar não selecionado' },
        { status: 400 }
      );
    }

    const ano = searchParams.get('ano') || new Date().getFullYear().toString();
    const mes = searchParams.get('mes');

    // Usar service_role para dados administrativos (bypass RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Calcular semana atual
    const hoje = new Date();
    const semanaAtual = getWeekNumber(hoje);

    // Construir query base - MOSTRAR APENAS ATÉ A SEMANA ATUAL
    let query = supabase
      .from('desempenho_semanal')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', parseInt(ano))
      .lte('numero_semana', semanaAtual) // 🎯 MOSTRAR SÓ ATÉ SEMANA ATUAL
      .order('numero_semana', { ascending: false });

    // Filtrar por mês se especificado
    if (mes && mes !== 'todos') {
      const mesInt = parseInt(mes);
      // Aproximação: considerar semanas 1-4 como mês 1, 5-8 como mês 2, etc.
      const semanaInicio = (mesInt - 1) * 4 + 1;
      const semanaFim = mesInt * 4 + 4;
      
      query = query
        .gte('numero_semana', semanaInicio)
        .lte('numero_semana', semanaFim);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar dados:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar dados de desempenho' },
        { status: 500 }
      );
    }

    // Calcular resumo
    const resumo = data && data.length > 0 ? {
      total_semanas: data.length,
      faturamento_medio: data.reduce((acc, item) => acc + (item.faturamento_total || 0), 0) / data.length,
      faturamento_total_ano: data.reduce((acc, item) => acc + (item.faturamento_total || 0), 0),
      clientes_medio: data.reduce((acc, item) => acc + (item.clientes_atendidos || 0), 0) / data.length,
      clientes_total_ano: data.reduce((acc, item) => acc + (item.clientes_atendidos || 0), 0),
      ticket_medio_geral: data.reduce((acc, item) => acc + (item.ticket_medio || 0), 0) / data.length,
      atingimento_medio: data.reduce((acc, item) => {
        const atingimento = item.meta_semanal > 0 
          ? (item.faturamento_total / item.meta_semanal) * 100 
          : 0;
        return acc + atingimento;
      }, 0) / data.length,
      cmv_medio: data.reduce((acc, item) => acc + (item.cmv_limpo || 0), 0) / data.length,
    } : null;

    return NextResponse.json({ 
      success: true, 
      data: data || [],
      resumo 
    });

  } catch (error) {
    console.error('Erro na API de desempenho:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir registro de desempenho
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const barId = request.headers.get('x-user-data')
      ? JSON.parse(request.headers.get('x-user-data') || '{}').bar_id
      : null;

    if (!barId || !id) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros inválidos' },
        { status: 400 }
      );
    }

    // Usar service_role para dados administrativos (bypass RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from('desempenho_semanal')
      .delete()
      .eq('id', parseInt(id))
      .eq('bar_id', barId);

    if (error) {
      console.error('Erro ao excluir:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao excluir registro' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Registro excluído com sucesso' 
    });

  } catch (error) {
    console.error('Erro ao excluir:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar registro de desempenho
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    console.log('PUT desempenho - body:', JSON.stringify(body));
    
    const userDataHeader = request.headers.get('x-user-data');
    console.log('PUT desempenho - userDataHeader:', userDataHeader);
    
    let barId = null;
    if (userDataHeader) {
      try {
        const decoded = decodeURIComponent(userDataHeader);
        console.log('PUT desempenho - decoded:', decoded);
        const parsed = JSON.parse(decoded);
        barId = parsed.bar_id;
      } catch (parseError) {
        console.error('Erro ao parsear header:', parseError);
        return NextResponse.json(
          { success: false, error: 'Erro ao parsear header x-user-data' },
          { status: 400 }
        );
      }
    }

    const { id, ...updateData } = body;
    console.log('PUT desempenho - barId:', barId, 'id:', id, 'updateData:', JSON.stringify(updateData));

    if (!barId || !id) {
      return NextResponse.json(
        { success: false, error: `Parâmetros inválidos: barId=${barId}, id=${id}` },
        { status: 400 }
      );
    }

    // Usar service_role para dados administrativos (bypass RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Atualizar o registro
    const { data, error } = await supabase
      .from('desempenho_semanal')
      .update({
        ...updateData,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .eq('bar_id', barId)
      .select()
      .single();

    if (error) {
      console.error('Erro Supabase ao atualizar:', error);
      return NextResponse.json(
        { success: false, error: `Erro ao atualizar: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('PUT desempenho - sucesso:', data);
    return NextResponse.json({ 
      success: true, 
      message: 'Registro atualizado com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro geral ao atualizar:', error);
    return NextResponse.json(
      { success: false, error: `Erro interno: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
