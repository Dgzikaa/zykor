import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { action, userIds, data = {} } = await request.json();

    if (
      !action ||
      !userIds ||
      !Array.isArray(userIds) ||
      userIds.length === 0
    ) {
      return NextResponse.json(
        {
          error: 'Ação e IDs dos usuários são obrigatórios',
        },
        { status: 400 }
      );
    }

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Executar ação em lote
    switch (action) {
      case 'delete':
        for (const userId of userIds) {
          try {
            const { error } = await supabase
              .from('usuarios_bar')
              .delete()
              .eq('id', userId);

            if (error) throw error;

            results.push({ id: userId, success: true });
            successCount++;
          } catch (error) {
            results.push({
              id: userId,
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
            .from('usuarios_bar')
            .update({ ativo: true, updated_at: new Date().toISOString() })
            .in('id', userIds);

          if (error) throw error;

          results.push({ success: true, affected: userIds.length });
          successCount = userIds.length;
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          errorCount = userIds.length;
        }
        break;

      case 'deactivate':
        try {
          const { error } = await supabase
            .from('usuarios_bar')
            .update({ ativo: false, updated_at: new Date().toISOString() })
            .in('id', userIds);

          if (error) throw error;

          results.push({ success: true, affected: userIds.length });
          successCount = userIds.length;
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          errorCount = userIds.length;
        }
        break;

      case 'update_role':
        if (!data.role) {
          return NextResponse.json(
            {
              error: 'Papel (role) é obrigatório para esta ação',
            },
            { status: 400 }
          );
        }

        try {
          const { error } = await supabase
            .from('usuarios_bar')
            .update({
              role: data.role,
              updated_at: new Date().toISOString(),
            })
            .in('id', userIds);

          if (error) throw error;

          results.push({ success: true, affected: userIds.length });
          successCount = userIds.length;
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          errorCount = userIds.length;
        }
        break;

      case 'update_bar':
        if (!data.bar_id) {
          return NextResponse.json(
            {
              error: 'ID do bar é obrigatório para esta ação',
            },
            { status: 400 }
          );
        }

        try {
          const { error } = await supabase
            .from('usuarios_bar')
            .update({
              bar_id: data.bar_id,
              updated_at: new Date().toISOString(),
            })
            .in('id', userIds);

          if (error) throw error;

          results.push({ success: true, affected: userIds.length });
          successCount = userIds.length;
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          errorCount = userIds.length;
        }
        break;

      case 'export':
        try {
          const { data: users, error } = await supabase
            .from('usuarios_bar')
            .select(
              `
              id,
              nome,
              email,
              role,
              ativo,
              criado_em,
              bars (nome)
            `
            )
            .in('id', userIds);

          if (error) throw error;

          // Preparar dados para exportação
          const exportData = users.map(user => ({
            ID: user.id,
            Nome: user.nome,
            Email: user.email,
            Papel: user.role,
            Ativo: user.ativo ? 'Sim' : 'Não',
            Bar: user.bars?.[0]?.nome || 'N/A',
            'Criado em': new Date(user.criado_em).toLocaleDateString('pt-BR'),
          }));

          return NextResponse.json({
            success: true,
            data: exportData,
            filename: `usuarios_${new Date().toISOString().split('T')[0]}.csv`,
          });
        } catch (error) {
          return NextResponse.json(
            {
              error:
                error instanceof Error ? error.message : 'Erro ao exportar',
            },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          {
            error: `Ação '${action}' não suportada`,
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: userIds.length,
        success: successCount,
        errors: errorCount,
        action,
      },
    });
  } catch (error) {
    console.error('Erro na operação em lote:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}

// GET para listar ações disponíveis
export async function GET() {
  return NextResponse.json({
    actions: [
      {
        id: 'delete',
        label: 'Excluir usuários',
        description: 'Remove permanentemente os usuários selecionados',
        requiresConfirmation: true,
        destructive: true,
      },
      {
        id: 'activate',
        label: 'Ativar usuários',
        description: 'Ativa os usuários selecionados',
        requiresConfirmation: false,
      },
      {
        id: 'deactivate',
        label: 'Desativar usuários',
        description: 'Desativa os usuários selecionados',
        requiresConfirmation: true,
      },
      {
        id: 'update_role',
        label: 'Alterar papel',
        description: 'Altera o papel dos usuários selecionados',
        requiresData: ['role'],
        requiresConfirmation: true,
      },
      {
        id: 'update_bar',
        label: 'Alterar bar',
        description: 'Altera o bar dos usuários selecionados',
        requiresData: ['bar_id'],
        requiresConfirmation: true,
      },
      {
        id: 'export',
        label: 'Exportar usuários',
        description: 'Exporta dados dos usuários selecionados',
        requiresConfirmation: false,
      },
    ],
  });
}
