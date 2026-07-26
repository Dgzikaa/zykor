import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse , permissionErrorResponse } from '@/middleware/auth';
import { safeErrorLog, isExpectedError } from '@/lib/logger';

export const dynamic = 'force-dynamic'

// ========================================
// 🏆 API PARA BADGES E NOTIFICAÇÕES
// ========================================

interface BadgeRequest {
  bar_id: string;
  user_id: string;
}

interface Badges {
  home: number;
  checklist: number;
  producao: number;
  marketing: number;
  visaoGeral: number;
  configuracoes: number;
  notifications: number;
  relatorios: number;
  financeiro: number;
}

interface BadgeSummary {
  total_issues: number;
  critical_issues: number;
  pending_tasks: number;
}

interface ApiError {
  message: string;
}

// ========================================
// 🏆 POST /api/badges
// ========================================

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }
    if ((user.role as string) !== 'admin') return permissionErrorResponse('Somente admin');

    const body = (await request.json()) as BadgeRequest;
    const { bar_id, user_id } = body;

    if (!bar_id || !user_id) {
      return NextResponse.json(
        { error: 'bar_id e user_id são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // 🎯 BUSCAR TODOS OS DADOS EM UMA SÓ CONSULTA
    const badges: Badges = {
      home: 0,
      checklist: 0,
      producao: 0,
      marketing: 0,
      visaoGeral: 0,
      configuracoes: 0,
      notifications: 0,
      relatorios: 0,
      financeiro: 0,
    };

    try {
      // Executar queries em paralelo com tratamento de erro individual
      const queries = [
        // 1. CHECKLISTS - checklist_agendamentos (checklist_execucoes removida)
        supabase
          .from('checklist_agendamentos')
          .select('id')
          .eq('bar_id', bar_id),

        // 2. PRODUÇÕES PENDENTES
        supabase
          .from('producoes')
          .select('id')
          .eq('bar_id', bar_id)
          .in('status', ['pendente', 'em_andamento']),

        // 3. NOTIFICAÇÕES NÃO LIDAS
        supabase
          .from('notificacoes')
          .select('id')
          .eq('bar_id', bar_id)
          .eq('lida', false),

        // 4. ALERTAS DO SISTEMA
        supabase
          .from('sistema_alertas')
          .select('id')
          .eq('bar_id', bar_id)
          .is('resolvido_em', null),

        // 5. MARKETING - Posts recentes
        supabase
          .from('instagram_posts')
          .select('id')
          .eq('bar_id', bar_id)
          .gte(
            'created_at',
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          ),

        // 6. CONFIGURAÇÕES - Para admins apenas
        user.role === 'admin'
          ? supabase
              .from('integracoes_config')
              .select('id')
              .eq('bar_id', bar_id)
              .eq('ativo', false)
          : Promise.resolve({ data: null, error: null }),
      ];

      const results = await Promise.allSettled(queries);

      if (results[0].status === 'fulfilled' && results[0].value?.data) {
        badges.checklist = (results[0].value.data as any[])?.length ?? 0;
      }

      if (results[1].status === 'fulfilled' && results[1].value?.data) {
        badges.producao = results[1].value.data.length || 0;
      }

      if (results[2].status === 'fulfilled' && results[2].value?.data) {
        badges.notifications = results[2].value.data.length || 0;
      }

      if (results[3].status === 'fulfilled' && results[3].value?.data) {
        badges.visaoGeral = results[3].value.data.length || 0;
      }

      if (results[4].status === 'fulfilled' && results[4].value?.data) {
        badges.marketing = results[4].value.data.length || 0;
      }

      if (results[5].status === 'fulfilled' && results[5].value?.data) {
        badges.configuracoes = results[5].value.data.length || 0;
      }

      // 7. HOME - Resumo geral
      badges.home = badges.checklist + badges.notifications + badges.visaoGeral;

      // 8. RELATÓRIOS - Alertas críticos
      badges.relatorios = badges.visaoGeral;

      // 9. FINANCEIRO - Por enquanto 0, pode ser implementado depois
      badges.financeiro = 0;
    } catch (queryError: unknown) {
      // 🔇 Usa safeErrorLog para ignorar erros esperados (ECONNRESET, etc.)
      safeErrorLog('queries de badges', queryError);
      // Continuar com badges zerados em caso de erro
    }

    const summary: BadgeSummary = {
      total_issues: Object.values(badges).reduce(
        (sum: number, count: number) => sum + count,
        0
      ),
      critical_issues: badges.visaoGeral,
      pending_tasks: badges.checklist + badges.producao,
    };

    return NextResponse.json({
      success: true,
      badges,
      summary,
    });
  } catch (error: unknown) {
    // 🔇 Ignora erros esperados (conexão cancelada quando usuário navega)
    if (!isExpectedError(error)) {
      safeErrorLog('API badges consolidada', error);
    }

    // Retornar badges zerados em caso de erro
    return NextResponse.json({
      success: true,
      badges: {
        checklist: 0,
        producao: 0,
        marketing: 0,
        configuracoes: 0,
        notifications: 0,
        home: 0,
        visaoGeral: 0,
        relatorios: 0,
        financeiro: 0,
      },
      summary: {
        total_issues: 0,
        critical_issues: 0,
        pending_tasks: 0,
      },
    });
  }
}

// ========================================
// 🏆 GET /api/badges
// ========================================

export async function GET(request: NextRequest) {
  return POST(request);
}
