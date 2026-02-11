import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Listar chamados
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const status = searchParams.get('status');
    const categoria = searchParams.get('categoria');
    const prioridade = searchParams.get('prioridade');
    const criado_por = searchParams.get('criado_por');
    const limite = searchParams.get('limite') || '50';
    const pagina = searchParams.get('pagina') || '1';

    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const offset = (parseInt(pagina) - 1) * parseInt(limite);

    let query = supabase
      .from('chamados')
      .select('*', { count: 'exact' })
      .eq('bar_id', parseInt(barId))
      .order('criado_em', { ascending: false })
      .range(offset, offset + parseInt(limite) - 1);

    if (status && status !== 'todos') {
      query = query.eq('status', status);
    }
    if (categoria && categoria !== 'todos') {
      query = query.eq('categoria', categoria);
    }
    if (prioridade && prioridade !== 'todos') {
      query = query.eq('prioridade', prioridade);
    }
    if (criado_por) {
      query = query.eq('criado_por', criado_por);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar chamados:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar chamados', details: error.message },
        { status: 500 }
      );
    }

    const chamados = (data || []) as any[];

    // Buscar contagem por status para estatísticas rápidas
    const { data: statsData } = await supabase
      .from('chamados')
      .select('status')
      .eq('bar_id', parseInt(barId));

    const stats = {
      total: statsData?.length || 0,
      abertos: statsData?.filter(c => c.status === 'aberto').length || 0,
      em_andamento: statsData?.filter(c => c.status === 'em_andamento').length || 0,
      aguardando_cliente: statsData?.filter(c => c.status === 'aguardando_cliente').length || 0,
      resolvidos: statsData?.filter(c => c.status === 'resolvido').length || 0,
      fechados: statsData?.filter(c => c.status === 'fechado').length || 0
    };

    return NextResponse.json({
      success: true,
      data: chamados,
      meta: {
        total: count || 0,
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        total_paginas: Math.ceil((count || 0) / parseInt(limite))
      },
      stats
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar novo chamado
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      bar_id, 
      titulo, 
      descricao, 
      categoria, 
      modulo, 
      prioridade,
      criado_por,
      criado_por_nome,
      anexos,
      tags
    } = body;

    // Validações
    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    if (!titulo || titulo.trim().length < 5) {
      return NextResponse.json(
        { error: 'Título deve ter pelo menos 5 caracteres' },
        { status: 400 }
      );
    }
    if (!descricao || descricao.trim().length < 10) {
      return NextResponse.json(
        { error: 'Descrição deve ter pelo menos 10 caracteres' },
        { status: 400 }
      );
    }
    if (!criado_por) {
      return NextResponse.json(
        { error: 'criado_por é obrigatório' },
        { status: 400 }
      );
    }

    // Criar chamado
    const novoChamado = {
      bar_id: parseInt(bar_id),
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      categoria: categoria || 'duvida',
      modulo: modulo || 'outro',
      prioridade: prioridade || 'media',
      status: 'aberto',
      criado_por,
      anexos: anexos || [],
      tags: tags || [],
      sla_primeira_resposta_horas: prioridade === 'critica' ? 4 : prioridade === 'alta' ? 12 : 24,
      sla_resolucao_horas: prioridade === 'critica' ? 24 : prioridade === 'alta' ? 48 : 72
    };

    const { data: chamado, error } = await supabase
      .from('chamados')
      .insert(novoChamado)
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar chamado:', error);
      return NextResponse.json(
        { error: 'Erro ao criar chamado', details: error.message },
        { status: 500 }
      );
    }

    // Registrar no histórico
    await supabase
      .from('chamados_historico')
      .insert({
        chamado_id: chamado.id,
        usuario_id: criado_por,
        usuario_nome: criado_por_nome || 'Usuário',
        acao: 'criado',
        detalhes: { titulo, categoria, prioridade }
      });

    // Criar notificação (se existir a tabela)
    try {
      await supabase
        .from('notificacoes')
        .insert({
          bar_id: parseInt(bar_id),
          usuario_id: criado_por,
          tipo: 'info',
          titulo: `Chamado #${chamado.numero_chamado} criado`,
          mensagem: `Seu chamado "${titulo}" foi registrado com sucesso.`,
          dados: { chamado_id: chamado.id, numero: chamado.numero_chamado },
          canais: ['app'],
          status: 'enviada'
        });
    } catch (notifError) {
      console.log('Notificação não enviada (tabela pode não existir):', notifError);
    }

    return NextResponse.json({
      success: true,
      data: chamado,
      message: `Chamado #${chamado.numero_chamado} criado com sucesso`
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
