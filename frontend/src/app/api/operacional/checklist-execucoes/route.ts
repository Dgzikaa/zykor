import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import DiscordChecklistService from '@/lib/discord-checklist-service';

// Forçar renderização dinâmica devido ao uso de request.url
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      checklist_id,
      responsavel_id,
      tempo_execucao,
      total_itens,
      itens_ok,
      itens_problema,
      itens_na,
      observacoes_gerais,
      respostas,
      bar_id,
    } = body;

    // Validações básicas
    if (!checklist_id || !responsavel_id || !bar_id) {
      return NextResponse.json(
        {
          error: 'Dados obrigatórios: checklist_id, responsavel_id, bar_id',
        },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Criar registro de execução
    const { data: execucao, error: execucaoError } = await supabase
      .from('checklist_execucoes')
      .insert({
        checklist_id,
        responsavel_id,
        status: 'concluido',
        concluido_em: new Date().toISOString(),
        tempo_execucao,
        total_itens: total_itens || 0,
        itens_ok: itens_ok || 0,
        itens_problema: itens_problema || 0,
        itens_na: itens_na || 0,
        observacoes_gerais,
        bar_id,
        dispositivo_info: {
          user_agent: request.headers.get('user-agent'),
          timestamp: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (execucaoError) {
      console.error('❌ Erro ao criar execução:', execucaoError);
      return NextResponse.json(
        {
          error: 'Erro ao salvar execução do checklist',
          details: execucaoError.message,
        },
        { status: 500 }
      );
    }

    // 2. Salvar respostas individuais
    if (respostas && Array.isArray(respostas) && respostas.length > 0) {
      const respostasFormatadas = respostas.map(resposta => ({
        execucao_id: execucao.id,
        item_id: resposta.item_id,
        valor: resposta.valor,
        observacoes: resposta.observacoes,
        arquivos: resposta.arquivos || [],
        status: resposta.status || 'ok',
      }));

      const { error: respostasError } = await supabase
        .from('checklist_respostas')
        .insert(respostasFormatadas);

      if (respostasError) {
        console.error('❌ Erro ao salvar respostas:', respostasError);
        // Não falhar a operação se só as respostas deram erro
      }
    }

    // 3. Calcular nota geral usando sistema inteligente
    let scoreResult: unknown = null;
    try {
      const checklistScoring = await import('@/lib/checklist-scoring');
      const mockExecucao = {
        respostas: { secoes: respostas.map((r: unknown) => ({ itens: [r] })) },
        estrutura_checklist: { secoes: [] }, // Estrutura simplificada para compatibilidade
      };
      scoreResult = checklistScoring.calcularScore(mockExecucao as any, 0, 0);

      // Atualizar execução com score calculado
      const { error: scoreError } = await supabase
        .from('checklist_execucoes')
        .update({
          score_final: (scoreResult as any).score,
          score_detalhado: scoreResult,
          categoria_score:
            (scoreResult as any).percentual > 80
              ? 'excelente'
              : (scoreResult as any).percentual > 60
                ? 'bom'
                : 'regular',
        })
        .eq('id', execucao.id);

      if (scoreError) {
        console.error('❌ Erro ao salvar score:', scoreError);
      }
    } catch (scoreError) {
      console.error('❌ Erro no cálculo de score:', scoreError);
    }

    // 4. 🔥 ENVIAR NOTIFICAÇÃO DISCORD DE CONCLUSÃO
    try {
      // Buscar dados do checklist e usuário para notificação completa
      const { data: checklistData } = await supabase
        .from('checklists')
        .select('nome, categoria, setor')
        .eq('id', checklist_id)
        .single();

      const { data: userData } = await supabase
        .from('usuarios_bar')
        .select('nome')
        .eq('id', responsavel_id)
        .single();

      if (checklistData && userData) {
        const executionNotification = {
          id: execucao.id,
          checklist_id: checklist_id,
          titulo: checklistData.nome || 'Checklist',
          responsavel: userData.nome || 'Usuário',
          setor: checklistData.setor || 'Não informado',
          tempo_execucao: tempo_execucao || 0,
          total_itens: total_itens || 0,
          itens_ok: itens_ok || 0,
          itens_problema: itens_problema || 0,
          status: 'concluido',
          observacoes_gerais: observacoes_gerais || '',
          concluido_em: execucao.concluido_em,
          pontuacao_final: (scoreResult as any)?.score || null,
        };

        await DiscordChecklistService.sendCompletion(executionNotification);
      }
    } catch (discordError) {
      console.error('❌ Erro ao enviar notificação Discord:', discordError);
      // Não falhar a operação se só o Discord der erro
    }

    return NextResponse.json({
      success: true,
      execucao_id: execucao.id,
      message: 'Checklist enviado com sucesso!',
      discord_notification: true,
    });
  } catch (error: unknown) {
    console.error('❌ Erro na API checklist-execucoes:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bar_id = searchParams.get('bar_id');
    const responsavel_id = searchParams.get('responsavel_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!bar_id) {
      return NextResponse.json(
        {
          error: 'Parâmetro bar_id é obrigatório',
        },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from('checklist_execucoes')
      .select(
        `
        *,
        checklists:checklist_id (
          nome,
          descricao,
          setor,
          tipo
        ),
        usuarios_bar:responsavel_id (
          nome,
          email
        )
      `
      )
      .eq('bar_id', bar_id)
      .order('concluido_em', { ascending: false })
      .range(offset, offset + limit - 1);

    if (responsavel_id) {
      query = query.eq('responsavel_id', responsavel_id);
    }

    const { data: execucoes, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar execuções:', error);
      return NextResponse.json(
        {
          error: 'Erro ao buscar execuções',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      execucoes: execucoes || [],
      total: execucoes?.length || 0,
    });
  } catch (error: unknown) {
    console.error('❌ Erro na API GET checklist-execucoes:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
