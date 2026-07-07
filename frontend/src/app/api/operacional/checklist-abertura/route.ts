import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

// Interfaces para tipagem
interface ChecklistItem {
  id: number;
  titulo: string;
  descricao: string;
  area: string;
  prioridade: string;
  tempo_estimado: number;
  responsavel: string;
  status: string;
  observacoes?: string;
  horario_inicio?: string;
  horario_conclusao?: string;
  verificado_por?: string;
}

interface ChecklistItemStatus {
  status: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bar_id = searchParams.get('bar_id');
    const data = searchParams.get('data');

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    if (data) {
      // Buscar checklist específico de uma data
      const { data: checklist, error } = await supabase
        .from('checklist_abertura')
        .select(
          `
          *,
          checklist_abertura_itens (*)
        `
        )
        .eq('bar_id', bar_id)
        .eq('data', data)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar checklist:', error);
        return NextResponse.json(
          { error: 'Erro ao buscar checklist' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        checklist: checklist?.checklist_abertura_itens || [],
        hora_inicio: checklist?.hora_inicio,
        hora_conclusao: checklist?.hora_conclusao,
        responsavel_geral: checklist?.responsavel_geral,
      });
    } else {
      // Buscar todos os checklists do bar
      const { data: checklists, error } = await supabase
        .from('checklist_abertura')
        .select('*')
        .eq('bar_id', bar_id)
        .order('data', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Erro ao buscar checklists:', error);
        return NextResponse.json(
          { error: 'Erro ao buscar checklists' },
          { status: 500 }
        );
      }

      return NextResponse.json({ checklists: checklists || [] });
    }
  } catch (error) {
    console.error('Erro na API de checklist:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const body = await request.json();
    const {
      bar_id,
      data,
      hora_inicio,
      hora_conclusao,
      itens,
      responsavel_geral,
      observacoes_gerais,
    } = body;

    if (!bar_id || !data || !itens) {
      return NextResponse.json(
        {
          error: 'bar_id, data e itens são obrigatórios',
        },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Calcular estatísticas
    const total_itens = itens.length;
    const itens_concluidos = itens.filter(
      (item: ChecklistItem) => item.status === 'concluido'
    ).length;
    const itens_problemas = itens.filter(
      (item: ChecklistItem) => item.status === 'problema'
    ).length;
    const percentual_conclusao =
      total_itens > 0 ? (itens_concluidos / total_itens) * 100 : 0;

    // Criar ou atualizar checklist principal
    const { data: checklistData, error: checklistError } = await supabase
      .from('checklist_abertura')
      .upsert(
        {
          bar_id,
          data,
          hora_inicio,
          hora_conclusao,
          responsavel_geral,
          observacoes_gerais,
          total_itens,
          itens_concluidos,
          itens_problemas,
          percentual_conclusao,
          status: percentual_conclusao === 100 ? 'completo' : 'parcial',
        },
        {
          onConflict: 'bar_id, data',
        }
      )
      .select()
      .single();

    if (checklistError) {
      console.error('Erro ao salvar checklist:', checklistError);
      return NextResponse.json(
        { error: 'Erro ao salvar checklist' },
        { status: 500 }
      );
    }

    // Remover itens antigos se existirem
    await supabase
      .from('checklist_abertura_itens')
      .delete()
      .eq('checklist_id', checklistData.id);

    // Inserir novos itens
    const itensParaInserir = itens.map((item: ChecklistItem) => ({
      checklist_id: checklistData.id,
      item_id: item.id,
      titulo: item.titulo,
      descricao: item.descricao,
      area: item.area,
      prioridade: item.prioridade,
      tempo_estimado: item.tempo_estimado,
      responsavel: item.responsavel,
      status: item.status,
      observacoes: item.observacoes,
      horario_inicio: item.horario_inicio,
      horario_conclusao: item.horario_conclusao,
      verificado_por: item.verificado_por,
    }));

    const { error: itensError } = await supabase
      .from('checklist_abertura_itens')
      .insert(itensParaInserir);

    if (itensError) {
      console.error('Erro ao salvar itens:', itensError);
      return NextResponse.json(
        { error: 'Erro ao salvar itens do checklist' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Checklist salvo com sucesso',
      data: {
        checklist_id: checklistData.id,
        total_itens,
        itens_concluidos,
        itens_problemas,
        percentual_conclusao,
      },
    });
  } catch (error) {
    console.error('Erro ao processar checklist:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  await authenticateUser(request);
  try {
    const body = await request.json();
    const { checklist_id, item_id, status, observacoes } = body;

    if (!checklist_id || !item_id || !status) {
      return NextResponse.json(
        {
          error: 'checklist_id, item_id e status são obrigatórios',
        },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    const agora = new Date().toISOString();

    // Atualizar item específico
    const { error } = await supabase
      .from('checklist_abertura_itens')
      .update({
        status,
        observacoes,
        horario_inicio: status === 'fazendo' ? agora : undefined,
        horario_conclusao: status === 'concluido' ? agora : undefined,
        verificado_por: status === 'concluido' ? 'Usuario Logado' : undefined, // TODO: pegar do contexto
      })
      .eq('checklist_id', checklist_id)
      .eq('item_id', item_id);

    if (error) {
      console.error('Erro ao atualizar item:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar item' },
        { status: 500 }
      );
    }

    // Recalcular estatísticas do checklist
    const { data: itens, error: itensError } = await supabase
      .from('checklist_abertura_itens')
      .select('status')
      .eq('checklist_id', checklist_id);

    if (!itensError && itens) {
      const total_itens = itens.length;
      const itens_concluidos = itens.filter(
        (item: ChecklistItemStatus) => item.status === 'concluido'
      ).length;
      const itens_problemas = itens.filter(
        (item: ChecklistItemStatus) => item.status === 'problema'
      ).length;
      const percentual_conclusao =
        total_itens > 0 ? (itens_concluidos / total_itens) * 100 : 0;

      await supabase
        .from('checklist_abertura')
        .update({
          total_itens,
          itens_concluidos,
          itens_problemas,
          percentual_conclusao,
          status: percentual_conclusao === 100 ? 'completo' : 'parcial',
        })
        .eq('id', checklist_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Item atualizado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
