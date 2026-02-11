import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Buscar chamado específico com mensagens e histórico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do chamado é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar chamado
    const { data: chamado, error: chamadoError } = await supabase
      .from('chamados')
      .select('*')
      .eq('id', id)
      .single();

    if (chamadoError || !chamado) {
      return NextResponse.json(
        { error: 'Chamado não encontrado' },
        { status: 404 }
      );
    }

    // Buscar mensagens
    const { data: mensagens } = await supabase
      .from('chamados_mensagens')
      .select('*')
      .eq('chamado_id', id)
      .order('criado_em', { ascending: true });

    // Buscar histórico
    const { data: historico } = await supabase
      .from('chamados_historico')
      .select('*')
      .eq('chamado_id', id)
      .order('criado_em', { ascending: false })
      .limit(50);

    return NextResponse.json({
      success: true,
      data: {
        ...chamado,
        mensagens: mensagens || [],
        historico: historico || []
      }
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar chamado
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      status, 
      prioridade, 
      atribuido_para,
      avaliacao_nota,
      avaliacao_comentario,
      usuario_id,
      usuario_nome
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do chamado é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar chamado atual
    const { data: chamadoAtual } = await supabase
      .from('chamados')
      .select('*')
      .eq('id', id)
      .single();

    if (!chamadoAtual) {
      return NextResponse.json(
        { error: 'Chamado não encontrado' },
        { status: 404 }
      );
    }

    // Preparar atualização
    const updateData: any = {};

    if (status !== undefined) {
      updateData.status = status;
      
      // Atualizar timestamps baseado no status
      if (status === 'resolvido' && chamadoAtual.status !== 'resolvido') {
        updateData.resolvido_em = new Date().toISOString();
      }
      if (status === 'fechado' && chamadoAtual.status !== 'fechado') {
        updateData.fechado_em = new Date().toISOString();
      }
    }

    if (prioridade !== undefined) {
      updateData.prioridade = prioridade;
    }

    if (atribuido_para !== undefined) {
      updateData.atribuido_para = atribuido_para;
    }

    if (avaliacao_nota !== undefined) {
      updateData.avaliacao_nota = avaliacao_nota;
      updateData.avaliacao_comentario = avaliacao_comentario || null;
      updateData.avaliacao_em = new Date().toISOString();

      // Registrar avaliação no histórico
      await supabase
        .from('chamados_historico')
        .insert({
          chamado_id: id,
          usuario_id: usuario_id || chamadoAtual.criado_por,
          usuario_nome: usuario_nome || 'Usuário',
          acao: 'avaliado',
          detalhes: { nota: avaliacao_nota, comentario: avaliacao_comentario }
        });
    }

    // Atualizar chamado (o trigger vai registrar no histórico)
    const { data: chamadoAtualizado, error } = await supabase
      .from('chamados')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar chamado:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar chamado', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: chamadoAtualizado,
      message: 'Chamado atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir chamado (apenas se aberto e sem mensagens)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do chamado é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se chamado pode ser excluído
    const { data: chamado } = await supabase
      .from('chamados')
      .select('status')
      .eq('id', id)
      .single();

    if (!chamado) {
      return NextResponse.json(
        { error: 'Chamado não encontrado' },
        { status: 404 }
      );
    }

    if (chamado.status !== 'aberto') {
      return NextResponse.json(
        { error: 'Apenas chamados abertos podem ser excluídos' },
        { status: 400 }
      );
    }

    // Verificar se tem mensagens
    const { count } = await supabase
      .from('chamados_mensagens')
      .select('*', { count: 'exact', head: true })
      .eq('chamado_id', id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Chamados com mensagens não podem ser excluídos' },
        { status: 400 }
      );
    }

    // Excluir chamado
    const { error } = await supabase
      .from('chamados')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir chamado:', error);
      return NextResponse.json(
        { error: 'Erro ao excluir chamado', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Chamado excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
