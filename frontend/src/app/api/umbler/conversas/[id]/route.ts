import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/umbler/conversas/[id]
 * Retorna detalhes de uma conversa com mensagens
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Buscar conversa
    const { data: conversa, error: conversaError } = await supabase
      .from('umbler_conversas')
      .select('*')
      .eq('id', id)
      .single();

    if (conversaError) {
      console.error('Erro ao buscar conversa:', conversaError);
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    // Buscar mensagens da conversa
    const { data: mensagens, error: mensagensError } = await supabase
      .from('umbler_mensagens')
      .select('*')
      .eq('conversa_id', id)
      .order('created_at', { ascending: true });

    if (mensagensError) {
      console.error('Erro ao buscar mensagens:', mensagensError);
    }

    // Buscar dados do cliente na tabela visitas se tiver correlação
    let clienteVisita: {
      id: any;
      cliente_nome: any;
      data_visita: any;
      valor_pagamentos: any;
    } | null = null;
    if (conversa.cliente_id) {
      const { data: cliente } = await supabase
        .from('visitas')
        .select('id, cliente_nome, data_visita, valor_pagamentos')
        .eq('id', conversa.cliente_id)
        .single();
      
      clienteVisita = cliente;
    }

    return NextResponse.json({
      conversa,
      mensagens: mensagens || [],
      cliente_visita: clienteVisita
    });

  } catch (error) {
    console.error('Erro na API Umbler Conversa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
