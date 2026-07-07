import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

// =====================================================
// 📋 API PARA COPIAR ITENS ENTRE CHECKLISTS
// =====================================================

export async function POST(req: NextRequest) {
  await authenticateUser(req);
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { targetChecklistId, items } = await req.json();

    if (!targetChecklistId || !items || !Array.isArray(items)) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
        },
        { status: 400 }
      );
    }

    // Verificar se o checklist de destino existe e pertence ao usuário
    const { data: targetChecklist, error: checklistError } = await supabase
      .from('checklists')
      .select('id, titulo, user_id, total_itens')
      .eq('id', targetChecklistId)
      .eq('user_id', user.id)
      .single();

    if (checklistError || !targetChecklist) {
      return NextResponse.json(
        {
          error: 'Checklist de destino não encontrado',
        },
        { status: 404 }
      );
    }

    // Obter a próxima ordem disponível no checklist de destino
    const { data: lastItem } = await supabase
      .from('checklist_items')
      .select('ordem')
      .eq('checklist_id', targetChecklistId)
      .order('ordem', { ascending: false })
      .limit(1)
      .single();

    let nextOrder = lastItem?.ordem ? lastItem.ordem + 1 : 1;

    // Preparar itens para inserção
    const itemsToInsert = items.map(item => ({
      checklist_id: targetChecklistId,
      titulo: item.titulo,
      tipo: item.tipo,
      obrigatorio: item.obrigatorio,
      secao: item.secao || null,
      placeholder: item.placeholder || null,
      descricao: item.descricao || null,
      ordem: nextOrder++,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Inserir itens
    const { data: insertedItems, error: insertError } = await supabase
      .from('checklist_items')
      .insert(itemsToInsert)
      .select();

    if (insertError) {
      console.error('Erro ao inserir itens:', insertError);
      return NextResponse.json(
        {
          error: 'Erro ao copiar itens',
        },
        { status: 500 }
      );
    }

    // Atualizar estatísticas do checklist de destino
    const { error: updateError } = await supabase
      .from('checklists')
      .update({
        total_itens: (targetChecklist.total_itens || 0) + itemsToInsert.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetChecklistId);

    if (updateError) {
      console.error('Erro ao atualizar estatísticas:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: `${itemsToInsert.length} itens copiados com sucesso`,
      targetChecklist: targetChecklist.titulo,
      copiedItems: insertedItems.length,
      items: insertedItems,
    });
  } catch (error) {
    console.error('Erro ao copiar itens:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
