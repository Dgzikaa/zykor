import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Listar mensagens de um chamado
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

    const { data: mensagens, error } = await supabase
      .from('chamados_mensagens')
      .select('*')
      .eq('chamado_id', id)
      .order('criado_em', { ascending: true });

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar mensagens', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mensagens || []
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Adicionar mensagem ao chamado
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      autor_id, 
      autor_nome, 
      autor_tipo,
      mensagem, 
      tipo,
      anexos 
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do chamado é obrigatório' },
        { status: 400 }
      );
    }

    if (!autor_id) {
      return NextResponse.json(
        { error: 'autor_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!mensagem || mensagem.trim().length < 1) {
      return NextResponse.json(
        { error: 'Mensagem é obrigatória' },
        { status: 400 }
      );
    }

    // Verificar se chamado existe e não está fechado
    const { data: chamado } = await supabase
      .from('chamados')
      .select('id, status, bar_id, criado_por, numero_chamado, titulo')
      .eq('id', id)
      .single();

    if (!chamado) {
      return NextResponse.json(
        { error: 'Chamado não encontrado' },
        { status: 404 }
      );
    }

    if (chamado.status === 'fechado' || chamado.status === 'cancelado') {
      return NextResponse.json(
        { error: 'Não é possível adicionar mensagens a chamados fechados ou cancelados' },
        { status: 400 }
      );
    }

    // Criar mensagem
    const novaMensagem = {
      chamado_id: id,
      autor_id,
      autor_nome: autor_nome || 'Usuário',
      autor_tipo: autor_tipo || 'cliente',
      mensagem: mensagem.trim(),
      tipo: tipo || 'resposta',
      anexos: anexos || []
    };

    const { data: mensagemCriada, error } = await supabase
      .from('chamados_mensagens')
      .insert(novaMensagem)
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar mensagem:', error);
      return NextResponse.json(
        { error: 'Erro ao criar mensagem', details: error.message },
        { status: 500 }
      );
    }

    // Atualizar status do chamado se necessário
    if (autor_tipo === 'cliente' && chamado.status === 'aguardando_cliente') {
      await supabase
        .from('chamados')
        .update({ status: 'em_andamento' })
        .eq('id', id);
    } else if (autor_tipo === 'suporte' && chamado.status === 'aberto') {
      await supabase
        .from('chamados')
        .update({ status: 'em_andamento' })
        .eq('id', id);
    }

    // Criar notificação para a outra parte
    try {
      const destinatario = autor_tipo === 'suporte' ? chamado.criado_por : null;
      if (destinatario) {
        await supabase
          .from('notificacoes')
          .insert({
            bar_id: chamado.bar_id,
            usuario_id: destinatario,
            tipo: 'info',
            titulo: `Nova resposta no chamado #${chamado.numero_chamado}`,
            mensagem: `${autor_nome || 'Suporte'} respondeu ao chamado "${chamado.titulo}"`,
            dados: { chamado_id: id, numero: chamado.numero_chamado },
            canais: ['app'],
            status: 'pendente'
          });
      }
    } catch (notifError) {
      console.log('Notificação não enviada:', notifError);
    }

    return NextResponse.json({
      success: true,
      data: mensagemCriada,
      message: 'Mensagem enviada com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
