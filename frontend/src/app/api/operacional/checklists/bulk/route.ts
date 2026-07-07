import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

// Interfaces TypeScript
interface BulkResult {
  id?: string;
  success: boolean;
  error?: string;
  affected?: number;
}

const supabase = createServiceRoleClient();

export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const { action, checklistIds, data = {} } = await request.json();

    if (
      !action ||
      !checklistIds ||
      !Array.isArray(checklistIds) ||
      checklistIds.length === 0
    ) {
      return NextResponse.json(
        {
          error: 'Ação e IDs dos checklists são obrigatórios',
        },
        { status: 400 }
      );
    }

    const results: BulkResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    switch (action) {
      case 'delete':
        for (const checklistId of checklistIds) {
          try {
            // Verificar se há execuções pendentes
            const { data: execucoes, error: execError } = await supabase
              .from('checklist_execucoes')
              .select('id')
              .eq('checklist_id', checklistId)
              .eq('status', 'em_andamento');

            if (execError) throw execError;

            if (execucoes && execucoes.length > 0) {
              results.push({
                id: checklistId,
                success: false,
                error: 'Checklist possui execuções em andamento',
              });
              errorCount++;
              continue;
            }

            // Deletar checklist
            const { error } = await supabase
              .from('checklists')
              .delete()
              .eq('id', checklistId);

            if (error) throw error;

            results.push({ id: checklistId, success: true });
            successCount++;
          } catch (error) {
            results.push({
              id: checklistId,
              success: false,
              error:
                error instanceof Error ? error.message : 'Erro desconhecido',
            });
            errorCount++;
          }
        }
        break;

      case 'activate':
        try {
          const { error } = await supabase
            .from('checklists')
            .update({ ativo: true, updated_at: new Date().toISOString() })
            .in('id', checklistIds);

          if (error) throw error;

          results.push({ success: true, affected: checklistIds.length });
          successCount = checklistIds.length;
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          errorCount = checklistIds.length;
        }
        break;

      case 'deactivate':
        try {
          const { error } = await supabase
            .from('checklists')
            .update({ ativo: false, updated_at: new Date().toISOString() })
            .in('id', checklistIds);

          if (error) throw error;

          results.push({ success: true, affected: checklistIds.length });
          successCount = checklistIds.length;
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          errorCount = checklistIds.length;
        }
        break;

      case 'duplicate':
        for (const checklistId of checklistIds) {
          try {
            // Buscar checklist original
            const { data: originalChecklist, error: fetchError } =
              await supabase
                .from('checklists')
                .select(
                  `
                nome,
                descricao,
                tipo,
                bar_id,
                agendamento_config,
                checklist_items (
                  nome,
                  descricao,
                  tipo,
                  obrigatorio,
                  ordem,
                  opcoes
                )
              `
                )
                .eq('id', checklistId)
                .single();

            if (fetchError) throw fetchError;

            if (!originalChecklist) {
              results.push({
                id: checklistId,
                success: false,
                error: 'Checklist não encontrado',
              });
              errorCount++;
              continue;
            }

            // Criar novo checklist
            const { data: newChecklist, error: createError } = await supabase
              .from('checklists')
              .insert({
                nome: `${originalChecklist.nome} (Cópia)`,
                descricao: originalChecklist.descricao,
                tipo: originalChecklist.tipo,
                bar_id: originalChecklist.bar_id,
                agendamento_config: originalChecklist.agendamento_config,
                ativo: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (createError) throw createError;

            // Duplicar itens do checklist
            if (
              originalChecklist.checklist_items &&
              originalChecklist.checklist_items.length > 0
            ) {
              const newItems = originalChecklist.checklist_items.map(
                (item: any) => ({
                  checklist_id: newChecklist.id,
                  nome: item.nome,
                  descricao: item.descricao,
                  tipo: item.tipo,
                  obrigatorio: item.obrigatorio,
                  ordem: item.ordem,
                  opcoes: item.opcoes,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
              );

              const { error: itemsError } = await supabase
                .from('checklist_items')
                .insert(newItems);

              if (itemsError) throw itemsError;
            }

            results.push({ id: checklistId, success: true });
            successCount++;
          } catch (error) {
            results.push({
              id: checklistId,
              success: false,
              error:
                error instanceof Error ? error.message : 'Erro desconhecido',
            });
            errorCount++;
          }
        }
        break;

      case 'update':
        try {
          const { error } = await supabase
            .from('checklists')
            .update({
              ...data,
              updated_at: new Date().toISOString(),
            })
            .in('id', checklistIds);

          if (error) throw error;

          results.push({ success: true, affected: checklistIds.length });
          successCount = checklistIds.length;
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          errorCount = checklistIds.length;
        }
        break;

      default:
        return NextResponse.json(
          {
            error: 'Ação não suportada',
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Operação concluída: ${successCount} sucessos, ${errorCount} erros`,
      data: {
        total: checklistIds.length,
        successCount,
        errorCount,
        results,
      },
    });
  } catch (error) {
    console.error('❌ Erro na operação bulk:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data: checklists, error } = await supabase
      .from('checklists')
      .select(
        `
        id,
        nome,
        tipo,
        ativo,
        created_at,
        updated_at,
        checklist_items (id)
      `
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    const checklistsWithCount =
      checklists?.map(checklist => ({
        ...checklist,
        items_count: checklist.checklist_items?.length || 0,
      })) || [];

    return NextResponse.json({
      success: true,
      data: checklistsWithCount,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar checklists:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
