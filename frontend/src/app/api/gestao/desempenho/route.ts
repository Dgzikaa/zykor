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

// Campos que pertencem à tabela marketing_semanal
const MARKETING_FIELDS = [
  'o_num_posts', 'o_alcance', 'o_interacao', 'o_curtidas', 'o_comentarios', 
  'o_salvamentos', 'o_compartilhamento', 'o_engajamento', 'o_num_stories', 
  'o_visu_stories', 'o_retencao_stories',
  'm_valor_investido', 'm_alcance', 'm_impressoes', 'm_frequencia', 'm_cpm',
  'm_cliques', 'm_ctr', 'm_cpc', 'm_conversas_iniciadas', 'm_reproducoes_25', 'm_reproducoes_75',
  'g_valor_investido', 'g_impressoes', 'g_cliques', 'g_cpc', 'g_ctr',
  'g_solicitacoes_rotas', 'g_ligacoes', 'g_click_reservas',
  'gmn_total_acoes', 'gmn_total_visualizacoes', 'gmn_visu_pesquisa', 'gmn_visu_maps',
  'gmn_cliques_website', 'gmn_ligacoes', 'gmn_solicitacoes_rotas', 'gmn_menu_views'
];

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

    const { id, numero_semana, ano, ...updateData } = body;
    console.log('PUT desempenho - barId:', barId, 'id:', id, 'updateData:', JSON.stringify(updateData));

    if (!barId || !id) {
      return NextResponse.json(
        { success: false, error: `Parâmetros inválidos: barId=${barId}, id=${id}` },
        { status: 400 }
      );
    }

    // Extrair dados do usuário para auditoria
    let userId: string | null = null;
    let userName: string | null = null;
    if (userDataHeader) {
      try {
        const decoded = decodeURIComponent(userDataHeader);
        const parsed = JSON.parse(decoded);
        // Converter ID para string (pode ser número ou UUID)
        userId = parsed.id ? String(parsed.id) : null;
        userName = parsed.nome || parsed.email || null;
      } catch (e) {
        // Ignora erro de parse para auditoria
      }
    }

    // Usar service_role para dados administrativos (bypass RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Separar campos de marketing e desempenho
    const marketingData: Record<string, any> = {};
    const desempenhoData: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(updateData)) {
      if (MARKETING_FIELDS.includes(key)) {
        marketingData[key] = value;
      } else {
        desempenhoData[key] = value;
      }
    }

    let resultData = null;
    let hasError = false;
    let errorMessage = '';

    // Atualizar marketing_semanal se houver campos de marketing
    if (Object.keys(marketingData).length > 0) {
      // Primeiro, buscar semana/ano do registro de desempenho
      const { data: desempenhoInfo } = await supabase
        .from('desempenho_semanal')
        .select('numero_semana, ano')
        .eq('id', id)
        .eq('bar_id', barId)
        .single();

      if (desempenhoInfo) {
        // Atualizar marketing_semanal usando semana e ano
        const { data: mktData, error: mktError } = await supabase
          .from('marketing_semanal')
          .update({
            ...marketingData,
            updated_at: new Date().toISOString()
          })
          .eq('bar_id', barId)
          .eq('semana', desempenhoInfo.numero_semana)
          .eq('ano', desempenhoInfo.ano)
          .select()
          .single();

        if (mktError) {
          console.error('Erro ao atualizar marketing_semanal:', mktError);
          // Se não existe, criar o registro
          if (mktError.code === 'PGRST116') {
            const { error: insertError } = await supabase
              .from('marketing_semanal')
              .insert({
                bar_id: barId,
                semana: desempenhoInfo.numero_semana,
                ano: desempenhoInfo.ano,
                ...marketingData,
                fonte: 'manual'
              });
            if (insertError) {
              hasError = true;
              errorMessage = `Erro ao inserir marketing: ${insertError.message}`;
            }
          } else {
            hasError = true;
            errorMessage = `Erro ao atualizar marketing: ${mktError.message}`;
          }
        } else {
          resultData = mktData;
        }
      }
    }

    // Atualizar desempenho_semanal se houver campos de desempenho
    if (Object.keys(desempenhoData).length > 0 && !hasError) {
      const { data, error } = await supabase
        .from('desempenho_semanal')
        .update({
          ...desempenhoData,
          atualizado_em: new Date().toISOString(),
          atualizado_por: userId,
          atualizado_por_nome: userName
        })
        .eq('id', id)
        .eq('bar_id', barId)
        .select()
        .single();

      if (error) {
        console.error('Erro Supabase ao atualizar desempenho:', error);
        hasError = true;
        errorMessage = `Erro ao atualizar desempenho: ${error.message}`;
      } else {
        resultData = data;
      }
    }

    if (hasError) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }

    console.log('PUT desempenho - sucesso:', resultData);
    return NextResponse.json({ 
      success: true, 
      message: 'Registro atualizado com sucesso',
      data: resultData
    });

  } catch (error) {
    console.error('Erro geral ao atualizar:', error);
    return NextResponse.json(
      { success: false, error: `Erro interno: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
